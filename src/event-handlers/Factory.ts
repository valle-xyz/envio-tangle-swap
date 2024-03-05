import {
  FactoryContract_PoolCreated_handlerAsync,
  FactoryContract_PoolCreated_loader
} from '../../generated/src/Handlers.gen'

import { ADDRESS_ZERO, FACTORY_ADDRESS, ZERO_BD, ZERO_BI } from '../utils/constants'

import { type TokenEntity, type BundleEntity, type FactoryEntity, type PoolEntity } from '../../generated/src/Types.gen'
import { fetchTokenSymbol, fetchTokenDecimals, fetchTokenName, fetchTokenTotalSupply } from '../utils/token'
import { WHITELIST_TOKENS } from '../utils/pricing'

FactoryContract_PoolCreated_loader(({ event, context }) => {
  context.Pool.load(event.params.pool, {})
  context.Factory.load(FACTORY_ADDRESS)
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
      ethPriceUSD: ZERO_BD
    }
    context.Bundle.set(bundle)
  }

  factory = { ...factory, poolCount: factory.poolCount + 1n }
  context.Factory.set(factory)

  let token0: TokenEntity | undefined = await context.Token.get(event.params.token0)
  let token1: TokenEntity | undefined = await context.Token.get(event.params.token1)

  // fetch info if null
  if (token0 === undefined) {
    const symbol = await fetchTokenSymbol(event.params.token0)
    const name = await fetchTokenName(event.params.token0)
    const totalSupply = await fetchTokenTotalSupply(event.params.token0)
    const decimals = await fetchTokenDecimals(event.params.token0)

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
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      txCount: ZERO_BI,
      poolCount: ZERO_BI
    }
    context.Token.set(token0)
  }

  if (token1 === undefined) {
    const symbol = await fetchTokenSymbol(event.params.token1)
    const name = await fetchTokenName(event.params.token1)
    const totalSupply = await fetchTokenTotalSupply(event.params.token1)
    const decimals = await fetchTokenDecimals(event.params.token1)

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
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
      totalValueLockedUSDUntracked: ZERO_BD,
      txCount: ZERO_BI,
      poolCount: ZERO_BI
    }
    context.Token.set(token1)
  }

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
    totalValueLockedToken1: 0,
    token1_id: event.params.token1,
    volumeUSD: 0,
    feesUSD: 0,
    feeTier: event.params.fee,
    feeGrowthGlobal0X128: 0n,
    feeGrowthGlobal1X128: 0n,
    collectedFeesToken0: 0,
    totalValueLockedToken0: 0,
    tick: undefined,
    totalValueLockedETH: 0,
    createdAtBlockNumber: 0n,
    volumeToken1: 0,
    createdAtTimestamp: BigInt(event.blockTimestamp)
  }

  context.Pool.set(poolEntity)

  // update white listed pools
  if (WHITELIST_TOKENS.includes(token0.id)) {
    context.TokenPoolWhitelist.set({ id: `${token0.id}-${poolEntity.id}`, token_id: token0.id, pool_id: poolEntity.id })
  }
  if (WHITELIST_TOKENS.includes(token1.id)) {
    context.TokenPoolWhitelist.set({ id: `${token1.id}-${poolEntity.id}`, token_id: token1.id, pool_id: poolEntity.id })
  }
})
