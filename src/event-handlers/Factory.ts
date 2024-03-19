import {
  FactoryContract_PoolCreated_handlerAsync,
  FactoryContract_PoolCreated_loader
} from '../../generated/src/Handlers.gen'

import { ADDRESS_ZERO, FACTORY_ADDRESS, POOL_ADDRESSES, ZERO_BD, ZERO_BI } from '../utils/constants'

import { type TokenEntity, type BundleEntity, type FactoryEntity, type PoolEntity } from '../../generated/src/Types.gen'
import { fetchTokenDetails } from '../utils/token'

FactoryContract_PoolCreated_loader(({ event, context }) => {
  context.contractRegistration.addPool(event.params.pool)
  context.Pool.load(event.params.pool, {})
  context.Factory.load(FACTORY_ADDRESS)
  context.Token.load(event.params.token0)
  context.Token.load(event.params.token1)
  context.Bundle.load('1')
})

FactoryContract_PoolCreated_handlerAsync(async ({ event, context }) => {
  // load factory
  let factory: FactoryEntity | undefined = await context.Factory.get(FACTORY_ADDRESS)
  if (factory === undefined) {
    factory = {
      id: FACTORY_ADDRESS,
      poolCount: ZERO_BI,
      totalVolumeETH: ZERO_BD,
      totalVolumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalFeesUSD: ZERO_BD,
      totalFeesETH: ZERO_BD,
      totalValueLockedETH: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      totalValueLockedETHUntracked: ZERO_BD,
      txCount: ZERO_BI,
      owner: ADDRESS_ZERO
    }
    context.Factory.set(factory)

    // create new bundle for tracking eth price
    const bundle: BundleEntity = {
      id: '1',
      ethPriceUSD: ZERO_BD,
      allPositionIds: '',
      allTokenIds: ''
    }
    context.Bundle.set(bundle)
  }

  factory = { ...factory, poolCount: factory.poolCount + 1n }
  context.Factory.set(factory)

  let token0: TokenEntity | undefined = await context.Token.get(event.params.token0)
  let token1: TokenEntity | undefined = await context.Token.get(event.params.token1)

  // fetch info if null
  if (token0 === undefined) {
    const { symbol, name, totalSupply, decimals } = await fetchTokenDetails(event.params.token0)

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      context.log.debug('mybug the decimal on token 0 was null')
      return
    }

    token0 = {
      id: event.params.token0,
      symbol,
      name,
      totalSupply,
      decimals,
      derivedETH: ZERO_BD,
      derivedUSD: ZERO_BD,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalValueLocked: 0n,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      txCount: ZERO_BI,
      poolCount: ZERO_BI,
      whitelistPoolIds: ''
    }

    // add new token0 id to bundle
    const tempBundle = await context.Bundle.get('1')
    if (tempBundle === undefined) {
      context.log.error('Bundle was undefined')
      return
    }
    context.Bundle.set({
      ...tempBundle,
      allTokenIds: tempBundle.allTokenIds === '' ? event.params.token0 : tempBundle.allTokenIds.concat(',', event.params.token0)
    })
  }
  context.Token.set({
    ...token0,
    whitelistPoolIds: token0.whitelistPoolIds === '' ? event.params.pool : token0.whitelistPoolIds.concat(',', event.params.pool)
  })

  if (token1 === undefined) {
    const { symbol, name, totalSupply, decimals } = await fetchTokenDetails(event.params.token1)

    // bail if we couldn't figure out the decimals
    if (decimals === null) {
      context.log.debug('mybug the decimal on token 0 was null')
      return
    }

    token1 = {
      id: event.params.token1,
      symbol,
      name,
      totalSupply,
      decimals,
      derivedETH: ZERO_BD,
      derivedUSD: ZERO_BD,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalValueLocked: 0n,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      txCount: ZERO_BI,
      poolCount: ZERO_BI,
      whitelistPoolIds: ''
    }

    // add new token0 id to bundle
    const tempBundle = await context.Bundle.get('1')
    if (tempBundle === undefined) {
      context.log.error('Bundle was undefined')
      return
    }
    context.Bundle.set({
      ...tempBundle,
      allTokenIds: tempBundle.allTokenIds === '' ? event.params.token1 : tempBundle.allTokenIds.concat(',', event.params.token1)
    })
  }
  context.Token.set({
    ...token1,
    whitelistPoolIds: token0.whitelistPoolIds === '' ? event.params.pool : token0.whitelistPoolIds.concat(',', event.params.pool)
  })

  const isWhitelisted = POOL_ADDRESSES.includes(event.params.pool.toLowerCase())

  context.log.info('Pool ' + event.params.pool.toLowerCase() + ' is whitelisted: ' + isWhitelisted)

  // create new pool
  const poolEntity: PoolEntity = {
    id: event.params.pool,
    untrackedVolumeUSD: 0,
    totalValueLockedUSDUntracked: 0,
    sqrtPrice: 0n,
    token0_id: event.params.token0,
    volumeToken0: 0,
    collectedFeesUSD: 0,
    totalValueLockedUSD: 0,
    liquidityProviderCount: 0n,
    liquidity: 0n,
    token0Price: 0,
    token1Price: 0,
    observationIndex: 0n,
    collectedFeesToken1: 0,
    txCount: 0n,
    totalValueLockedToken1: 0n,
    token1_id: event.params.token1,
    volumeUSD: 0,
    feesUSD: 0,
    feeTier: event.params.fee,
    feeGrowthGlobal0X128: 0n,
    feeGrowthGlobal1X128: 0n,
    collectedFeesToken0: 0,
    totalValueLockedToken0: 0n,
    tick: undefined,
    totalValueLockedETH: 0,
    createdAtBlockNumber: 0n,
    volumeToken1: 0,
    createdAtTimestamp: BigInt(event.blockTimestamp),
    positionIds: '',
    isWhitelisted
  }

  context.Pool.set(poolEntity)
})
