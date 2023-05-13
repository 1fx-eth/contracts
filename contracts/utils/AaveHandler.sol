// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

// pool and tokens
import "../external-protocols/aave-v3-core/interfaces/IPool.sol";
import "../external-protocols/aave-v3-core/interfaces/IAToken.sol";
import "../external-protocols/aave-v3-core/interfaces/IVariableDebtToken.sol";
import "../external-protocols/aave-v3-core/protocol/libraries/configuration/ReserveConfiguration.sol";

// flash loan implementation
import "../interfaces/IFlashLoanReceiverAave.sol";

import "../external-protocols/openzeppelin/token/ERC20/extensions/IERC20Permit.sol";

/**
 * sets up Aave such that all operations can be conducted
 * - opening a position
 *      - flash loan collateral
 *      - deposit collateral
 *      - borrow required funds (precalculated, approximate)
 *      - swap the borrowed funds to the currenxy borrowed in the flash loan
 *      - repay flash loan
 * - closing a position
 *      - flash loan borrow amount to be repaid
 *      - repay obtained funds
 *      - withdraw precomputed collateral amount
 *      - swap the withdrawn amount to the borrow (& flash loan) currency
 *      - repay flash loan
 */
contract AaveHandler is IFlashLoanSimpleReceiver {
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;

    address immutable AAVE_POOL;
    address immutable ONE_INCH;
    // pair config
    address public COLLATERAL;
    address public BORROW;

    address public A_COLLATERAL;
    address public V_BORROW;

    // owner
    address public OWNER;

    constructor(address _aavePool, address _1inchRouter) {
        AAVE_POOL = _aavePool;
        ONE_INCH = _1inchRouter;
    }

    /**
     * Initializes slot for aave Position
     * Deposits initial collateral, sets tokens and eMode
     */
    function _initializeAndDeposit(
        address _depositor,
        uint256 _amountCollateral,
        address _aTokenCollateral,
        address _vTokenBorrow
    ) internal {
        address aTokenCollateral = _aTokenCollateral;
        address vTokenBorrow = _vTokenBorrow;
        address assetCollateral = IAToken(_aTokenCollateral).UNDERLYING_ASSET_ADDRESS();
        address assetBorrow = IVariableDebtToken(vTokenBorrow).UNDERLYING_ASSET_ADDRESS();

        address pool = AAVE_POOL; // save gas
        address oneInch = ONE_INCH; // save gas

        COLLATERAL = assetCollateral;
        BORROW = assetBorrow;
        A_COLLATERAL = aTokenCollateral;
        V_BORROW = _vTokenBorrow;

        // approve for deposit and repayment
        IERC20(assetCollateral).approve(pool, type(uint256).max);
        IERC20(assetBorrow).approve(pool, type(uint256).max);
        IERC20(assetCollateral).approve(oneInch, type(uint256).max);
        IERC20(assetBorrow).approve(oneInch, type(uint256).max);

        // transfer collateral from user and deposit to aave
        IERC20(assetCollateral).transferFrom(_depositor, address(this), _amountCollateral);
        IPool(pool).deposit(assetCollateral, _amountCollateral, address(this), 0);
        // check eMode -> has to match
        uint8 _eMode = validateEMode(assetCollateral, assetBorrow);

        // configure collateral
        IPool(pool).setUserUseReserveAsCollateral(assetCollateral, true);
        IPool(pool).setUserEMode(_eMode);

        // set owner
        OWNER = _depositor;
    }

    struct PermitParams {
        address owner;
        address spender;
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /**
     * Initializes slot for aave Position
     * Deposits initial collateral, sets tokens and eMode
     */
    function _initializeAndDepositWithPermit(
        address _aTokenCollateral,
        address _vTokenBorrow,
        PermitParams calldata permit
    ) internal {
        address aTokenCollateral = _aTokenCollateral;
        address vTokenBorrow = _vTokenBorrow;
        address assetCollateral = IAToken(_aTokenCollateral).UNDERLYING_ASSET_ADDRESS();
        address assetBorrow = IVariableDebtToken(vTokenBorrow).UNDERLYING_ASSET_ADDRESS();

        address pool = AAVE_POOL; // save gas
        address oneInch = ONE_INCH; // save gas

        COLLATERAL = assetCollateral;
        BORROW = assetBorrow;
        A_COLLATERAL = aTokenCollateral;
        V_BORROW = _vTokenBorrow;

        // approve for deposit and repayment
        IERC20(assetCollateral).approve(pool, type(uint256).max);
        IERC20(assetBorrow).approve(pool, type(uint256).max);
        IERC20(assetCollateral).approve(oneInch, type(uint256).max);
        IERC20(assetBorrow).approve(oneInch, type(uint256).max);

        IERC20Permit(assetCollateral).permit(permit.owner, permit.spender, permit.value, permit.deadline, permit.v, permit.r, permit.s);

        // transfer collateral from user and deposit to aave
        IERC20(assetCollateral).transferFrom(permit.owner, address(this), permit.value);
        IPool(pool).deposit(assetCollateral, permit.value, address(this), 0);
        // check eMode -> has to match
        uint8 _eMode = validateEMode(assetCollateral, assetBorrow);

        // configure collateral
        IPool(pool).setUserUseReserveAsCollateral(assetCollateral, true);
        IPool(pool).setUserEMode(_eMode);
    }

    /**
     * Resests configureation - usable when user closed entire balance
     */
    function resetSlot(
        address _aTokenCollateral,
        address _vTokenBorrow,
        uint8 _eMode
    ) internal {
        require(IERC20(A_COLLATERAL).balanceOf(address(this)) == 0, "BALANCE HAS TO BE EMPTY");

        address aTokenCollateral = _aTokenCollateral;
        address vTokenBorrow = _vTokenBorrow;

        address assetCollateral = IAToken(_aTokenCollateral).UNDERLYING_ASSET_ADDRESS();
        COLLATERAL = assetCollateral;
        BORROW = IVariableDebtToken(vTokenBorrow).UNDERLYING_ASSET_ADDRESS();
        A_COLLATERAL = aTokenCollateral;
        V_BORROW = vTokenBorrow;

        IPool(AAVE_POOL).setUserEMode(_eMode);
    }

    // Flash loan call to open leveraged position
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // validate initiator
        require(initiator == address(this), "INVALID INITIATOR");
        address pool = AAVE_POOL;
        address collateral = COLLATERAL;
        if (asset == collateral) {
            // decode params
            (bytes memory data, uint256 borrowAmount) = abi.decode(params, (bytes, uint256));

            // deposit flashed reserve
            IPool(pool).deposit(collateral, amount, address(this), 0);

            // borrow target funds
            IPool(pool).borrow(BORROW, borrowAmount, 2, 0, address(this));

            // execute and check swap
            (bool success, bytes memory result) = ONE_INCH.call(data);
            require(success, "SWAP FAILED");

            // decode amount received
            uint256 amountReceived = abi.decode(result, (uint256));
            uint256 amountToReturn = amount + premium;

            // validate that the repayment can be moved forward with
            require(amountReceived >= amountToReturn, "INSUFFICIENT FLASH REPAY BALLANCE");

            // collect dust
            uint256 dust;
            unchecked {
                dust = amountReceived - amountToReturn;
            }

            // deposit dust
            if (dust > 0) IPool(pool).deposit(collateral, dust, address(this), 0);
        } else {
            // decode params - target withdraw has to be sufficient such that the funds can be repaid
            (bytes memory data, uint256 targetWithdraw) = abi.decode(params, (bytes, uint256));

            // repay flashed reserve
            IPool(pool).repay(asset, amount, 2, address(this));

            // withdraw funds dust
            IPool(pool).withdraw(collateral, targetWithdraw, OWNER);

            // execute and check swap
            (bool success, bytes memory result) = ONE_INCH.call(data);
            require(success, "SWAP FAILED");

            // decode amount received
            uint256 amountReceived = abi.decode(result, (uint256));
            uint256 amountToReturn = amount + premium;

            // validate that the repayment can be moved forward with
            require(amountReceived >= amountToReturn, "INSUFFICIENT FLASH REPAY BALLANCE");

            // collect dust
            uint256 dust;
            unchecked {
                dust = amountReceived - amountToReturn;
            }

            // transfer leftovers to user
            IERC20(asset).transfer(OWNER, dust);

            // return excess collateral if any
            uint256 balance = IERC20(collateral).balanceOf(address(this));
            if (balance > 0) IERC20(collateral).transfer(OWNER, balance);
        }
        return true;
    }

    function _openPosition(
        uint256 _targetCollateralAmount,
        uint256 _borrowAmount,
        bytes memory _swapParams
    ) internal {
        bytes memory callData = abi.encode(_swapParams, _borrowAmount);
        IPool(AAVE_POOL).flashLoanSimple(address(this), COLLATERAL, _targetCollateralAmount, callData, 0);
    }

    function _closePosition(
        uint256 _targetRepayAmount,
        uint256 _targetWithdrawAmount,
        bytes memory _swapParams
    ) internal {
        bytes memory callData = abi.encode(_swapParams, _targetWithdrawAmount);
        IPool(AAVE_POOL).flashLoanSimple(address(this), BORROW, _targetRepayAmount, callData, 0);
    }

    function _closeFullPosition(bytes memory _swapParams) internal {
        bytes memory callData = abi.encode(_swapParams, IAToken(COLLATERAL).balanceOf(address(this)));
        IPool(AAVE_POOL).flashLoanSimple(address(this), BORROW, IERC20(BORROW).balanceOf(address(this)), callData, 0);
    }

    function validateEMode(address asset0, address asset1) public view returns (uint8 eMode) {
        eMode = getEMode(asset0);
        require(eMode == getEMode(asset1), "eModes mismatch");
    }

    function getEMode(address asset) public view returns (uint8 eMode) {
        DataTypes.ReserveConfigurationMap memory config = IPool(AAVE_POOL).getConfiguration(asset);
        eMode = uint8(config.getEModeCategory());
    }
}
