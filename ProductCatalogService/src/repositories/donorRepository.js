const Donor = require('../models/Donor');
const { getNextId } = require('./counterRepository');
const {
  getOrLoad,
  delMany,
  delByPattern,
  safeCacheKeyPart
} = require('../cache/cacheManager');

const TTL_DONOR_BY_ID = Number(process.env.REDIS_TTL_DONOR_BY_ID || 120);
const TTL_DONOR_LIST = Number(process.env.REDIS_TTL_DONOR_LIST || 180);

function donorByIdKey(id) {
  return `productcatalog:donor:id:${id}`;
}

function donorListAllKey() {
  return 'productcatalog:donor:list:all';
}

function donorByEmailKey(email) {
  return `productcatalog:donor:item:email:${safeCacheKeyPart(email)}`;
}

function donorByNameKey(firstName, lastName) {
  return `productcatalog:donor:item:name:${safeCacheKeyPart(firstName)}:${safeCacheKeyPart(lastName)}`;
}

async function invalidateDonorCaches(id, reason) {
  const keys = [];
  if (id !== undefined && id !== null) {
    keys.push(donorByIdKey(id));
  }
  keys.push(donorListAllKey());
  await delMany(keys, reason);
  await delByPattern('productcatalog:donor:item:*', reason);
}

async function getAll() {
  const key = donorListAllKey();
  return getOrLoad(
    key,
    TTL_DONOR_LIST,
    () => Donor.find().lean(),
    'donorRepository.getAll'
  );
}

async function getById(id) {
  const key = donorByIdKey(id);
  return getOrLoad(
    key,
    TTL_DONOR_BY_ID,
    () => Donor.findById(id).lean(),
    'donorRepository.getById'
  );
}

async function getByEmail(email) {
  const key = donorByEmailKey(email);
  return getOrLoad(
    key,
    TTL_DONOR_LIST,
    () => Donor.findOne({ email }).lean(),
    'donorRepository.getByEmail'
  );
}

async function getByName(firstName, lastName) {
  const key = donorByNameKey(firstName, lastName);
  return getOrLoad(
    key,
    TTL_DONOR_LIST,
    () => Donor.findOne({ firstName, lastName }).lean(),
    'donorRepository.getByName'
  );
}

async function create(data) {
  const id = await getNextId('donorId');
  const donor = new Donor({ _id: id, ...data });
  await donor.save();
  await invalidateDonorCaches(id, 'donor_created');
  return donor.toObject();
}

async function update(id, data) {
  const donor = await Donor.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
  if (!donor) throw new Error('Donor not found');
  await invalidateDonorCaches(id, 'donor_updated');
  return donor;
}

async function remove(id) {
  const result = await Donor.findByIdAndDelete(id);
  await invalidateDonorCaches(id, 'donor_removed');
  return !!result;
}

module.exports = { getAll, getById, getByEmail, getByName, create, update, remove };
