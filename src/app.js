const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("./config/env");
const pool = require("./config/db");

const authRoutes = require("./modules/auth/authRoutes");
const groupRoutes = require("./modules/groups/groupRoutes");
const userRoutes = require("./modules/users/userRoutes");
const accessControlRoutes = require("./modules/accessControl/accessControlRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const categoryRoutes = require("./modules/categories/categoryRoutes");
const subCategoryRoutes = require("./modules/subCategories/subCategoryRoutes");
const itemTypeRoutes = require("./modules/itemTypes/itemTypeRoutes");
const itemUnitRoutes = require("./modules/itemUnits/itemUnitsRoutes");
const manufacturerRoutes = require("./modules/manufacturers/manufacturerRoutes");
const shelveLocationRoutes = require("./modules/shelveLocations/shelveLocationRoutes");
const supplierRoutes = require("./modules/suppliers/supplierRoutes");
const itemRoutes = require("./modules/items/itemsRoutes");
const purchaseRoutes = require("./modules/purchase/purchaseRoute");
const goodsReceiptRoutes = require("./modules/goodsReceipt/goodsReceiptRoute");
const customerRoutes = require('./modules/customers/customerRoutes');
const saleRoutes = require('./modules/sales/saleRoutes');
const customerPaymentRoutes = require('./modules/customerPayments/paymentRoutes');
const saleReturnRoutes = require('./modules/saleReturns/returnRoutes');
const supplierPaymentRoutes = require('./modules/supplierPayments/supplierPaymentRoutes');
const purchaseReturnRoutes = require('./modules/purchaseReturns/returnRoutes');
const businessUnitRoutes = require('./modules/businessUnits/businessUnitRoutes');
const stockTransferRoute = require('./modules/stockTransfer/stockTransferRoute');
const bookingRoutes = require('./modules/bookings/bookingRoute')
const stockSnapshotRoutes = require('./modules/stockSnapshot/stockRoute');
const openingStockRoute = require('./modules/openingStock/openingStockRoute');
const bookingPaymentRoutes = require('./modules/bookingPayment/bookingPaymentRoute');
const customerLedgerRoutes = require('./modules/customerLedger/customerLedgerRoute');
const supplierLedgerRoutes = require('./modules/supplierLedger/supplierLedgerRoute');
const reorderRoute = require('./modules/reorder/reorderRoute');
const expenseVoucherRoute = require('./modules/expenseVoucher/expenseVoucherRoute');
const expenseReportRoute = require('./modules/expenseReport/expenseReport');
const expenseHeadRoute = require('./modules/expenseHead/expenseHead');
const daybookRoute = require('./modules/dayBook/dayBookRoute');
const dashboard = require('./modules/dashboard/dashboard');
const expiryTagRoutes = require('./modules/expiry-tags/expiryTag.routes');

const app = express();

// So req.ip reflects the real client address if this ever sits behind a
// reverse proxy/load balancer (Nginx, Heroku, etc) — otherwise access_ip_logs
// would just record the proxy's IP for every request. Harmless locally.
app.set("trust proxy", config.trustProxy);

// config.corsOrigins is already split/trimmed/emptied-filtered (see config/env.js).
// An empty list means "no restriction" — correct for local dev, warned about
// at boot in production.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !config.isProduction || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
  credentials: true,
}));
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan(config.isProduction ? "combined" : "dev"));

// Used by the deploy checklist and any uptime monitor to confirm the app is
// up and talking to MySQL without needing credentials.
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ success: true, message: "OK", uptime: Math.round(process.uptime()) });
  } catch {
    return res.status(503).json({ success: false, message: "Database unavailable" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/users", userRoutes);
app.use("/api/access-control", accessControlRoutes);

app.use("/api/categories", categoryRoutes);
app.use("/api/sub-categories", subCategoryRoutes);
app.use("/api/item-types", itemTypeRoutes);
app.use("/api/item-units", itemUnitRoutes);
app.use("/api/manufacturers", manufacturerRoutes);
app.use("/api/shelve-locations", shelveLocationRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/items", itemRoutes);
if (process.env.VERCEL !== "1") {
  app.use("/api/uploads", express.static(config.uploads.dir, { maxAge: config.isProduction ? "7d" : 0 }));
}
app.use("/api/purchases", purchaseRoutes);
app.use("/api/goods-receipts", goodsReceiptRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/customer-payments', customerPaymentRoutes);
app.use('/api/sale-returns', saleReturnRoutes);
app.use('/api/supplier-payments', supplierPaymentRoutes);
app.use('/api/purchase-returns', purchaseReturnRoutes);
app.use('/api/business-units', businessUnitRoutes);
app.use('/api/opening-stocks', openingStockRoute);
app.use('/api/stock-transfers', stockTransferRoute);
app.use('/api/stock-snapshots', stockSnapshotRoutes);
app.use('/api/customer-ledger', customerLedgerRoutes);
app.use('/api/supplier-ledger', supplierLedgerRoutes);
// app.use('/customer-returns', customerReturnRoutes);
app.use('/api/expense-heads', expenseHeadRoute);
app.use('/api/expense-reports', expenseReportRoute);
app.use('/api/expense-vouchers', expenseVoucherRoute);
app.use('/api/daybook', daybookRoute);
app.use('/api/bookings', bookingRoutes);
app.use('/api/booking-payments', bookingPaymentRoutes);
app.use('/api/reorders', reorderRoute);
app.use('/api/dashboard', dashboard);
app.use('/api/expiry-tags', expiryTagRoutes);
// app.use('/companies', companyRoutes);
// app.use('/departments', departmentRoutes);
// app.use('/designations', designationRoutes);
// app.use('/employees', employeeRoutes);
// app.use('/clients', clientRoutes);
// app.use('/follow-ups', followUpRoutes);
// app.use('/notifications', notificationRoutes);


app.use(notFound);
app.use(errorHandler);

module.exports = app;
