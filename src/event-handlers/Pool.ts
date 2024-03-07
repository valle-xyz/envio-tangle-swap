import {
  PoolContract_Initialize_loader,
  PoolContract_Initialize_handler,
  PoolContract_Mint_loader,
  PoolContract_Mint_handler,
  PoolContract_Swap_loader,
  PoolContract_Swap_handlerAsync

} from '../../generated/src/Handlers.gen'
import { type PoolPositionEntity } from '../src/Types.gen'
import { getPositionKey } from '../utils'
import { Position, Pool, SqrtPriceMath, TickMath } from '@uniswap/v3-sdk'
import { BigintIsh, MaxUint256, Percent, Price, type CurrencyAmount, type Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'

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
  // also set cache
  context.PoolPosition.set({ ...newPoolPosition, id: 'last' })
})

PoolContract_Swap_loader(({ event, context }) => {
  context.Pool.load(event.srcAddress, { loaders: {} })
})

PoolContract_Swap_handlerAsync(async ({ event, context }) => {
  const tick = event.params.tick
  const sqrtPriceX96 = event.params.sqrtPriceX96

  const pool = await context.Pool.get(event.srcAddress)

  if (pool === undefined) {
    context.log.error('Pool not found at swap')
    return
  }

  const newPool = {
    ...pool,
    tick,
    sqrtPriceX96
  }

  context.Pool.set(newPool)

  // update all positions

  // iterate through all positionIds of pool
  // example: "positionIds": "411,412,447,448,449,450"
  const positionIds = pool.positionIds.split(',')
  for (const positionId of positionIds) {
    const position = await context.Position.get(positionId)

    if (position === undefined) {
      context.log.error('Position not found')
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
      token0Amount = BigInt(SqrtPriceMath.getAmount1Delta(
        JSBI.BigInt(pool.sqrtPrice.toString()),
        TickMath.getSqrtRatioAtTick(Number(position.tickUpper)),
        JSBI.BigInt(position.liquidity.toString()),
        false
      ).toString())

      token1Amount = BigInt(SqrtPriceMath.getAmount1Delta(
        TickMath.getSqrtRatioAtTick(Number(position.tickLower)),
        JSBI.BigInt(pool.sqrtPrice.toString()),
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
      transaction_id: 'tx'
    // feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
    // feeGrowthInside1LastX128: position.feeGrowthInside1LastX128
    })
  }
})
