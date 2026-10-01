// openingStockController.js
const openingStockService = require('./openingStockService.js');

async function createOpeningStock(req, res) {
  try {
    const { business_unit_id, stock_date, remarks, items } = req.body;

    if (!business_unit_id) {
      return res.status(400).json({ success: false, message: 'business_unit_id is required' });
    }
    if (!stock_date) {
      return res.status(400).json({ success: false, message: 'stock_date is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'items[] is required and cannot be empty' });
    }
    for (const line of items) {
      if (!line.item_id || !Number.isFinite(Number(line.qty)) || Number(line.qty) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Each item requires a valid item_id and a non-negative numeric qty',
        });
      }
    }

    const created_by = req.user?.id || null;

    const result = await openingStockService.createOpeningStock({
      business_unit_id,
      stock_date,
      remarks,
      created_by,
      items,
    });

    return res.status(201).json({
      success: true,
      message: 'Opening stock recorded successfully',
      data: result,
    });
  } catch (err) {
    console.error('createOpeningStock error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create opening stock' });
  }
}

async function getOpeningStockList(req, res) {
  try {
    const { business_unit_id, item_id, category_id, stock_date, search, page = 1, limit = 20 } = req.query;
    const { rows, meta } = await openingStockService.getOpeningStockList({
      business_unit_id,
      item_id,
      category_id,
      stock_date,
      search,
      page,
      limit,
    });
    return res.json({
      success: true,
      message: 'Opening stock list fetched successfully',
      data: rows,
      meta,
    });
  } catch (err) {
    console.error('getOpeningStockList error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch opening stock list' });
  }
}

async function getOpeningStockById(req, res) {
  try {
    const { id } = req.params;
    const data = await openingStockService.getOpeningStockById(id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Opening stock entry not found' });
    }
    return res.json({ success: true, message: 'Opening stock fetched successfully', data });
  } catch (err) {
    console.error('getOpeningStockById error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch opening stock entry' });
  }
}

async function deleteOpeningStock(req, res) {
  try {
    const { id } = req.params;
    const deleted = await openingStockService.deleteOpeningStock(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Opening stock entry not found' });
    }
    return res.json({ success: true, message: 'Opening stock entry deleted successfully', data: Number(id) });
  } catch (err) {
    console.error('deleteOpeningStock error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete opening stock entry' });
  }
}

async function getItemStockByBranch(req, res) {
  try {
    const { business_unit_id } = req.params;
    if (!business_unit_id) {
      return res.status(400).json({ success: false, message: 'business_unit_id is required' });
    }
    const data = await openingStockService.getItemStockByBranch(business_unit_id);
    return res.json({ success: true, message: 'Item stock fetched successfully', data });
  } catch (err) {
    console.error('getItemStockByBranch error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch item stock' });
  }
}

module.exports = {
  createOpeningStock,
  getOpeningStockList,
  getOpeningStockById,
  deleteOpeningStock,
  getItemStockByBranch,
};