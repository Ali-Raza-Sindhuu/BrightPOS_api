const pool  = require("../../config/db");

const SETTINGS_FIELDS = [
  "enforce_2fa",
  "lock_after_failed_attempts",
  "session_ip_binding",
  "log_permission_changes",
];

async function getSettings() {
  const [[row]] = await pool.query(`SELECT * FROM access_control_settings WHERE id = 1`);
  return row;
}

async function updateSettings(fields) {
  const updates = Object.keys(fields).filter((f) => SETTINGS_FIELDS.includes(f));
  if (!updates.length) return getSettings();

  const setClause = updates.map((f) => `${f} = ?`).join(", ");
  const values = updates.map((f) => Boolean(fields[f]));

  await pool.query(`UPDATE access_control_settings SET ${setClause} WHERE id = 1`, values);
  return getSettings();
}

module.exports = { getSettings, updateSettings, SETTINGS_FIELDS };
