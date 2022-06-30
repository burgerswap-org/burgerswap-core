import chai, { expect } from 'chai'
import { Contract, constants } from 'ethers'
import {
  formatBytes32String
} from 'ethers/utils'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { expandTo18Decimals, expandToString, newBigNumber } from './shared/utilities'
import { LogConsole as log } from './shared/logconsol'

import ERC20 from '../build/ERC20.json'
import Dgas from '../build/DgasTest.json'
import Weth from '../build/WETH9.json'
import DemaxGovernance from '../build/DemaxGovernanceTest.json'
import DemaxBallotFactory from '../build/DemaxBallotFactory.json'
import DemaxBallot from '../build/DemaxBallot.json'
import DemaxConfig from '../build/DemaxConfigTest.json'


chai.use(solidity)

const overrides = {
  gasLimit: 9999999,
}

const TEST_AMOUNT = expandTo18Decimals(10)
const ZERO = expandTo18Decimals(0)
const NONE = 0;
const REGISTERED = 1;
const PENDING = 2;
const OPENED = 3;
const CLOSED = 4;

describe('DemaxGovernance', () => {
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
  
  const [wallet, rewarder, dev, user1, user2] = provider.getWallets()

  let dgas: any
  let weth: any
  let demaxConfig: any
  let demaxGovernance: any
  let demaxBallot: any
  let demaxBallotFactory: any
  let tokenA: any
  let tokenB: any
  let tokenC: any
  let tokenD: any
  let tokenE: any
  let lastBlockNumber: any
  before(async () => {
    const balance = await wallet.getBalance();
    log.debug('wallet:', wallet.address, ' balance:', expandToString(balance))
    tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'TA', 'Token A'], overrides)
    tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'TB', 'Token B'], overrides)
    tokenC = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'TC', 'Token C'], overrides)
    tokenD = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'TD', 'Token D'], overrides)
    tokenE = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'TE', 'Token E'], overrides)
    weth = await deployContract(wallet, Weth, [], overrides)
    dgas = await deployContract(wallet, Dgas, [], overrides)
    demaxGovernance = await deployContract(wallet, DemaxGovernance, [dgas.address], overrides)
    demaxConfig = await deployContract(wallet, DemaxConfig, [], overrides)
    demaxBallotFactory = await deployContract(wallet, DemaxBallotFactory, [], overrides)
    await demaxConfig.initialize(dgas.address, demaxGovernance.address, rewarder.address, dev.address, [dgas.address, weth.address])
    await demaxGovernance.initialize(rewarder.address, demaxConfig.address, demaxBallotFactory.address)
    log.info('dgas:', dgas.address)
    log.info('weth:', weth.address)
    log.info('demaxGovernance:', demaxGovernance.address)
    log.info('demaxConfig:', demaxConfig.address)
    log.info('demaxBallotFactory:', demaxBallotFactory.address)
    log.info('tokenA:', tokenA.address)
    log.info('tokenB:', tokenB.address)
    log.info('tokenC:', tokenC.address)

    await expect(dgas.approve(demaxGovernance.address, expandTo18Decimals(100000000)))
    .to.emit(dgas, 'Approval')
    .withArgs(wallet.address, demaxGovernance.address, expandTo18Decimals(100000000))
    expect(await dgas.allowance(wallet.address, demaxGovernance.address)).to.eq(expandTo18Decimals(100000000))

    await dgas.connect(user1).approve(demaxGovernance.address, expandTo18Decimals(1000))
    await dgas.connect(user2).approve(demaxGovernance.address, expandTo18Decimals(1000))

    await dgas.transfer(user1.address, expandTo18Decimals(1000))
    await dgas.transfer(user2.address, expandTo18Decimals(1000))
    await dgas.transfer(rewarder.address, expandTo18Decimals(1000))

    await getBlockNumber();
  })

  async function addBlockNumber(n:number) {
    for (let i=0; i<n; i++) {
      await dgas.approve(user1.address, expandTo18Decimals(10000000))
    }
  }

  async function initStaking() {
    let totalSupply = await dgas.totalSupply()
    log.info('totalSupply:', expandToString(totalSupply))

    let balance = await dgas.balanceOf(wallet.address)
    log.debug('wallet balance:', expandToString(balance))
    balance = await dgas.balanceOf(rewarder.address)
    log.debug('rewarder balance:', expandToString(balance))
    balance = await dgas.balanceOf(user1.address)
    log.debug('user1 balance:', expandToString(balance))
    balance = await dgas.balanceOf(user2.address)
    log.debug('user2 balance:', expandToString(balance))

    await expect(dgas.connect(rewarder).transfer(demaxGovernance.address, expandTo18Decimals(100)))
      .to.emit(dgas, 'Transfer')
      .withArgs(rewarder.address, demaxGovernance.address, expandTo18Decimals(100))

    await demaxGovernance.connect(rewarder).addReward(expandTo18Decimals(100))
    balance = await demaxGovernance.balanceOf(rewarder.address)
    log.debug('demaxGovernance rewarder balance:', expandToString(balance))

    balance = await dgas.balanceOf(wallet.address)
    log.debug('wallet balance:', expandToString(balance))
    balance = await dgas.balanceOf(demaxGovernance.address)
    log.debug('demaxGovernance balance:', expandToString(balance))

    let allowance = await dgas.allowance(wallet.address, demaxGovernance.address)
    log.debug('wallet allowance:', expandToString(allowance))
    allowance = await dgas.allowance(user1.address, demaxGovernance.address)
    log.debug('user1 allowance:', expandToString(allowance))
    allowance = await dgas.allowance(user2.address, demaxGovernance.address)
    log.debug('user2 allowance:', expandToString(allowance))

    await demaxGovernance.deposit(expandTo18Decimals(100))
    await demaxGovernance.connect(user1).deposit(expandTo18Decimals(100))
    await demaxGovernance.connect(user2).deposit(expandTo18Decimals(100))

    balance = await demaxGovernance.rewardOf(rewarder.address)
    log.debug('rewarder demaxGovernance balance:', expandToString(balance))
    balance = await demaxGovernance.balanceOf(wallet.address)
    log.debug('wallet demaxGovernance balance:', expandToString(balance))
    balance = await demaxGovernance.balanceOf(user1.address)
    log.debug('user1 demaxGovernance balance:', expandToString(balance))
    balance = await demaxGovernance.balanceOf(user2.address)
    log.debug('user2 demaxGovernance balance:', expandToString(balance))
  }

  describe('#base', () => {
    let tx
    let receipt
    it('base info', async () => {
      let balance = await demaxGovernance.balanceOf(wallet.address)
      log.debug('wallet balance:', expandToString(balance))
      let baseToken = await demaxGovernance.baseToken()
      log.debug('baseToken:', baseToken)
      expect(baseToken).to.eq(dgas.address)
    })
  
    it('addReward:fail', async () => {
      await expect(demaxGovernance.addReward(expandTo18Decimals(1))).to.be.revertedWith('DemaxGovernance: ONLY_REWARDER')
      await expect(demaxGovernance.connect(rewarder).addReward(expandTo18Decimals(1))).to.be.revertedWith('DemaxGovernance: ADD_REWARD_EXCEED')
    })

    it('createConfigBallot:fail', async () => {
      await expect(demaxGovernance.createConfigBallot(formatBytes32String('unknown'), 1, expandTo18Decimals(100), true, 'subject', 'content...')).to.be.revertedWith('DemaxGovernance: CONFIG_DISABLE')
      await expect(demaxGovernance.createConfigBallot(formatBytes32String('SWAP_FEE_PERCENT'), 1, expandTo18Decimals(100), true, 'subject', 'content...')).to.be.revertedWith('DemaxGovernance: OUTSIDE')
      await expect(demaxGovernance.createConfigBallot(formatBytes32String('SWAP_FEE_PERCENT'), 20, expandTo18Decimals(100), true, 'subject', 'content...')).to.be.revertedWith('DemaxGovernance: OVERSTEP')
    })

    it('createTokenBallot:fail', async () => {
      await expect(demaxGovernance.createTokenBallot(dgas.address, CLOSED, expandTo18Decimals(100), true, 'subject', 'content...')).to.be.revertedWith('DemaxGovernance: DEFAULT_LIST_TOKENS_PROPOSAL_DENY')
    })

    it('list token', async () => {
      let tx = await demaxGovernance.listToken(tokenB.address, expandTo18Decimals(10), true, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('listToken gas:', receipt.gasUsed.toString())
      log.debug('events:', receipt.events)
      log.debug('events[3].args:', receipt.events[4].args)
      log.debug('events[4].args:', receipt.events[5].args)
      expect(receipt.events[5].args.amount).to.eq(expandTo18Decimals(10))
      
      let ballotContract = new Contract(receipt.events[4].args.ballotAddr, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      let value = await ballotContract.subject()
      log.debug('subject:', value)
      expect(value).to.eq('subject')
      value = await ballotContract.content()
      log.debug('content:', value)
      expect(value).to.eq('content...')
    })
    
    it('fail to list token', async () => {
      await expect(demaxGovernance.listToken(tokenB.address, expandTo18Decimals(1000), true, 'subject', 'content...')).to.be.revertedWith('DemaxGovernance: LISTED')
    })
    
  })

  describe('#staking', () => {
    let tx
    let receipt
    let result
    let balance
    it('deposit', async () => {
      result = await demaxGovernance.lockTime()
      log.debug('lockTime1:', result.toString()) 
      await demaxGovernance.changeLockTime(3)
      result = await demaxGovernance.lockTime()
      log.debug('lockTime2:', result.toString()) 

      balance = await demaxGovernance.balanceOf(wallet.address)
      log.debug('wallet balance:', expandToString(balance))

      await getBlockNumber()
      tx = await demaxGovernance.deposit(expandTo18Decimals(100))
      receipt = await tx.wait()
      log.debug('deposit gas:', receipt.gasUsed.toString())
      balance = await demaxGovernance.balanceOf(wallet.address)
      log.debug('wallet balance:', expandToString(balance))
      
      let bn = await getBlockNumber()
      log.debug('getBlockNumber:', bn.toString()) 
      result = await demaxGovernance.allowance(wallet.address)
      log.debug('allowance:', result.toString())
      
      await demaxGovernance.connect(user1).deposit(expandTo18Decimals(100))
    })

    it('withdraw:fail', async () => {
      result = await demaxGovernance.totalSupply()
      log.debug('totalSupply:', expandToString(result))
      result = await demaxGovernance.stakingSupply()
      log.debug('stakingSupply:', expandToString(result))
      await expect(demaxGovernance.withdraw(expandTo18Decimals(100))).to.be.revertedWith('DgasStaking: NOT_DUE')
      await addBlockNumber(4)
      await expect(demaxGovernance.withdraw(expandTo18Decimals(1000))).to.be.revertedWith('TransferHelper: TRANSFER_FAILED')
      await expect(demaxGovernance.withdraw(expandTo18Decimals(101))).to.be.revertedWith('DgasStaking: INSUFFICIENT_BALANCE')
    })
    
    it('withdraw', async () => {
      tx = await demaxGovernance.withdraw(expandTo18Decimals(10))
      receipt = await tx.wait()
      log.debug('withdraw gas:', receipt.gasUsed.toString())
      balance = await demaxGovernance.balanceOf(wallet.address)
      log.debug('wallet balance:', expandToString(balance))
      expect(balance).to.eq(expandTo18Decimals(90))
    })
    
  })

  describe('#create config ballot and vote to pass', () => {
    let ballotContract: Contract
    const expectValue = expandTo18Decimals(1000)
    
    it('initialize', async () => {
      await initStaking()
    })
        
    it('change VOTE_DURATION to test below cases', async () => {
      const name = formatBytes32String('VOTE_DURATION')
      let tx = await demaxConfig.changeConfigValueNoCheck(name, 5)
      let receipt = await tx.wait()
      log.debug('changeConfigValueNoCheck gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      expect(receipt.events[0].args._value).to.eq(newBigNumber(5))
    })

    it('createConfigBallot', async () => {
      const name = formatBytes32String('LIST_DGAS_AMOUNT')
      const blockNumber = await getBlockNumber()
      log.debug('name:', name)
      
      let tx = await demaxGovernance.createConfigBallot(name, expectValue, expandTo18Decimals(100), true, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('create gas:', receipt.gasUsed.toString())
      // log.debug('events:', receipt.events)
      expect(receipt.events[3].args.name).to.eq(name)
      expect(receipt.events[3].args.proposer).to.eq(wallet.address)
      let reward = receipt.events[3].args.reward
      let ballot = receipt.events[3].args.ballotAddr
      log.debug('ballot:', ballot, ' reward:', expandToString(reward))
      expect(reward).to.eq(expandTo18Decimals(200))

      reward = await demaxGovernance.rewardOf(ballot)
      log.debug('rewardPool:', expandToString(reward))

      // connect ballot contract with wallet account
      ballotContract = new Contract(ballot, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      const value = await ballotContract.value()
      log.debug('value:', value.toString())
      expect(value).to.eq(expectValue)

    })

    it('vote', async () => {
      let tx;
      let receipt;
      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(1)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      let oldValue = await demaxConfig.getConfigValue(formatBytes32String('LIST_DGAS_AMOUNT'))
      log.debug('LIST_DGAS_AMOUNT: oldValue:', expandToString(oldValue))
      expect(oldValue).to.eq(0)

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('auditConfig gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[1].event, 'args:', receipt.events[1].args)
      // expect(receipt.events[1].args.ballot).to.eq(ballotContract.address)
      // expect(receipt.events[1].args.proposal).to.eq(expectValue)

      let value = await demaxConfig.getConfigValue(formatBytes32String('LIST_DGAS_AMOUNT'))
      log.debug('LIST_DGAS_AMOUNT: value:', expandToString(value))
      expect(value).to.eq(expandTo18Decimals(1000))

      let reward = await demaxGovernance.getReward(ballotContract.address)
      log.debug('wallet reward:', reward.toString())
      let reward1 = await demaxGovernance.connect(user1).getReward(ballotContract.address)
      log.debug('user1 reward:', reward1.toString())
      let reward2 = await demaxGovernance.connect(user2).getReward(ballotContract.address)
      log.debug('user2 reward:', reward2.toString())

      
      tx = await demaxGovernance.collectReward(ballotContract.address)
      receipt = await tx.wait()
      log.debug('collectReward gas:', receipt.gasUsed.toString())
      log.debug('collectReward receipt:', receipt.events[0].args)
      log.debug('collectReward value:', receipt.events[0].args.value.toString())
      // expect(reward).to.eq(receipt.events[0].args.value)
      // expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      // expect(receipt.events[0].args.to).to.eq(wallet.address)

      tx = await demaxGovernance.connect(user1).collectReward(ballotContract.address)
      receipt = await tx.wait()
      log.debug('collectReward gas:', receipt.gasUsed.toString())
      log.debug('collectReward receipt:', receipt.events[0].args)
      log.debug('collectReward value:', receipt.events[0].args.value.toString())
      // expect(reward1).to.eq(receipt.events[0].args.value)
      // expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      // expect(receipt.events[0].args.to).to.eq(user1.address)

      tx = await demaxGovernance.connect(user2).collectReward(ballotContract.address)
      receipt = await tx.wait()
      log.debug('collectReward gas:', receipt.gasUsed.toString())
      log.debug('collectReward receipt:', receipt.events[0].args)
      log.debug('collectReward value:', receipt.events[0].args.value.toString())
      // expect(reward2).to.eq(receipt.events[0].args.value)
      // expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      // expect(receipt.events[0].args.to).to.eq(user2.address)

      let balance = await demaxGovernance.rewardOf(ballotContract.address)
      log.debug('ballotContract balance:', balance.toString())

    })

  })


  describe('#vote to list token, no pass', () => {
    let ballotContract: Contract
    
    it('initialize1', async () => {
      await initStaking()
    })

    it('list token', async () => {
      const blockNumber = await getBlockNumber()

      let tx = await demaxGovernance.listToken(tokenC.address, expandTo18Decimals(100000), true, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('listToken gas:', receipt.gasUsed.toString())
      // log.debug('events:', receipt.events)
      log.debug('proposer:', receipt.events[4].args.proposer)
      log.debug('token:', receipt.events[4].args.token)
      log.debug('ballotAddr:', receipt.events[4].args.ballotAddr)
      log.debug('reward:', expandToString(receipt.events[4].args.reward))
      log.debug('amount:', expandToString(receipt.events[5].args.amount))
      expect(receipt.events[5].args.amount).to.eq(expandTo18Decimals(100000))

      ballotContract = new Contract(receipt.events[4].args.ballotAddr, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      log.debug('ballotContract address:', ballotContract.address)
    })

    it('vote to audit list token, no pass', async () => {
      let tx;
      let receipt;
      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(2)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())
      const result = await ballotContract.result()
      log.debug('result:', result)
      expect(result).to.eq(false)

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('execute gas:', receipt.gasUsed.toString())
      // log.debug('event:', receipt.events)
      // log.debug(receipt.events[3].event, 'args:', receipt.events[3].args)
      log.debug('user:', receipt.events[3].args.user)
      log.debug('token:', receipt.events[3].args.token)
      log.debug('status:', receipt.events[3].args.status.toString())
      log.debug('burn:', expandToString(receipt.events[3].args.burn))
      log.debug('reward:', expandToString(receipt.events[3].args.reward))
      log.debug('refund:', expandToString(receipt.events[3].args.refund))

      let status = await demaxConfig.tokenStatus(tokenC.address)
      log.debug('status:', status.toString())
      expect(status).to.eq(receipt.events[3].args.status)

    })

  })

  describe('#vote to list token', () => {
    let ballotContract: Contract
    
    it('initialize', async () => {
      await initStaking()
    })

    it('fail to list token', async () => {
      await expect(demaxGovernance.listToken(tokenA.address, expandTo18Decimals(100), true, 'subject', 'content...')).to.be.revertedWith('DemaxGovernance: NOT_ENOUGH_AMOUNT_TO_LIST')
    })
    
    it('list token', async () => {
      const blockNumber = await getBlockNumber()

      let tx = await demaxGovernance.listToken(tokenA.address, expandTo18Decimals(100000), true, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('listToken gas:', receipt.gasUsed.toString())
      // log.debug('events:', receipt.events)
      log.debug('proposer:', receipt.events[4].args.proposer)
      log.debug('token:', receipt.events[4].args.token)
      log.debug('ballotAddr:', receipt.events[4].args.ballotAddr)
      log.debug('reward:', expandToString(receipt.events[4].args.reward))
      log.debug('amount:', expandToString(receipt.events[5].args.amount))
      expect(receipt.events[5].args.amount).to.eq(expandTo18Decimals(100000))

      ballotContract = new Contract(receipt.events[4].args.ballotAddr, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      log.debug('ballotContract address:', ballotContract.address)
    })

    it('vote to audit list token, pass', async () => {
      let tx;
      let receipt;
      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(1)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())
      let result = await ballotContract.result()
      log.debug('result:', result)
      expect(result).to.eq(true)

      result = await demaxGovernance.ballotOf(ballotContract.address)
      log.debug('ballotOf 1:', expandToString(result))

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('execute gas:', receipt.gasUsed.toString())
      // log.debug('event:', receipt.events)
      // log.debug(receipt.events[2].event, 'args:', receipt.events[2].args)
      log.debug('user:', receipt.events[3].args.user)
      log.debug('token:', receipt.events[3].args.token)
      log.debug('status:', receipt.events[3].args.status.toString())
      log.debug('burn:', expandToString(receipt.events[3].args.burn))
      log.debug('reward:', expandToString(receipt.events[3].args.reward))
      log.debug('refund:', expandToString(receipt.events[3].args.refund))

      let status = await demaxConfig.tokenStatus(tokenA.address)
      log.debug('status:', status.toString())
      expect(status).to.eq(receipt.events[3].args.status)


      result = await demaxGovernance.ballotOf(ballotContract.address)
      log.debug('ballotOf 2:', expandToString(result))
      expect(result).to.eq(expandTo18Decimals(50100))

      let reward = await demaxGovernance.getReward(ballotContract.address)
      log.debug('wallet reward:', expandToString(reward), reward.toString())
      let reward1 = await demaxGovernance.connect(user1).getReward(ballotContract.address)
      log.debug('user1 reward:', expandToString(reward1), reward1.toString())
      let reward2 = await demaxGovernance.connect(user2).getReward(ballotContract.address)
      log.debug('user2 reward:', expandToString(reward2), reward2.toString())

    })

    it('create audit token for open', async () => {
      let tx = await demaxGovernance.createTokenBallot(tokenA.address, OPENED, expandTo18Decimals(100), true, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('createTokenBallot gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[3].event, 'args:', receipt.events[3].args)

      ballotContract = new Contract(receipt.events[3].args.ballotAddr, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      log.debug('ballotContract address:', ballotContract.address)

      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(1)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())
      const result = await ballotContract.result()
      log.debug('result:', result)
      expect(result).to.eq(true)

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('execute gas:', receipt.gasUsed.toString())
      // log.debug('event:', receipt.events)
      // log.debug(receipt.events.event, 'args:', receipt.events[1].args)
      log.debug('user:', receipt.events[1].args.user)
      log.debug('token:', receipt.events[1].args.token)
      log.debug('status:', receipt.events[1].args.status.toString())
      log.debug('result:', receipt.events[1].args.result)

      let status = await demaxConfig.tokenStatus(tokenA.address)
      log.debug('status:', status.toString())
      expect(status).to.eq(newBigNumber(OPENED))

    })

    it('create audit token for close', async () => {
      await demaxConfig.changeTokenStatus(tokenA.address, PENDING)
      let tx = await demaxGovernance.createTokenBallot(tokenA.address, CLOSED, expandTo18Decimals(100), true, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('createTokenBallot gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[3].event, 'args:', receipt.events[3].args)

      ballotContract = new Contract(receipt.events[3].args.ballotAddr, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      log.debug('ballotContract address:', ballotContract.address)

      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(1)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())
      const result = await ballotContract.result()
      log.debug('result:', result)
      expect(result).to.eq(true)

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('execute gas:', receipt.gasUsed.toString())
      // log.debug('event:', receipt.events)
      // log.debug(receipt.events.event, 'args:', receipt.events[1].args)
      log.debug('user:', receipt.events[1].args.user)
      log.debug('token:', receipt.events[1].args.token)
      log.debug('status:', receipt.events[1].args.status.toString())
      log.debug('result:', receipt.events[1].args.result)

      let status = await demaxConfig.tokenStatus(tokenA.address)
      log.debug('status:', status.toString())
      expect(status).to.eq(newBigNumber(CLOSED))

    })

    it('create audit token no pass', async () => {
      await demaxConfig.changeTokenStatus(tokenA.address, PENDING)
      let tx = await demaxGovernance.createTokenBallot(tokenA.address, OPENED, expandTo18Decimals(100), true, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('createTokenBallot gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[3].event, 'args:', receipt.events[3].args)

      ballotContract = new Contract(receipt.events[3].args.ballotAddr, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      log.debug('ballotContract address:', ballotContract.address)

      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(2)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())
      const result = await ballotContract.result()
      log.debug('result:', result)
      expect(result).to.eq(false)

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('execute gas:', receipt.gasUsed.toString())
      log.debug('user:', receipt.events[0].args.user)
      log.debug('token:', receipt.events[0].args.token)
      log.debug('status:', receipt.events[0].args.status.toString())
      log.debug('result:', receipt.events[0].args.result)

      let status = await demaxConfig.tokenStatus(tokenA.address)
      log.debug('status:', status.toString())
      expect(status).to.eq(newBigNumber(PENDING))

    })
  })

  describe('#create config ballot with staking and vote to pass', () => {
    let ballotContract: Contract
    const expectValue = expandTo18Decimals(1000)
    
    it('initialize', async () => {
      await initStaking()
    })
        
    it('change VOTE_DURATION to test below cases', async () => {
      const name = formatBytes32String('VOTE_DURATION')
      let tx = await demaxConfig.changeConfigValueNoCheck(name, 5)
      let receipt = await tx.wait()
      log.debug('changeConfigValueNoCheck gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      expect(receipt.events[0].args._value).to.eq(newBigNumber(5))
    })

    it('createConfigBallot fail, INSUFFICIENT_BALANCE', async () => {
      await expect(demaxGovernance.createConfigBallot(formatBytes32String('LIST_DGAS_AMOUNT'), expectValue, expandTo18Decimals(1000), false, 'subject', 'content...')).to.be.revertedWith('DgasStaking: INSUFFICIENT_BALANCE')
    })

    it('createConfigBallot', async () => {
      await demaxGovernance.deposit(expandTo18Decimals(100000))

      const name = formatBytes32String('LIST_DGAS_AMOUNT')
      const blockNumber = await getBlockNumber()
      log.debug('name:', name)
      
      let tx = await demaxGovernance.createConfigBallot(name, expectValue, expandTo18Decimals(100), false, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('create gas:', receipt.gasUsed.toString())
      // log.debug('events:', receipt.events)
      expect(receipt.events[2].args.name).to.eq(name)
      expect(receipt.events[2].args.proposer).to.eq(wallet.address)
      let reward = receipt.events[2].args.reward
      let ballot = receipt.events[2].args.ballotAddr
      log.debug('ballot:', ballot, ' reward:', expandToString(reward))
      expect(reward).to.eq(expandTo18Decimals(200))

      reward = await demaxGovernance.rewardOf(ballot)
      log.debug('rewardPool:', expandToString(reward))
      let ballotReward = await demaxGovernance.ballotOf(ballot)
      expect(reward).to.eq(ballotReward)

      // connect ballot contract with wallet account
      ballotContract = new Contract(ballot, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      const value = await ballotContract.value()
      log.debug('value:', value.toString())
      expect(value).to.eq(expectValue)

    })

    it('vote', async () => {
      let tx;
      let receipt;
      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(1)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      let oldValue = await demaxConfig.getConfigValue(formatBytes32String('LIST_DGAS_AMOUNT'))
      log.debug('LIST_DGAS_AMOUNT: oldValue:', expandToString(oldValue))

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('auditConfig gas:', receipt.gasUsed.toString())
      log.debug('auditConfig event:', receipt.events)

      let value = await demaxConfig.getConfigValue(formatBytes32String('LIST_DGAS_AMOUNT'))
      log.debug('LIST_DGAS_AMOUNT: value:', expandToString(value))
      expect(value).to.eq(expectValue)

      value = await ballotContract.ended()
      expect(value).to.eq(true)

      let reward = await demaxGovernance.getReward(ballotContract.address)
      log.debug('wallet reward:', reward.toString())
      let reward1 = await demaxGovernance.connect(user1).getReward(ballotContract.address)
      log.debug('user1 reward:', reward1.toString())
      let reward2 = await demaxGovernance.connect(user2).getReward(ballotContract.address)
      log.debug('user2 reward:', reward2.toString())

      tx = await demaxGovernance.collectReward(ballotContract.address)
      receipt = await tx.wait()
      expect(reward).to.eq(receipt.events[0].args.value)
      expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      expect(receipt.events[0].args.to).to.eq(wallet.address)

      tx = await demaxGovernance.connect(user1).collectReward(ballotContract.address)
      receipt = await tx.wait()
      expect(reward1).to.eq(receipt.events[0].args.value)
      expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      expect(receipt.events[0].args.to).to.eq(user1.address)

      await expect(demaxGovernance.connect(user1).collectReward(ballotContract.address)).to.be.revertedWith('DemaxGovernance: REWARD_COLLECTED')

      tx = await demaxGovernance.connect(user2).collectReward(ballotContract.address)
      receipt = await tx.wait()
      expect(reward2).to.eq(receipt.events[0].args.value)
      expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      expect(receipt.events[0].args.to).to.eq(user2.address)

    })

  })

  describe('#vote to list token with staking', () => {
    let ballotContract: Contract
    
    it('initialize', async () => {
      await initStaking()
      await demaxGovernance.deposit(expandTo18Decimals(100000))
    })

    it('list token', async () => {
      const blockNumber = await getBlockNumber()

      let tx = await demaxGovernance.listToken(tokenE.address, expandTo18Decimals(100000), false, 'subject', 'content...')
      let receipt = await tx.wait()
      log.debug('listToken gas:', receipt.gasUsed.toString())
      // log.debug('events:', receipt.events)
      log.debug('proposer:', receipt.events[3].args.proposer)
      log.debug('token:', receipt.events[3].args.token)
      log.debug('ballotAddr:', receipt.events[3].args.ballotAddr)
      log.debug('reward:', expandToString(receipt.events[3].args.reward))
      log.debug('amount:', expandToString(receipt.events[4].args.amount))
      expect(receipt.events[4].args.amount).to.eq(expandTo18Decimals(100000))

      ballotContract = new Contract(receipt.events[3].args.ballotAddr, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      log.debug('ballotContract address:', ballotContract.address)
    })

    it('vote to audit list token, pass', async () => {
      let tx;
      let receipt;
      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(1)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())
      let result = await ballotContract.result()
      log.debug('result:', result)
      expect(result).to.eq(true)

      result = await demaxGovernance.ballotOf(ballotContract.address)
      log.debug('ballotOf 1:', expandToString(result))

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('execute gas:', receipt.gasUsed.toString())
      // log.debug('event:', receipt.events)
      // log.debug(receipt.events[2].event, 'args:', receipt.events[2].args)
      log.debug('user:', receipt.events[3].args.user)
      log.debug('token:', receipt.events[3].args.token)
      log.debug('status:', receipt.events[3].args.status.toString())
      log.debug('burn:', expandToString(receipt.events[3].args.burn))
      log.debug('reward:', expandToString(receipt.events[3].args.reward))
      log.debug('refund:', expandToString(receipt.events[3].args.refund))

      let status = await demaxConfig.tokenStatus(tokenE.address)
      log.debug('status:', status.toString())
      expect(status).to.eq(receipt.events[3].args.status)


      result = await demaxGovernance.ballotOf(ballotContract.address)
      log.debug('ballotOf 2:', expandToString(result))
      expect(result).to.eq(expandTo18Decimals(50100))

      let reward = await demaxGovernance.getReward(ballotContract.address)
      log.debug('wallet reward:', expandToString(reward), reward.toString())
      let reward1 = await demaxGovernance.connect(user1).getReward(ballotContract.address)
      log.debug('user1 reward:', expandToString(reward1), reward1.toString())
      let reward2 = await demaxGovernance.connect(user2).getReward(ballotContract.address)
      log.debug('user2 reward:', expandToString(reward2), reward2.toString())

    })

  })

  describe('#upgrade', () => {
    let ballotContract: Contract
    let tx
    let receipt
    let result:any
    let balance
    let oldDemaxGovernance: Contract
    const expectValue = expandTo18Decimals(50)

    it('upgradeApproveReward:fail', async () => {
      result = await demaxGovernance.rewardOf(rewarder.address);
      log.debug('reward:',  expandToString(result), result.toString()) 
      await expect(demaxGovernance.upgradeApproveReward()).to.be.revertedWith('DemaxGovernance: UPGRADE_NO_REWARD')

      result = await demaxGovernance.rewardOf(rewarder.address);
      log.debug('reward:',  expandToString(result), result.toString())
      expect(result).to.eq(0)

      await dgas.connect(rewarder).transfer(demaxGovernance.address, expandTo18Decimals(100))
      await demaxGovernance.connect(rewarder).addReward(expandTo18Decimals(100))
      result = await demaxGovernance.rewardOf(rewarder.address);
      log.debug('reward:',  expandToString(result), result.toString())

      await expect(demaxGovernance.upgradeApproveReward()).to.be.revertedWith('DemaxGovernance: UPGRADE_NO_CHANGE')
    })

    it('redeploy', async () => {
      oldDemaxGovernance = new Contract(demaxGovernance.address, JSON.stringify(DemaxGovernance.abi), provider).connect(wallet)

      demaxGovernance = await deployContract(wallet, DemaxGovernance, [dgas.address], overrides)
      await demaxConfig.initialize(dgas.address, demaxGovernance.address, rewarder.address, dev.address, [])
      await demaxGovernance.initialize(rewarder.address, demaxConfig.address, demaxBallotFactory.address)

      log.debug('oldDemaxGovernance:', oldDemaxGovernance.address)
      log.debug('newDemaxGovernance:', demaxGovernance.address)
      result = await demaxConfig.governor()
      log.debug('governor:', result)
    })

    it('upgradeApproveReward', async () => {
      tx = await oldDemaxGovernance.upgradeApproveReward()
      receipt = await tx.wait()
      log.debug('upgradeApproveReward gas:', receipt.gasUsed.toString())

      tx = await demaxGovernance.receiveReward(oldDemaxGovernance.address, expandTo18Decimals(100))
      receipt = await tx.wait()
      log.debug('receiveReward gas:', receipt.gasUsed.toString())
      result = await demaxGovernance.rewardOf(rewarder.address);
      log.debug('reward:',  expandToString(result), result.toString())
      expect(result).to.eq(expandTo18Decimals(100))
    })

    it('initialize', async () => {
      await dgas.approve(demaxGovernance.address, expandTo18Decimals(100000000))
      await dgas.connect(user1).approve(demaxGovernance.address, expandTo18Decimals(1000))
      await dgas.connect(user2).approve(demaxGovernance.address, expandTo18Decimals(1000))
  
      await initStaking()
    })

    it('update governor for dgas', async () => {
      tx = await dgas.upgradeGovernance(oldDemaxGovernance.address)
      receipt = await tx.wait()
      log.debug('create gas:', receipt.gasUsed.toString())

      tx = await oldDemaxGovernance.updateDgasGovernor(demaxGovernance.address)
      receipt = await tx.wait()
      log.debug('create gas:', receipt.gasUsed.toString())
    })
    
    it('check oldDemaxGovernance', async () => {
      result = await oldDemaxGovernance.stakingSupply()
      log.debug('old stakingSupply:', expandToString(result))
    })

    it('old withdraw', async () => {
      balance = await oldDemaxGovernance.balanceOf(wallet.address)
      log.debug('wallet1 balance:', expandToString(balance))
      await oldDemaxGovernance.withdraw(expandTo18Decimals(10))
      balance = await oldDemaxGovernance.balanceOf(wallet.address)
      log.debug('wallet2 balance:', expandToString(balance))
    })

    it('check new DemaxGovernance', async () => {
      result = await demaxGovernance.stakingSupply()
      log.debug('new stakingSupply:', expandToString(result))
    })

    it('new withdraw', async () => {
      balance = await demaxGovernance.balanceOf(wallet.address)
      log.debug('new wallet balance:', expandToString(balance))
    })


    it('createConfigBallot', async () => {
      await demaxGovernance.deposit(expandTo18Decimals(100000))

      const name = formatBytes32String('PRODUCE_DGAS_RATE')
      const blockNumber = await getBlockNumber()
      log.debug('name:', name)
      const reslut = await demaxConfig.getConfigValue(name)
      log.debug('reslut:', expandToString(reslut))

      tx = await demaxGovernance.createConfigBallot(name, expectValue, expandTo18Decimals(110), false, 'subject', 'content...')
      receipt = await tx.wait()
      log.debug('create gas:', receipt.gasUsed.toString())
      // log.debug('events:', receipt.events)
      // expect(receipt.events[2].args.name).to.eq(name)
      // expect(receipt.events[2].args.proposer).to.eq(wallet.address)
      let reward = receipt.events[2].args.reward
      let ballot = receipt.events[2].args.ballotAddr
      log.debug('ballot:', ballot, ' reward:', expandToString(reward))
      // expect(reward).to.eq(expandTo18Decimals(150))

      reward = await demaxGovernance.rewardOf(ballot)
      log.debug('rewardPool:', expandToString(reward))
      let ballotReward = await demaxGovernance.ballotOf(ballot)
      // expect(reward).to.eq(ballotReward)

      // connect ballot contract with wallet account
      ballotContract = new Contract(ballot, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      const value = await ballotContract.value()
      log.debug('value:', value.toString())
      // expect(value).to.eq(expectValue)

    })

    it('vote', async () => {
      let reward
      let reward1
      let reward2
      let staking
      let stakingSupply
      await ballotContract.vote(1)
      await ballotContract.connect(user1).vote(1)
      await ballotContract.connect(user2).vote(2)
      const winner = await ballotContract.winningProposal()
      log.debug('winner:', winner.toString())

      await dgas.transfer(rewarder.address, expandTo18Decimals(100))

      let value = await dgas.amountPerBlock()
      log.debug('old grossProduct:', expandToString(value))

      let oldValue = await demaxConfig.getConfigValue(formatBytes32String('PRODUCE_DGAS_RATE'))
      log.debug('PRODUCE_DGAS_RATE: oldValue:', expandToString(oldValue))
      // expect(oldValue).to.eq(expandTo18Decimals(100))

      staking = await demaxGovernance.balanceOf(wallet.address)
      log.debug('wallet staking0:', expandToString(staking), staking.toString())
      stakingSupply = await demaxGovernance.stakingSupply()
      log.debug('wallet stakingSupply0:', expandToString(stakingSupply), stakingSupply.toString())

      tx = await demaxGovernance.audit(ballotContract.address)
      receipt = await tx.wait()
      log.debug('auditConfig gas:', receipt.gasUsed.toString())
      log.debug(receipt.events[2].event, 'args:', receipt.events[2].args)
      expect(receipt.events[2].args.ballot).to.eq(ballotContract.address)
      expect(receipt.events[2].args.proposal).to.eq(expectValue)

      value = await demaxConfig.getConfigValue(formatBytes32String('PRODUCE_DGAS_RATE'))
      log.debug('PRODUCE_DGAS_RATE: value:', expandToString(value))
      // expect(value).to.eq(expandTo18Decimals(150))

      value = await dgas.amountPerBlock()
      log.debug('grossProduct:', value)
      log.debug('grossProduct:', expandToString(value))
      expect(value).to.eq(expectValue)

      reward = await demaxGovernance.getReward(ballotContract.address)
      log.debug('wallet reward:', expandToString(reward), reward.toString())
      reward1 = await demaxGovernance.connect(user1).getReward(ballotContract.address)
      log.debug('user1 reward:', expandToString(reward1), reward1.toString())
      reward2 = await demaxGovernance.connect(user2).getReward(ballotContract.address)
      log.debug('user2 reward:', expandToString(reward2), reward2.toString())

      
      tx = await demaxGovernance.collectReward(ballotContract.address)
      receipt = await tx.wait()
      expect(reward).to.eq(receipt.events[0].args.value)
      expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      expect(receipt.events[0].args.to).to.eq(wallet.address)

      tx = await demaxGovernance.connect(user1).collectReward(ballotContract.address)
      receipt = await tx.wait()
      expect(reward1).to.eq(receipt.events[0].args.value)
      expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      expect(receipt.events[0].args.to).to.eq(user1.address)

      await expect(demaxGovernance.connect(user1).collectReward(ballotContract.address)).to.be.revertedWith('DemaxGovernance: REWARD_COLLECTED')

      tx = await demaxGovernance.connect(user2).collectReward(ballotContract.address)
      receipt = await tx.wait()
      expect(reward2).to.eq(receipt.events[0].args.value)
      expect(receipt.events[0].args.from).to.eq(ballotContract.address)
      expect(receipt.events[0].args.to).to.eq(user2.address)

      let staking1 = await demaxGovernance.balanceOf(wallet.address)
      log.debug('wallet staking1:', expandToString(staking1), staking.toString())
      expect(staking1).to.eq(staking.add(reward))

      let stakingSupply1 = await demaxGovernance.stakingSupply()
      log.debug('wallet stakingSupply1:', expandToString(stakingSupply1), stakingSupply1.toString())
      expect(stakingSupply1).to.gte(stakingSupply.add(reward))
    })
  })

})
