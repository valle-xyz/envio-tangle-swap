import {
  FactoryContract_PoolCreated_handler,
  FactoryContract_PoolCreated_loader
} from "../generated/src/Handlers.gen";

import { PoolEntity } from "../generated/src/Types.gen";


FactoryContract_PoolCreated_loader(({ event, context }) => {
  context.Pool.load(event.params.pool, {});
});

/**
Registers a handler that handles any values from the
NewGreeting event on the Greeter contract and index these values into
the DB.
*/
FactoryContract_PoolCreated_handler(({ event, context }) => {
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

  context.Pool.set(poolEntity);
});
