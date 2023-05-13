import '@nomiclabs/hardhat-ethers'
import { parseUnits } from 'ethers/lib/utils';
import hre, { ethers } from 'hardhat'
import { produceSig } from '../test/1fx/shared/permitUtils';
import {  FiatWithPermit__factory, OneFXLens__factory, OneFXSlotFactory__factory } from '../types';
import { coreAddresses } from './1FXAddresses';
import { addressesAaveATokens, addressesAaveVTokens, addressesTokens } from './aave_addresses';
import { JEUR_USDC } from './1inchResponses';

async function main() {

    const accounts = await hre.ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    console.log("Operate 1FX Proxy on", chainId, "by", operator.address)

    console.log('Get factory')
    const factory = await new OneFXSlotFactory__factory(operator).attach(coreAddresses.factory[chainId])

    const collateralKey = 'USDC'
    const debtKey = 'JEUR'

    console.log('Lens')
    const lens = await new OneFXLens__factory(operator).attach(coreAddresses.lens[chainId])

    const collateralAddress = (addressesTokens[collateralKey] as any)[chainId]
    const collateralATokenAddress = (addressesAaveATokens[collateralKey] as any)[chainId]

    const debtAddress = (addressesTokens[debtKey] as any)[chainId]
    const debtVTokenAddress = (addressesAaveVTokens[debtKey] as any)[chainId]

    const collateral = await new FiatWithPermit__factory(operator).attach(collateralAddress)
    const amountCollateral = parseUnits('1', 6)

    const targetCollateral = parseUnits('10', 6)

    const amountBorrow = parseUnits('10', 18)


    const projectedAddress = await factory.getNextAddress()

    const sigVRS = await produceSig(
        operator,
        projectedAddress,
        collateral,
        amountCollateral.toString()
    )

    const sig = {
        owner: operator.address,
        spender: projectedAddress,
        value: amountCollateral,
        deadline: ethers.constants.MaxUint256,
        v: sigVRS.split.v,
        r: sigVRS.split.r,
        s: sigVRS.split.s
    }


    await factory.connect(operator).estimateGas.createSlotWithPermit(
        collateralATokenAddress,
        debtVTokenAddress,
        targetCollateral,
        amountBorrow,
        JEUR_USDC.tx.data,
        sig
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
