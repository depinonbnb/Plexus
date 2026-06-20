// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Staking} from "../src/Staking.sol";
import {PlexusToken} from "../src/PlexusToken.sol";

contract StakingTest is Test {
    PlexusToken plex;
    Staking staking;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    uint256 constant THRESHOLD = 500_000e18;

    function setUp() public {
        plex = new PlexusToken(address(this), 1_000_000_000e18);
        staking = new Staking(plex);
        plex.transfer(alice, 10_000_000e18);
        plex.transfer(bob, 10_000_000e18);
    }

    function _stake(address who, uint256 amt) internal {
        vm.startPrank(who);
        plex.approve(address(staking), amt);
        staking.stake(amt);
        vm.stopPrank();
    }

    function test_StakeOpensLotAndIsImmature() public {
        _stake(alice, 1_000e18);
        assertEq(staking.stakedOf(alice), 1_000e18);
        assertEq(staking.maturedStakeOf(alice), 0, "fresh lot must not be matured");
        assertEq(staking.totalStaked(), 1_000e18);
    }

    function test_LotMaturesAfter24h() public {
        _stake(alice, 1_000e18);
        vm.warp(block.timestamp + 24 hours);
        assertEq(staking.maturedStakeOf(alice), 1_000e18);
    }

    function test_TopUpDoesNotResetAgedLot() public {
        _stake(alice, 1_000e18);
        vm.warp(block.timestamp + 24 hours); // lot 0 matured
        _stake(alice, 500e18); // lot 1 fresh
        assertEq(staking.maturedStakeOf(alice), 1_000e18, "aged lot stays matured");
        assertEq(staking.stakedOf(alice), 1_500e18);
    }

    function test_UnstakeIsLifoPreservingAgedStake() public {
        _stake(alice, 1_000e18);
        vm.warp(block.timestamp + 24 hours); // lot 0 matured
        _stake(alice, 800e18); // lot 1 fresh (youngest)

        // Unstake 500 -> burns the youngest lot first, aged lot untouched.
        vm.prank(alice);
        staking.unstake(500e18);
        assertEq(staking.maturedStakeOf(alice), 1_000e18, "aged stake preserved");
        assertEq(staking.stakedOf(alice), 1_300e18);
    }

    function test_UnstakeAcrossLots() public {
        _stake(alice, 1_000e18);
        vm.warp(block.timestamp + 24 hours);
        _stake(alice, 800e18);
        vm.prank(alice);
        staking.unstake(1_000e18); // eats all of lot1 (800) + 200 of lot0
        assertEq(staking.stakedOf(alice), 800e18);
        assertEq(staking.maturedStakeOf(alice), 800e18);
        assertEq(plex.balanceOf(alice), 10_000_000e18 - 800e18);
    }

    function test_FullUnstakeClearsLots() public {
        _stake(alice, 1_000e18);
        vm.prank(alice);
        staking.unstake(1_000e18);
        assertEq(staking.lotCount(alice), 0);
        assertEq(staking.totalStaked(), 0);
    }

    function test_RevertOnOverUnstake() public {
        _stake(alice, 1_000e18);
        vm.prank(alice);
        vm.expectRevert(Staking.InsufficientStake.selector);
        staking.unstake(1_001e18);
    }

    function test_WorkerBoostThreshold() public {
        _stake(alice, THRESHOLD);
        assertFalse(staking.hasWorkerBoost(alice, THRESHOLD), "not matured yet");
        vm.warp(block.timestamp + 24 hours);
        assertTrue(staking.hasWorkerBoost(alice, THRESHOLD));
    }

    function test_NextMatureAt() public {
        uint256 t0 = block.timestamp;
        _stake(alice, 1_000e18);
        assertEq(staking.nextMatureAt(alice), t0 + 24 hours);
        vm.warp(t0 + 24 hours);
        assertEq(staking.nextMatureAt(alice), 0, "nothing cooling once matured");
    }

    function testFuzz_StakeUnstakeConserves(uint96 a, uint96 b) public {
        vm.assume(a > 0 && b > 0 && uint256(a) + b <= 10_000_000e18);
        _stake(alice, a);
        _stake(alice, b);
        assertEq(staking.stakedOf(alice), uint256(a) + b);
        vm.prank(alice);
        staking.unstake(uint256(a) + b);
        assertEq(staking.stakedOf(alice), 0);
    }
}
