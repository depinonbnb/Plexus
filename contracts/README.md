# Plexus contracts

Foundry suite for the BNB settlement layer.

| Contract | Purpose |
| --- | --- |
| `PlexusToken.sol` | `$PLEX` BEP-20 — fixed supply, burnable, no mint authority |
| `Staking.sol` | self-custody staking: per-lot 24h maturity, LIFO unstake, worker boost |
| `RewardDistributor.sol` | per-epoch USDC rewards via cumulative Merkle claims |
| `Buyback.sol` | atomic USDC→PLEX swap + burn on PancakeSwap |

## Setup

```bash
./install.sh          # fetch OpenZeppelin + forge-std (needs Foundry)
forge build
forge test -vvv       # Staking.t.sol + RewardDistributor.t.sol
```

## Deploy (BSC testnet example)

```bash
export PRIVATE_KEY=0x...            # deployer/treasury
export USDC_ADDRESS=0x...           # testnet USDC (or a mock)
export PANCAKE_ROUTER=0x...         # PancakeSwap V2 router
export KEEPER_ADDRESS=0x...         # keeper EOA (owns RewardDistributor + Buyback)
forge script script/Deploy.s.sol --rpc-url $BSC_TESTNET_RPC_URL --broadcast
```

Then copy the printed addresses into the app's `.env`
(`PLEX_TOKEN_ADDRESS`, `STAKING_ADDRESS`, `REWARD_DISTRIBUTOR_ADDRESS`, `BUYBACK_ADDRESS`).

## Notes
- Solidity 0.8.24, optimizer on (200 runs).
- `Buyback` and `RewardDistributor` are owned by the keeper EOA; rotate via
  `Ownable.transferOwnership` if the keeper key changes.
- `RewardDistributor.rescue` / `Buyback.rescue` exist only for stuck-token recovery.
