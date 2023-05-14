import '@nomiclabs/hardhat-ethers'
import { parseUnits } from 'ethers/lib/utils';
import hre from 'hardhat'
import { AToken__factory, ERC20Mock__factory, FiatWithPermit__factory, OneFXLens__factory, OneFXSlotFactory__factory, OneFXSlot__factory, VariableDebtToken__factory } from '../types';
import { coreAddresses } from './1FXAddresses';
import { aavePool, addressesAaveATokens, addressesAaveVTokens, addressesTokens } from './aave_addresses';
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
    const lens = await new OneFXLens__factory(operator).attach(coreAddresses.lens[chainId])



    const slots = await lens.getUserSlots(operator.address, factory.address, aavePool)
    const slot = slots[0].slot

    const collateralAddress = slots[0].collateral
    const debtAddress = slots[0].debt
    const keyDebt = Object.keys(addressesTokens).find(k => (addressesTokens as any)[k][chainId]?.toLowerCase() === debtAddress.toLowerCase())
    const keyCollateral = Object.keys(addressesTokens).find(k => (addressesTokens as any)[k][chainId]?.toLowerCase() === collateralAddress.toLowerCase())

    const vAddress = (addressesAaveVTokens as any)[keyDebt ?? ''][chainId]
    const aAddress = (addressesAaveATokens as any)[keyCollateral ?? ''][chainId]
    console.log("addresses", aAddress, vAddress)
    const borrowToken = await new VariableDebtToken__factory(operator).attach(vAddress)
    const collateralToken = await new AToken__factory(operator).attach(aAddress)


    const borrow = await borrowToken.balanceOf(slot)
    const collateral = await collateralToken.balanceOf(slot)
    const swapAmount = collateral.mul(5).div(10)
    // calulate slot address

    console.log("Slot address", slot)

    const slippage = 45
    const API_DATA: any = await fetchData(
        `https://api.1inch.io/v5.0/137/swap?fromTokenAddress=${collateralAddress
        }&toTokenAddress=${debtAddress
        }&amount=${swapAmount.toString()
        }&fromAddress=${slot
        }&slippage=${slippage
        }&destReceiver=${slot
        }&referrerAddress=${slot
        }&disableEstimate=true&compatibilityMode=true&burnChi=false&allowPartialFill=false&complexityLevel=0`
    )

    const slotContract = await new OneFXSlot__factory(operator).attach(slot)

    await slotContract.estimateGas.close(
        borrow,
        collateral,
        API_DATA.tx.data,
    )

    await slotContract.close(
        borrow,
        collateral,
        API_DATA.tx.data,
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
