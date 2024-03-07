import {
  NonfungiblePositionManagerContract_IncreaseLiquidity_loader,
  // NonfungiblePositionManagerContract_IncreaseLiquidity_handler,
  NonfungiblePositionManagerContract_IncreaseLiquidity_handlerAsync,
  NonfungiblePositionManagerContract_DecreaseLiquidity_loader,
  NonfungiblePositionManagerContract_DecreaseLiquidity_handler,
  NonfungiblePositionManagerContract_Transfer_loader,
  NonfungiblePositionManagerContract_Transfer_handler
} from '../../generated/src/Handlers.gen'
import { type PositionEntity, type NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync, type NonfungiblePositionManagerContract_IncreaseLiquidityEvent_eventArgs, type eventLog, type NonfungiblePositionManagerContract_TransferEvent_handlerContext, type NonfungiblePositionManagerContract_TransferEvent_eventArgs } from '../src/Types.gen'

NonfungiblePositionManagerContract_IncreaseLiquidity_loader(({ event, context }) => {
  context.Position.load(event.params.tokenId.toString(), {})
  context.PoolPosition.load('last', {
    loaders: {
      loadPool: { loadToken0: true, loadToken1: true }
    }
  })
})

NonfungiblePositionManagerContract_IncreaseLiquidity_handlerAsync(async ({ event, context }) => {
  const poolPosition = await context.PoolPosition.get('last')
  if (poolPosition === undefined) {
    context.log.error('PoolPosition not found')
    return
  }

  const pool = await context.PoolPosition.getPool(poolPosition)

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

  // Position got created in this tx
  if (position?.tickLower === 0n && position.tickUpper === 0n) {
    const token0 = await context.Pool.getToken0(pool)
    const token1 = await context.Pool.getToken1(pool)

    if (token0 === undefined || token1 === undefined) {
      context.log.error('Token not found')
      return
    }
    position = {
      ...position,
      // The owner gets correctly updated in the Transfer handler
      pool_id: pool.id,
      token0_id: token0.id,
      token1_id: token1.id,
      tickLower: poolPosition.tickLower,
      tickUpper: poolPosition.tickUpper
    } satisfies PositionEntity

    // update pool positionIds
    const newPool = {
      ...pool,
      positionIds: pool.positionIds === '' ? tokenId.toString() : pool.positionIds.concat(',', tokenId)
    }
    context.Pool.set(newPool)
  }

  // const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  // const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  const newPosition = {
    ...position,
    liquidity: position.liquidity + event.params.liquidity,
    depositedToken0: position.depositedToken0 + event.params.amount0,
    depositedToken1: position.depositedToken1 + event.params.amount1
  }

  // updateFeeVars(position, event, event.params.tokenId)

  context.Position.set(newPosition)

  savePositionSnapshot(position, event, context)
})

NonfungiblePositionManagerContract_DecreaseLiquidity_loader(({ event, context }) => {
  context.Position.load(event.params.tokenId.toString(), {})
})

NonfungiblePositionManagerContract_DecreaseLiquidity_handler(({ event, context }) => {
  const position = context.Position.get(event.params.tokenId.toString())

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

  // updateFeeVars(position, event, event.params.tokenId)

  context.Position.set(newPosition)

  savePositionSnapshot(position, event, context)
})

NonfungiblePositionManagerContract_Transfer_loader(({ event, context }) => {
  context.Position.load(event.params.tokenId.toString(), {})
})

NonfungiblePositionManagerContract_Transfer_handler(({ event, context }) => {
  let position = context.Position.get(event.params.tokenId.toString())

  if (position === undefined) {
    position = {
      id: event.params.tokenId.toString(),
      // The owner gets correctly updated in the Transfer handler
      owner: event.params.to,
      pool_id: '',
      token0_id: '',
      token1_id: '',
      tickLower: 0n,
      tickUpper: 0n,
      liquidity: 0n,
      depositedToken0: 0n,
      depositedToken1: 0n,
      withdrawnToken0: 0n,
      withdrawnToken1: 0n
    } satisfies PositionEntity
  }

  const newPosition = {
    ...position,
    owner: event.params.to
  }

  context.Position.set(newPosition)

  savePositionSnapshot(position, event, context)
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
  context: NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync | NonfungiblePositionManagerContract_TransferEvent_handlerContext
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
    transaction_id: 'tx'
    // feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
    // feeGrowthInside1LastX128: position.feeGrowthInside1LastX128
  })
}
