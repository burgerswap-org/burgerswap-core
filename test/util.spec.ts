import { expect } from 'chai'
import { BigNumber, bigNumberify, parseEther } from 'ethers/utils'
import { expandTo18Decimals, expandToString, newBigNumber } from './shared/utilities'

describe('Util', () => {

  beforeEach(async () => {
  })

  it('temp', async () => {
    let bn = newBigNumber('100000000000000000000')
    console.log(expandToString(bn), bn.toString())
    bn = newBigNumber('100000000000000000000000000')
    console.log(expandToString(bn), bn.toString())
    bn = newBigNumber('3000000000000000000000000')
    console.log(expandToString(bn), bn.toString())
    bn = newBigNumber('0xb760252385a37fb500')
    console.log(expandToString(bn), bn.toString())
    console.log('1U:', expandTo18Decimals(1, 6).toString())
    console.log('1ETH:', expandTo18Decimals(1).toString())
    console.log('0.05ETH:', parseEther('0.05').toString())
  })

  it('decrease', async () => {
    const total = 95000000
    let count = 1
    let amount = 150000
    let value = 150000
    // console.info('====')
    // console.info(value)
    while (amount < total && value > 0) {
        count += 1
        value = value - 118
        if (amount + value > total) {
            value = total - amount
        }
        amount += value
        // console.info(value)
    }
    // console.info('====')
    console.info('count:', count)
    console.info('amount:', amount)
  })

  it('decrease2', async () => {
    const total = 95000000
    const days = 1188
    const begin = 31
    let count = 31
    let amount = 0
    let value = 0
    while (count <= days && amount < total) {
        value = 150000 - ((count-31)*118)
        // console.info(value)
        amount += value
        count += 1
    }
    // console.info('====')
    console.info('count:', count-1)
    console.info('amount:', amount)
  })

})
