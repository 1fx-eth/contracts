// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

// pool and tokens
import "../external-protocols/aave-v3-core/interfaces/IPool.sol";
import "../external-protocols/aave-v3-core/interfaces/IAToken.sol";
import "../external-protocols/aave-v3-core/interfaces/IVariableDebtToken.sol";

// flash loan implementation
import "../interfaces/IFlashLoanReceiverAave.sol";

/**
 * sets up Aave such that all operations can be conducted
 */
contract AaveHandler is IFlashLoanSimpleReceiver {
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
    function initializeAave(
        uint256 _amountCollateral,
        address _aTokenCollateral,
        address _vTokenBorrow,
        uint8 _eMode
    ) internal {
        address aTokenCollateral = _aTokenCollateral;
        address vTokenBorrow = _vTokenBorrow;
        address assetCollateral = IAToken(_aTokenCollateral).UNDERLYING_ASSET_ADDRESS();

        COLLATERAL = assetCollateral;
        BORROW = IVariableDebtToken(vTokenBorrow).UNDERLYING_ASSET_ADDRESS();
        A_COLLATERAL = aTokenCollateral;
        V_BORROW = _vTokenBorrow;

        // transfer collateral from user
        IERC20(assetCollateral).transferFrom(msg.sender, address(this), _amountCollateral);
        // deposit to aave
        IPool(AAVE_POOL).deposit(assetCollateral, _amountCollateral, address(this), 0);

        // configure collateral
        IPool(AAVE_POOL).setUserUseReserveAsCollateral(assetCollateral, true);
        IPool(AAVE_POOL).setUserEMode(_eMode);
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
        return false;
    }

    function openPosition(uint256 borrowAmountIn) internal {}

    function validateEMode(
        uint8 _eMode,
        address asset0,
        address asset1
    ) public view {
        // DataTypes.EModeCategory memory data = IPool(AAVE_POOL).getEModeCategoryData(_eMode);
        // data.
    }
}
