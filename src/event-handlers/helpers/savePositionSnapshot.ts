import { type PositionEntity, type NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync, type NonfungiblePositionManagerContract_DecreaseLiquidityEvent_handlerContextAsync, type NonfungiblePositionManagerContract_IncreaseLiquidityEvent_eventArgs, type eventLog, type NonfungiblePositionManagerContract_TransferEvent_handlerContext, type NonfungiblePositionManagerContract_TransferEvent_eventArgs, type PoolContract_SwapEvent_eventArgs, type PoolContract_SwapEvent_handlerContextAsync } from '../../src/Types.gen'

export function savePositionSnapshot (position: PositionEntity,
  event: eventLog<NonfungiblePositionManagerContract_IncreaseLiquidityEvent_eventArgs> | eventLog<NonfungiblePositionManagerContract_TransferEvent_eventArgs> | eventLog<PoolContract_SwapEvent_eventArgs>,
  context: NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync | NonfungiblePositionManagerContract_DecreaseLiquidityEvent_handlerContextAsync | NonfungiblePositionManagerContract_TransferEvent_handlerContext | PoolContract_SwapEvent_handlerContextAsync
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
