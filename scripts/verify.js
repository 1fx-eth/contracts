module.exports = [
    '0x02567769aAD16E77f974c45080b66b3e42933331', // entryPoint
    '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // aavePool
    '0x1111111254eeb25477b68fb85ed929f73a960582' //1inch
];

// module.exports =[
//     '0x988ec4e26f39eec06658ad5f73be82e72c4f368e' // implementation
// ]

// npx hardhat verify --network matic 0x779A69Ab613767F2946438b55EA0DA0A7E5757bf --contract contracts/utils/1FXLens.sol:OneFXLens

// npx hardhat verify --network matic 0x648cE75895873BECBC4c9a291A28CA1EF121953B --contract contracts/1FXSlotFactory.sol:OneFXSlotFactory --constructor-args scripts/verify.js

// npx hardhat verify --network matic 0x988ec4e26f39eec06658ad5f73be82e72c4f368e --contract contracts/1FXSlot.sol:OneFXSlot --constructor-args scripts/verify.js

// npx hardhat verify --network matic 0x13168f7Fd41Ae55A0007562E942b19Bf4A60C931 --contract contracts/utils/1FXProxy.sol:OneFXProxy --constructor-args scripts/verify.js