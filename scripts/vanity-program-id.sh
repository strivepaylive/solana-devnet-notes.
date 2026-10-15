#!/usr/bin/env bash
set -euo pipefail
# Run ONLY on a secure computer you control, after installing the Solana CLI.
# NEVER paste, upload, or commit the generated JSON keypair.
command -v solana-keygen >/dev/null || { echo 'Install the official Solana CLI first.'; exit 1; }
KEY_DIR="${HOME}/.config/solana/momentum-vanity"
mkdir -p "$KEY_DIR"
chmod 700 "$KEY_DIR"
cd "$KEY_DIR"
solana-keygen grind --starts-with Mom:1
printf '\nA matching public key/keypair was saved in %s\n' "$KEY_DIR"
printf 'This is NOT a deployed program. Preserve your private key securely.\n'
