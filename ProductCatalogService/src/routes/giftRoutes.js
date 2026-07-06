const express = require('express');
const router = express.Router();
const giftService = require('../services/giftService');
const { verifyToken, requireRole, requireInternalSecret } = require('../middleware/auth');

// GET /api/gift  — anonymous
router.get('/', async (req, res) => {
  const gifts = await giftService.getAll();
  if (!gifts.length) return res.status(204).send();
  res.json(gifts);
});

// GET /api/gift/sorted?ascending=true  — anonymous
router.get('/sorted', async (req, res) => {
  const asc = req.query.ascending !== 'false';
  const gifts = await giftService.getByPrice(asc);
  res.json(gifts);
});

// GET /api/gift/category/:category  — anonymous
router.get('/category/:category', async (req, res) => {
  const gifts = await giftService.getByCategory(req.params.category);
  if (!gifts.length) return res.status(204).send();
  res.json(gifts);
});

// GET /api/gift/name/:name  — anonymous
router.get('/name/:name', async (req, res) => {
  const gift = await giftService.getByName(req.params.name);
  if (!gift) return res.status(404).json({ message: 'Gift not found' });
  res.json(gift);
});

// GET /api/gift/donor?firstName=&lastName=  — manager
router.get('/donor', verifyToken, requireRole('manager'), async (req, res) => {
  const { firstName, lastName } = req.query;
  if (!firstName || !lastName) return res.status(400).json({ message: 'firstName and lastName required' });
  const gifts = await giftService.getByDonorName(firstName, lastName);
  res.json(gifts);
});

// GET /api/gift/buyers/:number  — manager
router.get('/buyers/:number', verifyToken, requireRole('manager'), async (req, res) => {
  const gifts = await giftService.getByBuyersNumber(Number(req.params.number));
  res.json(gifts);
});

// GET /api/gift/:id  — anonymous
router.get('/:id', async (req, res) => {
  const gift = await giftService.getById(Number(req.params.id));
  if (!gift) return res.status(404).json({ message: 'Gift not found' });
  res.json(gift);
});

// POST /api/gift  — manager
router.post('/', verifyToken, requireRole('manager'), async (req, res) => {
  try {
    const gift = await giftService.add(req.body);
    res.status(201).json(gift);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/gift/:id  — manager
router.put('/:id', verifyToken, requireRole('manager'), async (req, res) => {
  try {
    const gift = await giftService.update(Number(req.params.id), req.body);
    res.json(gift);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/gift/:id/buyers  — internal (called by OrderService after purchase)
router.patch('/:id/buyers', requireInternalSecret, async (req, res) => {
  try {
    const gift = await giftService.incrementBuyers(Number(req.params.id));
    res.json(gift);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/gift/:id/draw  — internal (called by InventoryService after lottery draw)
router.patch('/:id/draw', requireInternalSecret, async (req, res) => {
  try {
    const { winnerTicketId } = req.body;
    const gift = await giftService.markDrawn(Number(req.params.id), winnerTicketId);
    res.json(gift);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/gift/:id  — manager
router.delete('/:id', verifyToken, requireRole('manager'), async (req, res) => {
  const removed = await giftService.remove(Number(req.params.id));
  if (!removed) return res.status(404).json({ message: 'Gift not found' });
  res.status(204).send();
});

module.exports = router;
