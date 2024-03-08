export function exponentToBigDecimal (decimals: bigint): bigint {
  let bd: bigint = BigInt(1)
  for (let i = 0; i < Number(decimals); i++) {
    bd = bd * BigInt(10)
  }
  return bd
}

export function safeDiv (amount0: bigint, amount1: bigint): bigint {
  if (amount1 === BigInt(0)) {
    return BigInt(0)
  } else {
    return amount0 / amount1
  }
}

export function bigDecimalExponated (value: bigint, power: bigint): bigint {
  if (power === BigInt(0)) {
    return BigInt(1)
  }
  const negativePower = power < BigInt(0)
  let result: bigint = BigInt(0) + value
  const powerAbs: bigint = negativePower ? -power : power
  for (let i = BigInt(1); i < powerAbs; i++) {
    result = result * value
  }

  if (negativePower) {
    result = safeDiv(BigInt(1), result)
  }

  return result
}

export function tokenAmountToDecimal (tokenAmount: bigint, exchangeDecimals: bigint): bigint {
  if (exchangeDecimals === BigInt(0)) {
    return tokenAmount
  }
  return tokenAmount / exponentToBigDecimal(exchangeDecimals)
}

export function priceToDecimal (amount: bigint, exchangeDecimals: bigint): bigint {
  if (exchangeDecimals === BigInt(0)) {
    return amount
  }
  return safeDiv(amount, exponentToBigDecimal(exchangeDecimals))
}

export function equalToZero (value: bigint): boolean {
  return value === BigInt(0)
}

export function isNullEthValue (value: string): boolean {
  return value === '0x0000000000000000000000000000000000000000000000000000000000000001'
}

export function bigDecimalExp18 (): bigint {
  return BigInt('1000000000000000000')
}

export function convertTokenToDecimal (tokenAmount: bigint, exchangeDecimals: bigint): number {
  if (exchangeDecimals === BigInt(0)) {
    return Number(tokenAmount)
  }
  return Number(tokenAmount) / Number(exponentToBigDecimal(exchangeDecimals))
}

export function convertEthToDecimal (eth: bigint): bigint {
  return eth / exponentToBigDecimal(BigInt(18))
}

export function loadTransaction (event: any): any {
  let transaction = event.transaction.hash
  if (transaction === null) {
    transaction = event.transaction.hash
  }
  transaction.blockNumber = event.block.number
  transaction.timestamp = event.block.timestamp
  transaction.gasUsed = event.transaction.gasUsed
  transaction.gasPrice = event.transaction.gasPrice
  return transaction
}

export function getPositionKey (pool: string, owner: string, tickLower: bigint, tickUpper: bigint): string {
  return pool.concat('-').concat(owner).concat('-').concat(tickLower.toString()).concat('-').concat(tickUpper.toString())
}
