const Ticket = require('../models/Ticket');

async function upsert(data) {
  // If the ticket already exists (re-purchase), update quantity.
  return Ticket.findOneAndUpdate(
    { ticketId: data.ticketId },
    { $set: data },
    { new: true, upsert: true }
  ).lean();
}

async function getByGiftId(giftId) {
  return Ticket.find({ giftId }).lean();
}

async function getByTicketId(ticketId) {
  return Ticket.findOne({ ticketId }).lean();
}

async function removeByTicketId(ticketId) {
  const result = await Ticket.deleteOne({ ticketId });
  return result.deletedCount > 0;
}

async function countActiveReservationsByGiftId(giftId) {
  return Ticket.countDocuments({ giftId, reservationStatus: 'Reserved' });
}

module.exports = {
  upsert,
  getByGiftId,
  getByTicketId,
  removeByTicketId,
  countActiveReservationsByGiftId
};
