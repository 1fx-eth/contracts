// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

import "../external-protocols/openzeppelin/interfaces/IERC20.sol";

/**
 * sets up Aave such that all operations can be conducted
 */
contract MockRouter {
    uint256 public rate;

    constructor(uint256 _rate) {
        rate = _rate;
    }

    function swap(
        address inAsset,
        address outAsset,
        uint256 inAm
    ) external returns (uint256 outAm) {
        IERC20(inAsset).transferFrom(msg.sender, address(this), inAm);
        outAm = (inAm * rate) / 1e18;
        IERC20(outAsset).transfer(msg.sender, outAm);
    }

    function setRate(uint256 _rate) external {
        rate = _rate;
    }
}
