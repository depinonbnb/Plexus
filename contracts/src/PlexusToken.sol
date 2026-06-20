// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PLEX — the Plexus network token (BEP-20).
/// @notice Fixed-supply, burnable governance/utility token for the Plexus
///         decentralized inference network. The whole supply is minted to the
///         deployer once at construction (seeds the PancakeSwap LP + treasury);
///         there is no mint authority afterward, so supply only ever decreases
///         as the keeper's daily buyback burns PLEX. 18 decimals (EVM standard).
///
/// @dev Replaces the Solana SPL mint. No Token-2022 transfer hooks, no mint
///      authority — burn-only deflation, identical economic intent: buy + burn.
contract PlexusToken is ERC20, ERC20Burnable, Ownable {
    /// @param initialHolder receives the entire supply (deployer treasury).
    /// @param initialSupply whole supply in base units (e.g. 1_000_000_000e18).
    constructor(address initialHolder, uint256 initialSupply)
        ERC20("Plexus", "PLEX")
        Ownable(initialHolder)
    {
        _mint(initialHolder, initialSupply);
    }
}
