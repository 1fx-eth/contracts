// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;


interface I1FXSlot {
    function AAVE_POOL() external view returns (address);

    function ONE_INCH() external view returns (address);

    // pair config
    function COLLATERAL() external view returns (address);

    function BORROW() external view returns (address);

    function A_COLLATERAL() external view returns (address);

    function V_BORROW() external view returns (address);

    // owner
    function OWNER() external view returns (address);
}
