const { id: validId, quantity } = require('../../utils/validation');
const grnModel = require("./goods-receipt.model");
const ApiError = require("../../utils/api-error");
const { getPagination, buildMeta } = require("../../utils/pagination");

const list = async (query) => {
  const { page, limit, offset } = getPagination(query);
  const { rows, total } = await grnModel.findAll({
    limit,
    offset,
    status: query.status,
    purchase_id: query.purchase_id,
  });
  return { rows, meta: buildMeta(page, limit, total) };
};

const getOne = async (id) => {
  const grn = await grnModel.findById(id);
  if (!grn) throw new ApiError(404, "Goods receipt not found");
  const expected = await grnModel.findExpectedItems(grn.purchase_id);
  const received = await grnModel.findReceiptItems(id);
  return { ...grn, expected_items: expected, received_items: received };
};

// Body: { items: [{ item_id, received_qty }], remarks }
// Any item omitted from `items` defaults to receiving its full ordered qty,
// so a plain { items: [] } (or omitted) call receives everything as ordered.
const receiveGrn = async (id, data) => {
  const grn = await grnModel.findById(id);

  if (!grn) {
    throw new ApiError(404, "Goods receipt not found");
  }

  if (grn.status === "received") {
    throw new ApiError(
      409,
      "This goods receipt has already been fully received"
    );
  }


  const expected = await grnModel.findExpectedItems(grn.purchase_id);

  if (!expected.length) {
    throw new ApiError(
      400,
      "No outstanding items available for receiving"
    );
  }


  const inputItems = new Map();


  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new ApiError(
      400,
      "At least one received item is required"
    );
  }


  for (const [index, item] of data.items.entries()) {


    if (!item.purchase_item_id) {
      throw new ApiError(
        400,
        `items[${index}].purchase_item_id is required`
      );
    }


    if (
      item.received_qty === undefined ||
      item.received_qty < 0
    ) {
      throw new ApiError(
        400,
        `items[${index}].received_qty must be >= 0`
      );
    }


    validId(item.purchase_item_id, 'purchase_item_id');
    quantity(item.received_qty, 'received_qty', true);
    if (inputItems.has(Number(item.purchase_item_id))) throw new ApiError(422, 'Duplicate purchase_item_id');
    if (!expected.some(line => Number(line.purchase_item_id) === Number(item.purchase_item_id))) throw new ApiError(422, 'Receipt line is not outstanding on this purchase');
    inputItems.set(
      Number(item.purchase_item_id),
      {
        received_qty: Number(item.received_qty),
        condition_note: item.condition_note || null
      }
    );

  }



  const finalItems = [];


  for (const exp of expected) {


    const submitted = inputItems.get(
      Number(exp.purchase_item_id)
    );


    if (!submitted) {
      continue;
    }



    if (
      submitted.received_qty >
      Number(exp.outstanding_qty)
    ) {

      throw new ApiError(
        400,
        `${exp.item_name} received quantity cannot exceed outstanding quantity`
      );

    }



    if (submitted.received_qty > 0) {

      finalItems.push({

        purchase_item_id:
          exp.purchase_item_id,

        item_id:
          exp.item_id,

        received_qty:
          submitted.received_qty,

        condition_note:
          submitted.condition_note

      });

    }

  }



  if (finalItems.length === 0) {

    throw new ApiError(
      400,
      "At least one item must have received_qty greater than 0"
    );

  }



  await grnModel.receive({

    grnId: id,

    purchaseId: grn.purchase_id,

    items: finalItems,

    remarks: data.remarks

  });



  return getOne(id);
};

module.exports = { list, getOne, receiveGrn };
