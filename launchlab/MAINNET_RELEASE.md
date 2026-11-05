# Momentum mainnet production release gate
**Target:** Real-money Solana mainnet launchpad. The existing Raydium LaunchLab integration is DEVNET-ONLY and must remain so until replaced with verified mainnet integration and an independently reviewed release. No real-money launch or trading is currently enabled.

## Required release evidence
- Dedicated production Solana RPC (primary/fallback), chain and program IDs verified against official sources; separate devnet and mainnet environments.
- Production-ready embedded wallet provider with audited custody/key handling, wallet recovery, signing confirmation, account security, rate limits and incident revocation.
- Official mainnet Raydium launchpad/CPMM integration and mint authority / token metadata controls; simulate and inspect every transaction before asking for signatures.
- On-chain fee config independently verified; display complete quote, slippage, network fee, expected output, minimum received, and transaction confirmation. Never claim a 2% fee is active without on-chain evidence.
- Deposit and withdrawal routes verified, network selection checks, token account rent/fees, insufficient-funds errors, pending/failed status, explorer receipts and ledger reconciliation.
- Backend authentication, durable profiles, session revocation, KYC review as legally required, encrypted personal data, and separate least-privilege database.
- Verified holdings for $2 callouts; $100 account-value plus trade-or-launch eligibility for community creation; price freshness and anti-manipulation checks.
- Messaging encryption design reviewed, PIN rate-limits and secure recovery, media scanning, 30 MB server-enforced upload limit, block/report/inbox privacy.
- Indexer, price feeds, abuse monitoring, key rotation, audit logs, alerts, backups, disaster recovery, and security review including external audit of custom contracts where applicable.
- Applicable legal, sanctions, privacy and financial compliance reviewed for supported jurisdictions, with policies and contact process.
- Test suite, reproducible build, staging integration tests, small-value mainnet smoke tests with owner approval, monitored phased release and rollback plan.

## Release policy
The production authorization must be checked by a trusted backend/deployment pipeline using independently stored evidence. `src/mainnet-readiness.js` is a testable checklist model, **not** a production security boundary or a live credential/attestation system. Never set these flags to true just to unlock trading. The public devnet UI must not advertise mainnet support until all checks are independently verified.

## Owner actions
The owner will provide production wallet/RPC/provider credentials through secure environment settings, fund only explicitly approved accounts for mainnet smoke testing, arrange required audits and legal review, and approve the final production release. Never commit secrets or seed phrases to Git.
