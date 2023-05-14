import '@nomiclabs/hardhat-ethers'
import hre from 'hardhat'
import { EntryPoint__factory, OneFXLens__factory, OneFXSlotFactory__factory } from '../types';
import { aavePool, entryPointAddress, router } from './aave_addresses';


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

// factory: 0x648cE75895873BECBC4c9a291A28CA1EF121953B
// lens: 0xAe3C2d45270791Ef8aD023D1E66d275255db0499
// entryPoint: 0x02567769aAD16E77f974c45080b66b3e42933331
