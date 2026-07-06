const Counter = require('../models/Counter');

async function getNextId(counterName) {
  const counter = await Counter.findByIdAndUpdate(
    counterName,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = { getNextId };
