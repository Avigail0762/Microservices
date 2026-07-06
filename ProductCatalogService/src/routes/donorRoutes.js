const express = require('express');
const router = express.Router();
const donorService = require('../services/donorService');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/donor  — manager
router.get('/', verifyToken, requireRole('manager'), async (req, res) => {
  const donors = await donorService.getAll();
  if (!donors.length) return res.status(204).send();
  res.json(donors);
});

// GET /api/donor/email/:email
router.get('/email/:email', verifyToken, requireRole('manager'), async (req, res) => {
  const donor = await donorService.getByEmail(req.params.email);
  if (!donor) return res.status(404).json({ message: 'Donor not found' });
  res.json(donor);
});

// GET /api/donor/name?firstName=&lastName=
router.get('/name', verifyToken, requireRole('manager'), async (req, res) => {
  const { firstName, lastName } = req.query;
  if (!firstName || !lastName) return res.status(400).json({ message: 'firstName and lastName required' });
  const donor = await donorService.getByName(firstName, lastName);
  if (!donor) return res.status(404).json({ message: 'Donor not found' });
  res.json(donor);
});

// GET /api/donor/:id
router.get('/:id', verifyToken, requireRole('manager'), async (req, res) => {
  const donor = await donorService.getById(Number(req.params.id));
  if (!donor) return res.status(404).json({ message: 'Donor not found' });
  res.json(donor);
});

// POST /api/donor
router.post('/', verifyToken, requireRole('manager'), async (req, res) => {
  try {
    const donor = await donorService.add(req.body);
    res.status(201).json(donor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/donor/:id
router.put('/:id', verifyToken, requireRole('manager'), async (req, res) => {
  try {
    const donor = await donorService.update(Number(req.params.id), req.body);
    res.json(donor);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/donor/:id
router.delete('/:id', verifyToken, requireRole('manager'), async (req, res) => {
  const removed = await donorService.remove(Number(req.params.id));
  if (!removed) return res.status(404).json({ message: 'Donor not found' });
  res.status(204).send();
});

module.exports = router;
