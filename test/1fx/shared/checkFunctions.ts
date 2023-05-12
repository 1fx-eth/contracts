import { expect } from "chai"
import { BigNumber } from "ethers"
import { formatEther } from "ethers/lib/utils"


export const expectToBeLess = (amount0: BigNumber, amount1: BigNumber, scale0 = 1): void => {
    const am0 = Number(formatEther(amount0)) * scale0
    const am1 = Number(formatEther(amount1))
    expect(am0).to.be.lessThanOrEqual(am1)
}
