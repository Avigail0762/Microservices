const mongoose = require('mongoose');

const processedEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  correlationId: { type: String, required: true },
  sagaId: { type: String, required: true },
  eventType: { type: String, required: true },
  giftId: { type: Number, required: true },
  processedAt: { type: Date, default: Date.now }
});

processedEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model('ProcessedEvent', processedEventSchema);