// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Plexus staking — self-custody PLEX staking with per-deposit maturity.
/// @notice On-chain port of the original off-chain custodial staking. Every
///         top-up is its own *lot* that ages on its own 24h clock; only the
///         matured portion (held >= STAKE_MIN_AGE) earns rewards or grants the
///         worker revenue boost. So a fresh bag staked right before a reward
///         epoch earns nothing (no sniping), while honest stakers can add to a
///         position without resetting the clock on what they've already aged.
///         Partial unstakes burn the *youngest* lots first (LIFO), preserving
///         aged stake.
///
/// @dev    Self-custody: PLEX never leaves the user's control except via their
///         own unstake(). No server key. The off-chain keeper only *reads*
///         maturedStakeOf() to size reward epochs (see RewardDistributor).
contract Staking is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice A lot must age this long before it counts as matured.
    uint256 public constant STAKE_MIN_AGE = 24 hours;

    /// @notice The staked token (PLEX).
    IERC20 public immutable stakeToken;

    struct Lot {
        uint128 amount; // base units staked in this lot
        uint64 since; // unix ts the lot was opened
    }

    /// @dev user => lots, oldest-first by insertion order (push appends newest).
    mapping(address => Lot[]) private _lots;
    /// @notice Total currently staked across all users (matured + cooling).
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount, uint256 lotIndex, uint256 since);
    event Unstaked(address indexed user, uint256 amount);

    error ZeroAmount();
    error InsufficientStake();

    constructor(IERC20 _stakeToken) {
        stakeToken = _stakeToken;
    }

    /// @notice Stake `amount` PLEX. Opens a new lot dated now (ages 24h before it
    ///         earns). Requires prior approve() of this contract for `amount`.
    function stake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        _lots[msg.sender].push(Lot({amount: uint128(amount), since: uint64(block.timestamp)}));
        totalStaked += amount;
        emit Staked(msg.sender, amount, _lots[msg.sender].length - 1, block.timestamp);
    }

    /// @notice Unstake `amount` PLEX, consuming the youngest lots first (LIFO) so
    ///         aged stake keeps earning. Full balance is always withdrawable.
    function unstake(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Lot[] storage lots = _lots[msg.sender];
        uint256 remaining = amount;

        // Walk from the tail (youngest) toward the head (oldest).
        while (remaining > 0) {
            uint256 n = lots.length;
            if (n == 0) revert InsufficientStake();
            Lot storage last = lots[n - 1];
            if (last.amount <= remaining) {
                remaining -= last.amount;
                lots.pop();
            } else {
                last.amount -= uint128(remaining);
                remaining = 0;
            }
        }

        totalStaked -= amount;
        stakeToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    // ── views (the keeper reads these to size reward epochs) ──

    /// @notice Total PLEX `user` has staked (matured + cooling).
    function stakedOf(address user) public view returns (uint256 total) {
        Lot[] storage lots = _lots[user];
        for (uint256 i = 0; i < lots.length; i++) {
            total += lots[i].amount;
        }
    }

    /// @notice Matured PLEX for `user` — the only portion that earns/boosts.
    function maturedStakeOf(address user) public view returns (uint256 mature) {
        Lot[] storage lots = _lots[user];
        for (uint256 i = 0; i < lots.length; i++) {
            if (block.timestamp - lots[i].since >= STAKE_MIN_AGE) {
                mature += lots[i].amount;
            }
        }
    }

    /// @notice Timestamp the soonest cooling lot matures, or 0 if none cooling.
    function nextMatureAt(address user) external view returns (uint256 soonest) {
        Lot[] storage lots = _lots[user];
        for (uint256 i = 0; i < lots.length; i++) {
            if (block.timestamp - lots[i].since < STAKE_MIN_AGE) {
                uint256 matureAt = uint256(lots[i].since) + STAKE_MIN_AGE;
                if (soonest == 0 || matureAt < soonest) soonest = matureAt;
            }
        }
    }

    /// @notice True if `user`'s matured stake clears `threshold` (worker boost).
    function hasWorkerBoost(address user, uint256 threshold) external view returns (bool) {
        return maturedStakeOf(user) >= threshold;
    }

    /// @notice Raw lots for `user` (off-chain keeper reconstructs epochs from these).
    function lotsOf(address user) external view returns (Lot[] memory) {
        return _lots[user];
    }

    function lotCount(address user) external view returns (uint256) {
        return _lots[user].length;
    }
}
