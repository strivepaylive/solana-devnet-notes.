# Momentum LaunchLab — Devnet Studio and Market Radar

This adds a redesigned original Momentum brand, token-launch studio and risk-informed discovery interface to the existing Raydium LaunchLab devnet experiment. The existing Cloudflare read-only research beta and mainnet trade blocks remain unchanged.

## Implemented interface
- Original orbital-M SVG logo/favicon, custom Momentum wordmark, responsive animations, mobile design.
- Mainnet GeckoTerminal newest **liquidity pools** (not every new mint), source caching approximately one minute.
- Solana devnet Raydium LaunchLab account-change streaming when the public RPC supports it, with approximate funding-curve progress, creator, status and configuration addresses.
- Risk badges from mint/freeze authority, Token-2022 extension checks, top-token-account concentration and explicit unknowns. Optional Web Audio alert. Nothing is labeled universally safe.
- Token descriptions and social links from GeckoTerminal, labeled as source claims and not independent endorsement.
- Curated worldwide crypto headlines via GDELT public news index, which can be delayed or unavailable. No X/Twitter firehose.
- Simplified token-creation flow (name, ticker, image, description, website, X, Telegram). Technical config and manual metadata URL live behind Advanced.
- Nova guided tutorial with optional browser voice and no microphone; local wallet profile with a personal avatar/nickname.
- Devnet wallet-owned launch/trade SDK code. No live-wallet end-to-end trial or security audit yet.
- Vercel Blob metadata publisher guarded by server-verified Cloudflare Turnstile. Disabled when either CAPTCHA secret or sitekey is absent; use Advanced metadata URL in that case.
- Optional operator-only Raydium PlatformConfig creation with desired 2% bonding-curve trade fee (20,000 parts per million) and 100% proposed CPMM LP burn allocation. NOT applied to Momentum tokens until the operator config exists and is verified on-chain.

## Local
    cd launchlab
    npm install
    npm test
    npm run build

Vercel project: root directory launchlab; Vite; build command npm run build; output directory dist. Serverless functions live in launchlab/api.

## Configuration
To use operator fee setup, set VITE_MOMENTUM_OPERATOR_WALLET to your PUBLIC Solana wallet address on Vercel and rebuild. Connect that exact wallet and supply an official Raydium devnet CPMM config account. Only the operator wallet may sign creation. The app verifies the resulting platform program ownership, 2% fee rate and recipient account on chain before using it for new launches.

To use simple image/metadata publishing, attach the already-created public Vercel Blob store (BLOB_READ_WRITE_TOKEN) and configure VITE_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY for this domain. These must be set in Vercel environment variables, NEVER in GitHub source. Without both CAPTCHA keys the upload endpoint stays disabled. File types are PNG/JPEG/WebP max 1 MB. A server-side human check is mandatory. Additional wallet-based quotas should be introduced before opening large-scale uploads.

## Not yet implemented/verified
- Global token mint firehose, guaranteed immediate detection of every launch, persistent event indexing/backfill, all-chain bonding curves, and live production market trading.
- Audited anti-MEV protection, sniper resistance, provable rug prevention, audited LP migration or guaranteed 100% on-chain burn.
- Real end-to-end signed launch, real swap confirmation, on-chain verified Momentum fee collection or 2% one-time launch charge.
- Shared public profile database, social follow system, real profile authentication with server-issued nonces.

## Before a public real-money rollout
Review open-source licenses, update vulnerable dependencies, test live transactions and migrations on devnet, implement persistent low-latency indexing, secure quota-controlled asset uploads, prove all fee recipients and platform control, and obtain independent contract/infrastructure security review. Vercel Hobby plan is non-commercial only: a fee-earning production app needs compliant hosting. Mainnet Solana fees/rent are not free.

Reference:
https://github.com/raydium-io/raydium-sdk-V2-demo/tree/master/src/launchpad
https://github.com/raydium-io/raydium-docs-v1/blob/main/products/launchlab/platform-config.mdx
https://api.geckoterminal.com/docs/index.html
