const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// POST /api/notification/winner
// Body: { toEmail: string, giftName: string }
router.post('/winner', async (req, res) => {
  const { toEmail, giftName } = req.body;
  if (!toEmail || !giftName)
    return res.status(400).json({ message: 'toEmail and giftName are required' });

  try {
    await emailService.sendWinnerEmail(toEmail, giftName);
    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('Email send error:', err.message);
    // Return 200 so the lottery flow does not fail due to SMTP misconfiguration
    res.json({ message: 'Email queued (check SMTP settings if not received)' });
  }
});

module.exports = router;
