// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Minimal PancakeSwap V2 router surface used by the buyback.
interface IPancakeRouter02 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

/// @title Plexus buyback-and-burn.
/// @notice Ports the keeper's buy+burn into a single atomic on-chain action.
///         The keeper funds this contract with USDC (the buyback budget — compute
///         margin + the buyback share of PancakeSwap LP/treasury fees) and calls
///         buybackAndBurn(): it swaps USDC -> PLEX on PancakeSwap and burns the
///         PLEX received *in the same transaction*. There is no window where
///         bought PLEX can sit unburned, which was the original's failure mode
///         (a confirmed buy whose receipt couldn't be measured left PLEX unburned).
///
/// @dev    The burned amount is the contract's measured PLEX balance delta, so
///         it is structurally impossible to burn anything other than what this
///         swap produced. Slippage is bounded by `amountOutMin` (keeper-supplied,
///         quoted off-chain against the live pool).
contract Buyback is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    ERC20Burnable public immutable plex;
    IPancakeRouter02 public immutable router;

    event BoughtAndBurned(uint256 usdcIn, uint256 plexBurned);

    error NothingBought();

    constructor(IERC20 _usdc, ERC20Burnable _plex, IPancakeRouter02 _router, address keeper) Ownable(keeper) {
        usdc = _usdc;
        plex = _plex;
        router = _router;
    }

    /// @notice Swap `usdcIn` USDC held by this contract to PLEX and burn it all.
    /// @param usdcIn USDC to spend (must already be held by this contract).
    /// @param minPlexOut slippage floor, quoted off-chain by the keeper.
    /// @param deadline unix deadline for the swap.
    function buybackAndBurn(uint256 usdcIn, uint256 minPlexOut, uint256 deadline) external onlyOwner {
        uint256 before = plex.balanceOf(address(this));

        usdc.forceApprove(address(router), usdcIn);
        address[] memory path = new address[](2);
        path[0] = address(usdc);
        path[1] = address(plex);
        router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            usdcIn, minPlexOut, path, address(this), deadline
        );

        uint256 bought = plex.balanceOf(address(this)) - before;
        if (bought == 0) revert NothingBought();

        plex.burn(bought); // exact delta — cannot burn anything but this swap's output
        emit BoughtAndBurned(usdcIn, bought);
    }

    /// @notice Owner rescue for stuck tokens.
    function rescue(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
}
