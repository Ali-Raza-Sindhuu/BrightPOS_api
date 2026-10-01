const pool = require('../../config/db');
const catchAsync = require('../../utils/catchAsync');
const sendResponse = require('../../utils/sendResponse');
const express = require('express');

// Resolves a period keyword into a concrete [startDate, endDate] range,
// and how many days of chart buckets to show.
function resolvePeriodRange(period) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (period) {
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
      return { start, end, chartDays: end.getDate() };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = now;
      return { start, end, chartDays: 12, granularity: 'month' };
    }
    case 'last_year': {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { start, end, chartDays: 12, granularity: 'month' };
    }
    case 'all_time':
      return { start: null, end: null, chartDays: 7 }; // chart still shows last 7d for readability
    case 'this_month':
    default: {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = now;
      return { start, end, chartDays: end.getDate() };
    }
  }
}

function toSqlDate(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function getDashboardData(period) {
  const { start, end, chartDays, granularity } = resolvePeriodRange(period);

  const dateFilter = start && end ? 'AND created_at BETWEEN ? AND ?' : '';
  const dateParams = start && end ? [toSqlDate(start), toSqlDate(end)] : [];

  const [[{ totalCustomers }]] = await pool.query('SELECT COUNT(*) AS totalCustomers FROM customers');
  const [[{ totalProducts }]] = await pool.query('SELECT COUNT(*) AS totalProducts FROM item_details');
  const [[{ totalStaff }]] = await pool.query('SELECT COUNT(*) AS totalStaff FROM users');

  // Total sales — now scoped to the selected period
  const [[{ totalSales }]] = await pool.query(
    `SELECT COALESCE(SUM(payable), 0) AS totalSales FROM sale_invoices WHERE 1=1 ${dateFilter}`,
    dateParams
  );

  const [[{ totalBookings }]] = await pool.query(
    `SELECT COUNT(*) AS totalBookings FROM bookings WHERE 1=1 ${dateFilter}`,
    dateParams
  );

  // Chart data — daily buckets for month-scale periods, monthly buckets for year-scale periods
  let salesChartData = [];
  if (granularity === 'month') {
    const [salesChart] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS bucket, SUM(payable) AS sales
       FROM sale_invoices WHERE created_at BETWEEN ? AND ?
       GROUP BY bucket ORDER BY bucket`,
      [toSqlDate(start), toSqlDate(end)]
    );
    const [purchaseChart] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS bucket, SUM(payable) AS purchases
       FROM purchases WHERE created_at BETWEEN ? AND ?
       GROUP BY bucket ORDER BY bucket`,
      [toSqlDate(start), toSqlDate(end)]
    );
    const salesByBucket = new Map(salesChart.map((r) => [r.bucket, Number(r.sales)]));
    const purchasesByBucket = new Map(purchaseChart.map((r) => [r.bucket, Number(r.purchases)]));

    const monthStart = new Date(start);
    for (let i = 0; i < 12; i++) {
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth() + i, 1);
      if (d > end) break;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      salesChartData.push({
        name: d.toLocaleDateString('en-US', { month: 'short' }),
        Sales: salesByBucket.get(key) || 0,
        Expenses: purchasesByBucket.get(key) || 0,
      });
    }
  } else {
    // Daily buckets — either within the resolved [start,end] window, or last 7 days for all_time
    const rangeStart = start || new Date(Date.now() - 6 * 86400000);
    const rangeEnd = end || new Date();

    const [salesChart] = await pool.query(
      `SELECT DATE(created_at) AS day, SUM(payable) AS sales
       FROM sale_invoices WHERE created_at BETWEEN ? AND ?
       GROUP BY DATE(created_at) ORDER BY day`,
      [toSqlDate(rangeStart), toSqlDate(rangeEnd)]
    );
    const [purchaseChart] = await pool.query(
      `SELECT DATE(created_at) AS day, SUM(payable) AS purchases
       FROM purchases WHERE created_at BETWEEN ? AND ?
       GROUP BY DATE(created_at) ORDER BY day`,
      [toSqlDate(rangeStart), toSqlDate(rangeEnd)]
    );

    function toDateKey(val) {
      if (!val) return null;
      if (val instanceof Date) return val.toISOString().slice(0, 10);
      return String(val).slice(0, 10);
    }

    const salesByDay = new Map(salesChart.map((r) => [toDateKey(r.day), Number(r.sales)]));
    const purchasesByDay = new Map(purchaseChart.map((r) => [toDateKey(r.day), Number(r.purchases)]));

    const dayCount = Math.min(
      Math.max(1, Math.round((rangeEnd - rangeStart) / 86400000) + 1),
      31 // sanity cap so "this_month" on a 31-day month doesn't explode chart width unexpectedly
    );
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(rangeEnd);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      salesChartData.push({
        name: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        Sales: salesByDay.get(key) || 0,
        Expenses: purchasesByDay.get(key) || 0,
      });
    }
  }

  // Booking status distribution — scoped to period
  const [statusRows] = await pool.query(
    `SELECT booking_status, COUNT(*) AS count FROM bookings WHERE 1=1 ${dateFilter} GROUP BY booking_status`,
    dateParams
  );
  const orderStatus = { pending: 0, completed: 0, rejected: 0 };
  for (const r of statusRows) {
    if (r.booking_status === 'Pending') orderStatus.pending = r.count;
    if (r.booking_status === 'Completed') orderStatus.completed = r.count;
    if (r.booking_status === 'Rejected') orderStatus.rejected = r.count;
  }

  // Recent bookings/sales stay all-time (recency lists), unaffected by period filter
  const [recentBookings] = await pool.query(
    `SELECT b.id, c.customer_name, c.mobile_number AS mobile_no, b.booking_date, b.payable, b.booking_status
     FROM bookings b LEFT JOIN customers c ON c.id = b.customer_id
     ORDER BY b.id DESC LIMIT 5`
  );

  const [recentSales] = await pool.query(
    `SELECT si.id, si.receipt_no, c.customer_name, c.mobile_number AS mobile, si.payable,
            COALESCE(cp.paid, 0) AS paid
     FROM sale_invoices si
     LEFT JOIN customers c ON c.id = si.customer_id
     LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM customer_payments GROUP BY invoice_id) cp
       ON cp.invoice_id = si.id
     ORDER BY si.id DESC LIMIT 5`
  );

  const derivedSalesStatus = (payable, paid) => {
    if (paid >= payable) return 'Completed';
    if (paid > 0) return 'Pending';
    return 'Pending';
  };

  return {
    stats: { totalCustomers, totalProducts, totalStaff, totalSales: Number(totalSales), totalBookings },
    salesChartData,
    orderStatus,
    recentBookings: recentBookings.map((b) => ({
      id: `BK-${b.id}`,
      customer_name: b.customer_name || 'Walk-in',
      mobile_no: b.mobile_no || '-',
      booking_date: b.booking_date,
      payable: Number(b.payable),
      booking_status: b.booking_status,
    })),
    recentSales: recentSales.map((s) => ({
      id: s.receipt_no ? `INV-${s.receipt_no}` : `INV-${s.id}`,
      customer_name: s.customer_name || 'Walk-in',
      mobile: s.mobile || '-',
      payable: Number(s.payable),
      status: derivedSalesStatus(Number(s.payable), Number(s.paid)),
    })),
  };
}

const controller = {
  getDashboard: catchAsync(async (req, res) => {
    const period = req.query.period || 'this_month';
    const data = await getDashboardData(period);
    sendResponse(res, 200, 'Dashboard data fetched successfully', data);
  }),
};

const router = express.Router();

const protectResource = require('../../middleware/protectResource');
router.use(...protectResource('DASHBOARD'));
router.get('/', controller.getDashboard);
module.exports = router;