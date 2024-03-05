/* eslint-disable prefer-const */
import ERC20Abi from './../abis/ERC20.json'
import { viemClient } from './viem'
export async function fetchTokenSymbol (tokenAddress: string): Promise<string> {
  const symbolResult = await viemClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'symbol'
  })

  return symbolResult as string
}

export async function fetchTokenName (tokenAddress: string): Promise<string> {
  return await viemClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'name'
  }) as string
}

export async function fetchTokenTotalSupply (tokenAddress: string): Promise<bigint> {
  return await viemClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'totalSupply'
  }) as bigint
}

export async function fetchTokenDecimals (tokenAddress: string): Promise<bigint> {
  return await viemClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20Abi,
    functionName: 'decimals'
  }) as bigint
}
