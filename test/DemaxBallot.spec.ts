import chai, { expect } from 'chai'
import { Contract, constants } from 'ethers'
import {
  formatBytes32String
} from 'ethers/utils'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { expandTo18Decimals, expandToString, newBigNumber } from './shared/utilities'
import { LogConsole as log } from './shared/logconsol'

import ERC20 from '../build/DemaxBallotTestToken.json'
import DemaxBallot from '../build/DemaxBallot.json'


chai.use(solidity)

const overrides = {
  gasLimit: 9999999,
}

const TEST_AMOUNT = expandTo18Decimals(10)
const ZERO = expandTo18Decimals(0)

describe('DemaxBallot', () => {
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
  
  const [wallet, governor, user1, user2, user3, user4] = provider.getWallets()

  let token: any
  let demaxBallot: any
  let expectValue = 1
  let endBlockNumber = 12
  before(async () => {
    const balance = await wallet.getBalance();
    log.debug('wallet:', wallet.address, ' balance:', expandToString(balance))
    token = await deployContract(wallet, ERC20, [expandTo18Decimals(100), 'TT', 'Token Test'], overrides)
    demaxBallot = await deployContract(wallet, DemaxBallot, [], overrides)
    await demaxBallot.initialize(wallet.address, expectValue, endBlockNumber, token.address, "subject", "content")
    log.info('token:', token.address)
    log.info('demaxBallot:', demaxBallot.address)
    await getBlockNumber();
    await initialize();
  })

  async function initialize() {
    let totalSupply = await token.totalSupply()
    log.info('totalSupply:', expandToString(totalSupply))

    await token.transfer(user1.address, TEST_AMOUNT.mul(3))
    await token.transfer(user2.address, TEST_AMOUNT.mul(2))
    await token.transfer(user2.address, TEST_AMOUNT)

    let balance = await token.balanceOf(wallet.address)
    log.debug('wallet balance:', expandToString(balance))
    balance = await token.balanceOf(user1.address)
    log.debug('user1 balance:', expandToString(balance))
    balance = await token.balanceOf(user2.address)
    log.debug('user2 balance:', expandToString(balance))
    balance = await token.balanceOf(user3.address)
    log.debug('user3 balance:', expandToString(balance))
    balance = await token.balanceOf(user4.address)
    log.debug('user4 balance:', expandToString(balance))
  }
  describe('#tests', () => {

    it('init:fail', async () => {
      await getBlockNumber()
      await expect(demaxBallot.connect(user4).initialize(wallet.address, expectValue, endBlockNumber, token.address, "subject", "content")).to.be.revertedWith('DemaxBallot: FORBIDDEN')
    })

    it('end:fail', async () => {
      await expect(demaxBallot.end()).to.be.revertedWith('DemaxBallot: FORBIDDEN')
      await expect(token.end(demaxBallot.address)).to.be.revertedWith('ballot not yet ended')
    })

    it('vote:fail', async () => {
      await getBlockNumber()
      await expect(demaxBallot.vote(0)).to.be.revertedWith('Only vote 1 or 2')
      await expect(demaxBallot.connect(user4).vote(1)).to.be.revertedWith('Has no right to vote')
    })

    it('vote', async () => {
      await getBlockNumber()
      let tx = await demaxBallot.vote(1)
      let receipt = await tx.wait()
      log.debug('vote1 gas:', receipt.gasUsed.toString())
      tx = await demaxBallot.connect(user1).vote(1)
      receipt = await tx.wait()
      log.debug('vote2 gas:', receipt.gasUsed.toString())
    })

    it('delegate', async () => {
      await getBlockNumber()
      let tx = await demaxBallot.connect(user2).delegate(user3.address)
      let receipt = await tx.wait()
      log.debug('delegate gas:', receipt.gasUsed.toString())
      let voterData = await demaxBallot.voters(user3.address)
      log.debug('voterData:', voterData, ' weight:', expandToString(voterData.weight))
      await demaxBallot.connect(user3).vote(2)
      await expect(demaxBallot.connect(user2).delegate(user3.address)).to.be.revertedWith('You already voted')
    })

    it('winningProposal', async () => {
      await getBlockNumber()
      const res = await demaxBallot.winningProposal()
      log.debug('winner:', res)
    })

    it('result', async () => {
      await getBlockNumber()
      const res = await demaxBallot.result()
      log.debug('result:', res)
    })

    it('end', async () => {
      await token.transfer(user4.address, TEST_AMOUNT)
      await getBlockNumber()

      let tx = await token.end(demaxBallot.address)
      let receipt = await tx.wait()
      log.debug('end gas:', receipt.gasUsed.toString())
    })

    it('base info', async () => {
      let result
      result = await demaxBallot.total()
      log.debug('total:', expandToString(result))

      result = await demaxBallot.weight(user1.address)
      log.debug('user1 weight:', expandToString(result))

      result = await demaxBallot.createTime()
      log.debug('createTime:', expandToString(result))
    })
  })
    
})
