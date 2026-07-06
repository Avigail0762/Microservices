const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
  _id: { type: Number, required: true },   // integer ID — consistent with SQL tickets
  name: { type: String, required: true, maxlength: 100 },
  description: { type: String, maxlength: 1000 },
  donorId: { type: Number, required: true },
  price: { type: Number, required: true, min: 10, max: 100 },
  buyersNumber: { type: Number, default: 0 },
  category: { type: String, maxlength: 100 },
  winnerTicketId: { type: Number, default: null },
  isDrawn: { type: Boolean, default: false }
}, { _id: false });   // we manage _id manually

module.exports = mongoose.model('Gift', giftSchema);
