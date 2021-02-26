import { expect } from 'chai'
import { formatBytes32String } from 'ethers/utils'
import { expandTo18Decimals, expandToString, newBigNumber } from './shared/utilities'
import { LogConsole as log } from './shared/logconsol'

describe('ConfigNames', () => {

  beforeEach(async () => {
  })


  it('expandTo18Decimals', async () => {
    log.info('1', expandTo18Decimals(1).toString())
    log.info('1usdt', expandTo18Decimals(1, 6).toString())
    log.info('100', expandTo18Decimals(100).toString())
  })

  it('names', async () => {
    log.info('EMPTY', formatBytes32String(''))
    log.info('PRODUCE_DGAS_RATE', formatBytes32String('PRODUCE_DGAS_RATE'))
    log.info('SWAP_FEE_PERCENT', formatBytes32String('SWAP_FEE_PERCENT'))
    log.info('LIST_DGAS_AMOUNT', formatBytes32String('LIST_DGAS_AMOUNT'))
    log.info('UNSTAKE_DURATION', formatBytes32String('UNSTAKE_DURATION'))
    log.info('REMOVE_LIQUIDITY_DURATION', formatBytes32String('REMOVE_LIQUIDITY_DURATION'))
    log.info('TOKEN_TO_DGAS_PAIR_MIN_PERCENT', formatBytes32String('TOKEN_TO_DGAS_PAIR_MIN_PERCENT'))
    log.info('LIST_TOKEN_FAILURE_BURN_PRECENT', formatBytes32String('LIST_TOKEN_FAILURE_BURN_PRECENT'))
    log.info('LIST_TOKEN_SUCCESS_BURN_PRECENT', formatBytes32String('LIST_TOKEN_SUCCESS_BURN_PRECENT'))
    log.info('PROPOSAL_DGAS_AMOUNT', formatBytes32String('PROPOSAL_DGAS_AMOUNT'))
    log.info('VOTE_DURATION', formatBytes32String('VOTE_DURATION'))
    log.info('VOTE_REWARD_PERCENT', formatBytes32String('VOTE_REWARD_PERCENT'))
    log.info('TOKEN_PENGDING_SWITCH', formatBytes32String('TOKEN_PENGDING_SWITCH'))
    log.info('TOKEN_PENGDING_TIME', formatBytes32String('TOKEN_PENGDING_TIME'))
    log.info('FEE_LP_REWARD_PERCENT', formatBytes32String('FEE_LP_REWARD_PERCENT'))
    log.info('FEE_GOVERNANCE_REWARD_PERCENT', formatBytes32String('FEE_GOVERNANCE_REWARD_PERCENT'))
    log.info('DEV_PRECENT', formatBytes32String('DEV_PRECENT'))
    
  })

})
