const axios = require('axios');

const ORDER_URL = () => process.env.ORDER_URL;
const CATALOG_URL = () => process.env.CATALOG_URL;

async function getOrderDetails(userId, authHeader) {
  const ticketsResponse = await axios.get(`${ORDER_URL()}/api/customer/tickets?userId=${userId}`, {
    headers: { authorization: authHeader }
  });

  const tickets = Array.isArray(ticketsResponse.data) ? ticketsResponse.data : [];

  const detailedItems = await Promise.all(
    tickets.map(async (ticket) => {
      const giftId = ticket.giftId;
      if (!giftId) {
        return { ticket };
      }

      const latestGiftResponse = await axios.get(`${CATALOG_URL()}/api/gift/${giftId}`);

      return {
        ticket,
        giftId,
        gift: latestGiftResponse.data
      };
    })
  );

  return {
    userId,
    itemCount: detailedItems.length,
    items: detailedItems
  };
}

module.exports = { getOrderDetails };
