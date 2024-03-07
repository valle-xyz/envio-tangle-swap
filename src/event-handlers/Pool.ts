import {
  PoolContract_Initialize_loader,
  PoolContract_Initialize_handler,
  PoolContract_Mint_loader,
  PoolContract_Mint_handler

} from '../../generated/src/Handlers.gen'
import { type PoolPositionEntity } from '../src/Types.gen'
import { getPositionKey } from '../utils'

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
