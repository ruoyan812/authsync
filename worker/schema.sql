-- AuthSync 数据库表结构（Turso / libSQL）
-- 执行: npm run db:init  或  turso db shell <db-name> < schema.sql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS totp_secrets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issuer       TEXT NOT NULL DEFAULT '',
  account_name TEXT NOT NULL,
  secret_enc   TEXT NOT NULL,
  algorithm    TEXT NOT NULL DEFAULT 'SHA1',
  digits       INTEGER NOT NULL DEFAULT 6,
  period       INTEGER NOT NULL DEFAULT 30,
  created_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_totp_secrets_user ON totp_secrets(user_id);
