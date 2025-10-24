require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Database configuration with SSL for production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Database initialization function
async function initializeDatabase() {
  console.log('Starting database initialization...');
  const client = await pool.connect();
  
  try {
    console.log('Connected to database. Creating tables...');
    await client.query('BEGIN');

    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        current_state VARCHAR(50) DEFAULT 'main_menu',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create menu_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100),
        available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create current_orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS current_orders (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        menu_item_id INTEGER REFERENCES menu_items(id),
        quantity INTEGER DEFAULT 1,
        price DECIMAL(10, 2) NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES sessions(device_id) ON DELETE CASCADE
      )
    `);

    // Create placed_orders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS placed_orders (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_reference VARCHAR(255),
        scheduled_for TIMESTAMP,
        status VARCHAR(50) DEFAULT 'placed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES sessions(device_id) ON DELETE CASCADE
      )
    `);

    // Create order_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES placed_orders(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id),
        quantity INTEGER NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        item_name VARCHAR(255) NOT NULL
      )
    `);

    // Insert sample menu items
    await client.query(`
      INSERT INTO menu_items (name, description, price, category) VALUES
      ('Jollof Rice', 'Delicious Nigerian Jollof rice with chicken', 2500.00, 'Main Course'),
      ('Fried Rice', 'Tasty fried rice with vegetables and chicken', 2300.00, 'Main Course'),
      ('Pounded Yam & Egusi', 'Fresh pounded yam with rich Egusi soup', 3000.00, 'Main Course'),
      ('Pepper Soup', 'Spicy Nigerian pepper soup (Fish/Goat)', 1800.00, 'Soup'),
      ('Grilled Chicken', 'Perfectly grilled chicken with spices', 3500.00, 'Protein'),
      ('Beef Suya', 'Spicy grilled beef suya', 2000.00, 'Protein'),
      ('Chapman', 'Refreshing Chapman drink', 800.00, 'Drinks'),
      ('Zobo', 'Traditional Zobo drink', 500.00, 'Drinks'),
      ('Moi Moi', 'Steamed bean pudding', 600.00, 'Sides'),
      ('Plantain', 'Fried ripe plantain', 500.00, 'Sides')
      ON CONFLICT DO NOTHING
    `);

    await client.query('COMMIT');
    console.log('Database initialization completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during database initialization:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Load routes
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payment');

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/payment', paymentRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.json({ status: 'ok', timestamp: result.rows[0].now });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Application error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// Start server function
async function startServer() {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Then start the server
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Environment:', process.env.NODE_ENV);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Start the application
startServer();