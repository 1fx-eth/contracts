import '@nomiclabs/hardhat-ethers'
import { parseUnits } from 'ethers/lib/utils';
import hre, { ethers } from 'hardhat'
import { produceSig } from '../test/1fx/shared/permitUtils';
import {  ERC20Mock__factory, FiatWithPermit__factory, OneFXSlotFactory__factory } from '../types';
import { coreAddresses } from './1FXAddresses';
import { addressesAaveATokens, addressesAaveVTokens, addressesTokens } from './aave_addresses';
import axios from 'axios'

async function fetchData(url: string) {
    try {
        const response = await axios.get(url);
        console.log("response", response.data)
        return response.data
    } catch (error) {
        console.log(error);
    }
}


async function main() {

    const accounts = await hre.ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    console.log("Operate 1FX Proxy on", chainId, "by", operator.address)

    console.log('Get factory')
    const factory = await new OneFXSlotFactory__factory(operator).attach(coreAddresses.factory[chainId])


    const collateralKey = 'USDC'
    const debtKey = 'USDT'

    const collateralAddress = (addressesTokens[collateralKey] as any)[chainId]
    const collateralATokenAddress = (addressesAaveATokens[collateralKey] as any)[chainId]

    const debtAddress = (addressesTokens[debtKey] as any)[chainId]
    const debtVTokenAddress = (addressesAaveVTokens[debtKey] as any)[chainId]

    const collateralToken = await new FiatWithPermit__factory(operator).attach(collateralAddress)

    // amount to borrow
    const borrowBase = '20'

    const borrowToken = await new ERC20Mock__factory(operator).attach(debtAddress)

    const borrowDecimals = await borrowToken.decimals()
    const collateralDecimals = await collateralToken.decimals()

    // amount parameters
    const depositAmount = parseUnits('1', collateralDecimals)
    const targetCollateral = parseUnits(borrowBase, collateralDecimals).mul(99).div(100)
    const swapAmount = parseUnits(borrowBase, borrowDecimals)
    const amountBorrow = swapAmount

    // calulate slot address
    const projectedAddress = await factory.getNextAddress()
    console.log("Projected address", projectedAddress)

    const slippage = 45
    const USDC_USDT_LIVE: any = await fetchData(
        `https://api.1inch.io/v5.0/137/swap?fromTokenAddress=${debtAddress
        }&toTokenAddress=${collateralAddress
        }&amount=${swapAmount.toString()
        }&fromAddress=${projectedAddress
        }&slippage=${slippage
        }&destReceiver=${projectedAddress
        }&referrerAddress=${projectedAddress
        }&disableEstimate=true&compatibilityMode=true&burnChi=false&allowPartialFill=false&complexityLevel=0`
    )

    console.log("USDC_USDT_LIVE",USDC_USDT_LIVE)

    const sigVRS = await produceSig(
        operator,
        projectedAddress,
        collateralToken,
        depositAmount.toString()
    )

    // const sigVRS = await Sign(
    //     chainId,
    //     collateralToken,
    //     operator,
    //     depositAmount.toString(),
    //     projectedAddress,
    //     ethers.constants.MaxUint256.toString(),
    // )


    const sig = {
        owner: operator.address,
        spender: projectedAddress,
        value: depositAmount.toString(),
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
        USDC_USDT_LIVE.tx.data,
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
