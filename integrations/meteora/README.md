# Meteora SDK integration research — do not handle funds yet

This folder contains a **real official SDK import and a devnet-only unsigned create-config transaction builder** based on Meteora's published v1.5 SDK example. This is not live token creation, fee collection, wallet signatures, a deployed config, or an audited transaction workflow. It is NOT bundled into Cloudflare Workers. SDK dependencies must be installed from npm after reviewing current releases.

- Set `PUBLIC_PAYER` and `PUBLIC_FEE_CLAIMER` to public Solana devnet addresses, then `npm install && npm run preview`. It builds and shows on-chain instruction metadata but never sends a transaction.
- `PUBLIC_CONFIG=<existing DBC config pubkey> npm run inspect` reads an existing devnet config. `NETWORK=mainnet` enables **read-only inspection**, never writes.
- Never submit seed phrases or private keys to Momentum, to AI, or to scripts not individually reviewed.
- Before adding live trades, pin the SDK version, test on Solana devnet, integrate browser wallet `signTransaction`, simulate an exact transaction, verify official DBC instruction accounts and on-chain config, test LP locks, commission claims and DAMM v2 migration, audit and gate public mainnet operations.

Official guide: https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/getting-started

### SOL/USDC quote preview and platform fee

Set `QUOTE_ASSET=SOL` (default) or `QUOTE_ASSET=USDC` when running the preview. SOL uses the wrapped-SOL quote mint with 9 decimals; USDC uses the canonical Solana USDC mint with 6 decimals. This is **not** a pool creation or an executable 2% commission. Meteora`s native pool creation fee is a *fixed amount in SOL*, not a percentage. Momentum policy proposes a **2% charge on positive creator-provided initial purchase funding**, which requires a separately reviewed *atomic signed instruction*; charge no funds while this is unavailable. Do not introduce a two-step prepayment workflow. Verify final curves have at least the current Meteora keeper migration thresholds (10 SOL or 750 USDC), or provide a tested authorized migration keeper, before making any automatic graduation claim. Even USDC launches require SOL for rent and network fees.
