const donorRepo = require('../repositories/donorRepository');

async function getAll()              { return donorRepo.getAll(); }
async function getById(id)           { return donorRepo.getById(id); }
async function getByEmail(email)     { return donorRepo.getByEmail(email); }
async function getByName(fn, ln)     { return donorRepo.getByName(fn, ln); }

async function add(data) {
  return donorRepo.create(data);
}

async function update(id, data) {
  return donorRepo.update(id, data);
}

async function remove(id) {
  return donorRepo.remove(id);
}

module.exports = { getAll, getById, getByEmail, getByName, add, update, remove };
