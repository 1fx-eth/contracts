// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable max-line-length */

import "./external-protocols/openzeppelin/utils/Create2.sol";
import "./external-protocols/openzeppelin/proxy/ERC1967/ERC1967Proxy.sol";
import "./external-protocols/openzeppelin/utils/structs/EnumerableSet.sol";
import "./utils/1FXProxy.sol";
import "./1FXSlot.sol";

/**
 * A sample factory contract for SimpleAccount
 * A UserOperations "initCode" holds the address of the factory, and a method call (to createAccount, in this sample factory).
 * The factory's createAccount returns the target account address even if it is already installed.
 * This way, the entryPoint.getSenderAddress() can be called either before or after the account is created.
 */
contract OneFXSlotFactory {
    using EnumerableSet for EnumerableSet.UintSet;
    OneFXSlot public immutable accountImplementation;
    mapping(address => EnumerableSet.UintSet) private _userPositions;
    uint256 public currentId;

    constructor(
        IEntryPoint _entryPoint,
        address _aavePool,
        address _1inchRouter
    ) {
        accountImplementation = new OneFXSlot(_entryPoint, _aavePool, _1inchRouter);
    }

    /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createSlot(
        address _owner,
        uint256 _amountCollateral,
        address _aTokenCollateral,
        address _vTokenBorrow,
        uint256 _targetCollateralAmount,
        uint256 _borrowAmount,
        bytes calldata _swapParams
    ) public returns (OneFXSlot ret) {
        uint256 salt = ++currentId;
        address addr = getAddress(salt);
        if (addr.code.length > 0) {
            return OneFXSlot(payable(addr));
        }
        ret = OneFXSlot(payable(new OneFXProxy{salt: bytes32(salt)}(address(accountImplementation))));

        ret.initialize(
                _owner,
                _amountCollateral,
                _aTokenCollateral,
                _vTokenBorrow,
                _targetCollateralAmount,
                _borrowAmount,
                _swapParams
        );

        _userPositions[_owner].add(salt);
    }

        /**
     * create an account, and return its address.
     * returns the address even if the account is already deployed.
     * Note that during UserOperation execution, this method is called only if the account is not deployed.
     * This method returns an existing account address so that entryPoint.getSenderAddress() would work even after account creation
     */
    function createSlotWithPermit(
        address _aTokenCollateral,
        address _vTokenBorrow,
        uint256 _targetCollateralAmount,
        uint256 _borrowAmount,
        bytes calldata _swapParams,
        OneFXSlot.PermitParams calldata _permit
    ) public returns (OneFXSlot ret) {
        uint256 salt = ++currentId;
        address addr = getAddress(salt);
        if (addr.code.length > 0) {
            return OneFXSlot(payable(addr));
        }
        ret = OneFXSlot(payable(new OneFXProxy{salt: bytes32(salt)}(address(accountImplementation))));

        ret.initializeWithPermit(
                _aTokenCollateral,
                _vTokenBorrow,
                _targetCollateralAmount,
                _borrowAmount,
                _swapParams,
                _permit
        );

        _userPositions[_permit.owner].add(salt);
    }

    /**
     * calculate the counterfactual address of this account as it would be returned by createSlot()
     */
    function getAddress(uint256 salt) public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(salt),
                keccak256(abi.encodePacked(type(OneFXProxy).creationCode, abi.encode(address(accountImplementation))))
            );
    }
}
