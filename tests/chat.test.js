const request = require('supertest');
const express = require('express');
const chatRouter = require('../routes/chat');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/chat', chatRouter);

describe('Chat API Scheduling', () => {
  test('should format scheduled date in short format', async () => {
    // Get a future date for testing (tomorrow at noon)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    
    const testDate = tomorrow.toISOString().slice(0, 16).replace('T', ' ');
    
    // First init a session
    const initResponse = await request(app)
      .post('/api/chat/init')
      .send({});
    
    const deviceId = initResponse.body.deviceId;
    
    // Navigate to scheduling state
    await request(app)
      .post('/api/chat/message')
      .send({
        deviceId,
        message: '99' // Checkout
      });
    
    await request(app)
      .post('/api/chat/message')
      .send({
        deviceId,
        message: '1' // Schedule order
      });
    
    // Submit the schedule date
    const response = await request(app)
      .post('/api/chat/message')
      .send({
        deviceId,
        message: testDate
      });
    
    // Verify response format
    expect(response.body.message).toMatch(/✅ Order scheduled for [A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}/);
    expect(response.body.requiresPayment).toBe(true);
  });
});