# Momentum + open-source Raydium LaunchLab

The current production Cloudflare Worker remains a read-only research beta with blocked trade routes. The standalone Vite app under [launchlab/](./launchlab/README.md) adds a separate **experimental devnet-only** wallet-signed LaunchLab interface.

To check the build:

    cd launchlab
    npm install
    npm test
    npm run build

Then run the Cloudflare Worker deployment only after verifying that public/launchlab contains the compiled assets. The source-only GitHub branch does not automatically publish this page to the existing Cloudflare deployment.

Momentum's desired 2% creation/trading fees, MEV defenses, liquidity locks, mainnet activation, safety guarantees, and full-token listing service **remain unimplemented**. Do not advertise or process real-money token launches with this integration. Consult the [launchlab README](./launchlab/README.md) for protocol and licensing caveats.
