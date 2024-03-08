import assert from 'assert'
import { exponentToBigDecimal } from './../src/utils'

describe('exponentToBigDecimal', () => {
  it('should return correct big decimal for given exponent', () => {
    const result = exponentToBigDecimal(3n)
    assert.equal(result, 1000n, 'exponentToBigDecimal failed for 3n')

    const result2 = exponentToBigDecimal(5n)
    assert.equal(result2, 100000n, 'exponentToBigDecimal failed for 5n')
  })
})
