# Momentum LaunchLab integration — devnet only

This is a **separate experimental on-chain workspace** added to Momentum. It does not alter the existing Cloudflare read-only app or remove any of its 503 safety gates.

## What is implemented
- Connect a supported injected Solana wallet (Phantom, Solflare, or compatible wallet with transaction signing).
- Inspect a Raydium LaunchLab *devnet* configuration, including the configuration account's owner and quote mint.
- Build and request wallet approval for a Raydium LaunchLab **devnet token launch** using the official SDK.
- Buy and sell against a discovered LaunchLab devnet pool (wallet approvals required).
- Inspect a pool's on-chain status, quote asset, launch config and platform config address.
- Validate ticker, HTTPS token metadata URL, quote asset and exact atomic decimal amounts.

**Unverified:** This has not been installed in a connected build environment, run against Solana devnet, or audited. The trading calls are integrated from Raydium's published SDK demo, but require hands-on testing with devnet funds and wallet compatibility verification before they can be relied upon. Never treat a code path as proof of successful transactions.

## Run and build
From this directory:

    npm install
    npm test
    npm run dev
    npm run build

The build writes Cloudflare static assets into /public/launchlab. The base Momentum Cloudflare Worker can serve them with its existing public assets configuration. The project root deployment pipeline must perform the launchlab build separately before deploying assets. The source files alone do not put a live launchpad on the website.

## Important limitations
- Hardcoded to the official **Solana devnet** RPC. No mainnet mode or mainnet configuration.
- Requires an HTTPS *public token metadata JSON URL* supplied by creator. It does not upload images/metadata to permanent storage.
- SOL uses Raydium's default candidate PDA. USDC requires a valid **devnet** Raydium configuration address for the configured devnet USDC mint; the code checks that it exists and belongs to the configured LaunchLab program.
- Uses the third-party Raydium LaunchLab program; it is **not** a new Momentum bonding curve and it provides no guarantee against MEV, sniping, impersonation, or rugs.
- **Momentum's desired 2% launch and 2% trading fees are NOT active.** The chosen on-chain Raydium platform config determines real fees. Creating and verifying an owned Momentum platform configuration is a separate required step.
- Do not claim a full LP lock, automatic graduation proof, security audit, '75% rug protection', or mainnet support. Verify each property directly on chain before public launch.
- SDK and devnet addresses can change. Version-pinned integration follows the Raydium official sample; revalidate prior to deployment.
- The Raydium SDK package is distributed under GPL-3.0. Review license obligations before commercial redistribution.
- No user private keys, mnemonic phrases, or RPC credentials should ever be requested or stored. Users approve transactions in their wallets.

Sources: https://github.com/raydium-io/raydium-sdk-V2-demo/tree/master/src/launchpad and https://github.com/raydium-io/raydium-docs-v1/blob/main/products/launchlab/code-demos.mdx
