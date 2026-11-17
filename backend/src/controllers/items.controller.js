const itemsRepository = require('../repositories/items.repository');

async function listItems(_req, res, next) {
  try {
    res.json(await itemsRepository.listItems());
  } catch (error) {
    next(error);
  }
}

async function createItem(req, res, next) {
  const name = String(req.body?.name || '').trim();
  const defaultUnit = String(req.body?.defaultUnit || 'TON').trim().toUpperCase();
  if (name.length < 2 || name.length > 100 || defaultUnit.length < 1 || defaultUnit.length > 20) {
    const error = new Error('Item name and a valid default unit are required.');
    error.statusCode = 400;
    return next(error);
  }

  try {
    res.status(201).json(await itemsRepository.createItem(name, defaultUnit));
  } catch (error) {
    if (error.code === '23505') {
      error.statusCode = 409;
      error.message = 'An item with this name already exists.';
    }
    next(error);
  }
}

module.exports = { listItems, createItem };