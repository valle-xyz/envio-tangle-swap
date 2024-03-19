import assert from 'assert'
import { MockDb, Pool } from '../generated/src/TestHelpers.gen'
import { type PoolEntity } from './src/Types.gen'

describe('Transfers', () => {
  it('Tick Math', async () => {
    const mockDbEmpty = MockDb.createMockDb()

    const pool: PoolEntity = {
      sqrtPrice: 79158362996029144538478245127n,
      tick: -18n,
      feeTier: 500n,
      collectedFeesToken0: 0,
      collectedFeesToken1: 0,
      collectedFeesUSD: 0,
      feeGrowthGlobal0X128: 0n,
      feeGrowthGlobal1X128: 0n,
      feesUSD: 0,
      id: '0xb587996d7949781a9fc7dB29bf309B74762cE627',
      liquidity: 0n,
      observationIndex: 0n,
      positionIds: '2110',
      token0Price: 0,
      token0_id: '0xa4f8C7C1018b9dD3be5835bF00f335D9910aF6Bd',
      token1Price: 0,
      token1_id: '0xeCE555d37C37D55a6341b80cF35ef3BC57401d1A',
      totalValueLockedETH: 0,
      totalValueLockedToken0: 0n,
      totalValueLockedToken1: 0n,
      totalValueLockedUSD: 0,
      totalValueLockedUSDUntracked: 0,
      untrackedVolumeUSD: 0,
      volumeToken0: 0,
      volumeToken1: 0,
      volumeUSD: 0,
      txCount: 0n,
      createdAtTimestamp: 1704635259n,
      createdAtBlockNumber: 0n,
      liquidityProviderCount: 0n,
      isWhitelisted: false
    }

    const positionBefore = {
      id: '2110',
      liquidity: 599862768n,
      owner: '0x9Eb0030189651113831513D912768Df4061EB87C',
      user_id: '0x9Eb0030189651113831513D912768Df4061EB87C',
      tickLower: -877210n,
      tickUpper: 877220n,
      amount0: 0n,
      amount1: 0n,
      depositedToken0: 599759556n,
      depositedToken1: 599965999n,
      pool_id: '0xb587996d7949781a9fc7dB29bf309B74762cE627',
      token0_id: '0xa4f8C7C1018b9dD3be5835bF00f335D9910aF6Bd',
      token1_id: '0xeCE555d37C37D55a6341b80cF35ef3BC57401d1A',
      withdrawnToken0: 0n,
      withdrawnToken1: 0n,
      totalValueLockedUSD: 0
    }

    const swapEvent = Pool.Swap.createMockEvent({
      sender: '0xb587996d7949781a9fc7dB29bf309B74762cE627',
      recipient: '0x9Eb0030189651113831513D912768Df4061EB87C',
      amount0: 1234n,
      amount1: 1234n,
      sqrtPriceX96: 79158362996029144538478245127n,
      liquidity: 1234n,
      tick: -18n,
      mockEventData: {
        blockNumber: 1,
        blockTimestamp: 2,
        blockHash: '0x0',
        chainId: 1,
        srcAddress: '0xb587996d7949781a9fc7dB29bf309B74762cE627',
        transactionHash: '0x0',
        transactionIndex: 1,
        logIndex: 1
      }
    })

    const dbWithPool = mockDbEmpty.entities.Pool.set(pool)
    const dbWithPoolAndPosition = dbWithPool.entities.Position.set(positionBefore)

    const dbAfter = await Pool.Swap.processEventAsync({
      event: swapEvent,
      mockDb: dbWithPoolAndPosition
    })

    const positionAfter = dbAfter.entities.Position.get('2110')

    assert.equal(positionAfter?.amount0, 600391709n, 'amount0')
    assert.equal(positionAfter?.amount1, 599334292n, 'amount1')
  })
})
