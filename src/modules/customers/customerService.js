const ApiError = require('../../utils/ApiError');
const customerModel = require('./customerModel');
const { getPagination, buildMeta } = require('../../utils/pagination');

async function listCustomers(query) {
  const { page, limit, offset } = getPagination(query);
  const search = query.search?.trim();

  const [rows, total] = await Promise.all([
    customerModel.findAll({ limit, offset, search }),
    customerModel.count({ search }),
  ]);

  return { rows, meta: buildMeta({ page, limit, total }) };
}

async function getCustomer(id) {
  const customer = await customerModel.findByIdWithSummary(id);
  if (!customer) throw new ApiError(404, 'Customer not found');
  return customer;
}

async function createCustomer(data) {
  if (!data.customer_name || !data.customer_name.trim()) {
    throw new ApiError(422, 'customer_name is required');
  }

  if (data.mobile_number) {
    const existing = await customerModel.findByMobile(data.mobile_number);
    if (existing) throw new ApiError(409, 'A customer with this mobile number already exists');
  }

  const id = await customerModel.create(data);
  return customerModel.findById(id);
}

async function updateCustomer(id, data) {
  await getCustomer(id); // 404 if missing

  if (!data.customer_name || !data.customer_name.trim()) {
    throw new ApiError(422, 'customer_name is required');
  }

  if (data.mobile_number) {
    const existing = await customerModel.findByMobile(data.mobile_number, id);
    if (existing) throw new ApiError(409, 'A customer with this mobile number already exists');
  }

  await customerModel.update(id, data);
  return customerModel.findById(id);
}

async function deleteCustomer(id) {
  await getCustomer(id); // 404 if missing

  const refs = await customerModel.countReferences(id);
  if (refs > 0) {
    throw new ApiError(409, 'Cannot delete: customer has sales, payments, returns, or bookings on record');
  }

  await customerModel.remove(id);
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
