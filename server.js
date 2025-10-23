require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  if (!err.isOperational) {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Initialize database pool with better connection handling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Database health check
app.get('/health', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    res.json({ 
      status: 'ok',
      timestamp: result.rows[0].now 
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ 
      status: 'error',
      message: err.message
    });
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/payment', paymentRoutes);

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

const startServer = () => {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Attempting database connection...');
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      console.log('Database connected successfully:', result.rows[0].now);
      client.release();

      const server = app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log('Ready for connections');
        
        // Keep the process running indefinitely
        setInterval(() => {
          // Periodic health check
          pool.query('SELECT 1').catch(err => {
            console.error('Database health check failed:', err);
          });
        }, 30000);
      });

      server.on('error', (err) => {
        console.error('Server error:', err);
        if (err.code === 'EADDRINUSE') {
          console.error(`Port ${PORT} is already in use`);
        }
        reject(err);
      });

      resolve(server);
    } catch (err) {
      console.error('Failed to start server:', err);
      reject(err);
    }
  });
};

// Start the server
startServer().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});