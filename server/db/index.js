const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
 
const dbPath = path.join(__dirname, '../../data/metabridge.db');
const dataDir = path.dirname(dbPath);
 
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
 
const db = new Database(dbPath);
 
const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  monthly_limit INTEGER DEFAULT 10,
  monthly_used INTEGER DEFAULT 0,
  last_reset TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
 
CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  type TEXT,
  category TEXT,
  status TEXT DEFAULT 'success',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
 
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
 
INSERT OR IGNORE INTO settings (key, value) VALUES ('default_limit', '10');
`;
 
db.exec(schema);
 
module.exports = db;
 