# 2% fee and branded address runbook

Raydium LaunchLab PlatformConfig.feeRate is denominated in 1,000,000. A value of 20,000 means an additional **2% of the swap amount** on LaunchLab curve trades; it is not automatically charged after a token graduates to CPMM. The protocol trade fee and other charges are separate.

An operator must create and sign a PlatformConfig from the designated public wallet. Momentum verifies owner, configured fee and recipient before passing the platform ID into new token launches. All of these are devnet only until audited.

A main wallet address ending in Momentum is vanity branding, not a security feature. It cannot be assigned to someone else's existing key. The third-party Raydium program ID is an immutable protocol address, not a custom Momentum-owned program. Never paste seed phrases or wallet private keys into websites, CI, or chat.

LP migration with 100% proposed burn allocation needs actual on-chain tests; a configuration request alone does not prove permanent burn. A separate 2% one-time launch fee has not been implemented.

Source: https://github.com/raydium-io/raydium-docs-v1/blob/main/products/launchlab/platform-config.mdx
