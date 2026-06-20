// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Plexus reward distributor — per-epoch Merkle USDC payouts to stakers.
/// @notice Replaces the Solana per-staker reward-vault funding. Each epoch the
///         off-chain keeper:
///           1. reads every staker's matured stake from Staking.sol,
///           2. splits the epoch's USDC pool pro-rata by matured stake,
///           3. builds a Merkle tree of (account, cumulativeAmount) leaves,
///           4. funds this contract with the epoch USDC and posts the root.
///         Stakers claim against the latest root. Amounts are *cumulative* so a
///         staker who misses epochs still claims everything owed in one tx, and
///         a per-account `claimed` ledger makes double-claims impossible.
///
/// @dev    Cumulative-Merkle is the standard gas-efficient EVM payout pattern:
///         O(1) storage per claimer regardless of epoch count, one on-chain tx
///         per epoch (post the root) instead of N transfers. Leaf =
///         keccak256(abi.encodePacked(account, cumulativeAmount)).
contract RewardDistributor is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The reward token (USDC on BSC).
    IERC20 public immutable rewardToken;

    /// @notice Current cumulative-reward Merkle root.
    bytes32 public merkleRoot;
    /// @notice Monotonic epoch counter (incremented on each root update).
    uint256 public epoch;
    /// @notice Total USDC already claimed by each account (the cumulative ledger).
    mapping(address => uint256) public claimed;

    event RootUpdated(uint256 indexed epoch, bytes32 root, uint256 funded);
    event Claimed(address indexed account, uint256 amount, uint256 epoch);

    error NothingToClaim();
    error InvalidProof();

    constructor(IERC20 _rewardToken, address keeper) Ownable(keeper) {
        rewardToken = _rewardToken;
    }

    /// @notice Keeper posts a new cumulative root and funds the epoch's USDC.
    /// @param root new cumulative Merkle root over (account, cumulativeAmount).
    /// @param fundAmount USDC to pull from the keeper to cover this epoch's new
    ///        claimable delta. Requires prior approve().
    function updateRoot(bytes32 root, uint256 fundAmount) external onlyOwner {
        if (fundAmount > 0) {
            rewardToken.safeTransferFrom(msg.sender, address(this), fundAmount);
        }
        merkleRoot = root;
        uint256 e = ++epoch;
        emit RootUpdated(e, root, fundAmount);
    }

    /// @notice Claim everything owed up to the latest root.
    /// @param cumulativeAmount the staker's lifetime total in the current tree.
    /// @param proof Merkle proof for leaf (msg.sender, cumulativeAmount).
    function claim(uint256 cumulativeAmount, bytes32[] calldata proof) external nonReentrant {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, cumulativeAmount));
        if (!MerkleProof.verifyCalldata(proof, merkleRoot, leaf)) revert InvalidProof();

        uint256 already = claimed[msg.sender];
        if (cumulativeAmount <= already) revert NothingToClaim();

        uint256 payout = cumulativeAmount - already;
        claimed[msg.sender] = cumulativeAmount;
        rewardToken.safeTransfer(msg.sender, payout);
        emit Claimed(msg.sender, payout, epoch);
    }

    /// @notice Outstanding claimable for `account` given its cumulative leaf.
    function claimableOf(address account, uint256 cumulativeAmount) external view returns (uint256) {
        uint256 already = claimed[account];
        return cumulativeAmount > already ? cumulativeAmount - already : 0;
    }

    /// @notice Owner rescue for stuck tokens (never the reward float in normal use).
    function rescue(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
}
