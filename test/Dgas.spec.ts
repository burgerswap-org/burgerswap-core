import chai, { expect } from 'chai'
import { Contract, constants } from 'ethers'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { expandTo18Decimals, expandToNumber, expandToString, newBigNumber } from './shared/utilities'
import { LogConsole as log } from './shared/logconsol'

import Dgas from '../build/Dgas.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999,
}

const TEST_AMOUNT = expandTo18Decimals(10)
const ZERO = expandTo18Decimals(0)
const ZERO_ADDRESSES = '0x0000000000000000000000000000000000000000'

describe('Dgas', () => {
  const provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })

  async function getBlockNumber() {
    const blockNumber = await provider.getBlockNumber()
    log.debug("Current block number: " + blockNumber);
    return blockNumber;
  }
  
  const [wallet, user1, user2] = provider.getWallets()

  let token: any
  let lastBlockNumber: any
  before(async () => {
    const balance:any = await wallet.getBalance();
    log.debug('wallet:', wallet.address, ' balance:', expandToString(balance))
    token = await deployContract(wallet, Dgas, [], overrides)
    // log.debug('token:', token)
    await getBlockNumber();
  })

  describe('#base', () => {
    it('initlizated totalSupply', async () => {
      const totalSupply = await token.totalSupply()
      log.debug('initlizated totalSupply:', totalSupply.toString())
      expect(totalSupply).to.eq(ZERO)
      const balance = await token.balanceOf(wallet.address)
      log.debug('initlizated owner:', balance.toString())
      expect(balance).to.eq(ZERO)
    })
    
    it('approve', async () => {
      await expect(token.approve(user1.address, TEST_AMOUNT))
        .to.emit(token, 'Approval')
        .withArgs(wallet.address, user1.address, TEST_AMOUNT)
      expect(await token.allowance(wallet.address, user1.address)).to.eq(TEST_AMOUNT)
    })

    it('transfer', async () => {
      await expect(token.transfer(user1.address, ZERO))
        .to.emit(token, 'Transfer')
        .withArgs(wallet.address, user1.address, ZERO)
      expect(await token.balanceOf(wallet.address)).to.eq(ZERO)
      expect(await token.balanceOf(user1.address)).to.eq(ZERO)
    })

    it('transfer:fail', async () => {
      await expect(token.transfer(user1.address, ZERO.add(1))).to.be.reverted // ds-math-sub-underflow
      await expect(token.connect(user1).transfer(wallet.address, ZERO.add(1))).to.be.reverted // ds-math-sub-underflow
    })

    it('transferFrom', async () => {
      await token.approve(user1.address, TEST_AMOUNT)
      await expect(token.connect(user1).transferFrom(wallet.address, user1.address, ZERO))
        .to.emit(token, 'Transfer')
        .withArgs(wallet.address, user1.address, ZERO)
      expect(await token.allowance(wallet.address, user1.address)).to.eq(TEST_AMOUNT)
      expect(await token.balanceOf(wallet.address)).to.eq(ZERO)
      expect(await token.balanceOf(user1.address)).to.eq(ZERO)
    })

    it('upgrade:fail', async () => {
      await expect(token.connect(user1).upgradeImpl(wallet.address)).to.be.revertedWith('FORBIDDEN')
      await expect(token.upgradeImpl(ZERO_ADDRESSES)).to.be.revertedWith('INVALID_ADDRESS')
      await expect(token.upgradeImpl(wallet.address)).to.be.revertedWith('NO_CHANGE')

      await expect(token.connect(user1).upgradeGovernance(wallet.address)).to.be.revertedWith('FORBIDDEN')
      await expect(token.upgradeGovernance(ZERO_ADDRESSES)).to.be.revertedWith('INVALID_ADDRESS')
      await expect(token.upgradeGovernance(wallet.address)).to.be.revertedWith('NO_CHANGE')
    })

    it('upgrade', async () => {
      await expect(token.upgradeImpl(user1.address))
        .to.emit(token, 'ImplChanged')
        .withArgs(wallet.address, user1.address)

        await expect(token.upgradeGovernance(user1.address))
        .to.emit(token, 'GovernorChanged')
        .withArgs(wallet.address, user1.address)

      await expect(token.connect(user1).upgradeImpl(wallet.address))
        .to.emit(token, 'ImplChanged')
        .withArgs(user1.address, wallet.address)

      await expect(token.connect(user1).upgradeGovernance(wallet.address))
        .to.emit(token, 'GovernorChanged')
        .withArgs(user1.address, wallet.address)
    })

    it('changeAmountPerBlock:fail', async () => {
      await expect(token.connect(user1).changeInterestRatePerBlock(TEST_AMOUNT)).to.be.revertedWith('FORBIDDEN')
      // await expect(token.changeInterestRatePerBlock(expandTo18Decimals(40))).to.be.revertedWith('AMOUNT_PER_BLOCK_NO_CHANGE')
    })

    it('increaseProductivity:fail', async () => {
      await expect(token.connect(user1).increaseProductivity(user1.address, TEST_AMOUNT)).to.be.revertedWith('FORBIDDEN')
      await expect(token.increaseProductivity(user1.address, ZERO)).to.be.revertedWith('PRODUCTIVITY_VALUE_MUST_BE_GREATER_THAN_ZERO')
    })

    it('decreaseProductivity:fail', async () => {
      await expect(token.connect(user1).decreaseProductivity(user1.address, TEST_AMOUNT)).to.be.revertedWith('FORBIDDEN')
      await expect(token.decreaseProductivity(user1.address, ZERO)).to.be.revertedWith('INSUFFICIENT_PRODUCTIVITY')
      await expect(token.decreaseProductivity(user1.address, TEST_AMOUNT)).to.be.revertedWith('INSUFFICIENT_PRODUCTIVITY')
    })

    it('mint:fail', async () => {
      await expect(token.connect(user1).mint()).to.be.revertedWith('NO_PRODUCTIVITY')
    })
  })


  /**
   * Please be careful modify, you can add new cases to the end
   */
  describe('#hashrate mint', () => {
    async function getUserProduct(user:any) {
    }

    it('init', async () => {
      await token.changeInterestRatePerBlock(expandTo18Decimals(1000))
    })

    it('user1 first increaseProductivity', async () => {
      await getBlockNumber()
      let tx = await token.increaseProductivity(user1.address, TEST_AMOUNT)
      let receipt = await tx.wait()
      log.debug('first increaseProductivity gas:', receipt.gasUsed.toString())
      let totalSupply = await token.totalSupply()
      log.debug('totalSupply:', totalSupply.toString())
      expect(totalSupply).to.eq(ZERO)
    })

    it('user1 second increaseProductivity', async () => {
      await getBlockNumber()
      let tx = await token.increaseProductivity(user1.address, TEST_AMOUNT)
      let receipt = await tx.wait()
      log.debug('second increaseProductivity gas:', receipt.gasUsed.toString())
      let totalSupply = await token.totalSupply()
      log.debug('totalSupply:', totalSupply.toString())
      expect(totalSupply).to.eq(newBigNumber("1000000000000000000000"))

      const values = await token.getProductivity(user1.address)
      log.debug('getProductivity ', ' user:', expandToString(values[0]), ' total:', expandToString(values[1]))
    })

    it('user1 take', async () => {
      const blockNumber = await getBlockNumber()
      const amount = await token.connect(user1).take()
      log.debug('take amount:', expandToString(amount))
      expect(amount).to.eq(expandTo18Decimals(1000))
      const totalSupply = await token.totalSupply()
      log.debug('take totalSupply:', totalSupply.toString())
      expect(totalSupply).to.eq(newBigNumber("1000000000000000000000"))

      await getUserProduct(user1.address)
    })

    it('user1 mint', async () => {
      await getBlockNumber()
      const tx = await token.connect(user1).mint()
      let receipt = await tx.wait()
      log.debug('mint gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('mint value:', expandToString(receipt.events[0].args.value))
      expect(receipt.events[0].args.value).to.eq(expandTo18Decimals(2000))

      await getUserProduct(user1.address)
    })

    it('user1 take2', async () => {
      await getBlockNumber()
      const amount = await token.connect(user1).take()
      log.debug('take2 amount:', amount.toString())
      expect(amount).to.eq(expandTo18Decimals(0))
      const totalSupply = await token.totalSupply()
      log.debug('take totalSupply:', totalSupply.toString())
      expect(totalSupply).to.eq(expandTo18Decimals(2000))
    })

    it('user1 mint2', async () => {
      await getBlockNumber()
      const tx = await token.connect(user1).mint()
      let receipt = await tx.wait()
      log.debug('mint2 gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('mint2 value:', expandToString(receipt.events[0].args.value))
      expect(receipt.events[0].args.value).to.eq(expandTo18Decimals(1000))

      await getUserProduct(user1.address)
    })

    it('add blockNumber', async () => {
      await token.approve(user1.address, TEST_AMOUNT) //add blockNumber
    })

    it('user2 increaseProductivity', async () => {
      await getBlockNumber()
      const amount = TEST_AMOUNT.mul(2)
      await expect(token.increaseProductivity(user2.address, amount))
      .to.emit(token, 'ProductivityIncreased')
      .withArgs(user2.address, amount)

      const values = await token.getProductivity(user2.address)
      log.debug('getProductivity ', ' user:', expandToString(values[0]), ' total:', expandToString(values[1]))
    })

    it('user1 and user2 take', async () => {
      const amount1 = await token.connect(user1).take()
      log.debug('user1 amount:', expandToString(amount1))
      expect(amount1).to.eq(expandTo18Decimals(2000))
      const amount2 = await token.connect(user2).take()
      log.debug('user2 amount:', expandToString(amount2))
      expect(amount2).to.eq(expandTo18Decimals(0))
    })

    it('user1 and user2 mint', async () => {
      await getBlockNumber()
      await getUserProduct(user1.address)
      let tx = await token.connect(user1).mint()
      let receipt = await tx.wait()
      log.debug('user1 mint gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('user1 mint value:', expandToString(receipt.events[0].args.value), receipt.events[0].args.value.toString())
      expect(receipt.events[0].args.value).to.eq(newBigNumber('2500000000000000000000'))

      let amount = await token.connect(user2).take()
      log.debug('user2 take amount:', expandToString(amount), amount.toString())

      await getBlockNumber()
      await getUserProduct(user2.address)
      tx = await token.connect(user2).mint()
      receipt = await tx.wait()
      log.debug('user2 mint gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('user2 mint value:', expandToString(receipt.events[0].args.value), receipt.events[0].args.value.toString())
      expect(receipt.events[0].args.value).to.eq(newBigNumber('1000000000000000000000'))

      amount = await token.connect(user1).take()
      log.debug('user1 take amount:', expandToString(amount), amount.toString())
    })

    it('amountPerBlock', async () => {
      const amountPerBlock = await token.amountPerBlock()
      log.debug('amountPerBlock:', expandToString(amountPerBlock))
      expect(amountPerBlock).to.eq(expandTo18Decimals(1000))
    })

    it('changeInterestRatePerBlock', async () => {
      await getBlockNumber()
      const tx = await token.changeInterestRatePerBlock(expandTo18Decimals(100))
      let receipt = await tx.wait()
      log.debug('changeInterestRatePerBlock gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('changeInterestRatePerBlock oldvalue:', expandToString(receipt.events[0].args.oldValue))
      log.debug('changeInterestRatePerBlock newvalue:', expandToString(receipt.events[0].args.newValue))
      expect(receipt.events[0].args.newValue).to.eq(expandTo18Decimals(100))
    })

    it('user1 and user2 mint2', async () => {
      await getBlockNumber()
      let tx = await token.connect(user1).mint()
      let receipt = await tx.wait()
      log.debug('user1 mint gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('user1 mint value:', expandToString(receipt.events[0].args.value), receipt.events[0].args.value.toString())
      expect(receipt.events[0].args.value).to.eq(newBigNumber('1050000000000000000000'))

      await getBlockNumber()
      tx = await token.connect(user1).mint()
      receipt = await tx.wait()
      log.debug('user2 mint gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('user2 mint value:', expandToString(receipt.events[0].args.value), receipt.events[0].args.value.toString())
      expect(receipt.events[0].args.value).to.eq(newBigNumber('50000000000000000000'))
    })

    it('user1 decreaseProductivity', async () => {
      await getBlockNumber()
      const values = await token.getProductivity(user1.address)
      log.debug('getProductivity ', ' user:', expandToString(values[0]), ' total:', expandToString(values[1]))
      let tx = await token.decreaseProductivity(user1.address, TEST_AMOUNT)
      let receipt = await tx.wait()
      log.debug('second increaseProductivity gas:', receipt.gasUsed.toString())
      let totalSupply = await token.totalSupply()
      log.debug('totalSupply:', totalSupply.toString())
    })

    it('user1 and user2 mint3', async () => {
      await getBlockNumber()
      let tx = await token.connect(user1).mint()
      let receipt = await tx.wait()
      log.debug('user1 mint gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('user1 mint value:', expandToString(receipt.events[0].args.value), receipt.events[0].args.value.toString())
      expect(receipt.events[0].args.value).to.eq(newBigNumber('83333333333330000000'))

      await getBlockNumber()
      tx = await token.connect(user2).mint()
      receipt = await tx.wait()
      log.debug('user2 mint gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('user2 mint value:', expandToString(receipt.events[0].args.value), receipt.events[0].args.value.toString())
      expect(receipt.events[0].args.value).to.eq(newBigNumber('783333333333320000000'))
    })

    it('user1 decreaseProductivity2', async () => {
      await getBlockNumber()
      let values = await token.getProductivity(user1.address)
      log.debug('getProductivity ', ' user:', expandToString(values[0]), ' total:', expandToString(values[1]))
      let tx = await token.decreaseProductivity(user1.address, TEST_AMOUNT)
      let receipt = await tx.wait()
      log.debug('decreaseProductivity gas:', receipt.gasUsed.toString())
      let totalSupply = await token.totalSupply()
      log.debug('totalSupply:', totalSupply.toString())

      await getBlockNumber()
      tx = await token.connect(user2).mint()
      receipt = await tx.wait()
      log.debug('user2 mint gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('user2 mint value:', expandToString(receipt.events[0].args.value), receipt.events[0].args.value.toString())
      expect(receipt.events[0].args.value).to.eq(newBigNumber('166666666666660000000'))

      await getBlockNumber()
      tx = await token.connect(user1).mint()
      receipt = await tx.wait()
      log.debug('user1 mint1 gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      log.debug('user1 mint1 value:', expandToString(receipt.events[0].args.value), receipt.events[0].args.value.toString())
      expect(receipt.events[0].args.value).to.eq(newBigNumber('66666666666660000000'))
 
      await getBlockNumber()
      const amount = await token.connect(user1).take()
      log.debug('take amount:', amount.toString())
      expect(amount).to.eq(0)

      values = await token.getProductivity(user1.address)
      log.debug('getProductivity ', ' user:', expandToString(values[0]), ' total:', expandToString(values[1]))
      expect(values[0]).to.eq(0)

      await getUserProduct(user1.address)
      await expect(token.connect(user1).mint()).to.be.revertedWith('NO_PRODUCTIVITY')
      await getBlockNumber()
    })

  })
    
})
