const express = require('express');
const router = express.Router();
const lotteryService = require('../services/lotteryService');
const { verifyToken, requireRole } = require('../middleware/auth');

// POST /api/lottery/draw/:giftId
router.post('/draw/:giftId', verifyToken, requireRole('manager'), async (req, res) => {
  try {
    const winner = await lotteryService.doLottery(Number(req.params.giftId));
    res.json(winner);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/lottery/winners
router.get('/winners', verifyToken, requireRole('manager'), async (req, res) => {
  const winners = await lotteryService.getWinnersReport();
  if (!winners.length) return res.status(204).send();
  res.json(winners);
});

// GET /api/lottery/total-income
router.get('/total-income', verifyToken, requireRole('manager'), async (req, res) => {
  const total = await lotteryService.getTotalIncome();
  res.json(total);
});

module.exports = router;
