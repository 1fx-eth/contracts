import { BigNumber, BigNumberish } from 'ethers';
import { Pool } from '../../../types/Pool';
import { AaveProtocolDataProvider } from '../../../types/AaveProtocolDataProvider';
import { MintableERC20 } from '../../../types/MintableERC20';
import { AToken } from '../../../types/AToken';
import { PoolAddressesProvider } from '../../../types/PoolAddressesProvider';
import { PoolAddressesProviderRegistry } from '../../../types/PoolAddressesProviderRegistry';
import { WETH9Mocked } from '../../../types/WETH9Mocked';
import {
  AaveOracle,
  AaveProtocolDataProvider__factory,
  ACLManager,
  ACLManager__factory,
  AToken__factory,
  BorrowLogic__factory,
  BridgeLogic__factory,
  ConfiguratorLogic__factory,
  DefaultReserveInterestRateStrategy__factory,
  EModeLogic__factory,
  FlashLoanLogic__factory,
  LiquidationLogic__factory,
  MintableERC20__factory,
  MockIncentivesController__factory,
  PoolAddressesProviderRegistry__factory,
  PoolAddressesProvider__factory,
  PoolConfigurator,
  PoolConfigurator__factory,
  PoolLogic__factory,
  Pool__factory,
  PriceOracle,
  PriceOracle__factory,
  PriceOracleSentinel__factory,
  SequencerOracle__factory,
  StableDebtToken,
  StableDebtToken__factory,
  SupplyLogic__factory,
  VariableDebtToken,
  VariableDebtToken__factory,
  WETH9,
  WETH9Mocked__factory
} from '../../../types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';

const ONE_18 = BigNumber.from(18).pow(10)


export interface AAVEFixture {
  deployer: SignerWithAddress;
  poolAdmin: SignerWithAddress;
  emergencyAdmin: SignerWithAddress;
  riskAdmin: SignerWithAddress;
  users: SignerWithAddress[];
  pool: Pool;
  configurator: PoolConfigurator;
  oracle: PriceOracle;
  aaveOracle: AaveOracle;
  helpersContract: AaveProtocolDataProvider;
  weth: WETH9Mocked;
  aWETH: AToken;
  dai: MintableERC20;
  aDai: AToken;
  aAave: AToken;
  variableDebtDai: VariableDebtToken;
  stableDebtDai: StableDebtToken;
  aUsdc: AToken;
  usdc: MintableERC20;
  aave: MintableERC20;
  addressesProvider: PoolAddressesProvider;
  registry: PoolAddressesProviderRegistry;
  aclManager: ACLManager;
  tokens: { [s: string]: MintableERC20 | WETH9 };
  aTokens: { [a: string]: AToken }
  sTokens: { [a: string]: StableDebtToken }
  vTokens: { [a: string]: VariableDebtToken }
}

const testEnv: AAVEFixture = {
  deployer: {} as SignerWithAddress,
  poolAdmin: {} as SignerWithAddress,
  emergencyAdmin: {} as SignerWithAddress,
  riskAdmin: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  pool: {} as Pool,
  configurator: {} as PoolConfigurator,
  helpersContract: {} as AaveProtocolDataProvider,
  oracle: {} as PriceOracle,
  aaveOracle: {} as AaveOracle,
  weth: {} as WETH9Mocked,
  aWETH: {} as AToken,
  dai: {} as MintableERC20,
  aDai: {} as AToken,
  variableDebtDai: {} as VariableDebtToken,
  stableDebtDai: {} as StableDebtToken,
  aUsdc: {} as AToken,
  usdc: {} as MintableERC20,
  aave: {} as MintableERC20,
  addressesProvider: {} as PoolAddressesProvider,
  registry: {} as PoolAddressesProviderRegistry,
  aclManager: {} as ACLManager,
  tokens: {} as { [s: string]: MintableERC20 | WETH9 },
  aTokens: {} as { [a: string]: AToken },
  sTokens: {} as { [a: string]: StableDebtToken },
  vTokens: {} as { [a: string]: VariableDebtToken },
} as AAVEFixture;

const _tokenData = [
  { symbol: 'WETH', name: 'WETH', decimals: 18, emode: false },
  { symbol: 'DAI', name: 'DAI', decimals: 18, emode: true },
  { symbol: 'AAVE', name: 'AAVE', decimals: 18, emode: false },
  { symbol: 'WMATIC', name: 'WMATIC', decimals: 18, emode: false },
  { symbol: 'USDC', name: 'USDC', decimals: 18, emode: true }
]

const _tokenDataExtend = [
  ..._tokenData,
  { symbol: 'TEST1', name: 'TEST1', decimals: 18, emode: false },
  { symbol: 'TEST2', name: 'TEST2', decimals: 18, emode: false },
]


export enum InterestRateMode {
  NONE,
  STABLE,
  VARIABLE
}



// deploys AAVEs
export async function initializeMakeSuite(_deployer: SignerWithAddress, scenarion = 0) {

  const tokenData = scenarion === 0 ? _tokenData : _tokenDataExtend
  let tokens: { [s: string]: MintableERC20 | WETH9 } = {}

  // deploy tokens
  for (let i = 0; i < tokenData.length; i++) {
    const td = tokenData[i]
    if (td.symbol === "WETH")
      tokens[td.symbol] = await new WETH9Mocked__factory(_deployer).deploy()
    else
      tokens[td.symbol] = await new MintableERC20__factory(_deployer).deploy(td.name, td.symbol, td.decimals)
  }

  // deployrer becomes ultra admin
  testEnv.deployer = _deployer;
  testEnv.poolAdmin = _deployer;
  testEnv.emergencyAdmin = _deployer;
  testEnv.riskAdmin = _deployer;

  // deploy address provider - it is important that everything is added here as pools fetch data from there
  testEnv.addressesProvider = await new PoolAddressesProvider__factory(_deployer).deploy("0", _deployer.address)

  await testEnv.addressesProvider.setACLAdmin(_deployer.address)

  // deploy logics
  const libLiquidationLogic = await new LiquidationLogic__factory(_deployer).deploy()
  const libSupplyLogic = await new SupplyLogic__factory(_deployer).deploy()
  const libEModeLogic = await new EModeLogic__factory(_deployer).deploy()
  const libBorrowLogic = await new BorrowLogic__factory(_deployer).deploy()
  const libFlashLoanLogic = await new FlashLoanLogic__factory(
    { ["contracts/external-protocols/aave-v3-core/protocol/libraries/logic/BorrowLogic.sol:BorrowLogic"]: libBorrowLogic.address }
    , _deployer
  ).deploy()
  const libPoolLogic = await new PoolLogic__factory(_deployer).deploy()
  const libBridgeLogic = await new BridgeLogic__factory(_deployer).deploy()

  const inp = {
    ["contracts/external-protocols/aave-v3-core/protocol/libraries/logic/LiquidationLogic.sol:LiquidationLogic"]: libLiquidationLogic.address,
    ["contracts/external-protocols/aave-v3-core/protocol/libraries/logic/SupplyLogic.sol:SupplyLogic"]: libSupplyLogic.address,
    ["contracts/external-protocols/aave-v3-core/protocol/libraries/logic/EModeLogic.sol:EModeLogic"]: libEModeLogic.address,
    ["contracts/external-protocols/aave-v3-core/protocol/libraries/logic/BorrowLogic.sol:BorrowLogic"]: libBorrowLogic.address,
    ["contracts/external-protocols/aave-v3-core/protocol/libraries/logic/FlashLoanLogic.sol:FlashLoanLogic"]: libFlashLoanLogic.address,
    ["contracts/external-protocols/aave-v3-core/protocol/libraries/logic/PoolLogic.sol:PoolLogic"]: libPoolLogic.address,
    ["contracts/external-protocols/aave-v3-core/protocol/libraries/logic/BridgeLogic.sol:BridgeLogic"]: libBridgeLogic.address
  }
  const libConfigLogic = await new ConfiguratorLogic__factory(_deployer).deploy()

  // deploy pool
  testEnv.pool = await new Pool__factory(inp, _deployer).deploy(testEnv.addressesProvider.address)
  // deploy pool configurator
  testEnv.configurator = await new PoolConfigurator__factory({
    [
      "contracts/external-protocols/aave-v3-core/protocol/libraries/logic/ConfiguratorLogic.sol:ConfiguratorLogic"
    ]: libConfigLogic.address
  }, _deployer).deploy()

  // add pool and configurator to address provider - parameters are the bytes32 strings of the id ("POOL_CONFIGURATOR" & "POOL")
  await testEnv.addressesProvider.setAddress("0x504f4f4c5f434f4e464947555241544f52000000000000000000000000000000", testEnv.configurator.address)
  await testEnv.addressesProvider.setAddress("0x504f4f4c00000000000000000000000000000000000000000000000000000000", testEnv.pool.address)
  // initialize configurator (sets pool)
  await testEnv.configurator.initialize(testEnv.addressesProvider.address)

  // deploy registry and ACL manager
  testEnv.registry = await new PoolAddressesProviderRegistry__factory(_deployer).deploy(_deployer.address)// await getPoolAddressesProviderRegistry();
  testEnv.aclManager = await new ACLManager__factory(_deployer).deploy(testEnv.addressesProvider.address) //await getACLManager();

  // set up oracles
  testEnv.oracle = await new PriceOracle__factory(_deployer).deploy() // getFallbackOracle();
  const sequencer = await new SequencerOracle__factory(_deployer).deploy(_deployer.address)
  const sentinel = await new PriceOracleSentinel__factory(_deployer).deploy(testEnv.addressesProvider.address, sequencer.address, 1)

  // add oracles to provider
  await testEnv.addressesProvider.setPriceOracleSentinel(sentinel.address)
  await testEnv.addressesProvider.setPriceOracle(testEnv.oracle.address)

  testEnv.helpersContract = await new AaveProtocolDataProvider__factory(_deployer).deploy(testEnv.addressesProvider.address)// await getAaveProtocolDataProvider();

  let aTokens: { [a: string]: AToken } = {}
  let sTokens: { [a: string]: StableDebtToken } = {}
  let vTokens: { [a: string]: VariableDebtToken } = {}

  //  protocol params
  let optimalUsageRatio: BigNumber = ONE_18.div(20)
  let baseVariableBorrowRate: BigNumber = ONE_18.div(100)
  let variableRateSlope1: BigNumber = ONE_18.div(100)
  let variableRateSlope2: BigNumber = ONE_18.div(100)
  let stableRateSlope1: BigNumber = ONE_18.div(100)
  let stableRateSlope2: BigNumber = ONE_18.div(100)
  let baseStableRateOffset: BigNumber = ONE_18.div(100)
  let stableRateExcessOffset: BigNumber = ONE_18.div(100)
  let optimalStableToTotalDebtRatio: BigNumber = ONE_18.div(100)


  const irs = await new DefaultReserveInterestRateStrategy__factory(_deployer).deploy(
    testEnv.addressesProvider.address,
    optimalUsageRatio,
    baseVariableBorrowRate,
    variableRateSlope1,
    variableRateSlope2,
    stableRateSlope1,
    stableRateSlope2,
    baseStableRateOffset,
    stableRateExcessOffset,
    optimalStableToTotalDebtRatio,
  )

  // set Admins  / managers
  await testEnv.addressesProvider.setACLManager(testEnv.aclManager.address)
  await testEnv.aclManager.addPoolAdmin(_deployer.address)
  await testEnv.addressesProvider.setACLAdmin(testEnv.aclManager.address)

  // deploy token logics
  const aToken = await new AToken__factory(_deployer).deploy(testEnv.pool.address)
  const sToken = await new StableDebtToken__factory(_deployer).deploy(testEnv.pool.address)
  const vToken = await new VariableDebtToken__factory(_deployer).deploy(testEnv.pool.address)

  const ic = await new MockIncentivesController__factory(_deployer).deploy()
  await testEnv.configurator.setEModeCategory(1, 9900, 9905, 10010, testEnv.oracle.address, "testEmode")
  for (let i = 0; i < tokenData.length; i++) {
    const td = tokens[tokenData[i].symbol]
    const tfd = tokenData[i]

    const inp = {
      aTokenImpl: aToken.address,
      stableDebtTokenImpl: sToken.address,
      variableDebtTokenImpl: vToken.address,
      underlyingAssetDecimals: tfd.decimals,
      interestRateStrategyAddress: irs.address,
      underlyingAsset: td.address,
      treasury: _deployer.address,
      incentivesController: ic.address,
      aTokenName: `a${tfd.name}`,
      aTokenSymbol: `a${tfd.symbol}`,
      variableDebtTokenName: `v${tfd.name}`,
      variableDebtTokenSymbol: `v${tfd.symbol}`,
      stableDebtTokenName: `s${tfd.name}`,
      stableDebtTokenSymbol: `s${tfd.symbol}`,
      params: Buffer.from(""),
    }
    // initialize reserves
    await testEnv.configurator.initReserves([inp])
    const rd = await testEnv.pool.getReserveData(td.address)

    // assign token contracts
    aTokens[tfd.symbol] = await new ethers.Contract(rd.aTokenAddress, AToken__factory.createInterface(), _deployer) as AToken
    vTokens[tfd.symbol] = await new ethers.Contract(rd.variableDebtTokenAddress, VariableDebtToken__factory.createInterface(), _deployer) as VariableDebtToken
    sTokens[tfd.symbol] = await new ethers.Contract(rd.stableDebtTokenAddress, StableDebtToken__factory.createInterface(), _deployer) as StableDebtToken

    // activate reserve
    await testEnv.configurator.setReserveActive(td.address, true)
    await testEnv.configurator.setReserveBorrowing(td.address, true)
    await testEnv.configurator.configureReserveAsCollateral(td.address, 9000, 9050, 10010)
    
    await testEnv.configurator.setReserveStableRateBorrowing(td.address, true)
    // set mock price
    await testEnv.oracle.setAssetPrice(td.address, ONE_18)

    if(tfd.emode){
      await testEnv.configurator.setAssetEModeCategory(td.address,1)
    }
  }


  testEnv.aDai = aTokens["DAI"] as AToken

  testEnv.aUsdc = aTokens["DAI"] as AToken
  testEnv.aWETH = aTokens["WETH"] as AToken
  testEnv.aAave = aTokens["AAVE"] as AToken

  testEnv.dai = tokens["DAI"] as MintableERC20
  testEnv.aave = tokens["AAVE"] as MintableERC20
  testEnv.usdc = tokens["USDC"] as MintableERC20
  testEnv.weth = tokens["WETH"] as WETH9Mocked


  testEnv.tokens = tokens
  testEnv.aTokens = aTokens
  testEnv.sTokens = sTokens
  testEnv.vTokens = vTokens

  // Setup additional admins
  await testEnv.aclManager.addRiskAdmin(testEnv.riskAdmin.address)
  await testEnv.aclManager.addEmergencyAdmin(testEnv.emergencyAdmin.address)

  return testEnv
}



export const deposit = async (aave: AAVEFixture, assetIndex: string, user: SignerWithAddress, amount: BigNumberish) => {
  const allowance = aave.tokens[assetIndex].allowance(user.address, aave.pool.address)
  if ((await allowance).lt(amount))
    await aave.tokens[assetIndex].connect(user).approve(aave.pool.address, ethers.constants.MaxUint256)

  await aave.pool.connect(user).deposit(aave.tokens[assetIndex].address, amount, user.address, 0)

}