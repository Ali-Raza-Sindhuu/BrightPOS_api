const model = require("./supplier.model");
const ApiError = require("../../utils/api-error");
const { getPagination, buildMeta } = require("../../utils/pagination");

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await model.findAll({ limit, offset, search: query.search });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getOne = async (id) => {
  const record = await model.findByIdWithSummary(id);
  if (!record) throw new ApiError(404, "Supplier not found");
  return record;
};

const create = async (data) => {
  require('../../utils/money').minor(data.opening_balance ?? 0, 'opening_balance');
  if (!data.supplier_name || !data.supplier_name.trim()) {
    throw new ApiError(400, "supplier_name is required");
  }
  const existing = await model.findByName(data.supplier_name.trim());
  if (existing) throw new ApiError(409, "Supplier with this name already exists");

  if (data.payment_terms && !["Cash", "Credit"].includes(data.payment_terms)) {
    throw new ApiError(400, "payment_terms must be 'Cash' or 'Credit'");
  }

  return model.create({ ...data, supplier_name: data.supplier_name.trim() });
};

const update = async (id, data) => {
  const current = await getOne(id);
  if (data.opening_balance !== undefined && Number(data.opening_balance) !== Number(current.opening_balance)) throw new ApiError(409, 'Opening balance is immutable after creation');
  delete data.opening_balance;
  if (data.supplier_name !== undefined) {
    if (!data.supplier_name.trim()) throw new ApiError(400, "supplier_name cannot be empty");
    const existing = await model.findByName(data.supplier_name.trim(), id);
    if (existing) throw new ApiError(409, "Supplier with this name already exists");
    data.supplier_name = data.supplier_name.trim();
  }
  if (data.payment_terms && !["Cash", "Credit"].includes(data.payment_terms)) {
    throw new ApiError(400, "payment_terms must be 'Cash' or 'Credit'");
  }
  return model.update(id, data);
};

const remove = async (id) => {
  await getOne(id);
  const count = await model.countLinkedRecords(id);
  if (count > 0) throw new ApiError(409, `Cannot delete: ${count} records reference this supplier`);
  return model.remove(id);
};



module.exports = { list, getOne, create, update, remove };
