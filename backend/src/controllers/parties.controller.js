const partiesRepository = require('../repositories/parties.repository');

async function listParties(req, res, next) {
  try {
    const asOfDate = req.query.asOfDate ? String(req.query.asOfDate) : null;
    if (asOfDate && !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
      return next(Object.assign(new Error('As-of date is invalid.'), { statusCode: 400 }));
    }
    res.json(await partiesRepository.listParties(asOfDate));
  } catch (error) {
    next(error);
  }
}

function validateParty(body) {
  const party = {
    firmName: String(body.firmName || '').trim(),
    contactPerson: String(body.contactPerson || '').trim(),
    mobile: String(body.mobile || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim(),
    city: String(body.city || '').trim(),
    address: String(body.address || '').trim(),
    role: body.role,
    openingBalance: Number(body.openingBalance),
    balanceType: body.balanceType,
  };

  if (party.firmName.length < 2 || !party.contactPerson || !party.city) {
    return { error: 'Firm name, contact person, and city are required.' };
  }
  if (!/^[0-9]{10}$/.test(party.mobile)) {
    return { error: 'Mobile number must contain 10 digits.' };
  }
  if (party.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(party.email)) {
    return { error: 'Enter a valid email address.' };
  }
  if (!['SELLER', 'BUYER', 'BOTH'].includes(party.role)) {
    return { error: 'Role must be SELLER, BUYER, or BOTH.' };
  }
  if (!Number.isFinite(party.openingBalance) || party.openingBalance < 0) {
    return { error: 'Opening balance must be zero or greater.' };
  }
  if (!['RECEIVABLE', 'PAYABLE'].includes(party.balanceType)) {
    return { error: 'Balance type must be RECEIVABLE or PAYABLE.' };
  }
  return { party };
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parsePartyId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return next(badRequest('Party ID must be a positive integer.'));
  }
  return id;
}

async function createParty(req, res, next) {
  const { party, error } = validateParty(req.body || {});
  if (error) return next(badRequest(error));
  try {
    res.status(201).json(await partiesRepository.createParty(party));
  } catch (caught) {
    next(caught);
  }
}

async function updateParty(req, res, next) {
  const { party, error } = validateParty(req.body || {});
  if (error) return next(badRequest(error));
  const id = parsePartyId(req, res, next);
  if (typeof id !== 'number') return;
  try {
    const updated = await partiesRepository.updateParty(id, party);
    if (!updated) return next(Object.assign(new Error('Party not found.'), { statusCode: 404 }));
    res.json(updated);
  } catch (caught) {
    next(caught);
  }
}

async function deleteParty(req, res, next) {
  const id = parsePartyId(req, res, next);
  if (typeof id !== 'number') return;
  try {
    const result = await partiesRepository.deleteParty(id);
    if (result.notFound) return next(Object.assign(new Error('Party not found.'), { statusCode: 404 }));
    if (result.currentDue > 0) {
      return next(Object.assign(new Error('Settle the outstanding balance before deleting this party.'), { statusCode: 409 }));
    }
    res.sendStatus(204);
  } catch (error) {
    if (error.code === '23503') {
      error.statusCode = 409;
      error.message = 'This party is linked to existing deals or bills and cannot be deleted.';
    }
    next(error);
  }
}

module.exports = { listParties, createParty, updateParty, deleteParty };