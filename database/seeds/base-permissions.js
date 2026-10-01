/**
 * basePermissions.js
 *
 * Source of truth for RBAC seeding — permissionKey values here MUST exactly
 * match the `permission` strings used in SIDEBAR_CATALOG on the frontend.
 * Do not rename modules without updating SIDEBAR_CATALOG in the same change.
 */
module.exports = [
  // =========================
  // PARENT MENUS (sidebar section visibility only — READ used to show/hide
  // the section AND every child link under it in SIDEBAR_CATALOG)
  // =========================
  { permissionKey: "ACCESS.STOCK.READ", module: "STOCK", description: "Access Stock menu" },
  { permissionKey: "ACCESS.FINANCE.READ", module: "FINANCE", description: "Access Finance menu" },
  { permissionKey: "ACCESS.ACCOUNTS.READ", module: "ACCOUNTS", description: "Access Accounts menu" },
  { permissionKey: "ACCESS.CUSTOMERS.READ", module: "CUSTOMERS", description: "Access Customer menu" },
  { permissionKey: "ACCESS.SETUP.READ", module: "SETUP", description: "Access Setup menu" },
  { permissionKey: "ACCESS.SECURITY.READ", module: "SECURITY", description: "Access Security menu" },

  // =========================
  // DASHBOARD (standalone, READ only)
  // =========================
  { permissionKey: "ACCESS.DASHBOARD.READ", module: "DASHBOARD", description: "View Dashboard" },

  // =========================
  // ITEMS (standalone — sidebar id "items", label "Item Define")
  // =========================
  { permissionKey: "ACCESS.ITEMS.READ", module: "ITEMS", description: "View Item Define" },
  { permissionKey: "ACCESS.ITEMS.CREATE", module: "ITEMS", description: "Create Item Define" },
  { permissionKey: "ACCESS.ITEMS.UPDATE", module: "ITEMS", description: "Update Item Define" },
  { permissionKey: "ACCESS.ITEMS.DELETE", module: "ITEMS", description: "Delete Item Define" },
  { permissionKey: "ACCESS.ITEMS.PRINT", module: "ITEMS", description: "Print Item Define" },

  // =========================
  // SALES (standalone — sidebar id "sale", label "Sales Invoice")
  // =========================
  { permissionKey: "ACCESS.SALES.READ", module: "SALES", description: "View Sales Invoice" },
  { permissionKey: "ACCESS.SALES.CREATE", module: "SALES", description: "Create Sales Invoice" },
  { permissionKey: "ACCESS.SALES.UPDATE", module: "SALES", description: "Update Sales Invoice" },
  { permissionKey: "ACCESS.SALES.DELETE", module: "SALES", description: "Delete Sales Invoice" },
  { permissionKey: "ACCESS.SALES.PRINT", module: "SALES", description: "Print Sales Invoice" },

  // =========================
  // PURCHASES (standalone — sidebar id "purchase", label "Purchase")
  // =========================
  { permissionKey: "ACCESS.PURCHASES.READ", module: "PURCHASES", description: "View Purchase" },
  { permissionKey: "ACCESS.PURCHASES.CREATE", module: "PURCHASES", description: "Create Purchase" },
  { permissionKey: "ACCESS.PURCHASES.UPDATE", module: "PURCHASES", description: "Update Purchase" },
  { permissionKey: "ACCESS.PURCHASES.DELETE", module: "PURCHASES", description: "Delete Purchase" },
  { permissionKey: "ACCESS.PURCHASES.PRINT", module: "PURCHASES", description: "Print Purchase" },

  // =========================
  // BOOKINGS (standalone)
  // =========================
  { permissionKey: "ACCESS.BOOKINGS.READ", module: "BOOKINGS", description: "View Bookings" },
  { permissionKey: "ACCESS.BOOKINGS.CREATE", module: "BOOKINGS", description: "Create Bookings" },
  { permissionKey: "ACCESS.BOOKINGS.UPDATE", module: "BOOKINGS", description: "Update Bookings" },
  { permissionKey: "ACCESS.BOOKINGS.DELETE", module: "BOOKINGS", description: "Delete Bookings" },
  { permissionKey: "ACCESS.BOOKINGS.PRINT", module: "BOOKINGS", description: "Print Bookings" },

  // =========================
  // STOCK > Opening Stock
  // =========================
  { permissionKey: "ACCESS.OPENING_STOCK.READ", module: "OPENING_STOCK", description: "View Opening Stock" },
  { permissionKey: "ACCESS.OPENING_STOCK.CREATE", module: "OPENING_STOCK", description: "Create Opening Stock" },
  { permissionKey: "ACCESS.OPENING_STOCK.UPDATE", module: "OPENING_STOCK", description: "Update Opening Stock" },
  { permissionKey: "ACCESS.OPENING_STOCK.DELETE", module: "OPENING_STOCK", description: "Delete Opening Stock" },
  { permissionKey: "ACCESS.OPENING_STOCK.PRINT", module: "OPENING_STOCK", description: "Print Opening Stock" },

  // =========================
  // STOCK > Reorder Stock
  // =========================
  { permissionKey: "ACCESS.REORDER_STOCK.READ", module: "REORDER_STOCK", description: "View Reorder Stock" },
  { permissionKey: "ACCESS.REORDER_STOCK.CREATE", module: "REORDER_STOCK", description: "Create Reorder Stock" },
  { permissionKey: "ACCESS.REORDER_STOCK.UPDATE", module: "REORDER_STOCK", description: "Update Reorder Stock" },
  { permissionKey: "ACCESS.REORDER_STOCK.DELETE", module: "REORDER_STOCK", description: "Delete Reorder Stock" },
  { permissionKey: "ACCESS.REORDER_STOCK.PRINT", module: "REORDER_STOCK", description: "Print Reorder Stock" },

  // =========================
  // STOCK > Goods Receipt
  // =========================
  { permissionKey: "ACCESS.GOODS_RECEIPT.READ", module: "GOODS_RECEIPT", description: "View Goods Receipt" },
  { permissionKey: "ACCESS.GOODS_RECEIPT.CREATE", module: "GOODS_RECEIPT", description: "Create Goods Receipt" },
  { permissionKey: "ACCESS.GOODS_RECEIPT.UPDATE", module: "GOODS_RECEIPT", description: "Update Goods Receipt" },
  { permissionKey: "ACCESS.GOODS_RECEIPT.DELETE", module: "GOODS_RECEIPT", description: "Delete Goods Receipt" },
  { permissionKey: "ACCESS.GOODS_RECEIPT.PRINT", module: "GOODS_RECEIPT", description: "Print Goods Receipt" },

  // =========================
  // STOCK > Stock Transfer
  // =========================
  { permissionKey: "ACCESS.STOCK_TRANSFER.READ", module: "STOCK_TRANSFER", description: "View Stock Transfer" },
  { permissionKey: "ACCESS.STOCK_TRANSFER.CREATE", module: "STOCK_TRANSFER", description: "Create Stock Transfer" },
  { permissionKey: "ACCESS.STOCK_TRANSFER.UPDATE", module: "STOCK_TRANSFER", description: "Update Stock Transfer" },
  { permissionKey: "ACCESS.STOCK_TRANSFER.DELETE", module: "STOCK_TRANSFER", description: "Delete Stock Transfer" },
  { permissionKey: "ACCESS.STOCK_TRANSFER.PRINT", module: "STOCK_TRANSFER", description: "Print Stock Transfer" },

  // =========================
  // STOCK > Sales Return
  // =========================
  { permissionKey: "ACCESS.SALES_RETURN.READ", module: "SALES_RETURN", description: "View Sales Return" },
  { permissionKey: "ACCESS.SALES_RETURN.CREATE", module: "SALES_RETURN", description: "Create Sales Return" },
  { permissionKey: "ACCESS.SALES_RETURN.UPDATE", module: "SALES_RETURN", description: "Update Sales Return" },
  { permissionKey: "ACCESS.SALES_RETURN.DELETE", module: "SALES_RETURN", description: "Delete Sales Return" },
  { permissionKey: "ACCESS.SALES_RETURN.PRINT", module: "SALES_RETURN", description: "Print Sales Return" },

  // =========================
  // STOCK > Purchase Return
  // =========================
  { permissionKey: "ACCESS.PURCHASE_RETURN.READ", module: "PURCHASE_RETURN", description: "View Purchase Return" },
  { permissionKey: "ACCESS.PURCHASE_RETURN.CREATE", module: "PURCHASE_RETURN", description: "Create Purchase Return" },
  { permissionKey: "ACCESS.PURCHASE_RETURN.UPDATE", module: "PURCHASE_RETURN", description: "Update Purchase Return" },
  { permissionKey: "ACCESS.PURCHASE_RETURN.DELETE", module: "PURCHASE_RETURN", description: "Delete Purchase Return" },
  { permissionKey: "ACCESS.PURCHASE_RETURN.PRINT", module: "PURCHASE_RETURN", description: "Print Purchase Return" },

  // =========================
  // FINANCE > Supplier Account
  // =========================
  { permissionKey: "ACCESS.SUPPLIER_ACCOUNT.READ", module: "SUPPLIER_ACCOUNT", description: "View Supplier Account" },
  { permissionKey: "ACCESS.SUPPLIER_ACCOUNT.CREATE", module: "SUPPLIER_ACCOUNT", description: "Create Supplier Account" },
  { permissionKey: "ACCESS.SUPPLIER_ACCOUNT.UPDATE", module: "SUPPLIER_ACCOUNT", description: "Update Supplier Account" },
  { permissionKey: "ACCESS.SUPPLIER_ACCOUNT.DELETE", module: "SUPPLIER_ACCOUNT", description: "Delete Supplier Account" },
  { permissionKey: "ACCESS.SUPPLIER_ACCOUNT.PRINT", module: "SUPPLIER_ACCOUNT", description: "Print Supplier Account" },

  // =========================
  // FINANCE > Customer Account
  // =========================
  { permissionKey: "ACCESS.CUSTOMER_ACCOUNT.READ", module: "CUSTOMER_ACCOUNT", description: "View Customer Account" },
  { permissionKey: "ACCESS.CUSTOMER_ACCOUNT.CREATE", module: "CUSTOMER_ACCOUNT", description: "Create Customer Account" },
  { permissionKey: "ACCESS.CUSTOMER_ACCOUNT.UPDATE", module: "CUSTOMER_ACCOUNT", description: "Update Customer Account" },
  { permissionKey: "ACCESS.CUSTOMER_ACCOUNT.DELETE", module: "CUSTOMER_ACCOUNT", description: "Delete Customer Account" },
  { permissionKey: "ACCESS.CUSTOMER_ACCOUNT.PRINT", module: "CUSTOMER_ACCOUNT", description: "Print Customer Account" },

  // =========================
  // ACCOUNTS > Day Book
  // =========================
  { permissionKey: "ACCESS.DAY_BOOK.READ", module: "DAY_BOOK", description: "View Day Book" },
  { permissionKey: "ACCESS.DAY_BOOK.CREATE", module: "DAY_BOOK", description: "Create Day Book" },
  { permissionKey: "ACCESS.DAY_BOOK.UPDATE", module: "DAY_BOOK", description: "Update Day Book" },
  { permissionKey: "ACCESS.DAY_BOOK.DELETE", module: "DAY_BOOK", description: "Delete Day Book" },
  { permissionKey: "ACCESS.DAY_BOOK.PRINT", module: "DAY_BOOK", description: "Print Day Book" },

  // =========================
  // ACCOUNTS > Expense Head
  // =========================
  { permissionKey: "ACCESS.EXPENSE_HEAD.READ", module: "EXPENSE_HEAD", description: "View Expense Head" },
  { permissionKey: "ACCESS.EXPENSE_HEAD.CREATE", module: "EXPENSE_HEAD", description: "Create Expense Head" },
  { permissionKey: "ACCESS.EXPENSE_HEAD.UPDATE", module: "EXPENSE_HEAD", description: "Update Expense Head" },
  { permissionKey: "ACCESS.EXPENSE_HEAD.DELETE", module: "EXPENSE_HEAD", description: "Delete Expense Head" },
  { permissionKey: "ACCESS.EXPENSE_HEAD.PRINT", module: "EXPENSE_HEAD", description: "Print Expense Head" },

  // =========================
  // ACCOUNTS > Expense Voucher
  // =========================
  { permissionKey: "ACCESS.EXPENSE_VOUCHER.READ", module: "EXPENSE_VOUCHER", description: "View Expense Voucher" },
  { permissionKey: "ACCESS.EXPENSE_VOUCHER.CREATE", module: "EXPENSE_VOUCHER", description: "Create Expense Voucher" },
  { permissionKey: "ACCESS.EXPENSE_VOUCHER.UPDATE", module: "EXPENSE_VOUCHER", description: "Update Expense Voucher" },
  { permissionKey: "ACCESS.EXPENSE_VOUCHER.DELETE", module: "EXPENSE_VOUCHER", description: "Delete Expense Voucher" },
  { permissionKey: "ACCESS.EXPENSE_VOUCHER.PRINT", module: "EXPENSE_VOUCHER", description: "Print Expense Voucher" },

  // =========================
  // ACCOUNTS > Expense Report
  // =========================
  { permissionKey: "ACCESS.EXPENSE_REPORT.READ", module: "EXPENSE_REPORT", description: "View Expense Report" },
  { permissionKey: "ACCESS.EXPENSE_REPORT.CREATE", module: "EXPENSE_REPORT", description: "Create Expense Report" },
  { permissionKey: "ACCESS.EXPENSE_REPORT.UPDATE", module: "EXPENSE_REPORT", description: "Update Expense Report" },
  { permissionKey: "ACCESS.EXPENSE_REPORT.DELETE", module: "EXPENSE_REPORT", description: "Delete Expense Report" },
  { permissionKey: "ACCESS.EXPENSE_REPORT.PRINT", module: "EXPENSE_REPORT", description: "Print Expense Report" },

  // =========================
  // CUSTOMERS > Customer Registration (sidebar id "customer.registration", label "Registration")
  // =========================
  { permissionKey: "ACCESS.CUSTOMER_REGISTRATION.READ", module: "CUSTOMER_REGISTRATION", description: "View Customer Registration" },
  { permissionKey: "ACCESS.CUSTOMER_REGISTRATION.CREATE", module: "CUSTOMER_REGISTRATION", description: "Create Customer Registration" },
  { permissionKey: "ACCESS.CUSTOMER_REGISTRATION.UPDATE", module: "CUSTOMER_REGISTRATION", description: "Update Customer Registration" },
  { permissionKey: "ACCESS.CUSTOMER_REGISTRATION.DELETE", module: "CUSTOMER_REGISTRATION", description: "Delete Customer Registration" },
  { permissionKey: "ACCESS.CUSTOMER_REGISTRATION.PRINT", module: "CUSTOMER_REGISTRATION", description: "Print Customer Registration" },

  // =========================
  // SETUP > Suppliers
  // =========================
  { permissionKey: "ACCESS.SUPPLIERS.READ", module: "SUPPLIERS", description: "View Suppliers" },
  { permissionKey: "ACCESS.SUPPLIERS.CREATE", module: "SUPPLIERS", description: "Create Suppliers" },
  { permissionKey: "ACCESS.SUPPLIERS.UPDATE", module: "SUPPLIERS", description: "Update Suppliers" },
  { permissionKey: "ACCESS.SUPPLIERS.DELETE", module: "SUPPLIERS", description: "Delete Suppliers" },
  { permissionKey: "ACCESS.SUPPLIERS.PRINT", module: "SUPPLIERS", description: "Print Suppliers" },

  // =========================
  // SETUP > Manufacturers
  // =========================
  { permissionKey: "ACCESS.MANUFACTURERS.READ", module: "MANUFACTURERS", description: "View Manufacturers" },
  { permissionKey: "ACCESS.MANUFACTURERS.CREATE", module: "MANUFACTURERS", description: "Create Manufacturers" },
  { permissionKey: "ACCESS.MANUFACTURERS.UPDATE", module: "MANUFACTURERS", description: "Update Manufacturers" },
  { permissionKey: "ACCESS.MANUFACTURERS.DELETE", module: "MANUFACTURERS", description: "Delete Manufacturers" },
  { permissionKey: "ACCESS.MANUFACTURERS.PRINT", module: "MANUFACTURERS", description: "Print Manufacturers" },

  // =========================
  // SETUP > Item > Item Category
  // (setup.item is a UI-only grouping label in the sidebar — it carries no
  // permission of its own, just ACCESS.SETUP.READ like its siblings)
  // =========================
  { permissionKey: "ACCESS.ITEM_CATEGORY.READ", module: "ITEM_CATEGORY", description: "View Item Category" },
  { permissionKey: "ACCESS.ITEM_CATEGORY.CREATE", module: "ITEM_CATEGORY", description: "Create Item Category" },
  { permissionKey: "ACCESS.ITEM_CATEGORY.UPDATE", module: "ITEM_CATEGORY", description: "Update Item Category" },
  { permissionKey: "ACCESS.ITEM_CATEGORY.DELETE", module: "ITEM_CATEGORY", description: "Delete Item Category" },
  { permissionKey: "ACCESS.ITEM_CATEGORY.PRINT", module: "ITEM_CATEGORY", description: "Print Item Category" },

  // =========================
  // SETUP > Item > Item Subcategory
  // =========================
  { permissionKey: "ACCESS.ITEM_SUBCATEGORY.READ", module: "ITEM_SUBCATEGORY", description: "View Item Subcategory" },
  { permissionKey: "ACCESS.ITEM_SUBCATEGORY.CREATE", module: "ITEM_SUBCATEGORY", description: "Create Item Subcategory" },
  { permissionKey: "ACCESS.ITEM_SUBCATEGORY.UPDATE", module: "ITEM_SUBCATEGORY", description: "Update Item Subcategory" },
  { permissionKey: "ACCESS.ITEM_SUBCATEGORY.DELETE", module: "ITEM_SUBCATEGORY", description: "Delete Item Subcategory" },
  { permissionKey: "ACCESS.ITEM_SUBCATEGORY.PRINT", module: "ITEM_SUBCATEGORY", description: "Print Item Subcategory" },

  // =========================
  // SETUP > Item > Item Type
  // =========================
  { permissionKey: "ACCESS.ITEM_TYPE.READ", module: "ITEM_TYPE", description: "View Item Type" },
  { permissionKey: "ACCESS.ITEM_TYPE.CREATE", module: "ITEM_TYPE", description: "Create Item Type" },
  { permissionKey: "ACCESS.ITEM_TYPE.UPDATE", module: "ITEM_TYPE", description: "Update Item Type" },
  { permissionKey: "ACCESS.ITEM_TYPE.DELETE", module: "ITEM_TYPE", description: "Delete Item Type" },
  { permissionKey: "ACCESS.ITEM_TYPE.PRINT", module: "ITEM_TYPE", description: "Print Item Type" },

  // =========================
  // SETUP > Item > Item Unit
  // =========================
  { permissionKey: "ACCESS.ITEM_UNIT.READ", module: "ITEM_UNIT", description: "View Item Unit" },
  { permissionKey: "ACCESS.ITEM_UNIT.CREATE", module: "ITEM_UNIT", description: "Create Item Unit" },
  { permissionKey: "ACCESS.ITEM_UNIT.UPDATE", module: "ITEM_UNIT", description: "Update Item Unit" },
  { permissionKey: "ACCESS.ITEM_UNIT.DELETE", module: "ITEM_UNIT", description: "Delete Item Unit" },
  { permissionKey: "ACCESS.ITEM_UNIT.PRINT", module: "ITEM_UNIT", description: "Print Item Unit" },

  // =========================
  // SETUP > Item > Expiry Tags
  // =========================
  { permissionKey: "ACCESS.EXPIRY_TAGS.READ", module: "EXPIRY_TAGS", description: "View Expiry Tags" },
  { permissionKey: "ACCESS.EXPIRY_TAGS.CREATE", module: "EXPIRY_TAGS", description: "Create Expiry Tags" },
  { permissionKey: "ACCESS.EXPIRY_TAGS.UPDATE", module: "EXPIRY_TAGS", description: "Update Expiry Tags" },
  { permissionKey: "ACCESS.EXPIRY_TAGS.DELETE", module: "EXPIRY_TAGS", description: "Delete Expiry Tags" },
  { permissionKey: "ACCESS.EXPIRY_TAGS.PRINT", module: "EXPIRY_TAGS", description: "Print Expiry Tags" },

  // =========================
  // SETUP > Item > Shelve Location
  // =========================
  { permissionKey: "ACCESS.SHELVE_LOCATION.READ", module: "SHELVE_LOCATION", description: "View Shelve Location" },
  { permissionKey: "ACCESS.SHELVE_LOCATION.CREATE", module: "SHELVE_LOCATION", description: "Create Shelve Location" },
  { permissionKey: "ACCESS.SHELVE_LOCATION.UPDATE", module: "SHELVE_LOCATION", description: "Update Shelve Location" },
  { permissionKey: "ACCESS.SHELVE_LOCATION.DELETE", module: "SHELVE_LOCATION", description: "Delete Shelve Location" },
  { permissionKey: "ACCESS.SHELVE_LOCATION.PRINT", module: "SHELVE_LOCATION", description: "Print Shelve Location" },

  // =========================
  // SETUP > Accounts > Bank Information
  // (Accounts is a UI-only grouping label under Setup, like Item is —
  // carries no permission of its own, just ACCESS.SETUP.READ like its siblings)
  // =========================
  { permissionKey: "ACCESS.BANK_INFORMATION.READ", module: "BANK_INFORMATION", description: "View Bank Information" },
  { permissionKey: "ACCESS.BANK_INFORMATION.CREATE", module: "BANK_INFORMATION", description: "Create Bank Information" },
  { permissionKey: "ACCESS.BANK_INFORMATION.UPDATE", module: "BANK_INFORMATION", description: "Update Bank Information" },
  { permissionKey: "ACCESS.BANK_INFORMATION.DELETE", module: "BANK_INFORMATION", description: "Delete Bank Information" },
  { permissionKey: "ACCESS.BANK_INFORMATION.PRINT", module: "BANK_INFORMATION", description: "Print Bank Information" },

  // =========================
  // PARENT MENU: PAYROLL (sidebar section visibility — READ shows the
  // section AND every child link under it, same pattern as STOCK/FINANCE/etc.)
  // =========================
  { permissionKey: "ACCESS.PAYROLL.READ", module: "PAYROLL", description: "Access Payroll menu" },

  // =========================
  // PAYROLL > Departments
  // =========================
  { permissionKey: "ACCESS.DEPARTMENTS.READ", module: "DEPARTMENTS", description: "View Departments" },
  { permissionKey: "ACCESS.DEPARTMENTS.CREATE", module: "DEPARTMENTS", description: "Create Departments" },
  { permissionKey: "ACCESS.DEPARTMENTS.UPDATE", module: "DEPARTMENTS", description: "Update Departments" },
  { permissionKey: "ACCESS.DEPARTMENTS.DELETE", module: "DEPARTMENTS", description: "Delete Departments" },
  { permissionKey: "ACCESS.DEPARTMENTS.PRINT", module: "DEPARTMENTS", description: "Print Departments" },

  // =========================
  // PAYROLL > Designations
  // =========================
  { permissionKey: "ACCESS.DESIGNATIONS.READ", module: "DESIGNATIONS", description: "View Designations" },
  { permissionKey: "ACCESS.DESIGNATIONS.CREATE", module: "DESIGNATIONS", description: "Create Designations" },
  { permissionKey: "ACCESS.DESIGNATIONS.UPDATE", module: "DESIGNATIONS", description: "Update Designations" },
  { permissionKey: "ACCESS.DESIGNATIONS.DELETE", module: "DESIGNATIONS", description: "Delete Designations" },
  { permissionKey: "ACCESS.DESIGNATIONS.PRINT", module: "DESIGNATIONS", description: "Print Designations" },

  // =========================
  // PAYROLL > Duty Shifts
  // =========================
  { permissionKey: "ACCESS.DUTY_SHIFTS.READ", module: "DUTY_SHIFTS", description: "View Duty Shifts" },
  { permissionKey: "ACCESS.DUTY_SHIFTS.CREATE", module: "DUTY_SHIFTS", description: "Create Duty Shifts" },
  { permissionKey: "ACCESS.DUTY_SHIFTS.UPDATE", module: "DUTY_SHIFTS", description: "Update Duty Shifts" },
  { permissionKey: "ACCESS.DUTY_SHIFTS.DELETE", module: "DUTY_SHIFTS", description: "Delete Duty Shifts" },
  { permissionKey: "ACCESS.DUTY_SHIFTS.PRINT", module: "DUTY_SHIFTS", description: "Print Duty Shifts" },
  
  // =========================
  // SECURITY > Groups
  // (sidebar only links to one "Access Control" page — these are the
  // tabs/sections inside that page, following the same Stock-style pattern)
  // =========================
  { permissionKey: "ACCESS.GROUPS.READ", module: "GROUPS", description: "View Groups" },
  { permissionKey: "ACCESS.GROUPS.CREATE", module: "GROUPS", description: "Create Groups" },
  { permissionKey: "ACCESS.GROUPS.UPDATE", module: "GROUPS", description: "Update Groups" },
  { permissionKey: "ACCESS.GROUPS.DELETE", module: "GROUPS", description: "Delete Groups" },

  // =========================
  // SECURITY > User Groups
  // =========================
  { permissionKey: "ACCESS.USER_GROUPS.READ", module: "USER_GROUPS", description: "View User Groups" },
  { permissionKey: "ACCESS.USER_GROUPS.CREATE", module: "USER_GROUPS", description: "Create User Groups" },
  { permissionKey: "ACCESS.USER_GROUPS.UPDATE", module: "USER_GROUPS", description: "Update User Groups" },
  { permissionKey: "ACCESS.USER_GROUPS.DELETE", module: "USER_GROUPS", description: "Delete User Groups" },

  // =========================
  // SECURITY > Permissions
  // =========================
  { permissionKey: "ACCESS.PERMISSIONS.READ", module: "PERMISSIONS", description: "View Permissions" },
  { permissionKey: "ACCESS.PERMISSIONS.CREATE", module: "PERMISSIONS", description: "Create Permissions" },
  { permissionKey: "ACCESS.PERMISSIONS.UPDATE", module: "PERMISSIONS", description: "Update Permissions" },
  { permissionKey: "ACCESS.PERMISSIONS.DELETE", module: "PERMISSIONS", description: "Delete Permissions" },

  // =========================
  // SECURITY > Control Panel
  // =========================
  { permissionKey: "ACCESS.CONTROL_PANEL.READ", module: "CONTROL_PANEL", description: "View Control Panel" },
  { permissionKey: "ACCESS.CONTROL_PANEL.CREATE", module: "CONTROL_PANEL", description: "Create Control Panel" },
  { permissionKey: "ACCESS.CONTROL_PANEL.UPDATE", module: "CONTROL_PANEL", description: "Update Control Panel" },
  { permissionKey: "ACCESS.CONTROL_PANEL.DELETE", module: "CONTROL_PANEL", description: "Delete Control Panel" },

  // =========================
  // SECURITY > IP Tracking (READ only)
  // =========================
  { permissionKey: "ACCESS.IP_TRACKING.READ", module: "IP_TRACKING", description: "View IP Tracking" },
];