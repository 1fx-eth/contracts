// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable max-line-length */

import "./external-protocols/openzeppelin/utils/Create2.sol";
import "./external-protocols/openzeppelin/proxy/ERC1967/ERC1967Proxy.sol";
import "./external-protocols/openzeppelin/utils/structs/EnumerableSet.sol";
import "./utils/1FXProxy.sol";
import "./1FXSlot.sol";

/**
 * A sfactory to create minimal abstract accounts called "slots" that are used to hold isolated leveraged positions
 * Designed to create the position in a single click using create2 - the user can approve the projected slot address or
 * user ERC20Permit to open the position.
 */
contract OneFXSlotFactory {
    using EnumerableSet for EnumerableSet.AddressSet;
    OneFXSlot public immutable accountImplementation;
    mapping(address => EnumerableSet.AddressSet) private _userPositions;
    uint256 public currentId;

    constructor(
        IEntryPoint _entryPoint,
        address _aavePool,
        address _1inchRouter
    ) {
        accountImplementation = new OneFXSlot(_entryPoint, _aavePool, _1inchRouter);
    }

    /**
     * create a slot
     * - deposits collateral in collateral currency
     * - opens a margin position by swapping borrow amount to collateral
     * - users have to erc20-approve before the transaction can be executed 
     *      - the address to be approve can be fetched with getNextAddress
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

        _userPositions[_owner].add(address(ret));
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

        _userPositions[_permit.owner].add(address(ret));
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

    function getNextAddress() public view returns (address) {
        return
            Create2.computeAddress(
                bytes32(currentId + 1),
                keccak256(abi.encodePacked(type(OneFXProxy).creationCode, abi.encode(address(accountImplementation))))
            );
    }

    function getSlots(address _user) external view returns (address[] memory slots){
        slots = _userPositions[_user].values();
    }
}
