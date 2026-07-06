const giftRepo = require('../repositories/giftRepository');
const donorRepo = require('../repositories/donorRepository');

async function getAll()                      { return giftRepo.getAll(); }
async function getById(id)                   { return giftRepo.getById(id); }
async function getByName(name)               { return giftRepo.getByName(name); }
async function getByCategory(category)       { return giftRepo.getByCategory(category); }
async function getByDonorName(fn, ln)        { return giftRepo.getByDonorName(fn, ln); }
async function getByBuyersNumber(n)          { return giftRepo.getByBuyersNumber(n); }
async function getByPrice(ascending)         { return giftRepo.getByPrice(ascending); }

async function add(data) {
  if (!data.donorId) throw new Error('donorId is required');
  const donor = await donorRepo.getById(data.donorId);
  if (!donor) throw new Error('Donor not found');
  return giftRepo.create(data);
}

async function update(id, data) {
  return giftRepo.update(id, data);
}

async function incrementBuyers(id) {
  return giftRepo.incrementBuyers(id);
}

async function decrementBuyers(id) {
  return giftRepo.decrementBuyers(id);
}

async function markDrawn(id, winnerTicketId) {
  return giftRepo.markDrawn(id, winnerTicketId);
}

async function remove(id) {
  return giftRepo.remove(id);
}

module.exports = {
  getAll, getById, getByName, getByCategory, getByDonorName,
  getByBuyersNumber, getByPrice, add, update, incrementBuyers, decrementBuyers, markDrawn, remove
};
