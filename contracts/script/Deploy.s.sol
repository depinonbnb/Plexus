// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PlexusToken} from "../src/PlexusToken.sol";
import {Staking} from "../src/Staking.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";
import {Buyback, IPancakeRouter02} from "../src/Buyback.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @notice Full Plexus deployment for BNB Chain.
/// Env:
///   PRIVATE_KEY        deployer/treasury key
///   USDC_ADDRESS       BSC USDC (0x8AC76a51...3d in prod; a mock on testnet)
///   PANCAKE_ROUTER     PancakeSwap V2 router (0x10ED43C718714eb63d5aA57B78B54704E256024E)
///   KEEPER_ADDRESS     keeper EOA that posts reward roots + triggers buyback
///   PLEX_SUPPLY        whole supply in base units (default 1_000_000_000e18)
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treasury = vm.addr(pk);
        IERC20 usdc = IERC20(vm.envAddress("USDC_ADDRESS"));
        IPancakeRouter02 router = IPancakeRouter02(vm.envAddress("PANCAKE_ROUTER"));
        address keeper = vm.envOr("KEEPER_ADDRESS", treasury);
        uint256 supply = vm.envOr("PLEX_SUPPLY", uint256(1_000_000_000e18));

        vm.startBroadcast(pk);

        PlexusToken plex = new PlexusToken(treasury, supply);
        Staking staking = new Staking(IERC20(address(plex)));
        RewardDistributor dist = new RewardDistributor(usdc, keeper);
        Buyback buyback = new Buyback(usdc, ERC20Burnable(address(plex)), router, keeper);

        vm.stopBroadcast();

        console.log("PLEX             ", address(plex));
        console.log("Staking          ", address(staking));
        console.log("RewardDistributor", address(dist));
        console.log("Buyback          ", address(buyback));
        console.log("Treasury         ", treasury);
        console.log("Keeper           ", keeper);
    }
}
