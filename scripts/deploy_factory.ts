import '@nomiclabs/hardhat-ethers'
import hre from 'hardhat'
import { EntryPoint__factory, OneFXLens__factory, OneFXSlotFactory__factory } from '../types';

const aavePool = '0x794a61358D6845594F94dc1DB02A252b5b4814aD'
const router = '0x1111111254eeb25477b68fb85ed929f73a960582'

const entryPointAddress = ''

async function main() {

    const accounts = await hre.ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    console.log("Deploy 1FX Proxy on", chainId, "by", operator.address)

    console.log('EntryPoint')
    let _entryPointAddress = entryPointAddress
    // deploy entry point if not yet done
    if (!entryPointAddress) {
        const entryPoint = await new EntryPoint__factory(operator).deploy()
        await entryPoint.deployed()
        _entryPointAddress = entryPoint.address
    }

    console.log('Factory')
    const factory = await new OneFXSlotFactory__factory(operator).deploy(_entryPointAddress, aavePool, router)
    await factory.deployed()

    console.log('Lens')
    const lens = await new OneFXLens__factory(operator).deploy()
    await lens.deployed()

    console.log('Addresses')
    console.log('factory:', factory.address)
    console.log("lens:", lens.address)
    console.log('entryPoint:', _entryPointAddress)

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
