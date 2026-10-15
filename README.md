# Momentum — Solana Token Intelligence (Read-only Beta)

Momentum is a **free-first** Solana market research and token promotion web app. It includes a Cloudflare Worker API, D1 storage, mint/freeze authority checks, copycat screening, repeat-launch-payer observations, wallet-signed promotion submissions, Cloudflare Turnstile, a basic notification center and cross-chain market observation.

## MAINNET SAFETY STATUS (read this before deploying)

**No Momentum bonding-curve, swap, graduation, liquidity custody or anti-MEV smart contract is implemented or deployed. The project MUST NOT accept deposits, swaps, liquidity or live SOL trading.** This site is a read-only research beta with zero-cost, wallet-signed promotional requests when configured. A wallet signature for a boost does not spend SOL.

- `GET /api/launch-readiness` exposes public readiness metadata.
- `/api/launch`, `/api/buy`, `/api/sell`, `/api/trade`, `/api/graduate`, `/api/graduation`, `/api/migrate`, `/api/liquidity`, `/api/withdraw` and `/api/lock` **fail closed** with HTTP 503.
- `src/launch-safety.js` contains preliminary launch-policy validation (fee cap, slippage requirement, immutable settings, graduation, 100% migrated-LP lock). This is **not** a program and cannot enforce anything on Solana.
- The security tests only exercise application-level controls, not real fund safety. Run `npm test`.
- The project has **not had an independent security audit**, mainnet integration trial, or liquidity verification. 75% less rug pulls is an *unproven objective*, not a safety statistic.

## Safest path to actual launch functionality

1. **Do not deploy a new custom bonding-curve program as your first mainnet financial contract.** Evaluate well-maintained, independently reviewed protocols such as [Meteora Dynamic Bonding Curve](https://github.com/MeteoraAg/dynamic-bonding-curve) and [Raydium LaunchLab](https://github.com/raydium-io/raydium-docs-v1). Confirm their current official IDs, deployed version, upgrade authority and independent audits before selecting one.
2. On **Solana devnet**, implement a version-pinned and verified protocol SDK integration; prepare fixed-supply token mints with appropriate authority revocation. Keep all transaction signing in the user's wallet, and show the exact destination program, mints, SOL input, minimum output and fees before a user signs.
3. Fix graduation parameters at pool creation (supply allocation and immutable quote threshold); verify actual on-chain program state instead of trusting a backend index. Handle edge cases such as partial last trade, zero reserve, fee rounding, front-running price changes, migrations retried after interruption and unknown pool accounts.
4. Configure 100% of graduated LP ownership locked in the supported program escrow, with no unlocked creator/partner LP allocation (depending on protocol support). Verify escrow and pool accounts **on chain**. Note that fee claims, concentration and governance risks may remain even when LP is locked.
5. Independently review all Solana instructions and program upgrade controls; perform fuzz/property tests, simulated adversarial trading, idempotent migration tests, RPC outage tests, exact transaction simulations and a capped devnet program test. Require third-party security review before the public handles significant value.
6. Upgrade from read-only beta only via reviewed code, contract configuration and on-chain evidence. Do not use an environment toggle or an operator button alone to treat a financial program as safe.

## Deploy directly from GitHub to Cloudflare Workers (free beta)

The current `momentum-cloudflare` Git branch contains the full application, with a D1-optional *read-only* mode. Use **Cloudflare Workers > Create application > Import a repository**, connect GitHub, and choose the repository `strivepaylive/solana-devnet-notes.`. Configure:

- **Production branch:** `momentum-cloudflare` (Cloudflare may initially use the repository default `main`; after project creation change it under **Settings > Builds > Branch control**).
- **Root directory:** repository root `/` (leave blank).
- **Build command:** leave blank (or use `npm test` if Cloudflare requests one).
- **Deploy command:** `npx wrangler deploy`.
- **Worker name:** `momentum-launchpad`, as configured in `wrangler.jsonc`.

If Cloudflare deploys the repository's default `main` first, that is only a README, **not** the Momentum application. Change the production branch to `momentum-cloudflare` and redeploy. Do not connect it as a **static-only Pages** project; Momentum requires a Worker for `/api/*`.

Before enabling boosts or community reports, create a Cloudflare **D1** database, add its binding `DB`, run `schema.sql`, set `TURNSTILE_SITE_KEY` (public variable) and `TURNSTILE_SECRET_KEY` (secret), then redeploy. The market feed, global watch, manual token scans, wallet selector, and read-only analytics operate without these resources; notifications reflect only activity while the page is open. No deposits, trades, token creation, LP migration or fund custody are enabled.

**Public readiness checks:** `/api/health`, `/api/config`, `/api/launch-readiness`.

## Hosting at a $0 budget

Use Cloudflare Workers, Static Assets and D1 free allocations while within published quotas. This repository contains `wrangler.jsonc` and `schema.sql`. A local Node/npm install and a Cloudflare account are needed; **Cloudflare is not connected to this ChatGPT session**, and there is no public deployment URL to claim.

```sh
npm install
npm test
npx wrangler login
npx wrangler d1 create momentum-db
```

Put the returned D1 database ID in `wrangler.jsonc`, then execute:

```sh
npx wrangler d1 execute momentum-db --remote --file=./schema.sql
npx wrangler secret put TURNSTILE_SECRET_KEY
# Set TURNSTILE_SITE_KEY as a non-secret Worker variable in Cloudflare config
npm run deploy
```

Configure your own Turnstile site key and secret for the deployed domain. Optionally configure a Solana RPC URL via `SOLANA_RPC_URL` (never expose third-party private RPC keys in client assets). The free shared public RPC is rate-limited. After deployment, confirm `/api/health`, `/api/launch-readiness`, and `/api/feed` individually.

Never commit `.dev.vars`, private wallet keys, signing seed files, paid API credentials or a vanity program's keypair. A decorative vanity program address is not proof of safety, audit or verified protocol.

## Mainnet route researched for the $5 budget (October 2026)

Use Meteora's **existing official deployed DBC program** (`dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`) with **DAMM v2** graduation, not a freshly written unaudited Momentum fund-handling program. The project's proposed template requires a proposed 2% one-time Momentum creator-funding fee (NOT live), zero Meteora native fixed-SOL pool-creation fee, a fixed-supply SPL mint, revoked mint/freeze authority, immutable metadata and 100% permanently locked LP allocation. The SDK, config authority, graduation escrow and locks have NOT yet been implemented or verified in transactions.

- `GET /api/mainnet-plan`: proposed partner config, validation and honest readiness status. No DB required.
- `GET /api/dbc-program`: mainnet RPC checks whether the official DBC program ID points to an executable Solana account. This is only an identity check, not an audit.
- `GET /api/launch-cost`: live RPC rent-exempt minimum for an 82-byte SPL token mint and a 165-byte SPL token account, plus the per-signature base transaction fee. **Not** the full DBC launch price; on-chain virtual pool, metadata, ATAs, priority fees and later graduation require an exact transaction-specific cost simulation.
- `src/mainnet-plan.js`: safe preliminary draft template; its validator cannot replace proof of a deployed, correctly configured Meteora config.

### What must happen before a creator can launch on Momentum

1. Connect Cloudflare Workers + D1 + Turnstile and deploy the research site. The creator wallet must handle every signature locally. **No seed phrases or app-held private keys.**
2. Pick/pin a reviewed Meteora SDK version and verify the official DBC program ID on devnet and mainnet.
3. Create one **partner configuration** with strict LP allocation, no reserve withdrawals and explicit fees. Inspect on-chain config bytes, owner and authorities; decide whether it can be upgraded by admins and disclose that risk.
4. Implement and independently review wallet-signed pool and SPL mint creation, including transaction fee simulation, mint/freeze revocation and account assertions. Show actual SOL/rent requirements before signing.
5. Implement SDK-backed swap quote/build flows with slippage protection and expiry, plus actual graduation/migration keeper monitoring and verified DAMM v2 LP locks.
6. Run end-to-end devnet tests, failure/replay/congestion scenarios and externally reviewed low-value mainnet launch before public funds flow. Retain visible audit status and independent disclosures.
7. Only then change transaction routes from disabled to reviewed launch code. No environment toggle alone may unlock them.

### Funding model

The platform can be hosted free initially; creators pay Solana account rent and transaction fees. Meteora's DBC supports an optional zero pool creation fee. A **provisional wallet buffer** around `0.05–0.2 SOL` may help budgeting, but that is NOT a measured or guaranteed total. The only trustworthy total is the exact wallet transaction preview and on-chain simulation for the chosen protocol/config. Network fees can be charged even on failed transactions. User-paid rent is not the same as Momentum revenue. A permanent vanity Solana **custom program** is optional and not needed to integrate the existing DBC program; a Momentum token mint vanity address is a different address type. 

Official references: https://docs.meteora.ag/developer-guides/dbc/ ; https://solana.com/docs/core/fees ; https://solana.com/docs/programs/deploying ; https://solana.com/docs/tokens/basics/create-token-account .

## Proposed SOL/USDC launches and one-time 2% platform fee

- `GET /api/launch-quote?quote=SOL&funding=1` shows 0.02 SOL Momentum fee and 0.98 SOL remaining creator first-purchase budget. `quote=USDC&funding=100` shows 2 USDC fee and 98 USDC remaining. All outputs are **planning previews**.
- `GET /api/mainnet-plan?quote=SOL|USDC` returns the correct quote mint and decimals for the research template. The SDK research builder accepts `QUOTE_ASSET=SOL|USDC`; it never transmits transactions.
- A positive, user-authorized creator-funded first-purchase amount is required to support a meaningful proportional fee per launch. No creator funding = no fee; reject that launch model until another clearly disclosed, agreed fee basis exists. No hidden fee on token supply or market cap.
- Meteora's optional native pool creation fee is **fixed SOL**, with a minimum nonzero 0.001 SOL; it does not support an automatic 2% proportional launch fee. We leave that fee at zero in the research configuration; Momentum's proposed percentage must be executed in the *same wallet-signed atomic transaction* as pool creation and initial purchase and verified on-chain after signing. Never request prepayment or user private keys.
- The 2% launch fee is **in addition to** the proposed 2% bonding-curve swap fee and all SOL rent/network/migration costs; prominently disclose this distinction. A USDC quote means SOL is still needed for rent/fees.
- Mainnet Meteora migration keepers currently recognize specific quote thresholds: **10 SOL** or **750 USDC**. A graduation threshold below those levels may require manual migration instead of automatic keeper migration. An SDK preview alone does not guarantee the actual threshold or automatic graduation.
- **Mainnet trading remains intentionally disabled**. An unsigned quote is neither fee collection nor tested wallet integration. Configure a verified fee-recipient address, obtain independent audit/review of the combined fee instructions, test on devnet and verify pool ownership and 100% permanent LP locks before enabling any user payments.

References: https://github.com/MeteoraAg/dynamic-bonding-curve ; https://github.com/MeteoraAg/docs/blob/main/core-products/dbc/launch-configurations.mdx ; https://github.com/MeteoraAg/docs/blob/main/developer-guides/dbc/index.mdx

<!-- Cloudflare production deploy trigger: momentum-cloudflare branch, 2026-10-15 -->
