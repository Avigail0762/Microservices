const ticketRepo = require('../repositories/ticketRepository');

async function registerTicket(data) {
  return ticketRepo.upsert(data);
}

async function getTicketsByGiftId(giftId) {
  return ticketRepo.getByGiftId(giftId);
}

async function removeTicketByTicketId(ticketId) {
  return ticketRepo.removeByTicketId(ticketId);
}

async function countActiveReservationsByGiftId(giftId) {
  return ticketRepo.countActiveReservationsByGiftId(giftId);
}

module.exports = {
  registerTicket,
  getTicketsByGiftId,
  removeTicketByTicketId,
  countActiveReservationsByGiftId
};
