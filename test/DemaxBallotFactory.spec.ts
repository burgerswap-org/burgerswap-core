import chai, { expect } from 'chai'
import { Contract, constants } from 'ethers'
import {
  formatBytes32String
} from 'ethers/utils'
import { solidity, MockProvider, deployContract } from 'ethereum-waffle'
import { expandTo18Decimals, expandToString, newBigNumber } from './shared/utilities'
import { LogConsole as log } from './shared/logconsol'

import Dgas from '../build/Dgas.json'
import DemaxBallotFactory from '../build/DemaxBallotFactory.json'
import DemaxBallot from '../build/DemaxBallot.json'


chai.use(solidity)

const overrides = {
  gasLimit: 9999999,
}

const TEST_AMOUNT = expandTo18Decimals(10)
const ZERO = expandTo18Decimals(0)

describe('DemaxBallotFactory', () => {
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

  let dgas: any
  let demaxBallot: any
  let demaxBallotFactory: any
  before(async () => {
    const balance = await wallet.getBalance();
    log.debug('wallet:', wallet.address, ' balance:', expandToString(balance))
    dgas = await deployContract(wallet, Dgas, [], overrides)
    demaxBallotFactory = await deployContract(wallet, DemaxBallotFactory, [], overrides)
    log.info('dgas:', dgas.address)
    log.info('demaxBallotFactory:', demaxBallotFactory.address)
    await getBlockNumber();
  })

  describe('#tests', () => {
    it('create ballot', async () => {
      const blockNumber = await getBlockNumber()
      const tx = await demaxBallotFactory.create(wallet.address, 10, blockNumber+3, "subject", "content")
      let receipt = await tx.wait()
      log.debug('mint gas:', receipt.gasUsed.toString())
      // log.debug('events:', receipt.events)
      log.debug(receipt.events[0].event, 'args:', receipt.events[0].args)
      // expect(receipt.events[0].event).to.eq('Created')

      const ballot = new Contract(receipt.events[0].args.ballotAddr, JSON.stringify(DemaxBallot.abi), provider).connect(wallet)
      const result = await ballot.value()
      log.debug('value:', result.toString())
      // expect(result).to.eq(blockNumber+10)
    })
  })
    
})
