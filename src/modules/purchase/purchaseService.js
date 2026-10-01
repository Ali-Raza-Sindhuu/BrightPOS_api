const purchaseModel = require("./purchaseModel");
const pool = require("../../config/db");
const ApiError = require("../../utils/ApiError");
const { getPagination, buildMeta } = require("../../utils/pagination");

const PAYMENT_STATUSES = ["paid", "partial", "unpaid"];
const ORDER_STATUSES = ["pending", "received", "returned"];

const assertExists = async (table, id, label) => {
  if (id === undefined || id === null || id === "") return;
  const [rows] = await pool.query(`SELECT id FROM ${table} WHERE id = ?`, [id]);
  if (!rows.length) throw new ApiError(400, `Invalid ${label}: no record found with id ${id}`);
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const validateItemsPayload = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "At least one purchase item is required");
  }
  for (const [index, item] of items.entries()) {
    if (!item.item_id) throw new ApiError(400, `items[${index}].item_id is required`);
    if (item.qty === undefined || item.qty <= 0) {
      throw new ApiError(400, `items[${index}].qty must be greater than 0`);
    }
    if (item.purchase_price === undefined || item.purchase_price < 0) {
      throw new ApiError(400, `items[${index}].purchase_price must be >= 0`);
    }
  }
};

// Computes line totals + purchase-level sub_total/payable server-side so the
// client can never manipulate the invoice math.
const computeTotals = (items, discount_percent = 0, discount_amount = 0) => {
  const computedItems = items.map((item) => ({
    ...item,
    sale_price: item.sale_price !== undefined ? item.sale_price : 0,
    total: round2(item.qty * item.purchase_price),
  }));

  const sub_total = round2(computedItems.reduce((sum, i) => sum + i.total, 0));

  let finalDiscountAmount = discount_amount || 0;
  if (discount_percent) {
    finalDiscountAmount = round2((sub_total * discount_percent) / 100);
  }

  const payable = round2(sub_total - finalDiscountAmount);

  return { computedItems, sub_total, discount_amount: finalDiscountAmount, payable };
};

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await purchaseModel.findAll({
    limit,
    offset,
    search: query.search,
    supplier_id: query.supplier_id,
    payment_status: query.payment_status,
    order_status: query.order_status,
    item_id: query.item_id,
    from_date: query.from_date,
    to_date: query.to_date,
  });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getOne = async (id) => {
  const purchase = await purchaseModel.findById(id);
  if (!purchase) throw new ApiError(404, "Purchase not found");
  const items = await purchaseModel.findItemsByPurchaseId(id);
  return { ...purchase, items };
};

const create = async (data) => {
  const {
    supplier_id,
    business_unit_id,
    invoice_no,
    notes,
    discount_amount = 0,
    paid = 0,
    items,
  } = data;

  if (!supplier_id) {
    throw new ApiError(400, "supplier_id is required");
  }

  await assertExists("suppliers", supplier_id, "supplier_id");

  validateItemsPayload(items);

  for (const [index, item] of items.entries()) {
    await assertExists(
      "item_details",
      item.item_id,
      `items[${index}].item_id`
    );
  }

 const {
  computedItems,
  sub_total,
  discount_amount: finalDiscountAmount,
  payable
} = computeTotals(
  items,
  0,               // discount_percent — not used currently
  discount_amount  // the real flat discount amount
);


  let payment_status = "unpaid";

  if (paid >= payable) {
    payment_status = "paid";
  } 
  else if (paid > 0) {
    payment_status = "partial";
  }


  const purchaseId = await purchaseModel.createWithItems({
    header:{
      supplier_id,
      business_unit_id,
      invoice_no,
      notes,
      discount_amount: finalDiscountAmount,
      sub_total,
      payable,
      paid,
      payment_status,
      order_status:"pending",
    },
    items: computedItems,
  });


  return getOne(purchaseId);
};

const update = async (id, data) => {
  const current = await getOne(id);

  if (current.order_status === "received") {
    throw new ApiError(409, "Cannot edit a purchase that has already been received");
  }

  if (data.supplier_id !== undefined) {
    await assertExists("suppliers", data.supplier_id, "supplier_id");
  }
  if (data.payment_status !== undefined && !PAYMENT_STATUSES.includes(data.payment_status)) {
    throw new ApiError(400, `payment_status must be one of: ${PAYMENT_STATUSES.join(", ")}`);
  }
  if (data.order_status !== undefined && !ORDER_STATUSES.includes(data.order_status)) {
    throw new ApiError(400, `order_status must be one of: ${ORDER_STATUSES.join(", ")}`);
  }

  // Header-only update; line items are immutable after creation in this step.
  // (Editing items would require recomputation + GRN re-sync — left for a later pass.)
  await purchaseModel.updateHeader(id, data);
  return getOne(id);
};

const remove = async (id) => {
  const current = await getOne(id);
  if (current.order_status === "received") {
    throw new ApiError(409, "Cannot delete a purchase that has already been received");
  }
  return purchaseModel.remove(id);
};

module.exports = { list, getOne, create, update, remove };