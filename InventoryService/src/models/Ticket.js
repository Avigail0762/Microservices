const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketId: { type: Number, required: true, unique: true }, // SQL Server ticket ID from OrderService
  giftId:   { type: Number, required: true, index: true },
  userId:   { type: Number, required: true },
  correlationId: { type: String, index: true },
  sagaId: { type: String, index: true },
  reservationStatus: { type: String, default: 'Reserved', enum: ['Reserved', 'Released'] },
  ticketNumberForGift: { type: Number },
  quantity: { type: Number, default: 1 },
  purchasedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', ticketSchema);
