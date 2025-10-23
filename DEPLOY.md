# Restaurant Chatbot - Deployment Guide

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- NPM or Yarn package manager

## Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Update the environment variables in `.env`:
   - `PORT`: Server port (default: 3000)
   - `DATABASE_URL`: PostgreSQL connection string
   - `PAYSTACK_SECRET_KEY`: Your Paystack secret key
   - `PAYSTACK_PUBLIC_KEY`: Your Paystack public key
   - `BASE_URL`: Your production URL
   - `NODE_ENV`: Set to 'production'

## Database Setup

1. Create a PostgreSQL database:
   ```sql
   CREATE DATABASE restaurantchatbot;
   ```

2. Initialize the database:
   ```bash
   node initDb.js
   ```

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the application (if needed):
   ```bash
   npm run build
   ```

## Running in Production

1. Start the server:
   ```bash
   npm start
   ```

   Or using PM2 (recommended):
   ```bash
   npm install -g pm2
   pm2 start server.js --name restaurantchatbot
   ```

## Health Check

- The application provides a health check endpoint at `/health`
- Use this to verify the application is running correctly

## Monitoring

- Use PM2 for process management and monitoring:
  ```bash
  pm2 monit restaurantchatbot
  ```

## Troubleshooting

1. If the server won't start:
   - Check if the port is already in use
   - Verify database connection string
   - Ensure all environment variables are set

2. Database connection issues:
   - Verify PostgreSQL is running
   - Check database credentials
   - Ensure database exists and is accessible

3. Payment integration:
   - Verify Paystack API keys
   - Check webhook configurations

## Backup & Recovery

1. Database backup:
   ```bash
   pg_dump restaurantchatbot > backup.sql
   ```

2. Restore from backup:
   ```bash
   psql restaurantchatbot < backup.sql
   ```

## Security Considerations

- Keep `.env` file secure and never commit it to version control
- Regularly update dependencies for security patches
- Use HTTPS in production
- Set secure PostgreSQL password
- Properly configure firewall rules