# Momentum integration status — November 5, 2026

## Source and deployment safety
The polished launchpad UI, mainnet pool feed, devnet LaunchLab account streaming, on-chain token risk signals, crypto news, browser voice guide, simplified metadata flow and non-custodial wallet address UI are implemented in source on the Momentum devnet development branch. Browser and wallet end-to-end testing are required before live production financial use.

The connected wallet's public address can receive assets on its appropriate network. Momentum **does not hold custody**. The preview is **devnet only**. Never present it as a mainnet deposit or send actual funds through a test network.

## Remaining work
1. Validate successful Raydium devnet create/buy/sell transactions with multiple wallet providers and cancelled signatures.
2. Fix security advisories, perform independent on-chain program/config audits, verify liquidity burn and graduation before advertising financial safety.
3. Set VITE_MOMENTUM_OPERATOR_WALLET (public address), connect the operator wallet and sign a real Raydium devnet PlatformConfig. Verify exact 2% platform trade fee before declaring it active.
4. Configure anti-bot Turnstile site+secret keys for metadata storage and add durable per-wallet quotas before allowing unrestricted media uploads.
5. Replace local browser trader profiles with authenticated backend profiles, server-issued nonce/challenge and secure row-level access policies.
6. Replace free cached new-pool discovery with reliable persistent RPC subscription/indexer and backfill to approach near-real-time all-launch coverage.
7. Carry out E2E UI/accessibility, load and recovery tests. Current build success is not production proof.
8. Fee collection on a commercial public site requires hosting compliant with Vercel's noncommercial Hobby restrictions, or an alternative hosting plan.

## Public-facing facts
- A mint or liquidity pool can be malicious even if its mint and freeze authorities are revoked.
- Holder concentration can include vaults; wallet clustering, owner identity and anti-MEV/rug assurances cannot be inferred from a simple risk score.
- Social links supplied by issuers are not verified identities.
- 2% Raydium PlatformConfig rate covers LaunchLab curve trades where an operator-owned config is actually used; it does not automatically cover post-graduation CPMM trading.
