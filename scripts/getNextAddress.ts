import '@nomiclabs/hardhat-ethers'
import hre from 'hardhat'
import { OneFXSlotFactory__factory } from '../types';
import { coreAddresses } from './1FXAddresses';

async function main() {

    const accounts = await hre.ethers.getSigners()
    const operator = accounts[0]
    const chainId = await operator.getChainId();

    console.log("Operate 1FX Proxy on", chainId, "by", operator.address)

    console.log('Get factory')
    const factory = await new OneFXSlotFactory__factory(operator).attach(coreAddresses.factory[chainId])

    const projectedAddress = await factory.getNextAddress()

    console.log('Address:', projectedAddress)

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
