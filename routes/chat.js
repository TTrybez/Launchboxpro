const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Main menu options
const getMainMenu = () => {
  return `Welcome to our Restaurant! 🍽️

Please select an option:
1️⃣ Place an order
9️⃣9️⃣ Checkout order
9️⃣8️⃣ See order history
9️⃣7️⃣ See current order
0️⃣ Cancel order

Enter your choice (1, 99, 98, 97, or 0):`;
};

// Format menu items
const formatMenuItems = (items) => {
  let message = '📋 Our Menu:\n\n';
  let currentCategory = '';
  
  items.forEach((item, index) => {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      message += `\n--- ${currentCategory.toUpperCase()} ---\n`;
    }
    message += `${item.id}. ${item.name} - ₦${parseFloat(item.price).toLocaleString()}\n`;
    message += `   ${item.description}\n\n`;
  });
  
  message += '\nEnter the item number to add to cart, or 0 to return to main menu:';
  return message;
};

// Short, user-friendly date/time formatter
const formatShortDateTime = (dateInput) => {
  const d = new Date(dateInput);
  if (isNaN(d)) return '';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Format current order
const formatCurrentOrder = (order) => {
  if (order.length === 0) {
    return 'Your cart is empty. Select 1 from main menu to start ordering.';
  }
  
  let message = '🛒 Your Current Order:\n\n';
  let total = 0;
  
  order.forEach((item, index) => {
    const itemTotal = parseFloat(item.price) * item.quantity;
    total += itemTotal;
    message += `${index + 1}. ${item.name} x${item.quantity} - ₦${itemTotal.toLocaleString()}\n`;
  });
  
  message += `\n💰 Total: ₦${total.toLocaleString()}\n\n`;
  message += 'Options:\n99 - Checkout\n0 - Return to main menu';
  
  return message;
};

// Format order history
const formatOrderHistory = (orders) => {
  if (orders.length === 0) {
    return 'You have no order history yet.';
  }
  
  let message = '📜 Your Order History:\n\n';
  
  orders.forEach((order, index) => {
    const date = formatShortDateTime(order.created_at);
    message += `Order #${order.id} - ${date}\n`;
    message += `Status: ${order.payment_status.toUpperCase()}\n`;
    
    if (order.items && order.items[0]) {
      order.items.forEach(item => {
        if (item.item_name) {
          message += `  • ${item.item_name} x${item.quantity} - ₦${(parseFloat(item.price) * item.quantity).toLocaleString()}\n`;
        }
      });
    }
    
    message += `Total: ₦${parseFloat(order.total_amount).toLocaleString()}\n`;
    
    if (order.scheduled_for) {
      message += `Scheduled for: ${formatShortDateTime(order.scheduled_for)}\n`;
    }
    
    message += '\n';
  });
  
  message += 'Enter 0 to return to main menu:';
  return message;
};

// Validate numeric input
const isValidNumber = (input) => {
  return /^\d+$/.test(input);
};

// Initialize or get session
router.post('/init', async (req, res) => {
  try {
    let { deviceId } = req.body;
    
    if (!deviceId) {
      deviceId = uuidv4();
    }
    
    const session = await db.getOrCreateSession(deviceId);
    
    res.json({
      deviceId: session.device_id,
      message: getMainMenu(),
      state: 'main_menu'
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ error: 'Failed to initialize session' });
  }
});

// Process message
router.post('/message', async (req, res) => {
  try {
    const { deviceId, message } = req.body;
    
    if (!deviceId || message === undefined || message === null) {
      return res.status(400).json({ error: 'Device ID and message are required' });
    }
    
    const userInput = message.toString().trim();
    
    const session = await db.getOrCreateSession(deviceId);
    const currentState = session.current_state;
    console.log('DEBUG: incoming=', userInput, 'currentState=', currentState);
    
    // Validate numeric input only in states that expect numeric commands
    const numericStates = ['main_menu','ordering','viewing_cart','viewing_history','checkout_options'];
    if (numericStates.includes(currentState) && !isValidNumber(userInput)) {
      return res.json({
        message: '⚠️ Invalid input. Please enter a number.\n\n' + getMainMenu(),
        state: 'main_menu'
      });
    }
    
    let responseMessage = '';
    let newState = currentState;
    
    // Handle based on current state
    if (currentState === 'main_menu') {
      switch (userInput) {
        case '1': // Place order
          const menuItems = await db.getMenuItems();
          responseMessage = formatMenuItems(menuItems);
          newState = 'ordering';
          break;
          
        case '99': // Checkout
          const currentOrder = await db.getCurrentOrder(deviceId);
          if (currentOrder.length === 0) {
            responseMessage = 'No order to place. Select 1 to start ordering.\n\n' + getMainMenu();
          } else {
            responseMessage = formatCurrentOrder(currentOrder);
            responseMessage += '\n\nWould you like to:\n1 - Schedule this order\n2 - Pay now\n0 - Cancel';
            newState = 'checkout_options';
          }
          break;
          
        case '98': // Order history
          const history = await db.getOrderHistory(deviceId);
          responseMessage = formatOrderHistory(history);
          newState = 'viewing_history';
          break;
          
        case '97': // Current order
          const cart = await db.getCurrentOrder(deviceId);
          responseMessage = formatCurrentOrder(cart);
          newState = 'viewing_cart';
          break;
          
        case '0': // Cancel order
          await db.clearCurrentOrder(deviceId);
          responseMessage = 'Order cancelled successfully.\n\n' + getMainMenu();
          break;
          
        default:
          responseMessage = '⚠️ Invalid option. Please try again.\n\n' + getMainMenu();
      }
    } else if (currentState === 'ordering') {
      if (userInput === '0') {
        responseMessage = getMainMenu();
        newState = 'main_menu';
      } else {
        const itemId = parseInt(userInput);
        const item = await db.getMenuItemById(itemId);
        
        if (item) {
          await db.addToCurrentOrder(deviceId, itemId);
          responseMessage = `✅ ${item.name} added to cart!\n\nContinue ordering or enter 0 for main menu:`;
          const menuItems = await db.getMenuItems();
          responseMessage += '\n\n' + formatMenuItems(menuItems);
        } else {
          responseMessage = '⚠️ Invalid item number. Please try again.\n\n';
          const menuItems = await db.getMenuItems();
          responseMessage += formatMenuItems(menuItems);
        }
      }
    } else if (currentState === 'viewing_cart' || currentState === 'viewing_history') {
      if (userInput === '0') {
        responseMessage = getMainMenu();
        newState = 'main_menu';
      } else if (userInput === '99' && currentState === 'viewing_cart') {
        responseMessage = 'Would you like to:\n1 - Schedule this order\n2 - Pay now\n0 - Cancel';
        newState = 'checkout_options';
      } else {
        responseMessage = '⚠️ Invalid option.\n\n' + getMainMenu();
        newState = 'main_menu';
      }
    } else if (currentState === 'checkout_options') {
      if (userInput === '0') {
        responseMessage = getMainMenu();
        newState = 'main_menu';
      } else if (userInput === '1') {
    responseMessage = 'Enter date & time (YYYY-MM-DD HH:MM):\nOr enter 0 to cancel:';
        newState = 'scheduling';
      } else if (userInput === '2') {
        const order = await db.placeOrder(deviceId);
        if (order) {
          responseMessage = `Order placed! Order ID: ${order.id}\nTotal: ₦${parseFloat(order.total_amount).toLocaleString()}\n\nProceed to payment?`;
          newState = 'payment_pending';
          
          return res.json({
            message: responseMessage,
            state: newState,
            orderId: order.id,
            amount: order.total_amount,
            requiresPayment: true
          });
        } else {
          responseMessage = 'Failed to place order. Please try again.\n\n' + getMainMenu();
          newState = 'main_menu';
        }
      } else {
        responseMessage = '⚠️ Invalid option. Please enter 1, 2, or 0.';
      }
    } else if (currentState === 'scheduling') {
      if (userInput === '0') {
        responseMessage = getMainMenu();
        newState = 'main_menu';
      } else {
        // Simple validation - in production, use proper date parsing
        const datePattern = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/;
        if (datePattern.test(userInput)) {
          const scheduledDate = new Date(userInput);
          if (scheduledDate > new Date()) {
            const order = await db.placeOrder(deviceId, scheduledDate);
            if (order) {
              responseMessage = `✅ Order scheduled for ${formatShortDateTime(scheduledDate)}!\nOrder ID: ${order.id}\n\nProceed to payment?`;
              newState = 'payment_pending';
              
              return res.json({
                message: responseMessage,
                state: newState,
                orderId: order.id,
                amount: order.total_amount,
                requiresPayment: true
              });
            }
          } else {
            responseMessage = '⚠️ Scheduled time must be in the future. Please try again:';
          }
        } else {
          responseMessage = '⚠️ Invalid format. Use YYYY-MM-DD HH:MM:';
        }
      }
    }
    
    await db.updateSessionState(deviceId, newState);
    
    res.json({
      message: responseMessage,
      state: newState
    });
    
  } catch (error) {
    console.error('Message processing error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

module.exports = router;