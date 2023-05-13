import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { BigNumber, constants } from 'ethers';
import { formatEther, parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat'
import { EntryPoint, EntryPoint__factory, FiatWithPermit, MintableERC20, MockRouter, MockRouter__factory, OneFXSlotFactory, OneFXSlotFactory__factory, OneFXSlot__factory, WETH9 } from '../../types';
import { initializeMakeSuite, InterestRateMode, AAVEFixture } from './shared/aaveFixture';
import { produceSig } from './shared/permitUtils';

const ONE_18 = BigNumber.from(10).pow(18)

// we prepare a setup for compound in hardhat
// this series of tests checks that the features used for the margin swap implementation
// are correctly set up and working
describe('1fx Test', async () => {
    let deployer: SignerWithAddress, alice: SignerWithAddress, bob: SignerWithAddress, carol: SignerWithAddress;
    let aaveTest: AAVEFixture
    let tokens: (MintableERC20 | WETH9 | FiatWithPermit)[];
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
                await (aaveTest.tokens[key] as MintableERC20)['mint(address,uint256)'](deployer.address, ONE_18.mul(100_000_000))

                await aaveTest.tokens[key].connect(deployer).transfer(alice.address, ONE_18.mul(1_000_000))
                // add balances to router
                await aaveTest.tokens[key].connect(deployer).transfer(mockRouter.address, ONE_18.mul(1_000_000))
            }
            await aaveTest.pool.connect(deployer).supply(aaveTest.tokens[key].address, ONE_18.mul(1000), deployer.address, 0)

        }

    })

    it('deploys everything', async () => {
        await aaveTest.aDai.symbol()
        const { WETH, DAI } = aaveTest.tokens
        await DAI.connect(alice).approve(aaveTest.pool.address, constants.MaxUint256)

        // supply and borrow
        await aaveTest.pool.connect(alice).supply(DAI.address, ONE_18.mul(100), alice.address, 0)
        await aaveTest.pool.connect(alice).setUserUseReserveAsCollateral(DAI.address, true)
        await aaveTest.pool.connect(alice).borrow(WETH.address, ONE_18, InterestRateMode.VARIABLE, 0, alice.address)
    })

    it('deploys slot', async () => {
        const collatKey = 'DAI'
        const debtKey = 'USDC'
        const collateral = aaveTest.tokens[collatKey]
        const debt = aaveTest.tokens[debtKey]
        const aTokenCollateral = aaveTest.aTokens[collatKey]
        const vTokenBorrow = aaveTest.vTokens[debtKey]
        const amountCollateral = parseUnits('1', 18)
        const targetCollateral = parseUnits('30', 18)
        const amountBorrow = targetCollateral.mul(101).div(99)

        // approve projected address
        const addressToApprove = await factory.getAddress(1)
        console.log("Slot", addressToApprove)
        await collateral.connect(alice).approve(addressToApprove, ethers.constants.MaxUint256)

        // function swap(address inAsset, address outAsset, uint256 inAm)
        const params = mockRouter.interface.encodeFunctionData(
            'swap',
            [
                debt.address,
                collateral.address,
                amountBorrow
            ]
        )

        await factory.connect(alice).createSlot(
            alice.address,
            amountCollateral,
            aTokenCollateral.address,
            vTokenBorrow.address,
            targetCollateral,
            amountBorrow,
            params
        )

        const collateralPostTrade = await aTokenCollateral.balanceOf(addressToApprove)
        const borrowPostTrade = await vTokenBorrow.balanceOf(addressToApprove)
        console.log("Collateral", formatEther(collateralPostTrade))
        console.log("Debt", formatEther(borrowPostTrade))
        // validate collateral
        expect(collateralPostTrade.gt(ONE_18.mul(31))).to.equal(true)
        // validate debt
        expect(borrowPostTrade.toString()).to.equal(amountBorrow.toString())
    })

    it('closes full slot', async () => {
        const collatKey = 'DAI'
        const debtKey = 'USDC'
        const collateral = aaveTest.tokens[collatKey]
        const debt = aaveTest.tokens[debtKey]
        const aTokenCollateral = aaveTest.aTokens[collatKey]
        const vTokenBorrow = aaveTest.vTokens[debtKey]
        const amountCollateral = parseUnits('1', 18)
        const targetCollateral = parseUnits('30', 18)
        // repay more than he balances
        const amountToRepay = targetCollateral.mul(105).div(100)

        // approve projected address
        const slotAddress = await factory.getAddress(1)
        console.log("Slot", slotAddress)

        // function swap(address inAsset, address outAsset, uint256 inAm)
        const params = mockRouter.interface.encodeFunctionData(
            'swap',
            [
                collateral.address,
                debt.address,
                amountToRepay
            ]
        )

        const slot = await new OneFXSlot__factory(alice).attach(slotAddress)

        // await slot.close(
        //     amountToRepay,
        //     targetCollateral.add(amountCollateral),
        //     params
        // )

        await slot.closeFullPosition(
            params
        )

        const collateralPostTrade = await aTokenCollateral.balanceOf(slotAddress)
        const borrowPostTrade = await vTokenBorrow.balanceOf(slotAddress)
        console.log("Collateral", formatEther(collateralPostTrade))
        console.log("Debt", formatEther(borrowPostTrade))
        // validate collateral
        expect(collateralPostTrade.toString()).to.equal('0')
        // validate debt
        // expect(borrowPostTrade.toString()).to.equal(amountBorrow.toString())
    })


    it('deploys slot with permit', async () => {
        const collatKey = 'DAI'
        const debtKey = 'USDC'
        const collateral = aaveTest.tokens[collatKey]
        const debt = aaveTest.tokens[debtKey]
        const aTokenCollateral = aaveTest.aTokens[collatKey]
        const vTokenBorrow = aaveTest.vTokens[debtKey]
        const amountCollateral = parseUnits('1', 18)
        const targetCollateral = parseUnits('30', 18)
        const amountBorrow = targetCollateral.mul(101).div(99)

        // approve projected address
        const addressToApprove = await factory.getAddress(1)
        console.log("Slot", addressToApprove)
        await collateral.connect(alice).approve(addressToApprove, ethers.constants.MaxUint256)

        // function swap(address inAsset, address outAsset, uint256 inAm)
        const params = mockRouter.interface.encodeFunctionData(
            'swap',
            [
                debt.address,
                collateral.address,
                amountBorrow
            ]
        )
        const sigVRS = await produceSig(alice, bob.address, collateral as FiatWithPermit, amountCollateral.toString())

        const sig = {
            owner: alice.address,
            spender: bob.address,
            value: amountCollateral,
            deadline: ethers.constants.MaxUint256,
            v: sigVRS.split.v,
            r: sigVRS.split.r,
            s: sigVRS.split.s
        }

        await factory.connect(bob).createSlotWithPermit(
            aTokenCollateral.address,
            vTokenBorrow.address,
            targetCollateral,
            amountBorrow,
            params,
            sig
        )

        const collateralPostTrade = await aTokenCollateral.balanceOf(addressToApprove)
        const borrowPostTrade = await vTokenBorrow.balanceOf(addressToApprove)
        console.log("Collateral", formatEther(collateralPostTrade))
        console.log("Debt", formatEther(borrowPostTrade))
        // validate collateral
        expect(collateralPostTrade.gt(ONE_18.mul(31))).to.equal(true)
        // validate debt
        expect(borrowPostTrade.toString()).to.equal(amountBorrow.toString())
    })




})
