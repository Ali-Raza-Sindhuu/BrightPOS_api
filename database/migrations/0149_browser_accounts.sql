CREATE TABLE browser_accounts (
  email VARCHAR(254) NOT NULL PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES browser_workspaces(id) ON DELETE CASCADE
);
