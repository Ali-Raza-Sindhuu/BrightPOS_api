CREATE TABLE browser_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  workspace_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES browser_workspaces(id) ON DELETE CASCADE
);
