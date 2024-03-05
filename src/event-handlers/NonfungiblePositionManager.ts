import {
  NonfungiblePositionManagerContract_IncreaseLiquidity_loader,
  NonfungiblePositionManagerContract_IncreaseLiquidity_handlerAsync,
  NonfungiblePositionManagerContract_DecreaseLiquidity_loader,
  NonfungiblePositionManagerContract_DecreaseLiquidity_handlerAsync
} from '../../generated/src/Handlers.gen'
import { type PositionEntity, type NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync, type NonfungiblePositionManagerContract_IncreaseLiquidityEvent_eventArgs, type eventLog } from '../src/Types.gen'
import { ADDRESS_ZERO, FACTORY_ADDRESS, POSITION_MANAGER_ADDRESS } from '../utils/constants'
import { viemClient } from '../viem'
import NonfungiblePositionManagerAbi from '../../abis/NonfungiblePositionManager.json'
import FactoryAbi from '../../abis/factory.json'
import { convertTokenToDecimal } from '../utils'

NonfungiblePositionManagerContract_IncreaseLiquidity_loader(({ event, context }) => {
  context.Position.load(event.params.tokenId.toString(), {})
})

NonfungiblePositionManagerContract_IncreaseLiquidity_handlerAsync(async ({ event, context }) => {
  const position = await getPosition(event, context)

  // position was not able to be fetched
  if (position == null) {
    context.log.error('Position not found ' + event.params.tokenId.toString())
    return
  }

  const token0 = await context.Token.get(position.token0_id)
  const token1 = await context.Token.get(position.token1_id)

  if (token0 === undefined || token1 === undefined) {
    context.log.error('Token not found')
    return
  }

  const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  const newPosition = {
    ...position,
    liquidity: position.liquidity + event.params.liquidity,
    depositedToken0: position.depositedToken0 + Number(amount0),
    depositedToken1: position.depositedToken1 + Number(amount1)
  }

  // updateFeeVars(position, event, event.params.tokenId)

  context.Position.set(newPosition)

  savePositionSnapshot(position, event, context)
})

NonfungiblePositionManagerContract_DecreaseLiquidity_loader(({ event, context }) => {
  context.Position.load(event.params.tokenId.toString(), {})
})

NonfungiblePositionManagerContract_DecreaseLiquidity_handlerAsync(async ({ event, context }) => {
  const position = await getPosition(event, context)

  // position was not able to be fetched
  if (position == null) {
    context.log.error('Position not found ' + event.params.tokenId.toString())
    return
  }

  const token0 = await context.Token.get(position.token0_id)
  const token1 = await context.Token.get(position.token1_id)

  if (token0 === undefined || token1 === undefined) {
    context.log.error('Token not found')
    return
  }

  const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)

  const newPosition = {
    ...position,
    liquidity: position.liquidity - event.params.liquidity,
    withdrawnToken0: position.withdrawnToken0 + Number(amount0),
    withdrawnToken1: position.withdrawnToken1 + Number(amount1)
  }

  // updateFeeVars(position, event, event.params.tokenId)

  context.Position.set(newPosition)

  savePositionSnapshot(position, event, context)
})

async function getPosition (event: eventLog<NonfungiblePositionManagerContract_IncreaseLiquidityEvent_eventArgs>, context: NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync): Promise<PositionEntity | null> {
  const tokenId = event.params.tokenId.toString()
  let position = await context.Position.get(tokenId)
  if (position === undefined) {
    let positionResult
    try {
      positionResult = await viemClient.readContract({
        address: POSITION_MANAGER_ADDRESS,
        abi: NonfungiblePositionManagerAbi,
        functionName: 'positions',
        args: [tokenId],
        blockNumber: BigInt(event.blockNumber)
      })
    } catch (e) {
      context.log.error('Error fetching position')
      console.error(e instanceof Error ? e.name : e)
      return null
    }

    // the following call reverts in situations where the position is minted
    // and deleted in the same block - from my investigation this happens
    // in calls from  BancorSwap
    // (e.g. 0xf7867fa19aa65298fadb8d4f72d0daed5e836f3ba01f0b9b9631cdc6c36bed40)
    if (positionResult === undefined) {
      console.log('returning ')
      return null
    }
    let poolAddress
    try {
      poolAddress = await viemClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FactoryAbi,
        functionName: 'getPool',
        // @ts-expect-error we check positionResult manually
        args: [positionResult[2], positionResult[3], positionResult[4]],
        blockNumber: BigInt(event.blockNumber)
      }) as string
    } catch (e) {
      context.log.error('Error fetching pool')
      console.error(e instanceof Error ? e.name : e)
      return null
    }

    position = {
      id: tokenId.toString(),
      // The owner gets correctly updated in the Transfer handler
      owner: ADDRESS_ZERO,
      pool_id: poolAddress,
      // @ts-expect-error we check positionResult manually
      token0_id: positionResult[2],
      // @ts-expect-error we check positionResult manually
      token1_id: positionResult[3],
      // @ts-expect-error checked manually
      tickLower_id: poolAddress.concat('#').concat(positionResult[5].toString()),
      // @ts-expect-error checked manually
      tickUpper_id: poolAddress.concat('#').concat(positionResult[6].toString()),
      liquidity: 0n,
      depositedToken0: 0,
      depositedToken1: 0,
      withdrawnToken0: 0,
      withdrawnToken1: 0,
      collectedToken0: 0,
      collectedToken1: 0,
      collectedFeesToken0: 0,
      collectedFeesToken1: 0,
      transaction_id: 'tx',
      // @ts-expect-error checked manually
      feeGrowthInside0LastX128: positionResult[8],
      // @ts-expect-error checked manually
      feeGrowthInside1LastX128: positionResult[9]
    }
  }

  return position
}

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

function savePositionSnapshot (position: PositionEntity, event: eventLog<NonfungiblePositionManagerContract_IncreaseLiquidityEvent_eventArgs>, context: NonfungiblePositionManagerContract_IncreaseLiquidityEvent_handlerContextAsync): void {
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
    collectedFeesToken0: position.collectedFeesToken0,
    collectedFeesToken1: position.collectedFeesToken1,
    transaction_id: 'tx',
    feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
    feeGrowthInside1LastX128: position.feeGrowthInside1LastX128
  })
}
