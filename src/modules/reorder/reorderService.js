const ApiError = require('../../utils/ApiError');
const model = require('./reorderModel');
const { getPagination, buildMeta } = require('../../utils/pagination');

const VALID_STATUSES = ['Pending', 'Ordered', 'Received'];
// Forward-only workflow — no going back once ordered/received.
const ALLOWED_TRANSITIONS = { Pending: ['Ordered'], Ordered: ['Received'], Received: [] };

async function list(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();
  const status = query.status;
  if (status && !VALID_STATUSES.includes(status)) {
    throw new ApiError(422, `status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const [rows, total] = await Promise.all([
    model.findAll({ limit, offset, search, status }),
    model.count({ search, status }),
  ]);
  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function get(id) {
  const row = await model.findById(id);
  if (!row) throw new ApiError(404, 'Reorder not found');
  return row;
}

// Items due for reordering that don't already have an open reorder — the
// natural feed for a "create reorders for what's low" screen.
async function listSuggestions() {
  return model.findLowStockWithoutOpenReorder();
}

async function create(data) {
  if (!data.item_id) throw new ApiError(422, 'item_id is required');
  const item = await model.getItemById(data.item_id);
  if (!item) throw new ApiError(422, `item_id ${data.item_id} does not exist`);

  if (data.reorder_qty !== undefined && (!Number.isFinite(data.reorder_qty) || data.reorder_qty <= 0)) {
    throw new ApiError(422, 'reorder_qty must be a positive number');
  }

  const id = await model.create(data);
  return model.findById(id);
}

async function updateNotes(id, notes) {
  await get(id);
  await model.updateNotes(id, notes);
  return model.findById(id);
}

async function transition(id, toStatus) {
  const reorder = await get(id);
  const allowed = ALLOWED_TRANSITIONS[reorder.status] || [];
  if (!allowed.includes(toStatus)) {
    throw new ApiError(400, `Cannot move a reorder from "${reorder.status}" to "${toStatus}"`);
  }

  const extra = {};
  if (toStatus === 'Ordered') extra.ordered_at = new Date();
  if (toStatus === 'Received') extra.received_at = new Date();

  await model.updateStatus(id, toStatus, extra);
  return model.findById(id);
}

async function remove(id) {
  const reorder = await get(id);
  if (reorder.status !== 'Pending') {
    throw new ApiError(400, "Only a Pending reorder can be deleted — cancel isn't modeled for Ordered/Received");
  }
  await model.remove(id);
}

module.exports = { list, get, listSuggestions, create, updateNotes, transition, remove };