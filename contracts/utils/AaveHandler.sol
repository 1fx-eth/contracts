// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;


// pool and tokens
import "../external-protocols/aave-v3-core/interfaces/IPool.sol";
import "../external-protocols/aave-v3-core/interfaces/IAToken.sol";
import "../external-protocols/aave-v3-core/interfaces/IVariableDebtToken.sol";
import "../external-protocols/aave-v3-core/protocol/libraries/configuration/ReserveConfiguration.sol";

// flash loan implementation
import "../interfaces/IFlashLoanReceiverAave.sol";

/**
 * sets up Aave such that all operations can be conducted
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
        address,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // validate initiator
        require(initiator == address(this), "INVALID INITIATOR");
        address pool = AAVE_POOL;
        address collateral = COLLATERAL;

        // decode params
        (address target, bytes memory data, uint256 borrowAmount) = abi.decode(params, (address, bytes, uint256));

        // deposit flashed reserve
        IPool(pool).deposit(collateral, amount, address(this), 0);

        // borrow target funds
        IPool(pool).borrow(BORROW, borrowAmount, 2, 0, address(this));

        // execute and check swap
        (bool success, bytes memory result) = target.call(data);
        require(success, "SWAP FAILED");

        // decode amount received
        uint256 amountReceived = abi.decode(result, (uint256));
        uint256 amountToReturn = amount + premium;

        // validate that the repayment can be moved forward with
        require(amountReceived >= amountToReturn, "INSUFFICIENT REPAY BALLANCE");

        // collect dust
        uint256 dust;
        unchecked {
            dust = amountReceived - amountToReturn;
        }

        // deposit dust
        if (dust > 0) IPool(pool).deposit(collateral, dust, address(this), 0);

        return true;
    }

    function _openPosition(
        uint256 _targetCollateralAmount,
        uint256 _borrowAmount,
        address _swapTarget,
        bytes memory _swapParams
    ) internal {
        bytes memory callData = abi.encode(_swapTarget, _swapParams, _borrowAmount);
        IPool(AAVE_POOL).flashLoanSimple(address(this), COLLATERAL, _targetCollateralAmount, callData, 0);
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
