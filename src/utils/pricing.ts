/* eslint-disable prefer-const */
import { type PoolEntity, type FactoryContract_PoolCreatedEvent_handlerContextAsync, type TokenEntity } from '../src/Types.gen'
import { exponentToBigDecimal } from '../utils/index'

const SMR_ADDRESS = '0x1074010000000000000000000000000000000000'
const USDT_SMR_03_POOL = '0xA0E105b9300Cfa9564126A705d6E5Bc9E05DE618'

// token where amounts should contribute to tracked volume and liquidity
// usually tokens that many tokens are paired with s
export let WHITELIST_TOKENS: string[] = [
  SMR_ADDRESS, // SMR
  '0xa4f8C7C1018b9dD3be5835bF00f335D9910aF6Bd', // USDT
  '0xeCE555d37C37D55a6341b80cF35ef3BC57401d1A', // USDC
  '0x4638C9fb4eFFe36C49d8931BB713126063BF38f9', // WETH
  '0xb0119035d08CB5f467F9ed8Eae4E5f9626Aa7402', // WBTC
  '0xE6373A7Bb9B5a3e71D1761a6Cb4992AD8537Bf28', // WMATIC
  '0xEAf8553fD72417C994525178fC917882d5AEc725', // WAVAX
  '0x8C96Dd1A8B1952Ce6F3a582170bb173eD591D40D', // WFTM
  '0x2A6F394085B8E33fbD9dcFc776BCE4ed95F1900D', // WBNB
  '0x4794Aeafa5Efe2fC1F6f5eb745798aaF39A81D3e', // LUM
  '0x5dA63f4456A56a0c5Cb0B2104a3610D5CA3d48E8', // sIOTA
  '0x326f23422CE22Ee5fBb5F37f9fa1092d095546F8', // DEEPR
  '0xE5f3dCC241Dd008E3c308e57cf4F7880eA9210F8', // VOID
  '0x8E9b86C02F54d4D909e25134ce45bdf2B6597306', // FUSE
  '0x264F2e6142CE8bEA68e5C646f8C07db98A9E003A', // APEin
  '0x3C844FB5AD27A078d945dDDA8076A4084A76E513', // SSOON
  '0xbD17705cA627EFBB55dE22A0F966Af79E9191c89', // RUST
  '0x83b090759017EFC9cB4d9E45B813f5D5CbBFeb95' // FUEL
]

let MINIMUM_ETH_LOCKED = 4

let Q192: number = 2 ** 192
export function sqrtPriceX96ToTokenPrices (sqrtPriceX96: bigint, token0: TokenEntity, token1: TokenEntity): number[] {
  let num: number = Number(sqrtPriceX96) ** 2
  let denom: number = Q192
  let price1: number = (num / denom) * Number(exponentToBigDecimal(token0.decimals)) / Number(exponentToBigDecimal(token1.decimals))

  let price0: number = 1 / price1
  return [price0, price1]
}

export async function getEthPriceInUSD (context: FactoryContract_PoolCreatedEvent_handlerContextAsync): Promise<number> {
  let usdtPool: PoolEntity | undefined = await context.Pool.get(USDT_SMR_03_POOL)

  if (usdtPool !== undefined && Number(usdtPool.totalValueLockedToken0) > MINIMUM_ETH_LOCKED) {
    return Number(usdtPool.token1Price)
  } else {
    return 0
  }
}

// /**
//  * Search through graph to find derived Eth per token.
//  * @todo update to be derived ETH (add stablecoin estimates)
//  **/
// export function findEthPerToken (token: Token): BigDecimal {
//   if (token.id === SMR_ADDRESS) {
//     return ONE_BD
//   }
//   // TODO: query whitelists
//   let whiteList = token.whitelistPools
//   // for now just take USD from pool with greatest TVL
//   // need to update this to actually detect best rate based on liquidity distribution
//   let largestLiquidityETH = ZERO_BD
//   let priceSoFar = ZERO_BD
//   for (let i = 0; i < whiteList.length; ++i) {
//     let poolAddress = whiteList[i]
//     let pool = Pool.load(poolAddress)
//     if (pool.liquidity > ZERO_BI) {
//       if (pool.token0 === token.id) {
//         // whitelist token is token1
//         let token1 = Token.load(pool.token1)
//         // get the derived ETH in pool
//         let ethLocked = pool.totalValueLockedToken1.times(token1.derivedETH)
//         if (ethLocked > largestLiquidityETH && ethLocked > MINIMUM_ETH_LOCKED) {
//           largestLiquidityETH = ethLocked
//           // token1 per our token * Eth per token1
//           priceSoFar = pool.token1Price.times(token1.derivedETH as BigDecimal)
//         }
//       }
//       if (pool.token1 === token.id) {
//         let token0 = Token.load(pool.token0)
//         // get the derived ETH in pool
//         let ethLocked = pool.totalValueLockedToken0.times(token0.derivedETH)
//         if (ethLocked > largestLiquidityETH && ethLocked > MINIMUM_ETH_LOCKED) {
//           largestLiquidityETH = ethLocked
//           // token0 per our token * ETH per token0
//           priceSoFar = pool.token0Price.times(token0.derivedETH as BigDecimal)
//         }
//       }
//     }
//   }
//   return priceSoFar // nothing was found return 0
// }

// /**
//  * Accepts tokens and amounts, return tracked amount based on token whitelist
//  * If one token on whitelist, return amount in that token converted to USD * 2.
//  * If both are, return sum of two amounts
//  * If neither is, return 0
//  */
// export function getTrackedAmountUSD (
//   tokenAmount0: number,
//   token0: TokenEntity,
//   tokenAmount1: number,
//   token1: TokenEntity
// ): number {
//   let bundle = Bundle.load('1')
//   let price0USD = token0.derivedETH.times(bundle.ethPriceUSD)
//   let price1USD = token1.derivedETH.times(bundle.ethPriceUSD)

//   // both are whitelist tokens, return sum of both amounts
//   if (WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
//     return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD))
//   }

//   // take double value of the whitelisted token amount
//   if (WHITELIST_TOKENS.includes(token0.id) && !WHITELIST_TOKENS.includes(token1.id)) {
//     return tokenAmount0.times(price0USD).times(BigDecimal.fromString('2'))
//   }

//   // take double value of the whitelisted token amount
//   if (!WHITELIST_TOKENS.includes(token0.id) && WHITELIST_TOKENS.includes(token1.id)) {
//     return tokenAmount1.times(price1USD).times(BigDecimal.fromString('2'))
//   }

//   // neither token is on white list, tracked amount is 0
//   return ZERO_BD
// }
