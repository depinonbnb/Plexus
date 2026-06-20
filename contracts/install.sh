#!/usr/bin/env bash
# Fetch Solidity dependencies for the Plexus contracts (run once).
# Requires Foundry: https://getfoundry.sh  (curl -L https://foundry.paradigm.xyz | bash && foundryup)
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v forge >/dev/null 2>&1; then
  echo "forge not found. Install Foundry first: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
fi

forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install foundry-rs/forge-std --no-commit
echo "deps installed. Run: forge build && forge test -vvv"
