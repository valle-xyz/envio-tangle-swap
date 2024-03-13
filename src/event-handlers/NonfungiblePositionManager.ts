import {
  NonfungiblePositionManagerContract_IncreaseLiquidity_loader,
  // NonfungiblePositionManagerContract_IncreaseLiquidity_handler,
  NonfungiblePositionManagerContract_IncreaseLiquidity_handlerAsync,
  NonfungiblePositionManagerContract_DecreaseLiquidity_loader,
  NonfungiblePositionManagerContract_Transfer_loader,
  NonfungiblePositionManagerContract_Transfer_handler,
  NonfungiblePositionManagerContract_DecreaseLiquidity_handlerAsync
} from '../../generated/src/Handlers.gen'
import { type PositionEntity, type NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync, type NonfungiblePositionManagerContract_DecreaseLiquidityEvent_handlerContextAsync, type NonfungiblePositionManagerContract_IncreaseLiquidityEvent_eventArgs, type eventLog, type NonfungiblePositionManagerContract_TransferEvent_handlerContext, type NonfungiblePositionManagerContract_TransferEvent_eventArgs } from '../src/Types.gen'
import { convertTokenToDecimal } from '../utils'
import { sqrtPriceX96ToTokenPrices } from '../utils/pricing'

NonfungiblePositionManagerContract_IncreaseLiquidity_loader(({ event, context }) => {
  context.Position.load(event.params.tokenId.toString(), {})
  context.PoolPosition.load('last', {
    loadPool: { loadToken0: true, loadToken1: true }
  })
  context.Bundle.load('1')
})

NonfungiblePositionManagerContract_IncreaseLiquidity_handlerAsync(async ({ event, context }) => {
  const bundle = await context.Bundle.get('1')

  if (bundle === undefined) {
    context.log.error('Bundle not found')
    return
  }

  const lastPoolPosition = await context.PoolPosition.get('last') // used as cache
  if (lastPoolPosition === undefined) {
    context.log.error('PoolPosition not found')
    return
  }

  let pool = await context.PoolPosition.getPool(lastPoolPosition)

  if (pool === undefined) {
    context.log.error('Pool not found')
    return
  }

  const tokenId = event.params.tokenId.toString()
  let position = await context.Position.get(tokenId)

  if (position === undefined) {
    context.log.error('Position not found ')
    return
  }

  const token0 = await context.Pool.getToken0(pool)
  const token1 = await context.Pool.getToken1(pool)

  if (token0 === undefined || token1 === undefined) {
    context.log.error('Token not found')
    return
  }

  // Position got created in this tx when tick is not set
  if (position?.tickLower === 0n && position.tickUpper === 0n) {
    position = {
      ...position,
      // The owner gets correctly updated in the Transfer handler
      pool_id: pool.id,
      token0_id: token0.id,
      token1_id: token1.id,
      tickLower: lastPoolPosition.tickLower,
      tickUpper: lastPoolPosition.tickUpper
    } satisfies PositionEntity

    // add positionId to pool positionIds
    pool = { ...pool, positionIds: pool.positionIds === '' ? tokenId.toString() : pool.positionIds.concat(',', tokenId) }

    // add positionId to bundle allPositionIds
    context.Bundle.set({
      ...bundle,
      allPositionIds: bundle.allPositionIds === '' ? tokenId.toString() : bundle.allPositionIds.concat(',', tokenId)
    })
  }

  // we only set this at increase event, to make sure every pool has a token price
  // does not actually change on increase or decrease
  const [token0Price, token1Price] = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1)
  pool = {
    ...pool,
    liquidity: pool.liquidity + event.params.liquidity,
    token0Price,
    token1Price,
    totalValueLockedToken0: BigInt(pool.totalValueLockedToken0) + event.params.amount0,
    totalValueLockedToken1: BigInt(pool.totalValueLockedToken1) + event.params.amount1
  }
  context.Pool.set(pool)

  // const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  // const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  const newPosition = {
    ...position,
    liquidity: position.liquidity + event.params.liquidity,
    depositedToken0: position.depositedToken0 + event.params.amount0,
    depositedToken1: position.depositedToken1 + event.params.amount1
  }

  context.Position.set(newPosition)

  savePositionSnapshot(newPosition, event, context)

  // token 0

  const totalValueLockedToken0 = BigInt(token0.totalValueLocked) + event.params.amount0
  const totalValueLockedUSDToken0 = convertTokenToDecimal(totalValueLockedToken0, token0.decimals) * Number(token0.derivedETH) * Number(bundle.ethPriceUSD)

  context.Token.set({
    ...token0,
    totalValueLocked: totalValueLockedToken0,
    totalValueLockedUSD: totalValueLockedUSDToken0
  })

  // token 1

  const totalValueLockedToken1 = BigInt(token1.totalValueLocked) + event.params.amount1
  const totalValueLockedUSDToken1 = convertTokenToDecimal(totalValueLockedToken1, token1.decimals) * token1.derivedETH * bundle.ethPriceUSD

  context.Token.set({
    ...token1,
    totalValueLocked: totalValueLockedToken1,
    totalValueLockedUSD: totalValueLockedUSDToken1
  })
})

NonfungiblePositionManagerContract_DecreaseLiquidity_loader(({ event, context }) => {
  context.Position.load(event.params.tokenId.toString(), { loadPool: { loadToken0: true, loadToken1: true } })
  context.Bundle.load('1')
})

NonfungiblePositionManagerContract_DecreaseLiquidity_handlerAsync(async ({ event, context }) => {
  const position = await context.Position.get(event.params.tokenId.toString())

  // position was not able to be fetched
  if (position === undefined) {
    context.log.error('Position not found ' + event.params.tokenId.toString())
    return
  }

  const newPosition = {
    ...position,
    liquidity: position.liquidity - event.params.liquidity,
    withdrawnToken0: position.withdrawnToken0 + event.params.amount0,
    withdrawnToken1: position.withdrawnToken1 + event.params.amount1
  }

  context.Position.set(newPosition)

  savePositionSnapshot(newPosition, event, context)

  const pool = await context.Position.getPool(position)

  if (pool === undefined) {
    context.log.error('Pool not found')
    return
  }

  const newPool = {
    ...pool,
    liquidity: pool.liquidity - event.params.liquidity,
    totalValueLockedToken0: BigInt(pool.totalValueLockedToken0) - event.params.amount0,
    totalValueLockedToken1: BigInt(pool.totalValueLockedToken1) - event.params.amount1
  }
  context.Pool.set(newPool)

  const bundle = await context.Bundle.get('1')

  if (bundle === undefined) {
    context.log.error('Bundle not found')
    return
  }

  const token0 = await context.Pool.getToken0(pool)
  const token1 = await context.Pool.getToken1(pool)

  if (token0 === undefined || token1 === undefined) {
    context.log.error('Token not found')
    return
  }

  // token 0

  const totalValueLockedToken0 = BigInt(token0.totalValueLocked) - event.params.amount0
  const totalValueLockedUSDToken0 = convertTokenToDecimal(totalValueLockedToken0, token0.decimals) * Number(token0.derivedETH) * Number(bundle.ethPriceUSD)

  context.Token.set({
    ...token0,
    totalValueLocked: totalValueLockedToken0,
    totalValueLockedUSD: totalValueLockedUSDToken0
  })

  // token 1

  const totalValueLockedToken1 = BigInt(token1.totalValueLocked) - event.params.amount1
  const totalValueLockedUSDToken1 = convertTokenToDecimal(totalValueLockedToken1, token1.decimals) * token1.derivedETH * bundle.ethPriceUSD

  context.Token.set({
    ...token1,
    totalValueLocked: totalValueLockedToken1,
    totalValueLockedUSD: totalValueLockedUSDToken1
  })
})

NonfungiblePositionManagerContract_Transfer_loader(({ event, context }) => {
  context.Position.load(event.params.tokenId.toString(), {})
})

NonfungiblePositionManagerContract_Transfer_handler(({ event, context }) => {
  let position = context.Position.get(event.params.tokenId.toString())

  let eventType = 'Transfer'

  if (position === undefined) {
    eventType = 'Mint'
    position = {
      id: event.params.tokenId.toString(),
      // The owner gets correctly updated in the Transfer handler
      owner: event.params.to,
      user_id: event.params.to,
      pool_id: '',
      token0_id: '',
      token1_id: '',
      tickLower: 0n,
      tickUpper: 0n,
      liquidity: 0n,
      depositedToken0: 0n,
      depositedToken1: 0n,
      withdrawnToken0: 0n,
      withdrawnToken1: 0n,
      amount0: 0n,
      amount1: 0n,
      totalValueLockedUSD: 0n
    } satisfies PositionEntity
  }

  const newPosition = {
    ...position,
    owner: event.params.to
  }

  context.Position.set(newPosition)

  // only save snapshot on Transfer
  // for Mint event the snappshot will be saved in the IncreaseLiquidity handler
  if (eventType === 'Transfer') {
    savePositionSnapshot(newPosition, event, context)
  }
})

// TODO: Potentially add Collect event handler

// Omitted for now (to speed up syncing)
// TODO: Maybe add this back in later
// function updateFeeVars(position: Position, event: ethereum.Event, tokenId: BigInt): Position {
//   let positionManagerContract = NonfungiblePositionManager.bind(event.address)
//   let positionResult = positionManagerContract.try_positions(tokenId)
//   if (!positionResult.reverted) {
//     position.feeGrowthInside0LastX128 = positionResult.value.value8
//     position.feeGrowthInside1LastX128 = positionResult.value.value9
//   }
//   return position
// }

function savePositionSnapshot (position: PositionEntity,
  event: eventLog<NonfungiblePositionManagerContract_IncreaseLiquidityEvent_eventArgs> | eventLog<NonfungiblePositionManagerContract_TransferEvent_eventArgs>,
  context: NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync | NonfungiblePositionManagerContract_DecreaseLiquidityEvent_handlerContextAsync | NonfungiblePositionManagerContract_TransferEvent_handlerContext
): void {
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
    amount0: position.amount0,
    amount1: position.amount1
    // feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
    // feeGrowthInside1LastX128: position.feeGrowthInside1LastX128
  })
}
