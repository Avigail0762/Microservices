const mongoose = require('mongoose');

const donorSchema = new mongoose.Schema({
  _id: { type: Number, required: true },   // integer ID
  firstName: { type: String, required: true, maxlength: 50 },
  lastName: { type: String, required: true, maxlength: 50 },
  phoneNumber: { type: String, maxlength: 20 },
  email: { type: String, required: true, maxlength: 100, unique: true },
  address: { type: String, maxlength: 200 }
}, { _id: false });

module.exports = mongoose.model('Donor', donorSchema);
