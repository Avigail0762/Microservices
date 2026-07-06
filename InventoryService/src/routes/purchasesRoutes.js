const express = require('express');
const router = express.Router();
const purchasesService = require('../services/purchasesService');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/purchases/tickets-by-gift/:giftId
router.get('/tickets-by-gift/:giftId', verifyToken, requireRole('manager'), async (req, res) => {
  const tickets = await purchasesService.getTicketsByGiftId(Number(req.params.giftId));
  res.json(tickets);
});

// GET /api/purchases/gifts-by-price
router.get('/gifts-by-price', verifyToken, requireRole('manager'), async (req, res) => {
  const gifts = await purchasesService.getGiftsSortedByPrice();
  res.json(gifts);
});

// GET /api/purchases/gifts-by-buyers
router.get('/gifts-by-buyers', verifyToken, requireRole('manager'), async (req, res) => {
  const gifts = await purchasesService.getGiftsSortedByBuyers();
  res.json(gifts);
});

// GET /api/purchases/buyers-by-gift/:giftId
router.get('/buyers-by-gift/:giftId', verifyToken, requireRole('manager'), async (req, res) => {
  const buyers = await purchasesService.getBuyersByGiftId(Number(req.params.giftId));
  res.json(buyers);
});

module.exports = router;
