#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTRACTS="$ROOT/packages/contracts"
NODE_MODULES="$ROOT/node_modules"

rsync -a --delete --exclude '_testContracts' \
  "$NODE_MODULES/@erc3643org/erc-3643/contracts/" \
  "$CONTRACTS/contracts/vendor/erc3643/"

rsync -a --delete --exclude '_testContracts' --exclude 'Test.sol' \
  "$NODE_MODULES/@onchain-id/solidity/contracts/" \
  "$CONTRACTS/contracts/vendor/onchain-id/"

echo "Synced vendor contracts from node_modules"
