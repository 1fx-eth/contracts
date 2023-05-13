import '@nomiclabs/hardhat-ethers'
import { parseUnits } from 'ethers/lib/utils';
import hre from 'hardhat'
import { FiatWithPermit__factory, OneFXLens__factory, OneFXSlotFactory__factory } from '../types';
import { coreAddresses } from './1FXAddresses';
import { AGEUR_USDC, USDC_AGEUR, USDT_USDC } from './1inchResponses';
import { addressesAaveATokens, addressesAaveVTokens, addressesTokens } from './aave_addresses';


async function main() {

    const accounts = await hre.ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    console.log("Operate 1FX Proxy on", chainId, "by", operator.address)

    console.log('Get factory')
    const factory = await new OneFXSlotFactory__factory(operator).attach(coreAddresses.factory[chainId])

    const collateralKey = 'USDC'
    const debtKey = 'USDT'

    console.log('Lens')
    const lens = await new OneFXLens__factory(operator).attach(coreAddresses.lens[chainId])

    const collateralAddress = (addressesTokens[collateralKey] as any)[chainId]
    const collateralATokenAddress = (addressesAaveATokens[collateralKey] as any)[chainId]

    const debtAddress = (addressesTokens[debtKey] as any)[chainId]
    const debtVTokenAddress = (addressesAaveVTokens[debtKey] as any)[chainId]

    const collateral = await new FiatWithPermit__factory(operator).attach(collateralAddress)
    const amountCollateral = parseUnits('1', 6)

    const targetCollateral = parseUnits('9', 6)

    const amountBorrow = parseUnits('10', 6).mul(101).div(100)


    const projectedAddress = await factory.getNextAddress()
    console.log("Projected address", projectedAddress)
    const allowance = await collateral.allowance(operator.address, projectedAddress)
   
    // approve
    // if (allowance.gte(amountCollateral)) {
    //     console.log("Approving")
    //     const approveTx = await collateral.approve(projectedAddress, parseUnits('5', 6))
    //     await approveTx.wait()
    // }

    await factory.connect(operator).estimateGas.createSlot(
        operator.address,
        amountCollateral,
        collateralATokenAddress,
        debtVTokenAddress,
        targetCollateral,
        amountBorrow,
        USDT_USDC.tx.data,
    )



    console.log('Addresses')
    console.log('factory:', factory.address)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

// factory: 0x648cE75895873BECBC4c9a291A28CA1EF121953B
// lens: 0xAe3C2d45270791Ef8aD023D1E66d275255db0499
// entryPoint: 0x02567769aAD16E77f974c45080b66b3e42933331
