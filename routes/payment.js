const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BASE_URL = process.env.BASE_URL;

// Initialize payment
router.post('/initialize', async (req, res) => {
  try {
    const { orderId, email, deviceId } = req.body;
    
    if (!orderId || !email) {
      return res.status(400).json({ error: 'Order ID and email are required' });
    }
    
    const order = await db.getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.payment_status === 'paid') {
      return res.status(400).json({ error: 'Order already paid' });
    }
    
    // Initialize Paystack payment
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: email,
        amount: Math.round(parseFloat(order.total_amount) * 100), // Convert to kobo
        reference: `ORDER-${orderId}-${Date.now()}`,
        callback_url: `${BASE_URL}/payment-callback.html`,
        metadata: {
          order_id: orderId,
          device_id: deviceId,
          custom_fields: [
            {
              display_name: "Order ID",
              variable_name: "order_id",
              value: orderId
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    res.json({
      success: true,
      authorization_url: response.data.data.authorization_url,
      access_code: response.data.data.access_code,
      reference: response.data.data.reference
    });
    
  } catch (error) {
    console.error('Payment initialization error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to initialize payment',
      details: error.response?.data?.message || error.message
    });
  }
});

// Verify payment
router.get('/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );
    
    const paymentData = response.data.data;
    
    if (paymentData.status === 'success') {
      const orderId = paymentData.metadata.order_id;
      
      // Update order payment status
      await db.updateOrderPayment(orderId, reference, 'paid');
      
      // Reset session state
      const deviceId = paymentData.metadata.device_id;
      if (deviceId) {
        await db.updateSessionState(deviceId, 'main_menu');
      }
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        order_id: orderId,
        amount: paymentData.amount / 100,
        reference: reference
      });
    } else {
      res.json({
        success: false,
        message: 'Payment verification failed',
        status: paymentData.status
      });
    }
    
  } catch (error) {
    console.error('Payment verification error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to verify payment',
      details: error.response?.data?.message || error.message
    });
  }
});

// Webhook for Paystack (optional but recommended for production)
router.post('/webhook', async (req, res) => {
  try {
    const hash = require('crypto')
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');
      
    if (hash === req.headers['x-paystack-signature']) {
      const event = req.body;
      
      if (event.event === 'charge.success') {
        const orderId = event.data.metadata.order_id;
        const reference = event.data.reference;
        
        await db.updateOrderPayment(orderId, reference, 'paid');
        
        console.log(`Payment confirmed for order ${orderId}`);
      }
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;