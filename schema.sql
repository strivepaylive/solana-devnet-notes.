-- A brand is canonical only after independent evidence checks. Do NOT let users self-register official identities.
CREATE TABLE IF NOT EXISTS canonical_tokens (
  mint TEXT PRIMARY KEY,
  chain TEXT NOT NULL DEFAULT 'solana',
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_canonical_symbol ON canonical_tokens(symbol);
CREATE TABLE IF NOT EXISTS challenges (
  nonce TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  mint TEXT NOT NULL,
  intent TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
CREATE TABLE IF NOT EXISTS boosts (
  id TEXT PRIMARY KEY,
  mint TEXT NOT NULL,
  wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','review','blocked')),
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_boosts_created ON boosts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boosts_mint_status ON boosts(mint, status);
CREATE INDEX IF NOT EXISTS idx_boosts_wallet_created ON boosts(wallet, created_at);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  mint TEXT NOT NULL,
  wallet TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_reports ON reports(wallet,mint);
CREATE TABLE IF NOT EXISTS trends (
  chain TEXT NOT NULL,
  mint TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  score REAL NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(chain,mint)
);
-- Official Solana stablecoin mint from Circle. Update registry via operator-verified sources.
INSERT OR IGNORE INTO canonical_tokens(mint,chain,name,symbol,source_url,verified_at)
VALUES('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','solana','USD Coin','USDC','https://developers.circle.com/stablecoins/usdc-contract-addresses',strftime('%s','now'));
INSERT OR IGNORE INTO canonical_tokens(mint,chain,name,symbol,source_url,verified_at)
VALUES('So11111111111111111111111111111111111111112','solana','Wrapped SOL','SOL','https://spl.solana.com/token',strftime('%s','now'));

-- Coverage starts when Momentum first scans a mint; not a historical chain-wide index.
-- Payer is NOT necessarily the developer or controller of the project.
CREATE TABLE IF NOT EXISTS origin_observations (
  mint TEXT PRIMARY KEY,
  launch_payer TEXT,
  evidence_signature TEXT,
  origin_status TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  last_liquidity_usd REAL NOT NULL DEFAULT 0,
  last_volume_24h REAL NOT NULL DEFAULT 0,
  pair_created_at INTEGER,
  observed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_origin_launch_payer ON origin_observations(launch_payer, observed_at DESC);
