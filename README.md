# ETHGlobal Lisbon

FX trading on AAVE using 1inch / generic type swap routers.

1inch swap router implementation is illustrated in `scripts/open_position.ts`. Works with all other types of routers that return a single uint256 as swap output amount. 

# Core contract compomnents

The core contracts are the OneFXSlotFactory and the OneFXSlot.

OneFXSLotFactory deploys UUPS Upgradeaple contracts that implement EIP-4337 abstract accounts to enable automated creation of leveraged positions on the user's behalf.

The user controls the slot and can manage the position through interacting with a slot contract they own.

Aave flash loans are used in `constracts/utils/AaveHandler` to enable a single-swap creation of highly leveraged positions. Aave's eMode allows very high leverage - even more than 20x can be achieved in category 1 for example.

It is compatible with ERC20Permit and can therefore be executed gasless as the test `deploys slot with permit` shows.

# Setup

Run `yarn` to install depemndencies.

Compile contracts with `npx hardhat compile`.

Run `npx hardhat test test/1fx/1fx.spec.ts` to execute the unit tests.

# Deployments on Polygon PoS

The following list contains all our live deployments on Polyogon (chainId 137):

`OneFXSlotFactory: 0x648cE75895873BECBC4c9a291A28CA1EF121953B`
`OneFxSlot implementation: 0x988ec4e26f39eec06658ad5f73be82e72c4f368e`
`lens:  0xAe3C2d45270791Ef8aD023D1E66d275255db0499`
`entryPoint: 0x02567769aAD16E77f974c45080b66b3e42933331`


# Scripts

Populate a .env file as suggested in .env.example to be able to run the scrips using the live deployment.

`deploy_factory.ts`: deploys the stack.
`deploy_lens.ts`: deploys the OneFXLens contract - a smart contract that aggregates the position data for a frontend.
`open_position.ts`: opens a positions with the addresses in `scripts/1FXAddresses.ts`. The 1inch API is used to execute thae trade.