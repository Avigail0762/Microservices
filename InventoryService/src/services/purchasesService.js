const axios = require('axios');
const ticketRepo = require('../repositories/ticketRepository');

const CATALOG_URL = () => process.env.CATALOG_URL;
const ORDER_URL   = () => process.env.ORDER_URL;
const INTERNAL_HEADERS = () => ({ 'x-internal-secret': process.env.INTERNAL_SECRET });

async function getTicketsByGiftId(giftId) {
  return ticketRepo.getByGiftId(giftId);
}

async function getGiftsSortedByPrice() {
  const res = await axios.get(`${CATALOG_URL()}/api/gift/sorted?ascending=false`);
  return res.data;
}

async function getGiftsSortedByBuyers() {
  const res = await axios.get(`${CATALOG_URL()}/api/gift`);
  return (res.data || []).sort((a, b) => b.buyersNumber - a.buyersNumber);
}

async function getBuyersByGiftId(giftId) {
  const tickets = await ticketRepo.getByGiftId(giftId);
  const uniqueUserIds = [...new Set(tickets.map(t => t.userId))];

  const buyers = [];
  for (const userId of uniqueUserIds) {
    try {
      const res = await axios.get(
        `${ORDER_URL()}/api/user/${userId}`,
        { headers: INTERNAL_HEADERS() }
      );
      buyers.push(res.data);
    } catch {
      // user not found — skip
    }
  }
  return buyers;
}

module.exports = { getTicketsByGiftId, getGiftsSortedByPrice, getGiftsSortedByBuyers, getBuyersByGiftId };
