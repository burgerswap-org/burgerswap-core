import chai, { expect } from 'chai'
import { Contract, constants } from 'ethers'
import {
  formatBytes32String
} from 'ethers/utils'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { expandTo18Decimals, expandToString, newBigNumber } from './shared/utilities'
import { LogConsole as log } from './shared/logconsol'

import Dgas from '../build/Dgas.json'
import DemaxTransferListener from '../build/DemaxTransferListener.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999,
}

const TEST_AMOUNT = expandTo18Decimals(10)
const ZERO = expandTo18Decimals(0)

describe('DemaxTransferListener', () => {
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
  
  const [wallet, plateform, factory, weth, user1] = provider.getWallets()
  let dgas: any
  let demaxTransferListener: any
  let demaxTransferListener2: any
  before(async () => {
    const balance = await wallet.getBalance();
    log.debug('wallet:', wallet.address, ' balance:', expandToString(balance))
    dgas = await deployContract(wallet, Dgas, [], overrides)
    demaxTransferListener = await deployContract(wallet, DemaxTransferListener, [], overrides)
    demaxTransferListener2 = await deployContract(wallet, DemaxTransferListener, [], overrides)
    log.info('dgas:', dgas.address)
    log.info('demaxTransferListener:', demaxTransferListener.address)
    log.info('demaxTransferListener2:', demaxTransferListener2.address)
  })

  describe('#tests', () => {
    let result
    let tx
    let receipt
    

    it('init dgas', async () => {
      tx = await dgas.upgradeImpl(demaxTransferListener.address)
      receipt = await tx.wait()
      log.debug('upgradeImpl gas:', receipt.gasUsed.toString())
      result = await dgas.impl()
      log.debug('impl:', result)
    })

    it('demaxTransferListener init', async () => {
      tx = await demaxTransferListener.initialize(dgas.address, factory.address, weth.address, plateform.address)
      receipt = await tx.wait()
      log.debug('upgradeImpl gas:', receipt.gasUsed.toString())
      result = await demaxTransferListener.DGAS()
      log.debug('DGAS:', result)

      tx = await demaxTransferListener2.initialize(dgas.address, factory.address, weth.address, plateform.address)
      receipt = await tx.wait()
      log.debug('upgradeImpl gas:', receipt.gasUsed.toString())
      result = await demaxTransferListener2.DGAS()
      log.debug('DGAS:', result)
    })

    it('demaxTransferListener updateDGASImpl', async () => {
      tx = await demaxTransferListener.updateDGASImpl(demaxTransferListener2.address)
      receipt = await tx.wait()
      log.debug('updateDGASImpl gas:', receipt.gasUsed.toString())
    })
  })
    
})
