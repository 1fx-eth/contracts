import { splitSignature } from "ethers/lib/utils"
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, ERC20MockWithPermit } from "../../../types"
import { BigNumber } from "ethers";
import { ethers } from "ethers";

const EIP712_DOMAIN_TYPE = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
]

const EIP2612_TYPE = [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
]

const structure = (name: string, version: string, chainId: number, tokenAddress: string, nonce: string, value: string, owner: string, spender: string, deadline: string) => {
    return {
        "types": {
            "Permit": [{
                "name": "owner",
                "type": "address"
            },
            {
                "name": "spender",
                "type": "address"
            },
            {
                "name": "value",
                "type": "uint256"
            },
            {
                "name": "nonce",
                "type": "uint256"
            },
            {
                "name": "deadline",
                "type": "uint256"
            }
            ]
        },
        "primaryType": "Permit",
        "domain": {
            "name": name,
            "version": version,
            "chainId": chainId,
            "verifyingContract": tokenAddress
        },
        "message": {
            "owner": owner,
            "spender": spender,
            "value": value,
            "nonce": nonce,
            "deadline": deadline
        }
    }
}

const permitVersion = '1'

const buildData = async (amount: string, owner: string, spender: string, chainId: any, token: ERC20MockWithPermit, deadline: string) => {
    const _name = await token.name()
    const version = '1'
    const value = amount
    const nonce = await token.nonces(owner);
    return structure(_name, version, chainId, token.address, nonce.toString(), value, owner, spender, deadline)

}

export const Sign = async (
    chainId: number,
    token: ERC20MockWithPermit,
    user: SignerWithAddress,
    amount: string,
    spender: string,
    deadline: string,
) => {
    const data = await buildData(amount, user.address, spender, chainId, token, deadline);
    const digest = await user._signTypedData(data.domain, data.types, data.message);
    const { v, r, s } = ethers.utils.splitSignature(digest);

    return { signature: digest, split: { v, r, s } }
}


/**
 * Produces signature for ERC20Permit using the signer object
 * @param provider ethers signer to sign message
 * @param spender speder permit params
 * @param token token to sign
 * @param amount amount to sign for
 * @returns 
 */
export const produceSig = async (
    provider: SignerWithAddress,
    spender: string,
    token: ERC20MockWithPermit,
    amount: string
) => {
    const account = provider.address
    const nonce = await token.nonces(account)
    const message = {
        owner: account,
        spender,
        value: amount,
        nonce,
        deadline: ethers.constants.MaxUint256,
    }
    const chainId = await provider.getChainId()
    const name = await token.name()
    const domain = {
        name,
        verifyingContract: token.address,
        chainId,
        version: permitVersion
    }


    const rawData = {
        types: {
            EIP712Domain: EIP712_DOMAIN_TYPE,
            Permit: EIP2612_TYPE,
        },
        domain,
        primaryType: 'Permit',
        message,
    }


    const signature = await provider._signTypedData(domain, { Permit: rawData.types.Permit }, rawData.message)

    const split = splitSignature(signature)
    return { signature, split }
}