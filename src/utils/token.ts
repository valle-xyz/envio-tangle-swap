import ERC20Abi from '../../abis/ERC20.json'
import { viemClient } from '../viem'
import fs from 'fs'
import path from 'path'

interface TokenDetails {
  symbol: string
  name: string
  totalSupply: bigint
  decimals: bigint
}

export async function fetchTokenDetails (tokenAddress: string): Promise<TokenDetails> {
  const filePath = path.join(__dirname, 'token-details.json')

  let tokenDetailsData: Record<string, TokenDetails>
  try {
    tokenDetailsData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    tokenDetailsData = {}
  }

  if (Object.prototype.hasOwnProperty.call(tokenDetailsData, tokenAddress)) {
    const tokenDetails = tokenDetailsData[tokenAddress]
    return {
      symbol: tokenDetails.symbol,
      name: tokenDetails.name,
      totalSupply: BigInt(tokenDetails.totalSupply),
      decimals: BigInt(tokenDetails.decimals)
    }
  }

  const symbol = await fetchTokenSymbol(tokenAddress)
  const name = await fetchTokenName(tokenAddress)
  const totalSupply = await fetchTokenTotalSupply(tokenAddress)
  const decimals = await fetchTokenDecimals(tokenAddress)

  const tokenDetails: TokenDetails = { symbol, name, totalSupply, decimals }

  tokenDetailsData[tokenAddress] = tokenDetails

  fs.writeFileSync(filePath, JSON.stringify(tokenDetailsData, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2))

  return tokenDetails
}

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
