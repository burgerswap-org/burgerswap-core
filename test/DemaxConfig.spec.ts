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
import DemaxConfig from '../build/DemaxConfigTest.json'


chai.use(solidity)

const overrides = {
  gasLimit: 9999999,
}

const TEST_AMOUNT = expandTo18Decimals(10)
const ZERO = expandTo18Decimals(0)
const ETHADDR = '0x0000000000000000000000000000000000000000'
const NONE = 0;
const REGISTERED = 1;
const PENDING = 2;
const OPENED = 3;
const CLOSED = 4;

describe('DemaxConfig', () => {
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

  const [wallet, governor, rewarder, dev, user1, user2] = provider.getWallets()

  let demaxConfig: any
  let dgas: any
  let tokenA: any
  let tokenB: any
  let tokenC: any
  before(async () => {
    const balance = await wallet.getBalance();
    log.debug('wallet:', wallet.address, ' balance:', expandToString(balance))
    dgas = await deployContract(wallet, Dgas, [], overrides)
    tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'TA', 'Token A'], overrides)
    tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'TB', 'Token B'], overrides)
    tokenC = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'TC', 'Token C'], overrides)
    demaxConfig = await deployContract(wallet, DemaxConfig, [], overrides)
    log.info('dgas:', dgas.address)
    log.info('demaxConfig:', demaxConfig.address)
    log.info('tokenA:', tokenA.address)
    log.info('tokenB:', tokenB.address)
    log.info('tokenC:', tokenC.address)

    await getBlockNumber();
  })
  
  async function addBlockNumber(n:number) {
    for (let i=0; i<n; i++) {
      await dgas.approve(user1.address, expandTo18Decimals(10000000))
    }
  }
  

  describe('#initialize', () => {
    it('initialize: FORBIDDEN', async () => {
      await expect(demaxConfig.connect(governor).initialize(dgas.address, governor.address, rewarder.address, dev.address, [tokenA.address])).to.be.revertedWith('Ownable: FORBIDDEN')
    })

    it('initialize: ZERO ADDRESS', async () => {
      await expect(demaxConfig.initialize(ETHADDR, governor.address, rewarder.address, dev.address, [tokenA.address])).to.be.revertedWith('DemaxConfig: ZERO ADDRESS')
    })

    it('initialize: INPUT_ADDRESS_IS_ZERO', async () => {
      await expect(demaxConfig.initialize(dgas.address, ETHADDR, rewarder.address, dev.address, [tokenA.address])).to.be.revertedWith('Governable: INPUT_ADDRESS_IS_ZERO')
    })

    it('initialize', async () => {
      let tokens = await demaxConfig.getDefaultListTokens()
      log.debug('tokens1:', tokens)
      expect(tokens.length).to.eq(0)
      await demaxConfig.initialize(dgas.address, governor.address, rewarder.address, dev.address, [tokenA.address])
      tokens = await demaxConfig.getDefaultListTokens()
      log.debug('tokens2:', tokens)
      expect(tokens.length).to.eq(1)

      await demaxConfig.initialize(dgas.address, governor.address, rewarder.address, dev.address, [])
    })

  })

  describe('#base fail', () => {
    it('modifyDev: fail', async () => {
      await expect(demaxConfig.connect(governor).modifyDev(user1.address)).to.be.revertedWith('DemaxConfig: FORBIDDEN')
    })

    it('registryToken: fail', async () => {
      await expect(demaxConfig.registryToken(ETHADDR)).to.be.revertedWith('Governable: FORBIDDEN')
      await expect(demaxConfig.connect(governor).registryToken(ETHADDR)).to.be.revertedWith('TokenRegistry: INVALID_TOKEN')
    })

    it('publishToken: fail', async () => {
      await expect(demaxConfig.publishToken(ETHADDR)).to.be.revertedWith('Governable: FORBIDDEN')
      await expect(demaxConfig.connect(governor).publishToken(ETHADDR)).to.be.revertedWith('TokenRegistry: INVALID_TOKEN')
    })

    it('updateToken: fail', async () => {
      await expect(demaxConfig.updateToken(ETHADDR, OPENED)).to.be.revertedWith('Governable: FORBIDDEN')
      await expect(demaxConfig.connect(governor).updateToken(ETHADDR, OPENED)).to.be.revertedWith('TokenRegistry: INVALID_TOKEN')
    })

    it('changeConfig: fail', async () => {
      await expect(demaxConfig.connect(user1).changeConfig(formatBytes32String('SWAP_FEE_PERCENT'), 1,50,5,50)).to.be.revertedWith('Ownable: FORBIDDEN')
    })
    
    it('changeConfigValue: fail', async () => {
      await expect(demaxConfig.changeConfigValue(formatBytes32String('VOTE_DURATION'), 250)).to.be.revertedWith('Governable: FORBIDDEN')
      await expect(demaxConfig.connect(governor).changeConfigValue(formatBytes32String('VOTE_DURATION'), 50)).to.be.revertedWith('DemaxConfig: OVERFLOW')
      let result = await demaxConfig.getConfigValue(formatBytes32String('VOTE_DURATION'))
      log.debug('VOTE_DURATION:', result)
      await expect(demaxConfig.connect(governor).changeConfigValue(formatBytes32String('VOTE_DURATION'), 17280*3)).to.be.revertedWith('DemaxConfig: EXCEED MAX ADJUST SPAN')
    })

    it('token status:fail', async () => {
      let status = await demaxConfig.tokenStatus(tokenA.address)
      log.debug('status:', status)
      expect(status).to.eq(newBigNumber(OPENED))
      await expect(demaxConfig.connect(governor).updateToken(tokenA.address, OPENED)).to.be.revertedWith('TokenRegistry: TOKEN_STATUS_NO_CHANGE')
    })
    
  })

  describe('#api tests', () => {
    let tx
    let receipt
    let result

    it('modifyDev', async () => {
      tx = await demaxConfig.connect(dev).modifyDev(user1.address)
      receipt = await tx.wait()
      log.debug('modifyDev gas:', receipt.gasUsed.toString())
      result = await demaxConfig.dev()
      expect(result).to.eq(user1.address)
    })
     
    it('changeConfigValue', async () => {
      tx = await demaxConfig.connect(governor).changeConfigValue(formatBytes32String('TOKEN_PENGDING_TIME'), 90*17280)
      receipt = await tx.wait()
      log.debug('changeConfigValue gas:', receipt.gasUsed.toString())
      // log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      expect(receipt.events[0].args._value).to.eq(newBigNumber(90*17280))

      result = await demaxConfig.getConfigValue(formatBytes32String('TOKEN_PENGDING_SWITCH'))
      log.debug('TOKEN_PENGDING_SWITCH:', result.toString())

      tx = await demaxConfig.connect(governor).changeConfigValue(formatBytes32String('TOKEN_PENGDING_SWITCH'), 0)
      receipt = await tx.wait()
      log.debug('changeConfigValue gas:', receipt.gasUsed.toString())
      // log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      expect(receipt.events[0].args._value).to.eq(newBigNumber(0))
      
    })

    it('changeConfig', async () => {
      tx = await demaxConfig.changeConfig(formatBytes32String('SWAP_FEE_PERCENT'), 1,50,5,50)
      receipt = await tx.wait()
      log.debug('changeConfig gas:', receipt.gasUsed.toString())
      result = await demaxConfig.getConfig(formatBytes32String('SWAP_FEE_PERCENT'))
      log.debug('getConfig', result)
      expect(result.value).to.eq(newBigNumber(50))
    })

    it('LIST_TOKEN_SWITCH off', async () => {
      result = await demaxConfig.checkToken(tokenB.address)
      log.debug('checkToken tokenB:', result)
      expect(result).to.eq(true)
    })

    it('LIST_TOKEN_SWITCH on', async () => {
      tx = await demaxConfig.connect(governor).changeConfigValue(formatBytes32String('LIST_TOKEN_SWITCH'), 1)
      receipt = await tx.wait()
      log.debug('changeConfigValue gas:', receipt.gasUsed.toString())
      result = await demaxConfig.getConfigValue(formatBytes32String('LIST_TOKEN_SWITCH'))
      expect(result).to.eq(1)
    })

    it('registryToken', async () => {
      result = await demaxConfig.checkToken(tokenB.address)
      log.debug('checkToken tokenB:', result)
      expect(result).to.eq(false)
      tx = await demaxConfig.connect(governor).registryToken(tokenB.address)
      receipt = await tx.wait()
      log.debug('registryToken gas:', receipt.gasUsed.toString())
      // log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      // expect(receipt.events[0].args._status).to.eq(newBigNumber(REGISTERED))
      result = await demaxConfig.checkToken(tokenB.address)
      log.debug('checkToken tokenB:', result)
      expect(result).to.eq(false)
    })

    it('publishToken', async () => {
      await demaxConfig.connect(governor).changeConfigValueNoCheck(formatBytes32String('TOKEN_PENGDING_TIME'), 3)
      tx = await demaxConfig.connect(governor).publishToken(tokenB.address)
      receipt = await tx.wait()
      log.debug('publishToken gas:', receipt.gasUsed.toString())
      // expect(receipt.events[0].args._status).to.eq(newBigNumber(PENDING))

      result = await demaxConfig.getConfigValue(formatBytes32String('TOKEN_PENGDING_SWITCH'))
      log.debug('TOKEN_PENGDING_SWITCH:', result.toString())
      let beginBlock = await demaxConfig.publishTime(tokenB.address)
      log.debug('beginBlock:', beginBlock.toString())
      let spanBlock = await demaxConfig.getConfigValue(formatBytes32String('TOKEN_PENGDING_TIME'))
      log.debug('TOKEN_PENGDING_TIME:', spanBlock.toString())

      let bn = await getBlockNumber()
      log.debug('getBlockNumber:', bn, ' endBlockNumber:', beginBlock.add(spanBlock).toString())

      result = await demaxConfig.checkToken(tokenB.address)
      log.debug('checkToken result1:', result)
      expect(result).to.eq(true)

      await addBlockNumber(3)
      await getBlockNumber()
      result = await demaxConfig.checkToken(tokenB.address)
      log.debug('checkToken result2:', result)
      expect(result).to.eq(true)

      await demaxConfig.connect(governor).changeConfigValue(formatBytes32String('TOKEN_PENGDING_SWITCH'), 1)
      await getBlockNumber()
      result = await demaxConfig.checkToken(tokenB.address)
      log.debug('checkToken result3:', result)
      expect(result).to.eq(false)
    })

    it('removeToken', async () => {
      tx = await demaxConfig.connect(governor).updateToken(tokenB.address, CLOSED)
      receipt = await tx.wait()
      log.debug('updateToken gas:', receipt.gasUsed.toString())
      // expect(receipt.events[0].args._status).to.eq(newBigNumber(CLOSED))
      result = await demaxConfig.checkToken(tokenB.address)
      expect(result).to.eq(false)
    })

    it('addToken', async () => {
      tx = await demaxConfig.connect(governor).updateToken(tokenB.address, OPENED)
      receipt = await tx.wait()
      log.debug('updateToken gas:', receipt.gasUsed.toString())
      expect(receipt.events[0].args._status).to.eq(newBigNumber(OPENED))
      result = await demaxConfig.checkToken(tokenB.address)
      expect(result).to.eq(true)
    })
        
    it('checkToken', async () => {
      let result = await demaxConfig.checkToken(tokenB.address)
      log.debug('checkToken B:', result)
    })
            
    it('modifyGovernor', async () => {
      let tx = await demaxConfig.modifyGovernor(user1.address)
      receipt = await tx.wait()
      log.debug('addPair gas:', receipt.gasUsed.toString())

      let result = await demaxConfig.governor()
      log.debug('result:', result)
    })
  })

})
