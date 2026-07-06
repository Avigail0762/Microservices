const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { getOrderDetails } = require('../services/orderDetailsService');

const router = express.Router();

router.get('/user/:userId/order-details', verifyToken, async (req, res) => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  try {
    const data = await getOrderDetails(userId, req.headers.authorization || '');
    return res.json(data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data || { message: error.message || 'Aggregation failed' };
    return res.status(status).json(message);
  }
});

module.exports = router;
