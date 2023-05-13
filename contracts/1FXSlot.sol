// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.18;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */
/* solhint-disable max-line-length */

// account security
import "./external-protocols/openzeppelin/utils/cryptography/ECDSA.sol";
import "./external-protocols/openzeppelin/proxy/utils/Initializable.sol";
import "./external-protocols/openzeppelin/proxy/utils/UUPSUpgradeable.sol";
import "./abstract-account/BaseAccount.sol";
import "./utils/AaveHandler.sol";

/**
 * minimal account.
 *  this is sample minimal account.
 *  has execute, eth handling methods
 *  has a single signer that can send requests through the entryPoint.
 */
contract OneFXSlot is BaseAccount, UUPSUpgradeable, Initializable, AaveHandler {
    using ECDSA for bytes32;

    IEntryPoint private immutable _entryPoint;

    event SimpleAccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}

    constructor(
        IEntryPoint anEntryPoint,
        address _aavePool,
        address _1inchRouter
    ) AaveHandler(_aavePool, _1inchRouter) {
        _entryPoint = anEntryPoint;
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        //directly from EOA owner, or through the account itself (which gets redirected through execute())
        require(msg.sender == OWNER || msg.sender == address(this), "only owner");
    }

    /**
     * execute a transaction (called directly from owner, or by entryPoint)
     */
    function execute(
        address dest,
        uint256 value,
        bytes calldata func
    ) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    /**
     * execute a sequence of transactions
     */
    function executeBatch(address[] calldata dest, bytes[] calldata func) external {
        _requireFromEntryPointOrOwner();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    /**
     * @dev The _entryPoint member is immutable, to reduce gas consumption.  To upgrade EntryPoint,
     * a new implementation of SimpleAccount must be deployed with the new EntryPoint address, then upgrading
     * the implementation by calling `upgradeTo()`
     */
    function initialize(
        address _owner,
        uint256 _amountCollateral,
        address _aTokenCollateral,
        address _vTokenBorrow,
        uint256 _targetCollateralAmount,
        uint256 _borrowAmount,
        bytes calldata _swapParams
    ) public virtual initializer {
        // init aave data and deposit
        _initializeAndDeposit(_owner, _amountCollateral, _aTokenCollateral, _vTokenBorrow);
        // flash loan and swap
        _openPosition(_targetCollateralAmount, _borrowAmount, _swapParams);
    }

    /**
     * @dev The _entryPoint member is immutable, to reduce gas consumption.  To upgrade EntryPoint,
     * a new implementation of SimpleAccount must be deployed with the new EntryPoint address, then upgrading
     * the implementation by calling `upgradeTo()`
     */
    function close(
        uint256 _targetRepayAmount,
        uint256 _targetWithdrawAmount,
        bytes calldata _swapParams
    ) public virtual onlyOwner {
        // flash loan and swap
        _closePosition(_targetRepayAmount, _targetWithdrawAmount, _swapParams);
    }

    /**
     * @dev The _entryPoint member is immutable, to reduce gas consumption.  To upgrade EntryPoint,
     * a new implementation of SimpleAccount must be deployed with the new EntryPoint address, then upgrading
     * the implementation by calling `upgradeTo()`
     */
    function closeFullPosition(bytes calldata _swapParams) public virtual onlyOwner {
        // flash loan and swap
        _closeFullPosition(_swapParams);
    }

    /**
     * @dev The _entryPoint member is immutable, to reduce gas consumption.  To upgrade EntryPoint,
     * a new implementation of SimpleAccount must be deployed with the new EntryPoint address, then upgrading
     * the implementation by calling `upgradeTo()`
     */
    function initializeWithPermit(
        address _aTokenCollateral,
        address _vTokenBorrow,
        uint256 _targetCollateralAmount,
        uint256 _borrowAmount,
        bytes calldata _swapParams,
        PermitParams calldata _permit
    ) public virtual initializer {
        // init aave data and deposit
        _initializeAndDepositWithPermit(_aTokenCollateral, _vTokenBorrow, _permit);
        // flash loan and swap
        _openPosition(_targetCollateralAmount, _borrowAmount, _swapParams);
    }

    // Require the function call went through EntryPoint or owner
    function _requireFromEntryPointOrOwner() internal view {
        require(msg.sender == address(entryPoint()) || msg.sender == OWNER, "account: not Owner or EntryPoint");
    }

    /// implement template method of BaseAccount
    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash) internal virtual override returns (uint256 validationData) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (OWNER != hash.recover(userOp.signature)) return SIG_VALIDATION_FAILED;
        return 0;
    }

    function _call(
        address target,
        uint256 value,
        bytes memory data
    ) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    /**
     * check current account deposit in the entryPoint
     */
    function getDeposit() public view returns (uint256) {
        return entryPoint().balanceOf(address(this));
    }

    /**
     * deposit more funds for this account in the entryPoint
     */
    function addDeposit() public payable {
        entryPoint().depositTo{value: msg.value}(address(this));
    }

    /**
     * withdraw value from the account's deposit
     * @param withdrawAddress target to send to
     * @param amount to withdraw
     */
    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        entryPoint().withdrawTo(withdrawAddress, amount);
    }

    function _authorizeUpgrade(address newImplementation) internal view override {
        (newImplementation);
        _onlyOwner();
    }
}
