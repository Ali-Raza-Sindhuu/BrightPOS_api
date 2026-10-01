const itemModel = require("./itemsModel");
const pool = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { getPagination, buildMeta } = require("../../utils/pagination");

const assertExists = async (table, id, label) => {
  if (id === undefined || id === null || id === "") return;
  const [rows] = await pool.query(`SELECT id FROM ${table} WHERE id = ?`, [id]);
  if (!rows.length)
    throw new ApiError(400, `Invalid ${label}: no record found with id ${id}`);
};

const validateForeignKeys = async (data) => {
  await assertExists("categories", data.item_category_id, "item_category_id");
  await assertExists(
    "sub_categories",
    data.item_subcategory_id,
    "item_subcategory_id",
  );
  await assertExists("manufacturers", data.manufacturer_id, "manufacturer_id");
  await assertExists("suppliers", data.supplier_id, "supplier_id");
  await assertExists(
    "shelve_locations",
    data.shelve_location_id,
    "shelve_location_id",
  );
  await assertExists("item_units", data.item_unit_id, "item_unit_id");
  await assertExists("item_types", data.item_type_id, "item_type_id");
  await assertExists("business_units", data.business_unit_id, "business_unit_id");
};

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await itemModel.findAll({
    limit,
    offset,
    search: query.search,
    category_id: query.category_id,
    subcategory_id: query.subcategory_id,
    is_enable: query.is_enable,
    business_unit_id: query.business_unit_id,
  });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getOne = async (id, business_unit_id) => {
  const item = await itemModel.findById(id, business_unit_id);
  if (!item) throw new ApiError(404, "Item not found");
  return item;
};

const create = async (data) => {
  if (!data.item_name || !data.item_name.trim()) {
    throw new ApiError(400, "item_name is required");
  }
  if (data.purchase_price !== undefined && data.purchase_price < 0) {
    throw new ApiError(400, "purchase_price cannot be negative");
  }
  if (data.sale_price !== undefined && data.sale_price < 0) {
    throw new ApiError(400, "sale_price cannot be negative");
  }
  // business_unit_id is required at creation since opening stock (if any)
  // needs a branch to post into.
  if (!data.business_unit_id) {
    throw new ApiError(400, "business_unit_id is required");
  }
  if (data.stock !== undefined && data.stock < 0) {
    throw new ApiError(400, "stock cannot be negative");
  }

  if (data.label_barcode) {
    const existing = await itemModel.findByBarcode(data.label_barcode);
    if (existing)
      throw new ApiError(409, "Item with this barcode already exists");
  }

  await validateForeignKeys(data);

  return itemModel.create({
    ...data,
    item_name: data.item_name.trim(),
    item_image_url: data.item_image_url || null,
    is_enable: data.is_enable !== undefined ? data.is_enable : 1,
    stock: data.stock !== undefined ? data.stock : 0,
    reorder_level: data.reorder_level !== undefined ? data.reorder_level : 0,
    per_unit: data.per_unit !== undefined ? data.per_unit : 1,
  });
};

// Metadata-only edit — stock is never touched here. To change stock, use
// Opening Stock (first-time only), Purchase→Goods Receipt, Sale, Sales/Purchase
// Return, Stock Transfer, or Stock Adjustment.
const update = async (id, data) => {
  await getOne(id, data.business_unit_id);

  if (data.item_name !== undefined && !data.item_name.trim()) {
    throw new ApiError(400, "item_name cannot be empty");
  }
  if (data.purchase_price !== undefined && data.purchase_price < 0) {
    throw new ApiError(400, "purchase_price cannot be negative");
  }
  if (data.sale_price !== undefined && data.sale_price < 0) {
    throw new ApiError(400, "sale_price cannot be negative");
  }
  if (data.label_barcode) {
    const existing = await itemModel.findByBarcode(data.label_barcode, id);
    if (existing)
      throw new ApiError(409, "Item with this barcode already exists");
  }

  await validateForeignKeys(data);

  return itemModel.update(id, data);
};

const remove = async (id) => {
  await getOne(id);
  return itemModel.remove(id);
};

const getLowStock = async (business_unit_id) => itemModel.findLowStock(business_unit_id);

module.exports = { list, getOne, create, update, remove, getLowStock };