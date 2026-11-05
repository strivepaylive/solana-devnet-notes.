# Momentum launchpad: integration status

## Current status
The redesigned landing page and risk/news API modules have been committed as source, but the frontend integration has not passed an end-to-end build or browser test. Do not deploy this branch as a production trading interface until the mismatched frontend handlers are resolved.

## Wallet deposits (noncustodial)
- A connected Solana wallet can receive SOL and SPL tokens directly from another supported Solana wallet or exchange.
- Never describe the connected public address as a custodial Momentum deposit address. It is controlled by the wallet provider, not Momentum.
- Never request recovery phrases, private keys, or secret-key exports.
- Show the selected network prominently, verify the token mint and network, and provide a copyable public address.
- Mainnet and devnet balances must remain separate. Devnet test funds are not real funds.
- Never credit an internal balance based only on a pending transaction or user-supplied transaction hash.
- If introducing hosted wallets, use a professionally audited embedded-wallet provider and server-side authentication, not plaintext browser key storage.

## Remaining blockers
1. Connect the new landing page to the discovery, risk, news, and guide modules; the old main.js still targets elements that were replaced.
2. Test wallet connections in desktop and mobile wallet browsers, including rejection and account changes.
3. Verify Raydium launch and swap transaction building with devnet wallets.
4. Set up image/metadata storage, signed uploads, and content validation.
5. Create and independently verify a Momentum-owned Raydium platform configuration before claiming any 2% fee collection.
6. Add secured Google OAuth and user profiles with appropriate row-level authorization.
7. Run security, dependency, accessibility, and end-to-end tests before any production launch.

## Payments
Direct noncustodial wallet transfers do not require Stripe. Card purchases are a separate regulated service requiring an eligible approved provider.
