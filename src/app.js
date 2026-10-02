const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const config = require("./config/env");
const pool = require("./config/db");

const authRoutes = require("./modules/auth/auth.routes");
const groupRoutes = require("./modules/groups/group.routes");
const userRoutes = require("./modules/users/user.routes");
const accessControlRoutes = require("./modules/access-control/access-control.routes");
const { notFound, errorHandler } = require("./middleware/error-handler");

const categoryRoutes = require("./modules/categories/category.routes");
const subCategoryRoutes = require("./modules/sub-categories/sub-category.routes");
const itemTypeRoutes = require("./modules/item-types/item-type.routes");
const itemUnitRoutes = require("./modules/item-units/item-units.routes");
const manufacturerRoutes = require("./modules/manufacturers/manufacturer.routes");
const shelveLocationRoutes = require("./modules/shelve-locations/shelve-location.routes");
const supplierRoutes = require("./modules/suppliers/supplier.routes");
const itemRoutes = require("./modules/items/items.routes");
const purchaseRoutes = require("./modules/purchases/purchase.routes");
const goodsReceiptRoutes = require("./modules/goods-receipts/goods-receipt.routes");
const customerRoutes = require('./modules/customers/customer.routes');
const saleRoutes = require('./modules/sales/sale.routes');
const customerPaymentRoutes = require('./modules/customer-payments/customer-payment.routes');
const saleReturnRoutes = require('./modules/sale-returns/sale-return.routes');
const supplierPaymentRoutes = require('./modules/supplier-payments/supplier-payment.routes');
const purchaseReturnRoutes = require('./modules/purchase-returns/purchase-return.routes');
const businessUnitRoutes = require('./modules/business-units/business-unit.routes');
const stockTransferRoute = require('./modules/stock-transfers/stock-transfer.routes');
const bookingRoutes = require('./modules/bookings/booking.routes')
const stockSnapshotRoutes = require('./modules/stock-snapshots/stock-snapshot.routes');
const openingStockRoute = require('./modules/opening-stock/opening-stock.routes');
const bookingPaymentRoutes = require('./modules/booking-payments/booking-payment.routes');
const customerLedgerRoutes = require('./modules/customer-ledger/customer-ledger.routes');
const supplierLedgerRoutes = require('./modules/supplier-ledger/supplier-ledger.routes');
const reorderRoute = require('./modules/reorders/reorder.routes');
const expenseVoucherRoute = require('./modules/expense-vouchers/expense-voucher.routes');
const expenseReportRoute = require('./modules/expense-reports/expense-report.routes');
const expenseHeadRoute = require('./modules/expense-heads/expense-head.routes');
const daybookRoute = require('./modules/daybook/day-book.routes');
const dashboard = require('./modules/dashboard/dashboard.routes');
const expiryTagRoutes = require('./modules/expiry-tags/expiry-tag.routes');

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
app.use((req,res,next)=>{req.id=require('node:crypto').randomUUID();res.set('X-Request-ID',req.id);next();});
app.use(express.json({ limit: "1mb" }));
morgan.token('request-id',req=>req.id);
app.use(morgan(config.isProduction ? (tokens,req,res)=>JSON.stringify({request_id:req.id,method:tokens.method(req,res),path:req.path,status:Number(tokens.status(req,res)),duration_ms:Number(tokens['response-time'](req,res))}) : "dev"));
app.get('/api/openapi.json',(req,res)=>res.json(require('./modules/counter/api-contract').spec(require('./modules/counter/counter.routes').contract,require('./modules/demo/demo.routes').contract)));

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


app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (req.body === undefined) req.body = {};
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return next(new (require('./utils/api-error'))(400, 'Request body must be an object'));
  }
  next();
});
app.use("/api/auth", authRoutes);
app.use('/api/marketing', require('./modules/marketing/marketing.routes'));
app.use('/api/counter', require('./modules/counter/counter.routes'));
app.use('/api/demo', require('./modules/demo/demo.routes'));
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
app.use('/api/expense-heads', expenseHeadRoute);
app.use('/api/expense-reports', expenseReportRoute);
app.use('/api/expense-vouchers', expenseVoucherRoute);
app.use('/api/daybook', daybookRoute);
app.use('/api/bookings', bookingRoutes);
app.use('/api/booking-payments', bookingPaymentRoutes);
app.use('/api/reorders', reorderRoute);
app.use('/api/dashboard', dashboard);
app.use('/api/expiry-tags', expiryTagRoutes);


app.use(notFound);
app.use(errorHandler);

module.exports = app;
