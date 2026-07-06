const Gift = require('../models/Gift');
const Donor = require('../models/Donor');
const { getNextId } = require('./counterRepository');
const {
  getOrLoad,
  delMany,
  delByPattern,
  safeCacheKeyPart
} = require('../cache/cacheManager');

const TTL_GIFT_BY_ID = Number(process.env.REDIS_TTL_GIFT_BY_ID || 60);
const TTL_GIFT_LIST = Number(process.env.REDIS_TTL_GIFT_LIST || 120);

function giftByIdKey(id) {
  return `productcatalog:gift:id:${id}`;
}

function giftListAllKey() {
  return 'productcatalog:gift:list:all';
}

function giftByPriceKey(ascending) {
  return `productcatalog:gift:list:sort:price:${ascending ? 'asc' : 'desc'}`;
}

function giftByCategoryKey(category) {
  return `productcatalog:gift:list:category:${safeCacheKeyPart(category)}`;
}

function giftByNameKey(name) {
  return `productcatalog:gift:item:name:${safeCacheKeyPart(name)}`;
}

function giftByDonorNameKey(firstName, lastName) {
  return `productcatalog:gift:list:donor:${safeCacheKeyPart(firstName)}:${safeCacheKeyPart(lastName)}`;
}

function giftByBuyersNumberKey(number) {
  return `productcatalog:gift:list:buyers:${number}`;
}

async function invalidateGiftCaches(id, reason) {
  const keys = [];
  if (id !== undefined && id !== null) {
    keys.push(giftByIdKey(id));
  }
  keys.push(giftListAllKey());
  await delMany(keys, reason);
  await delByPattern('productcatalog:gift:list:*', reason);
  await delByPattern('productcatalog:gift:item:name:*', reason);
}

async function getAll() {
  const key = giftListAllKey();
  return getOrLoad(
    key,
    TTL_GIFT_LIST,
    () => Gift.find().populate({ path: 'donorId', model: Donor, localField: 'donorId', foreignField: '_id' }).lean(),
    'giftRepository.getAll'
  );
}

async function getById(id) {
  const key = giftByIdKey(id);
  return getOrLoad(
    key,
    TTL_GIFT_BY_ID,
    () => Gift.findById(id).lean(),
    'giftRepository.getById'
  );
}

async function getByName(name) {
  const key = giftByNameKey(name);
  return getOrLoad(
    key,
    TTL_GIFT_LIST,
    () => Gift.findOne({ name }).lean(),
    'giftRepository.getByName'
  );
}

async function getByCategory(category) {
  const key = giftByCategoryKey(category);
  return getOrLoad(
    key,
    TTL_GIFT_LIST,
    () => Gift.find({ category }).lean(),
    'giftRepository.getByCategory'
  );
}

async function getByDonorName(firstName, lastName) {
  const key = giftByDonorNameKey(firstName, lastName);
  return getOrLoad(
    key,
    TTL_GIFT_LIST,
    async () => {
      const donor = await Donor.findOne({ firstName, lastName }).lean();
      if (!donor) return [];
      return Gift.find({ donorId: donor._id }).lean();
    },
    'giftRepository.getByDonorName'
  );
}

async function getByBuyersNumber(number) {
  const key = giftByBuyersNumberKey(number);
  return getOrLoad(
    key,
    TTL_GIFT_LIST,
    () => Gift.find({ buyersNumber: number }).lean(),
    'giftRepository.getByBuyersNumber'
  );
}

async function getByPrice(ascending = true) {
  const key = giftByPriceKey(ascending);
  return getOrLoad(
    key,
    TTL_GIFT_LIST,
    () => Gift.find().sort({ price: ascending ? 1 : -1 }).lean(),
    'giftRepository.getByPrice'
  );
}

async function create(data) {
  const id = await getNextId('giftId');
  const gift = new Gift({ _id: id, ...data });
  await gift.save();
  await invalidateGiftCaches(id, 'gift_created');
  return gift.toObject();
}

async function update(id, data) {
  const gift = await Gift.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  if (!gift) throw new Error('Gift not found');
  await invalidateGiftCaches(id, 'gift_updated');
  return gift;
}

async function incrementBuyers(id) {
  const gift = await Gift.findByIdAndUpdate(id, { $inc: { buyersNumber: 1 } }, { new: true }).lean();
  if (!gift) throw new Error('Gift not found');
  await invalidateGiftCaches(id, 'gift_increment_buyers');
  return gift;
}

async function decrementBuyers(id) {
  const gift = await Gift.findByIdAndUpdate(
    id,
    { $inc: { buyersNumber: -1 } },
    { new: true }
  ).lean();
  if (!gift) throw new Error('Gift not found');
  await invalidateGiftCaches(id, 'gift_decrement_buyers');
  return gift;
}

async function markDrawn(id, winnerTicketId) {
  const gift = await Gift.findByIdAndUpdate(
    id,
    { $set: { isDrawn: true, winnerTicketId } },
    { new: true }
  ).lean();
  if (!gift) throw new Error('Gift not found');
  await invalidateGiftCaches(id, 'gift_mark_drawn');
  return gift;
}

async function remove(id) {
  const result = await Gift.findByIdAndDelete(id);
  await invalidateGiftCaches(id, 'gift_removed');
  return !!result;
}

module.exports = {
  getAll, getById, getByName, getByCategory, getByDonorName,
  getByBuyersNumber, getByPrice, create, update, incrementBuyers, decrementBuyers,
  markDrawn, remove
};
