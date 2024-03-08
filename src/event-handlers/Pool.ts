import {
  PoolContract_Initialize_loader,
  PoolContract_Initialize_handler,
  PoolContract_Mint_loader,
  PoolContract_Mint_handler,
  PoolContract_Swap_loader,
  PoolContract_Swap_handlerAsync,
  PoolContract_Burn_loader,
  PoolContract_Burn_handler

} from '../../generated/src/Handlers.gen'
import { type BundleEntity, type PoolEntity, type PoolPositionEntity } from '../src/Types.gen'
import { convertTokenToDecimal, getPositionKey } from '../utils'
import { SqrtPriceMath, TickMath } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import { findEthPerToken, getEthPriceInUSD, sqrtPriceX96ToTokenPrices } from '../utils/pricing'

PoolContract_Initialize_loader(({ event, context }) => {
  context.Pool.load(event.srcAddress, {})
})

PoolContract_Initialize_handler(({ event, context }) => {
  const pool = context.Pool.get(event.srcAddress)

  if (pool === undefined) {
    context.log.error('Pool not found at initialize')
    return
  }

  const newPool = {
    ...pool,
    sqrtPriceX96: event.params.sqrtPriceX96,
    tick: event.params.tick
  }

  context.Pool.set(newPool)
})

PoolContract_Mint_loader(({ event, context }) => {
  context.Pool.load(event.srcAddress, {})
})

PoolContract_Mint_handler(({ event, context }) => {
  const newPoolPosition: PoolPositionEntity = {
    id: getPositionKey(event.srcAddress, event.params.owner, event.params.tickLower, event.params.tickUpper),
    owner: event.params.owner,
    pool_id: event.srcAddress,
    tickLower: event.params.tickLower,
    tickUpper: event.params.tickUpper,
    amount: event.params.amount,
    amount0: event.params.amount0,
    amount1: event.params.amount1
  }

  context.PoolPosition.set(newPoolPosition)
  // also set cache here
  context.PoolPosition.set({ ...newPoolPosition, id: 'last' })

  const pool = context.Pool.get(event.srcAddress)

  if (pool === undefined) {
    context.log.error('Pool not found at mint')
    return
  }

  if (pool.tick === undefined || pool.liquidity === undefined) {
    context.log.error('Pool tick or liquidity not found')
    return
  }

  if (pool.tick !== null && event.params.tickLower <= pool.tick && event.params.tickUpper > pool.tick) {
    context.Pool.set(({
      ...pool,
      liquidity: BigInt(pool.liquidity) + event.params.amount
    }))
  }
})

PoolContract_Burn_loader(({ event, context }) => {
  context.Pool.load(event.srcAddress, {})
})

PoolContract_Burn_handler(({ event, context }) => {
  const pool = context.Pool.get(event.srcAddress)

  if (pool === undefined) {
    context.log.error('Pool not found at mint')
    return
  }

  if (pool.tick === undefined || pool.liquidity === undefined) {
    context.log.error('Pool tick or liquidity not found')
    return
  }

  if (pool.tick !== null && event.params.tickLower <= pool.tick && event.params.tickUpper > pool.tick) {
    context.Pool.set({
      ...pool,
      liquidity: BigInt(pool.liquidity) - event.params.amount
    })
  }
})

PoolContract_Swap_loader(({ event, context }) => {
  context.Pool.load(event.srcAddress, { loadToken0: true, loadToken1: true })
  context.Bundle.load('1')
})

PoolContract_Swap_handlerAsync(async ({ event, context }) => {
  const tick = event.params.tick
  const sqrtPriceX96 = event.params.sqrtPriceX96

  const pool = await context.Pool.get(event.srcAddress)

  if (pool === undefined) {
    context.log.error('Pool not found at swap')
    return
  }

  const bundle = await context.Bundle.get('1')

  if (bundle === undefined) {
    context.log.error('Bundle not found')
    return
  }

  const token0 = await context.Pool.getToken0(pool)
  const token1 = await context.Pool.getToken1(pool)

  const [token0Price, token1Price] = sqrtPriceX96ToTokenPrices(sqrtPriceX96, token0, token1)

  const newPool: PoolEntity = {
    ...pool,
    tick,
    sqrtPrice: sqrtPriceX96,
    liquidity: event.params.liquidity,
    totalValueLockedToken0: BigInt(pool.totalValueLockedToken0) + event.params.amount0,
    totalValueLockedToken1: BigInt(pool.totalValueLockedToken1) + event.params.amount1,
    token0Price,
    token1Price
  }

  context.Pool.set(newPool)

  const newEthPrice = await getEthPriceInUSD(context)

  let shouldUpdateAllPositions = false
  if (newEthPrice !== bundle.ethPriceUSD) {
    context.Bundle.set({
      ...bundle,
      ethPriceUSD: await getEthPriceInUSD(context)
    })
    shouldUpdateAllPositions = true // will be done at the end of this function
  }

  // update all positions
  // iterate through all positionIds of pool

  const positionIds = pool.positionIds.split(',')
  for (const positionId of positionIds) {
    const position = await context.Position.get(positionId)

    if (position === undefined) {
      context.log.error('Position not found ' + positionId)
      return
    }

    let token0Amount: bigint
    let token1Amount: bigint
    if (tick < position.tickLower) {
      token0Amount =
        BigInt(SqrtPriceMath.getAmount0Delta(
          TickMath.getSqrtRatioAtTick(Number(position.tickLower)),
          TickMath.getSqrtRatioAtTick(Number(position.tickUpper)),
          JSBI.BigInt(position.liquidity.toString()),
          false
        ).toString())
      token1Amount = 0n
    } else if (tick < position.tickUpper) {
      token0Amount = BigInt(SqrtPriceMath.getAmount0Delta(
        JSBI.BigInt(sqrtPriceX96.toString()),
        TickMath.getSqrtRatioAtTick(Number(position.tickUpper)),
        JSBI.BigInt(position.liquidity.toString()),
        false
      ).toString())

      token1Amount = BigInt(SqrtPriceMath.getAmount1Delta(
        TickMath.getSqrtRatioAtTick(Number(position.tickLower)),
        JSBI.BigInt(sqrtPriceX96.toString()),
        JSBI.BigInt(position.liquidity.toString()),
        false
      ).toString())
    } else {
      token0Amount = 0n
      token1Amount = BigInt(
        SqrtPriceMath.getAmount1Delta(
          TickMath.getSqrtRatioAtTick(Number(position.tickLower)),
          TickMath.getSqrtRatioAtTick(Number(position.tickUpper)),
          JSBI.BigInt(position.liquidity.toString()),
          false
        ).toString())
    }

    const newPosition = {
      ...position,
      amount0: token0Amount,
      amount1: token1Amount
    }

    context.Position.set(newPosition)

    context.PositionSnapshot.set({
      id: position.id.concat('#').concat(event.blockNumber.toString()),
      owner: position.owner,
      pool_id: position.pool_id,
      position_id: position.id,
      blockNumber: BigInt(event.blockNumber),
      timestamp: BigInt(event.blockTimestamp),
      liquidity: position.liquidity,
      depositedToken0: position.depositedToken0,
      depositedToken1: position.depositedToken1,
      withdrawnToken0: position.withdrawnToken0,
      withdrawnToken1: position.withdrawnToken1,
      // collectedFeesToken0: position.collectedFeesToken0,
      // collectedFeesToken1: position.collectedFeesToken1,
      transaction_id: 'tx',
      amount0: token0Amount,
      amount1: token1Amount
    // feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
    // feeGrowthInside1LastX128: position.feeGrowthInside1LastX128
    })
  }

  const derivedEthToken0 = await findEthPerToken(token0, context)
  const totalValueLockedToken0 = BigInt(pool.totalValueLockedToken0) + event.params.amount0

  context.Token.set({
    ...token0,
    totalValueLocked: totalValueLockedToken0,
    totalValueLockedUSD: convertTokenToDecimal(totalValueLockedToken0, token0.decimals) * Number(bundle.ethPriceUSD),
    derivedETH: derivedEthToken0,
    derivedUSD: derivedEthToken0 * Number(bundle.ethPriceUSD)
  })

  const derivedEthToken1 = await findEthPerToken(token1, context)
  const totalValueLockedToken1 = BigInt(pool.totalValueLockedToken1) + event.params.amount1

  context.Token.set({
    ...token1,
    totalValueLocked: totalValueLockedToken1,
    totalValueLockedUSD: convertTokenToDecimal(totalValueLockedToken1, token1.decimals) * Number(bundle.ethPriceUSD),
    derivedETH: derivedEthToken1,
    derivedUSD: derivedEthToken1 * Number(bundle.ethPriceUSD)
  })

  if (shouldUpdateAllPositions) {
    // update all positions
  }
})
