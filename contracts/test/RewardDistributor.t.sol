// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RewardDistributor} from "../src/RewardDistributor.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract RewardDistributorTest is Test {
    MockUSDC usdc;
    RewardDistributor dist;
    address keeper = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        usdc = new MockUSDC();
        dist = new RewardDistributor(usdc, keeper);
    }

    // Build a 2-leaf tree for (alice, aAmt) and (bob, bAmt).
    function _tree(uint256 aAmt, uint256 bAmt)
        internal
        view
        returns (bytes32 root, bytes32 aLeaf, bytes32 bLeaf)
    {
        aLeaf = keccak256(abi.encodePacked(alice, aAmt));
        bLeaf = keccak256(abi.encodePacked(bob, bAmt));
        root = aLeaf < bLeaf
            ? keccak256(abi.encodePacked(aLeaf, bLeaf))
            : keccak256(abi.encodePacked(bLeaf, aLeaf));
    }

    function test_PostRootAndClaim() public {
        (bytes32 root, , bytes32 bLeaf) = _tree(100e18, 50e18);
        usdc.approve(address(dist), 150e18);
        dist.updateRoot(root, 150e18);
        assertEq(dist.epoch(), 1);

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = bLeaf; // alice's sibling is bob's leaf

        vm.prank(alice);
        dist.claim(100e18, proof);
        assertEq(usdc.balanceOf(alice), 100e18);
        assertEq(dist.claimed(alice), 100e18);
    }

    function test_DoubleClaimReverts() public {
        (bytes32 root, , bytes32 bLeaf) = _tree(100e18, 50e18);
        usdc.approve(address(dist), 150e18);
        dist.updateRoot(root, 150e18);

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = bLeaf;
        vm.startPrank(alice);
        dist.claim(100e18, proof);
        vm.expectRevert(RewardDistributor.NothingToClaim.selector);
        dist.claim(100e18, proof);
        vm.stopPrank();
    }

    function test_CumulativeAcrossEpochs() public {
        // Epoch 1: alice cumulative 100, bob 50.
        (bytes32 r1, , bytes32 b1) = _tree(100e18, 50e18);
        usdc.approve(address(dist), 150e18);
        dist.updateRoot(r1, 150e18);
        bytes32[] memory p1 = new bytes32[](1);
        p1[0] = b1;
        vm.prank(alice);
        dist.claim(100e18, p1);
        assertEq(usdc.balanceOf(alice), 100e18);

        // Epoch 2: alice cumulative grows to 175 (delta 75). Fund the delta.
        (bytes32 r2, , bytes32 b2) = _tree(175e18, 60e18);
        usdc.approve(address(dist), 85e18); // 75 alice delta + 10 bob delta
        dist.updateRoot(r2, 85e18);
        bytes32[] memory p2 = new bytes32[](1);
        p2[0] = b2;
        vm.prank(alice);
        dist.claim(175e18, p2);
        assertEq(usdc.balanceOf(alice), 175e18, "alice gets only the 75 delta");
        assertEq(dist.claimed(alice), 175e18);
    }

    function test_InvalidProofReverts() public {
        (bytes32 root, , ) = _tree(100e18, 50e18);
        usdc.approve(address(dist), 150e18);
        dist.updateRoot(root, 150e18);
        bytes32[] memory bad = new bytes32[](1);
        bad[0] = bytes32(uint256(0xdead));
        vm.prank(alice);
        vm.expectRevert(RewardDistributor.InvalidProof.selector);
        dist.claim(100e18, bad);
    }

    function test_OnlyKeeperUpdatesRoot() public {
        vm.prank(alice);
        vm.expectRevert();
        dist.updateRoot(bytes32(0), 0);
    }
}
