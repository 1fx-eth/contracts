// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface I1FXInitializer {
    function initialize(
        address _owner,
        uint256 _amountCollateral,
        address _aTokenCollateral,
        address _vTokenBorrow,
        uint256 _targetCollateralAmount,
        uint256 _borrowAmount,
        address _swapTarget,
        bytes calldata _swapParams
    ) external;
}
