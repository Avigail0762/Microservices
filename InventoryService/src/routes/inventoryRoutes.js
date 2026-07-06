const express = require('express');
const router = express.Router();
const ticketService = require('../services/ticketService');
const { requireInternalSecret } = require('../middleware/auth');

// POST /api/inventory/tickets  — called by OrderService after a purchase
router.post('/tickets', requireInternalSecret, async (req, res) => {
  try {
    const ticket = await ticketService.registerTicket(req.body);
    res.status(201).json(ticket);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
