const ApiError = require('../../utils/ApiError');
const model = require('./businessUnitModel');
const { getPagination, buildMeta } = require('../../utils/pagination');

async function listUnits(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();

  const [rows, total] = await Promise.all([
    model.findAll({ limit, offset, search }),
    model.count({ search }),
  ]);

  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function getUnit(id) {
  const unit = await model.findById(id);
  if (!unit) throw new ApiError(404, 'Business unit not found');
  return unit;
}

function validate(data) {
  if (!data.name || !data.name.trim()) throw new ApiError(422, 'name is required');
  if (data.type && !model.VALID_TYPES.includes(data.type)) {
    throw new ApiError(422, `type must be one of: ${model.VALID_TYPES.join(', ')}`);
  }
}

async function createUnit(data) {
  validate(data);
  const existing = await model.findByName(data.name);
  if (existing) throw new ApiError(409, 'A business unit with this name already exists');

  const id = await model.create(data);
  return model.findById(id);
}

async function updateUnit(id, data) {
  await getUnit(id);
  validate(data);

  const existing = await model.findByName(data.name, id);
  if (existing) throw new ApiError(409, 'A business unit with this name already exists');

  await model.update(id, data);
  return model.findById(id);
}

async function deleteUnit(id) {
  await getUnit(id);

  const refs = await model.countReferences(id);
  if (refs > 0) {
    throw new ApiError(409, 'Cannot delete: this location has inventory, sales, purchases, or transfers on record');
  }

  await model.remove(id);
}

module.exports = { listUnits, getUnit, createUnit, updateUnit, deleteUnit };
