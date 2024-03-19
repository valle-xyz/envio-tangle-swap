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
import { type PoolEntity, type PoolPositionEntity } from '../src/Types.gen'
import { getPositionKey } from '../utils'
import { SqrtPriceMath, TickMath } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import { getEthPriceInUSD, sqrtPriceX96ToTokenPrices } from '../utils/pricing'
import { savePositionSnapshot } from './helpers/savePositionSnapshot'

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

  const ethPriceUSD = await getEthPriceInUSD(context)

  context.Bundle.set({
    ...bundle,
    ethPriceUSD
  })

  // if pool is whitelisted, update all positions
  // update all positions
  // iterate through all positionIds of pool
  if (pool.isWhitelisted === true) {
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

      if (position.amount0 !== token0Amount || position.amount1 !== token1Amount) {
        const newPosition = {
          ...position,
          amount0: token0Amount,
          amount1: token1Amount
        }

        context.Position.set(newPosition)
        savePositionSnapshot(newPosition, event, context)
      }
    }
  }

  // const derivedEthToken0 = await findEthPerToken(token0, context)
  // const totalValueLockedToken0 = BigInt(token0.totalValueLocked) + event.params.amount0

  // context.Token.set({
  //   ...token0,
  //   totalValueLocked: totalValueLockedToken0,
  //   totalValueLockedUSD: convertTokenToDecimal(totalValueLockedToken0, token0.decimals) * ethPriceUSD,
  //   derivedETH: derivedEthToken0,
  //   derivedUSD: derivedEthToken0 * ethPriceUSD
  // })

  // const derivedEthToken1 = await findEthPerToken(token1, context)
  // const totalValueLockedToken1 = BigInt(token1.totalValueLocked) + event.params.amount1

  // context.Token.set({
  //   ...token1,
  //   totalValueLocked: totalValueLockedToken1,
  //   totalValueLockedUSD: convertTokenToDecimal(totalValueLockedToken1, token1.decimals) * ethPriceUSD,
  //   derivedETH: derivedEthToken1,
  //   derivedUSD: derivedEthToken1 * ethPriceUSD
  // })

  // Update all positions :)

  // const allPositionIds = bundle.allPositionIds.split(',')

  // for (const positionId of allPositionIds) {
  //   const position = await context.Position.get(positionId)

  //   if (position === undefined) {
  //     context.log.error('Position not found at update all: ' + positionId)
  //     continue
  //   }

  //   const t0 = await context.Position.getToken0(position)
  //   const t1 = await context.Position.getToken1(position)

  //   const totalValueLockedUSDToken0 = convertTokenToDecimal(position.amount0, t0.decimals) * Number(t0.derivedUSD)
  //   const totalValueLockedUSDToken1 = convertTokenToDecimal(position.amount1, t1.decimals) * Number(t1.derivedUSD)
  //   const totalValueLockedUSD = totalValueLockedUSDToken0 + totalValueLockedUSDToken1

  //   context.Position.set(({
  //     ...position,
  //     totalValueLockedUSD
  //   }))

  //   context.PositionSnapshot.set({
  //     id: position.id.concat('#').concat(event.blockNumber.toString()),
  //     owner: position.owner,
  //     pool_id: position.pool_id,
  //     position_id: position.id,
  //     blockNumber: BigInt(event.blockNumber),
  //     timestamp: BigInt(event.blockTimestamp),
  //     liquidity: position.liquidity,
  //     depositedToken0: position.depositedToken0,
  //     depositedToken1: position.depositedToken1,
  //     withdrawnToken0: position.withdrawnToken0,
  //     withdrawnToken1: position.withdrawnToken1,
  //     transaction_id: 'tx',
  //     amount0: position.amount0,
  //     amount1: position.amount1
  //   })

  //   // update user hour data

  //   const roundedTimestamp = event.blockTimestamp - event.blockTimestamp % 3600
  //   const id = position.owner.concat('-').concat((roundedTimestamp).toString())

  //   let userHourData = await context.UserHourData.get(id)

  //   if (userHourData === undefined) {
  //     userHourData = {
  //       id,
  //       user_id: position.owner,
  //       timestamp: roundedTimestamp,
  //       totalValueLockedUSD: 0,
  //       lastTransaction: ''
  //     }
  //   }
  //   /// When last transaction is not the same, we reset the totalValueLockedUSD
  //   if (userHourData.lastTransaction !== event.transactionHash) {
  //     userHourData = {
  //       ...userHourData,
  //       lastTransaction: event.transactionHash,
  //       totalValueLockedUSD
  //     }
  //   } else {
  //     /// else we add the totalValueLockedUSD to the existing one
  //     userHourData = {
  //       ...userHourData,
  //       totalValueLockedUSD: userHourData.totalValueLockedUSD + totalValueLockedUSD
  //     }
  //   }
  //   context.UserHourData.set(userHourData)
  // }

  // Update all token :)
  // const allTokenIds = bundle.allTokenIds.split(',')
  // for (const tokenId of allTokenIds) {
  //   const token = await context.Token.get(tokenId)

  //   if (token === undefined) {
  //     context.log.error('Token not found at update all: ' + tokenId)
  //     continue
  //   }

  //   const derivedEth = await findEthPerToken(token, context)

  //   context.Token.set({
  //     ...token,
  //     derivedETH: derivedEth,
  //     derivedUSD: derivedEth * ethPriceUSD
  //   })
  // }
})
