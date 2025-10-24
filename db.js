require('dotenv').config();

const connectionString = process.env.DATABASE_URL
const sql = postgres(connectionString)

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Wrapper for getting a client with error handling and retries
const getClient = async (retries = 3) => {
  while (retries > 0) {
    try {
      return await pool.connect();
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.error('Database connection failed, retrying...', err);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

// Session management
const getOrCreateSession = async (deviceId) => {
  const client = await getClient();
  try {
    let result = await client.query(
      'SELECT * FROM sessions WHERE device_id = $1',
      [deviceId]
    );

    if (result.rows.length === 0) {
      result = await client.query(
        'INSERT INTO sessions (device_id) VALUES ($1) RETURNING *',
        [deviceId]
      );
    } else {
      await client.query(
        'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE device_id = $1',
        [deviceId]
      );
    }

    return result.rows[0];
  } catch (err) {
    console.error('Error in getOrCreateSession:', err);
    throw err;
  } finally {
    client.release();
  }
};

const updateSessionState = async (deviceId, state) => {
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE sessions SET current_state = $1, last_activity = CURRENT_TIMESTAMP WHERE device_id = $2',
      [state, deviceId]
    );
  } finally {
    client.release();
  }
};

// Menu items
const getMenuItems = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM menu_items WHERE available = true ORDER BY category, id'
    );
    return result.rows;
  } finally {
    client.release();
  }
};

const getMenuItemById = async (id) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT * FROM menu_items WHERE id = $1 AND available = true',
      [id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
};

// Current order (cart)
const addToCurrentOrder = async (deviceId, menuItemId, quantity = 1) => {
  const client = await pool.connect();
  try {
    const menuItem = await getMenuItemById(menuItemId);
    if (!menuItem) return null;

    // Check if item already in cart
    const existing = await client.query(
      'SELECT * FROM current_orders WHERE device_id = $1 AND menu_item_id = $2',
      [deviceId, menuItemId]
    );

    if (existing.rows.length > 0) {
      // Update quantity
      const result = await client.query(
        'UPDATE current_orders SET quantity = quantity + $1 WHERE device_id = $2 AND menu_item_id = $3 RETURNING *',
        [quantity, deviceId, menuItemId]
      );
      return result.rows[0];
    } else {
      // Insert new item
      const result = await client.query(
        'INSERT INTO current_orders (device_id, menu_item_id, quantity, price) VALUES ($1, $2, $3, $4) RETURNING *',
        [deviceId, menuItemId, quantity, menuItem.price]
      );
      return result.rows[0];
    }
  } finally {
    client.release();
  }
};

const getCurrentOrder = async (deviceId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT co.*, mi.name, mi.description, mi.category 
       FROM current_orders co
       JOIN menu_items mi ON co.menu_item_id = mi.id
       WHERE co.device_id = $1`,
      [deviceId]
    );
    return result.rows;
  } finally {
    client.release();
  }
};

const clearCurrentOrder = async (deviceId) => {
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM current_orders WHERE device_id = $1', [deviceId]);
  } finally {
    client.release();
  }
};

// Placed orders
const placeOrder = async (deviceId, scheduledFor = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentOrder = await getCurrentOrder(deviceId);
    if (currentOrder.length === 0) return null;

    const totalAmount = currentOrder.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );

    const orderResult = await client.query(
      `INSERT INTO placed_orders (device_id, total_amount, scheduled_for) 
       VALUES ($1, $2, $3) RETURNING *`,
      [deviceId, totalAmount, scheduledFor]
    );

    const orderId = orderResult.rows[0].id;

    for (const item of currentOrder) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, price, item_name) 
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.menu_item_id, item.quantity, item.price, item.name]
      );
    }

    await clearCurrentOrder(deviceId);
    await client.query('COMMIT');

    return orderResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const getOrderHistory = async (deviceId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT po.*, 
        json_agg(json_build_object(
          'item_name', oi.item_name,
          'quantity', oi.quantity,
          'price', oi.price
        )) as items
       FROM placed_orders po
       LEFT JOIN order_items oi ON po.id = oi.order_id
       WHERE po.device_id = $1
       GROUP BY po.id
       ORDER BY po.created_at DESC`,
      [deviceId]
    );
    return result.rows;
  } finally {
    client.release();
  }
};

const updateOrderPayment = async (orderId, reference, status = 'paid') => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE placed_orders 
       SET payment_status = $1, payment_reference = $2 
       WHERE id = $3 RETURNING *`,
      [status, reference, orderId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
};

const getOrderById = async (orderId) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT po.*, 
        json_agg(json_build_object(
          'item_name', oi.item_name,
          'quantity', oi.quantity,
          'price', oi.price
        )) as items
       FROM placed_orders po
       LEFT JOIN order_items oi ON po.id = oi.order_id
       WHERE po.id = $1
       GROUP BY po.id`,
      [orderId]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  getOrCreateSession,
  updateSessionState,
  getMenuItems,
  getMenuItemById,
  addToCurrentOrder,
  getCurrentOrder,
  clearCurrentOrder,
  placeOrder,
  getOrderHistory,
  updateOrderPayment,
  getOrderById,
};