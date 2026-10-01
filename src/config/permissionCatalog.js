// src/config/permissionCatalog.js

const PERMISSION_CATALOG = [
  {
    module: "Dashboard",
    code: "DASHBOARD",
    permissions: [
      "ACCESS.DASHBOARD.READ",
    ],
  },

  {
    module: "Sales",
    code: "SALES",
    permissions: [
      "ACCESS.ITEMS.READ",
      "ACCESS.ITEMS.CREATE",
      "ACCESS.ITEMS.UPDATE",
      "ACCESS.ITEMS.DELETE",

      "ACCESS.SALES.READ",
      "ACCESS.SALES.CREATE",
      "ACCESS.SALES.UPDATE",
      "ACCESS.SALES.DELETE",

      "ACCESS.PURCHASES.READ",
      "ACCESS.PURCHASES.CREATE",
      "ACCESS.PURCHASES.UPDATE",
      "ACCESS.PURCHASES.DELETE",

      "ACCESS.BOOKINGS.READ",
      "ACCESS.BOOKINGS.CREATE",
      "ACCESS.BOOKINGS.UPDATE",
      "ACCESS.BOOKINGS.DELETE",
    ],
  },

  {
    module: "Inventory",
    code: "INVENTORY",
    permissions: [
      "ACCESS.STOCK.READ",
      "ACCESS.STOCK.CREATE",
      "ACCESS.STOCK.UPDATE",
      "ACCESS.STOCK.DELETE",
    ],
  },

  {
    module: "Finance",
    code: "FINANCE",
    permissions: [
      "ACCESS.FINANCE.READ",
      "ACCESS.FINANCE.CREATE",
      "ACCESS.FINANCE.UPDATE",
      "ACCESS.FINANCE.DELETE",
    ],
  },

  {
    module: "Accounts",
    code: "ACCOUNTS",
    permissions: [
      "ACCESS.ACCOUNTS.READ",
      "ACCESS.ACCOUNTS.CREATE",
      "ACCESS.ACCOUNTS.UPDATE",
      "ACCESS.ACCOUNTS.DELETE",
    ],
  },

  {
    module: "Customers",
    code: "CUSTOMERS",
    permissions: [
      "ACCESS.CUSTOMERS.READ",
      "ACCESS.CUSTOMERS.CREATE",
      "ACCESS.CUSTOMERS.UPDATE",
      "ACCESS.CUSTOMERS.DELETE",
    ],
  },

  {
    module: "Setup",
    code: "SETUP",
    permissions: [
      "ACCESS.SETUP.READ",
      "ACCESS.SETUP.CREATE",
      "ACCESS.SETUP.UPDATE",
      "ACCESS.SETUP.DELETE",
    ],
  },

  {
    module: "Security",
    code: "SECURITY",
    permissions: [
      "ACCESS.SECURITY.READ",
      "ACCESS.SECURITY.CREATE",
      "ACCESS.SECURITY.UPDATE",
      "ACCESS.SECURITY.DELETE",

      "ACCESS.GROUPS.READ",
      "ACCESS.GROUPS.CREATE",
      "ACCESS.GROUPS.UPDATE",
      "ACCESS.GROUPS.DELETE",

      "ACCESS.PERMISSIONS.READ",
      "ACCESS.PERMISSIONS.CREATE",
      "ACCESS.PERMISSIONS.UPDATE",
      "ACCESS.PERMISSIONS.DELETE",

      "ACCESS.USER_GROUPS.READ",
      "ACCESS.USER_GROUPS.CREATE",
      "ACCESS.USER_GROUPS.UPDATE",
      "ACCESS.USER_GROUPS.DELETE",

      "ACCESS.IP.READ",
    ],
  },
];

module.exports = PERMISSION_CATALOG;