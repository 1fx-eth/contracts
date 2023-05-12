import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, constants } from 'ethers';
import { ethers } from 'hardhat'
import { EntryPoint, EntryPoint__factory, MintableERC20, MockRouter, MockRouter__factory, OneFXSlotFactory, OneFXSlotFactory__factory, WETH9 } from '../../types';
import { initializeMakeSuite, InterestRateMode, AAVEFixture } from './shared/aaveFixture';

const ONE_18 = BigNumber.from(10).pow(18)

// we prepare a setup for compound in hardhat
// this series of tests checks that the features used for the margin swap implementation
// are correctly set up and working
describe('1fx Test', async () => {
    let deployer: SignerWithAddress, alice: SignerWithAddress, bob: SignerWithAddress, carol: SignerWithAddress;
    let aaveTest: AAVEFixture
    let tokens: (MintableERC20 | WETH9)[];
    let factory: OneFXSlotFactory
    let entryPoint: EntryPoint
    let mockRouter: MockRouter

    beforeEach('Deploy Aave', async () => {
        [deployer, alice, bob, carol] = await ethers.getSigners();
        entryPoint = await new EntryPoint__factory(deployer).deploy()

        mockRouter = await new MockRouter__factory(deployer).deploy(ONE_18)

        aaveTest = await initializeMakeSuite(deployer)
        factory = await new OneFXSlotFactory__factory(deployer).deploy(entryPoint.address, aaveTest.pool.address, mockRouter.address)
        tokens = Object.values(aaveTest.tokens)

        // adds liquidity to the protocol
        let keys = Object.keys(aaveTest.tokens)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            await aaveTest.tokens[key].connect(deployer).approve(aaveTest.pool.address, constants.MaxUint256)
            if (key === "WETH") {
                await (aaveTest.tokens[key] as WETH9).deposit({ value: ONE_18.mul(1000) })
            } else {
                await (aaveTest.tokens[key] as MintableERC20)['mint(address,uint256)'](deployer.address, ONE_18.mul(1_000_000))
            }
            await aaveTest.pool.connect(deployer).supply(aaveTest.tokens[key].address, ONE_18.mul(1000), deployer.address, 0)
        }

    })

    it('deploys everything', async () => {
        await aaveTest.aDai.symbol()
        const { WETH, DAI } = aaveTest.tokens
        await (DAI as MintableERC20).connect(alice)['mint(address,uint256)'](alice.address, ONE_18.mul(1_000))
        await DAI.connect(alice).approve(aaveTest.pool.address, constants.MaxUint256)

        // supply and borrow
        await aaveTest.pool.connect(alice).supply(DAI.address, ONE_18.mul(100), alice.address, 0)
        await aaveTest.pool.connect(alice).setUserUseReserveAsCollateral(DAI.address, true)
        await aaveTest.pool.connect(alice).borrow(WETH.address, ONE_18, InterestRateMode.VARIABLE, 0, alice.address)
    })

    it('deploys slot', async () => {
        await factory.connect(alice).createSlot(alice.address)
    })



})
