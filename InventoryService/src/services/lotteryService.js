const axios = require('axios');
const ticketRepo = require('../repositories/ticketRepository');

const CATALOG_URL      = () => process.env.CATALOG_URL;
const NOTIFICATION_URL = () => process.env.NOTIFICATION_URL;
const ORDER_URL        = () => process.env.ORDER_URL;
const INTERNAL_HEADERS = () => ({ 'x-internal-secret': process.env.INTERNAL_SECRET });

async function doLottery(giftId) {
  // 1. Load tickets from local MongoDB
  const tickets = await ticketRepo.getByGiftId(giftId);
  if (!tickets.length) throw new Error('No tickets for this gift');

  // 2. Get gift from ProductCatalogService
  const giftRes = await axios.get(`${CATALOG_URL()}/api/gift/${giftId}`);
  const gift = giftRes.data;
  if (gift.isDrawn) throw new Error('Lottery already done for this gift');

  // 3. Build weighted pool based on quantity
  const pool = [];
  for (const ticket of tickets) {
    for (let i = 0; i < ticket.quantity; i++) {
      pool.push(ticket.ticketId);
    }
  }

  const winnerTicketId = pool[Math.floor(Math.random() * pool.length)];
  const winnerTicket = tickets.find(t => t.ticketId === winnerTicketId);

  // 4. Mark gift as drawn in ProductCatalogService
  await axios.patch(
    `${CATALOG_URL()}/api/gift/${giftId}/draw`,
    { winnerTicketId },
    { headers: INTERNAL_HEADERS() }
  );

  // 5. Get winner user details from OrderService
  let winnerEmail = null;
  try {
    const userRes = await axios.get(
      `${ORDER_URL()}/api/user/${winnerTicket.userId}`,
      { headers: INTERNAL_HEADERS() }
    );
    winnerEmail = userRes.data.email;
  } catch (err) {
    console.error('Could not fetch winner user:', err.message);
  }

  // 6. Send notification email
  if (winnerEmail) {
    try {
      await axios.post(
        `${NOTIFICATION_URL()}/api/notification/winner`,
        { toEmail: winnerEmail, giftName: gift.name }
      );
    } catch (err) {
      console.error('Notification send failed:', err.message);
    }
  }

  return winnerTicket;
}

async function getWinnersReport() {
  // Get all drawn gifts from catalog
  const giftsRes = await axios.get(`${CATALOG_URL()}/api/gift`);
  const drawnGifts = (giftsRes.data || []).filter(g => g.isDrawn && g.winnerTicketId != null);

  const winners = [];
  for (const gift of drawnGifts) {
    const ticket = await ticketRepo.getByTicketId(gift.winnerTicketId);
    if (ticket) winners.push({ ...ticket, giftName: gift.name });
  }
  return winners;
}

async function getTotalIncome() {
  const giftsRes = await axios.get(`${CATALOG_URL()}/api/gift`);
  const gifts = giftsRes.data || [];
  return gifts.reduce((sum, g) => sum + g.price * g.buyersNumber, 0);
}

module.exports = { doLottery, getWinnersReport, getTotalIncome };
