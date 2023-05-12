import { ethers } from 'hardhat'
import { BigNumber, constants } from 'ethers'
import {
    IWETH9,
    MockTimeNonfungiblePositionManager,
    MockTimeSwapRouter,
    NonfungibleTokenPositionDescriptor,
    ERC20Mock,
    ERC20Mock__factory,
    UniswapV3Factory,
    IERC20,
    MinimalSwapRouter,
    IERC20__factory,
    WETH9,
} from '../../../types'
import { minimalUniswapV3RouterFixtureNoWETH, uniswapV3RouterFixture, uniswapV3RouterFixtureNoWETH } from './unsiwapRouter'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { FeeAmount, TICK_SPACINGS } from '../../uniswap-v3/periphery/shared/constants'
import { getMaxTick, getMinTick } from '../../uniswap-v3/periphery/shared/ticks'
import { encodePriceSqrt } from '../../uniswap-v3/periphery/shared/encodePriceSqrt'

export interface UniswapFixture {
    weth9: WETH9
    factory: UniswapV3Factory
    router: MockTimeSwapRouter
    nft: MockTimeNonfungiblePositionManager
    nftDescriptor: NonfungibleTokenPositionDescriptor
    tokens: ERC20Mock[]
}

export async function uniswapFixture(signer: SignerWithAddress, tokenCount = 5): Promise<UniswapFixture> {
    const { weth9, factory, router } = await uniswapV3RouterFixture(signer)

    let tokens: ERC20Mock[] = []
    for (let i = 0; i < tokenCount; i++) {
        const token = await new ERC20Mock__factory(signer).deploy("Token Nr" + i, "T" + i, signer.address, constants.MaxUint256.div(2))
        tokens.push(token)
    }

    const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor')
    const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()
    const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
        libraries: {
            NFTDescriptor: nftDescriptorLibrary.address,
        },
    })
    const nftDescriptor = (await positionDescriptorFactory.deploy(
        tokens[0].address,
        // 'ETH' as a bytes32 string
        '0x4554480000000000000000000000000000000000000000000000000000000000'
    )) as NonfungibleTokenPositionDescriptor

    const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager')

    const nft = (await positionManagerFactory.deploy(
        factory.address,
        weth9.address,
        nftDescriptor.address
    )) as MockTimeNonfungiblePositionManager

    tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

    return {
        weth9,
        factory,
        router,
        tokens,
        nft,
        nftDescriptor,
    }
}

export interface UniswapFixtureNoTokens {
    factory: UniswapV3Factory
    router: MockTimeSwapRouter
    nft: MockTimeNonfungiblePositionManager
    nftDescriptor: NonfungibleTokenPositionDescriptor
}

export async function uniswapFixtureNoTokens(signer: SignerWithAddress, wethAddress: string): Promise<UniswapFixtureNoTokens> {
    const { factory, router } = await uniswapV3RouterFixtureNoWETH(signer, wethAddress)


    const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor')
    const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()
    const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
        libraries: {
            NFTDescriptor: nftDescriptorLibrary.address,
        },
    })
    const nftDescriptor = (await positionDescriptorFactory.deploy(
        wethAddress,
        // 'ETH' as a bytes32 string
        '0x4554480000000000000000000000000000000000000000000000000000000000'
    )) as NonfungibleTokenPositionDescriptor

    const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager')

    const nft = (await positionManagerFactory.deploy(
        factory.address,
        wethAddress,
        nftDescriptor.address
    )) as MockTimeNonfungiblePositionManager

    return {
        factory,
        router,
        nft,
        nftDescriptor,
    }
}



export interface UniswapMinimalFixtureNoTokens {
    factory: UniswapV3Factory
    router: MinimalSwapRouter
    nft: MockTimeNonfungiblePositionManager
    nftDescriptor: NonfungibleTokenPositionDescriptor
}

export async function uniswapMinimalFixtureNoTokens(signer: SignerWithAddress, wethAddress: string): Promise<UniswapMinimalFixtureNoTokens> {
    const { factory, router } = await minimalUniswapV3RouterFixtureNoWETH(signer, wethAddress)


    const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor')
    const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()
    const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
        libraries: {
            NFTDescriptor: nftDescriptorLibrary.address,
        },
    })
    const nftDescriptor = (await positionDescriptorFactory.deploy(
        wethAddress,
        // 'ETH' as a bytes32 string
        '0x4554480000000000000000000000000000000000000000000000000000000000'
    )) as NonfungibleTokenPositionDescriptor

    const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager')

    const nft = (await positionManagerFactory.deploy(
        factory.address,
        wethAddress,
        nftDescriptor.address
    )) as MockTimeNonfungiblePositionManager

    return {
        factory,
        router,
        nft,
        nftDescriptor,
    }
}



export async function addLiquidity(
    signer: SignerWithAddress,
    tokenAddressA: string,
    tokenAddressB: string,
    amountA: BigNumber,
    amountB: BigNumber,
    uniswap: UniswapFixture | UniswapFixtureNoTokens | UniswapMinimalFixtureNoTokens
) {
    if (tokenAddressA.toLowerCase() > tokenAddressB.toLowerCase())
        [tokenAddressA, tokenAddressB, amountA, amountB] = [tokenAddressB, tokenAddressA, amountB, amountA]

    await uniswap.nft.connect(signer).createAndInitializePoolIfNecessary(
        tokenAddressA,
        tokenAddressB,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
        // encodePriceSqrt(amountB, amountA)
    )

    const liquidityParams = {
        token0: tokenAddressA,
        token1: tokenAddressB,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: signer.address,
        amount0Desired: amountA,
        amount1Desired: amountB,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
    }

    const tA = await new ethers.Contract(tokenAddressA, IERC20__factory.createInterface(), signer)
    await tA.connect(signer).approve(uniswap.nft.address, constants.MaxUint256)

    const tB = await new ethers.Contract(tokenAddressB, IERC20__factory.createInterface(), signer)
    await tB.connect(signer).approve(uniswap.nft.address, constants.MaxUint256)

    console.log("add liquidity", tokenAddressA, tokenAddressB)

    return uniswap.nft.connect(signer).mint(liquidityParams)
}
