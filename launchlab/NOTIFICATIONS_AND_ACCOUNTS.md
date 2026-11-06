# Momentum notifications and account architecture

## Current state
The frontend has a callouts screen and device-only notification preferences. These are not authenticated subscriptions. The email templates in `src/email-templates.js` are server-side building blocks, not active campaigns.

## Secure rollout requirements
1. Set up a **separate Momentum Supabase project**. Do not reuse the Crestora Bank project. Enable email verification, rate limits, RLS, and account recovery.
2. Choose and configure an audited embedded wallet provider supporting Solana and EVM chains, with MPC/passkey or equivalent non-exportable key management and recovery. Never store private keys in browser localStorage or Supabase public tables.
3. Verify a Momentum-owned email sending domain in Resend and configure a server-only API key. Do not expose Resend credentials in Vite client bundles.
4. Use transactional email for welcome, email verification, security notices and account recovery. Never email passwords, recovery phrases or wallet private keys.
5. Add opt-in notification subscriptions, an authenticated unsubscribe endpoint, bounce/complaint suppression and per-user frequency controls.
6. Run a server-side weekly job only after trade attribution and verified realized-P&L calculations exist. Never rank user-entered P&L cards. Keep mainnet and devnet statistics separate.
7. Implement an auditable, admin-signed announcement publisher with safe HTML escaping, moderation, expiry dates and deduplication. No arbitrary client-side broadcast endpoint.
8. Before mainnet launch, complete chain-specific wallet signing, smart contract review, end-to-end test transactions, withdrawal tests and external security audit.

## Template API
`welcomeEmail({displayName,dashboardUrl})` and `weeklyLeaderboardEmail({weekLabel,leaders,dashboardUrl,unsubscribeUrl})`. Only verified leaderboard entries are rendered; unsubscribe URL is mandatory for weekly campaigns.
