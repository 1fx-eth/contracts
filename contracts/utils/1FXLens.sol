// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/I1FXFactory.sol";
import "../external-protocols/aave-v3-core/interfaces/IPool.sol";
import "../interfaces/I1FXSlot.sol";
import "../external-protocols/aave-v3-core/protocol/libraries/configuration/ReserveConfiguration.sol";

struct AaveUserData {
    uint256 totalCollateralBase;
    uint256 totalDebtBase;
    uint256 availableBorrowsBase;
    uint256 currentLiquidationThreshold;
    uint256 ltv;
    uint256 healthFactor;
}

/**
 * View contract for slots on the factory
 */
contract OneFXLens {
    using ReserveConfiguration for DataTypes.ReserveConfigurationMap;

    struct SlotData {
        address slot;
        address owner;
        address collateral;
        uint8 collateralDecimals;
        address debt;
        uint8 debtDecimals;
        uint256 totalCollateralBase;
        uint256 totalDebtBase;
        uint256 availableBorrowsBase;
        uint256 currentLiquidationThreshold;
        uint256 ltv;
        uint256 healthFactor;
    }

    function getUserSlots(
        address _user,
        address _slotFactory,
        address _aaveV3Pool
    ) external view returns (SlotData[] memory userSlots) {
        address[] memory slots = IOneFXSlotFactory(_slotFactory).getSlots(_user);
        uint256 length = slots.length;
        userSlots = new SlotData[](length);
        for (uint256 i = 0; i < length; i++) {
            userSlots[i] = getSlotData(slots[i], _aaveV3Pool);
        }
    }

    function getSlotData(address _slot, address _aaveV3Pool) public view returns (SlotData memory slotData) {
        address collateral = I1FXSlot(_slot).COLLATERAL();
        address debt = I1FXSlot(_slot).BORROW();
        AaveUserData memory aaveData = getAaveUserDataInternal(_aaveV3Pool, _slot);
        slotData = SlotData({
            slot: _slot,
            owner: I1FXSlot(_slot).OWNER(),
            collateral: collateral,
            collateralDecimals: IERC20Base(collateral).decimals(),
            debt: debt,
            debtDecimals: IERC20Base(debt).decimals(),
            totalCollateralBase: aaveData.totalCollateralBase,
            totalDebtBase: aaveData.totalDebtBase,
            availableBorrowsBase: aaveData.availableBorrowsBase,
            currentLiquidationThreshold: aaveData.currentLiquidationThreshold,
            ltv: aaveData.ltv,
            healthFactor: aaveData.healthFactor
        });
    }

    function getAaveUserDataInternal(address _pool, address _user) internal view returns (AaveUserData memory data) {
        (
            data.totalCollateralBase,
            data.totalDebtBase,
            data.availableBorrowsBase,
            data.currentLiquidationThreshold,
            data.ltv,
            data.healthFactor
        ) = IAavePool(_pool).getUserAccountData(_user);
    }

    struct ConfigData {
        address asset;
        string symbol;
        uint256 eMode;
        uint256 ltv;
        uint256 liquidationThreshold;
        uint256 liquidationBonus;
        bool siloedBorrowing;
        bool flashLoanEnabled;
    }

    function getConfig(address asset, address _aavePool) public view returns (ConfigData memory data) {
        DataTypes.ReserveConfigurationMap memory config = IPool(_aavePool).getConfiguration(asset);
        data.symbol = IERC20Base(asset).symbol();
        data.asset = asset;
        data.eMode = config.getEModeCategory();
        data.ltv = config.getLtv();
        data.liquidationThreshold = config.getLiquidationThreshold();
        data.liquidationBonus = config.getLiquidationBonus();
        data.siloedBorrowing = config.getSiloedBorrowing();
        data.flashLoanEnabled = config.getFlashLoanEnabled();
    }

    function getConfigs(address[] memory assets, address _aavePool) external view returns (ConfigData[] memory data) {
        uint256 length = assets.length;
        data = new ConfigData[](length);

        for (uint256 i = 0; i < length; i++) {
            data[i] = getConfig(assets[i], _aavePool);
        }
    }
}

interface IERC20Base {
    function decimals() external view returns (uint8);

    function symbol() external view returns (string memory);
}

interface IAavePool {
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}
