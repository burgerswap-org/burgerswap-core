import chai, { expect } from 'chai'
import { Contract, ethers } from 'ethers'
import { BigNumber, bigNumberify, formatBytes32String } from 'ethers/utils'
import { solidity, MockProvider, deployContract, getWallets } from 'ethereum-waffle'
import {
  expandTo18Decimals,
  convertBigNumber,
  expandToNumber,
  getApprovalDigest,
  expandToString,
  sleep,
  mineBlock
} from './shared/utilities'
import { LogConsole as log } from './shared/logconsol'
import demaxPlatform from '../build/demaxPlatform.json'
import ERC20 from '../build/ERC20.json'
import dgas from '../build/DgasTest.json'
import demaxConfig from '../build/DemaxConfigTest.json'
import demaxPair from '../build/DemaxPair.json'
import demaxPool from '../build/DemaxPool.json'
import WETH9 from '../build/WETH9.json'
import usdt from '../build/usdt.json'
import demaxFactory from '../build/DemaxFactory.json'
import demaxGovernance from '../build/DemaxGovernance.json'
import ballotFactory from '../build/DemaxBallotFactory.json'
import ballot from '../build/DemaxBallot.json'
import demaxTransferListener from '../build/DemaxTransferListener.json'

chai.use(solidity)

const VOTE_DURATION = '0x564f54455f4455524154494f4e00000000000000000000000000000000000000'
// totalSupply += 1000000000* 10 ** 18;
// balanceOf[msg.sender] = 1000000000* 10 ** 18;

const overrides = {
  gasLimit: 9999999,
  gasPrice: 10 ** 10 // 10gwei
}

let WETH: any
let CONFIG: any
let FACTORY: any
let PLATFORM: any
let PLATFORM2: any
let POOL: any
let DGAS: any
let TOKEN_A: any
let TOKEN_B: any
let TOKEN_USDT: any
let GOVERNANCE: any
let BALLOT_FACTORY: any
let TRANSFER_LISTENER: any
let TRANSFER_LISTENER2: any
let userAccount: string
let wallet: any
let dev: any
let provider: any
let wallets: any

async function getLiquidity(addrss: string, tokenA: string, tokenB: string) {
  const pairContract = await getPairContract(tokenA, tokenB)
  const liquidity = await pairContract.balanceOf(addrss)
  return [liquidity, await pairContract.totalSupply()]
}

async function getPairContract(tokenA: string, tokenB: string) {
  const pair = await PLATFORM.pairFor(tokenA, tokenB)
  const pairContract = new Contract(pair, demaxPair.abi, provider).connect(wallet)
  return pairContract
}

async function makeContractAndInitialize() {
  provider = new MockProvider({
    hardfork: 'istanbul',
    mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    gasLimit: 9999999
  })
  log.debug('initialize start')
  wallets = provider.getWallets()
  wallet = wallets[0]
  dev = wallets[2].address
  userAccount = wallets[1].address
  WETH = await deployContract(wallet, WETH9, [], overrides)
  PLATFORM = await deployContract(wallet, demaxPlatform, [], overrides)
  PLATFORM2 = await deployContract(wallet, demaxPlatform, [], overrides)
  DGAS = await deployContract(wallet, dgas, [], overrides)
  TOKEN_A = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'tokenA', 'A'], overrides)
  TOKEN_B = await deployContract(wallet, ERC20, [expandTo18Decimals(100000000000), 'tokenB', 'B'], overrides)
  TOKEN_USDT = await deployContract(wallet, usdt, [], overrides)
  GOVERNANCE = await deployContract(wallet, demaxGovernance, [DGAS.address], overrides)
  CONFIG = await deployContract(wallet, demaxConfig, [], overrides)
  BALLOT_FACTORY = await deployContract(wallet, ballotFactory, [], overrides)
  TRANSFER_LISTENER = await deployContract(wallet, demaxTransferListener, [], overrides)
  TRANSFER_LISTENER2 = await deployContract(wallet, demaxTransferListener, [], overrides)
  FACTORY = await deployContract(wallet, demaxFactory, [DGAS.address, CONFIG.address], overrides)
  POOL = await deployContract(wallet, demaxPool, [], overrides)

  await TRANSFER_LISTENER.initialize(DGAS.address, FACTORY.address, WETH.address, PLATFORM.address, dev)
  await GOVERNANCE.initialize(PLATFORM.address, CONFIG.address, BALLOT_FACTORY.address)
  await PLATFORM.initialize(
    DGAS.address,
    CONFIG.address,
    FACTORY.address,
    WETH.address,
    GOVERNANCE.address,
    TRANSFER_LISTENER.address,
    POOL.address
  )

  await POOL.initialize(
    DGAS.address,
    WETH.address,
    FACTORY.address,
    PLATFORM.address,
    CONFIG.address,
    GOVERNANCE.address
  )

  await CONFIG.initialize(DGAS.address, GOVERNANCE.address, PLATFORM.address, dev, [
    DGAS.address,
    WETH.address,
    TOKEN_USDT.address,
  ])
  await DGAS.upgradeImpl(TRANSFER_LISTENER.address)

  log.debug('initialize end')
}
async function getListBallotContractAddress(tx: any) {
  let recept = await tx.wait()
  for (let event of recept.events) {
    // console.log(event)
    if ('TokenBallotCreated(address,address,uint256,address,uint256)' === event.eventSignature) {
      return '0x' + event.topics[3].slice(-40)
    }
  }
}

async function getDGAS() {
  await TOKEN_USDT.approve(PLATFORM.address, expandTo18Decimals(10000, 6))
  let tx = await PLATFORM.addLiquidityETH(
    TOKEN_USDT.address,
    expandTo18Decimals(10000, 6),
    expandTo18Decimals(10000, 6),
    expandTo18Decimals(1),
    Math.trunc(Date.now() / 1000) + 1000,
    {
      value: expandTo18Decimals(1)
    }
  )
  let receipt = await tx.wait()
  await runBlock(400)
  const pairContract = await getPairContract(TOKEN_USDT.address, WETH.address)
  const _reward = await  pairContract.queryReward()
  if(_reward > 0) {
    tx = await pairContract.mintReward() // mint dgas for pair
    receipt = await tx.wait()
    log.debug('mintReward gas:', receipt.gasUsed.toString())
  }
  
  log.debug(
    'add liquidity  usdt/eth after 20 block get dgas amount : ',
    convertBigNumber(await DGAS.balanceOf(wallet.address))
  )
}
async function logContractUint(ins: any, count = 6) {
  for (let i = 0; i < count; i++) {
    log.debug(`logContractUint ${i}`, convertBigNumber(await ins.logUint(i)))
  }
}
// makeContractAndInitialize().then(getDGAS)

async function listTokens(address: string) {
  return
  // change vote duration for test
  await CONFIG.changeConfigValueNoCheck(VOTE_DURATION, 4)
  // apply list token
  let tx = await GOVERNANCE.listToken(address, expandTo18Decimals(0), true, 'list token title', 'apply list token')
  let ballotAddress = (await getListBallotContractAddress(tx))!!
  // staking
  await DGAS.approve(GOVERNANCE.address, expandTo18Decimals(1000))
  await GOVERNANCE.deposit(expandTo18Decimals(1000))
  const contract = new Contract(ballotAddress, ballot.abi, provider).connect(wallet)
  // // exe vote
  await contract.vote(1)
  // // comfirm vote result
  await GOVERNANCE.auditListToken(ballotAddress)
}

async function changeSwapFee(value:any) {
  let tx = await CONFIG.changeConfigValueNoCheck(formatBytes32String('SWAP_FEE_PERCENT'), value)
  await tx.wait()
}


async function runBlock(count = 5) {
  for (let i = 0; i < count; i++) {
    await TOKEN_USDT.approve(PLATFORM.address, expandTo18Decimals(1))
  }
}

describe('upgrade platform and listener contract ', async () => {
  before(async () => {
    await makeContractAndInitialize()
    await getDGAS()
    await listTokens(TOKEN_A.address)
  })
  it('before update add dgas/eth liquilidty', async () => {
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(100))
    let approveAmount: BigNumber = await DGAS.allowance(wallet.address, PLATFORM.address)
    expect(approveAmount.toString()).to.eq(expandTo18Decimals(100))
    let tx = await PLATFORM.addLiquidityETH(
      DGAS.address,
      expandTo18Decimals(100),
      expandTo18Decimals(100),
      expandTo18Decimals(10),
      Math.trunc(Date.now() / 1000) + 1000,
      {
        value: expandTo18Decimals(10)
      }
    )
    await tx.wait()
  })
  it('execute update contract', async () => {
    await CONFIG.initialize(DGAS.address, GOVERNANCE.address, PLATFORM2.address, dev, [])
    await TRANSFER_LISTENER2.initialize(DGAS.address, FACTORY.address, WETH.address, PLATFORM2.address, dev)
    await TRANSFER_LISTENER.updateDGASImpl(TRANSFER_LISTENER2.address)
    await PLATFORM2.initialize(
      DGAS.address,
      CONFIG.address,
      FACTORY.address,
      WETH.address,
      GOVERNANCE.address,
      TRANSFER_LISTENER2.address,
      POOL.address
    )
    await POOL.initialize(
      DGAS.address,
      WETH.address,
      FACTORY.address,
      PLATFORM2.address,
      CONFIG.address,
      GOVERNANCE.address
    )
  })
  it('after update add dgas/eth liquilidty', async () => {
    await DGAS.approve(PLATFORM2.address, expandTo18Decimals(100))
    let approveAmount: BigNumber = await DGAS.allowance(wallet.address, PLATFORM2.address)
    expect(approveAmount.toString()).to.eq(expandTo18Decimals(100))
    await sleep(1000)
    let tx = await PLATFORM2.addLiquidityETH(
      DGAS.address,
      expandTo18Decimals(100),
      expandTo18Decimals(100),
      expandTo18Decimals(10),
      Math.trunc(Date.now() / 1000) + 1000,
      {
        value: expandTo18Decimals(10)
      }
    )
    let receipt = await tx.wait()
    // log.debug(receipt)
  })
})

describe('demax platform', async () => {
  beforeEach(async () => {
    await makeContractAndInitialize()
    await getDGAS()
    // 默认上架了 weth usdt dags
    await listTokens(TOKEN_A.address)
    await listTokens(TOKEN_B.address)
  })

  it('add dgas/eth liqudity', async () => {
    log.debug('dgas amount of walelt ', (await DGAS.balanceOf(wallet.address)).toString())
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(100))
    let approveAmount: BigNumber = await DGAS.allowance(wallet.address, PLATFORM.address)
    expect(approveAmount.toString()).to.eq(expandTo18Decimals(100))
    await sleep(1000)
    let tx = await PLATFORM.addLiquidityETH(
      DGAS.address,
      expandTo18Decimals(100),
      expandTo18Decimals(100),
      expandTo18Decimals(10),
      Math.trunc(Date.now() / 1000) + 1000,
      {
        value: expandTo18Decimals(10)
      }
    )
    let receipt = await tx.wait()
    log.debug('addLiquidityETH 1 gas:', receipt.gasUsed.toString())
    let pairContract = await getPairContract(DGAS.address, WETH.address)
    let pair = await PLATFORM.pairFor(DGAS.address, WETH.address)
    let pairWethBalance = await WETH.balanceOf(pair)
    expect(pairWethBalance.toString()).to.eq(expandTo18Decimals(10))
    let pairDGASBalance = await DGAS.balanceOf(pair)
    expect(pairDGASBalance.toString()).to.eq(expandTo18Decimals(100))
    let getLiqudity = await pairContract.balanceOf(wallet.address)
    log.debug('getLiqudity 2:', expandToString(getLiqudity), getLiqudity.toString())
    expect(getLiqudity.toString()).to.eq('31622776601683792319')
    await sleep(1000)
    log.debug((await DGAS.balanceOf(wallet.address)).toString())
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(100))
    approveAmount = await DGAS.allowance(wallet.address, PLATFORM.address)
    expect(approveAmount.toString()).to.eq(expandTo18Decimals(100))
    await sleep(1000)
    tx = await PLATFORM.addLiquidityETH(
      DGAS.address,
      expandTo18Decimals(100),
      expandTo18Decimals(100),
      expandTo18Decimals(10),
      Math.trunc(Date.now() / 1000) * 1000,
      {
        value: expandTo18Decimals(10)
      }
    )
    receipt = await tx.wait()
    log.debug('addLiquidityETH 2 gas:', receipt.gasUsed.toString())
    pairContract = await getPairContract(DGAS.address, WETH.address)
    await sleep(500)
    pair = await PLATFORM.pairFor(DGAS.address, WETH.address)
    pairWethBalance = await WETH.balanceOf(pair)
    expect(pairWethBalance.toString()).to.eq(expandTo18Decimals(20))
    const result = await PLATFORM.getReserves(DGAS.address, WETH.address)
    //pairDGASBalance = await DGAS.balanceOf(pair)
    expect(result[0].toString()).to.eq(expandTo18Decimals(200))
    getLiqudity = await pairContract.balanceOf(wallet.address)
    log.debug('getLiqudity 2:', expandToString(getLiqudity), getLiqudity.toString())
  })

  it('add tokenA/dags liqudity', async () => {
    await sleep(1000)
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(10000))
    let approveAmount: BigNumber = await DGAS.allowance(wallet.address, PLATFORM.address)
    expect(approveAmount.toString()).to.eq(expandTo18Decimals(10000))
    await sleep(1000)
    let tx = await PLATFORM.addLiquidityETH(
      DGAS.address,
      expandTo18Decimals(10000),
      expandTo18Decimals(10000),
      expandTo18Decimals(10),
      Math.trunc(Date.now() / 1000) + 1000,
      {
        value: expandTo18Decimals(10)
      }
    )
    await sleep(1000)
    await TOKEN_A.approve(PLATFORM.address, expandTo18Decimals(10000))
    approveAmount = await TOKEN_A.allowance(wallet.address, PLATFORM.address)
    expect(approveAmount.toString()).to.eq(expandTo18Decimals(10000))
    log.debug('balance of wallet tokenA', (await TOKEN_A.balanceOf(wallet.address)).toString())
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(100))
    approveAmount = await DGAS.allowance(wallet.address, PLATFORM.address)
    expect(approveAmount.toString()).to.eq(expandTo18Decimals(100))
    log.debug('balance of wallet dgas', (await DGAS.balanceOf(wallet.address)).toString())
    await sleep(1000)
    tx = await PLATFORM.addLiquidity(
      TOKEN_A.address,
      DGAS.address,
      expandTo18Decimals(10000),
      expandTo18Decimals(100),
      expandTo18Decimals(10000),
      expandTo18Decimals(100),
      Math.trunc(Date.now() / 1000) + 1000
    )
    let receipt = await tx.wait()
    log.debug('addLiquidity 1 gas:', receipt.gasUsed.toString())
    let pairContract = await getPairContract(TOKEN_A.address, DGAS.address)
    let pair = await PLATFORM.pairFor(TOKEN_A.address, DGAS.address)
    let pairTokenABalance = await TOKEN_A.balanceOf(pair)
    expect(pairTokenABalance.toString()).to.eq(expandTo18Decimals(10000))
    let pairDGASBalance = await DGAS.balanceOf(pair)
    expect(pairDGASBalance.toString()).to.eq(expandTo18Decimals(100))
    let getLiqudity = await pairContract.balanceOf(wallets[0].address)
    log.debug('getLiqudity 1:', expandToString(getLiqudity), getLiqudity.toString())
    expect(getLiqudity.toString()).to.eq('999999999999999999000')
    await sleep(1000)
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(100))
    await sleep(1000)
    await TOKEN_A.approve(PLATFORM.address, expandTo18Decimals(10000))
    await sleep(1000)
    tx = await PLATFORM.addLiquidity(
      TOKEN_A.address,
      DGAS.address,
      expandTo18Decimals(10000),
      expandTo18Decimals(100),
      expandTo18Decimals(10000),
      expandTo18Decimals(100),
      Math.trunc(Date.now() / 1000) + 1000
    )
    receipt = await tx.wait()
    log.debug('addLiquidity 2 gas:', receipt.gasUsed.toString())
    pairContract = await getPairContract(TOKEN_A.address, DGAS.address)
    pair = await PLATFORM.pairFor(TOKEN_A.address, DGAS.address)
    pairTokenABalance = await TOKEN_A.balanceOf(pair)
    expect(pairTokenABalance.toString()).to.eq(expandTo18Decimals(20000))
    const result = await PLATFORM.getReserves(TOKEN_A.address, DGAS.address)
    //pairDGASBalance = await DGAS.balanceOf(pair)
    expect(result[1].toString()).to.eq(expandTo18Decimals(200))
    getLiqudity = await pairContract.balanceOf(wallets[0].address)
    log.debug('getLiqudity 2:', expandToString(getLiqudity), getLiqudity.toString())
  })
})

describe('removeLiqulity', async () => {
  beforeEach(async () => {
    await makeContractAndInitialize()
    await getDGAS()
    await listTokens(TOKEN_A.address)
    await listTokens(TOKEN_B.address)

    log.debug('add liqulity dgas/eth 10000/10')
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(10000))
    let tx = await PLATFORM.addLiquidityETH(
      DGAS.address,
      expandTo18Decimals(10000),
      expandTo18Decimals(10000),
      expandTo18Decimals(10),
      Math.trunc(Date.now() / 1000) + 1000,
      {
        value: expandTo18Decimals(10)
      }
    )
    await tx.wait()

    log.debug('add liqulity tokenA/eth  20000/4')
    await TOKEN_A.approve(PLATFORM.address, expandTo18Decimals(20000))
    tx = await PLATFORM.addLiquidityETH(
      TOKEN_A.address,
      expandTo18Decimals(20000),
      expandTo18Decimals(20000),
      expandTo18Decimals(4),
      Math.trunc(Date.now() / 1000) + 1000,
      {
        value: expandTo18Decimals(4)
      }
    )
    await tx.wait()

    log.debug('add liqulity tokenB/eth  20000/5')
    await TOKEN_B.approve(PLATFORM.address, expandTo18Decimals(20000))
    tx = await PLATFORM.addLiquidityETH(
      TOKEN_B.address,
      expandTo18Decimals(20000),
      expandTo18Decimals(20000),
      expandTo18Decimals(5),
      Math.trunc(Date.now() / 1000) + 1000,
      {
        value: expandTo18Decimals(5)
      }
    )
    await tx.wait()

    log.debug('add liqulity tokenA/dgas  10000/1000')
    await TOKEN_A.approve(PLATFORM.address, expandTo18Decimals(10000))
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(1000))
    tx = await PLATFORM.addLiquidity(
      TOKEN_A.address,
      DGAS.address,
      expandTo18Decimals(10000),
      expandTo18Decimals(1000),
      expandTo18Decimals(10000),
      expandTo18Decimals(1000),
      Math.trunc(Date.now() / 1000) + 1000
    )
    await tx.wait()

    log.debug('add liqulity tokenB/dgas 10000/20000')
    log.debug('tokenB amount', convertBigNumber(await TOKEN_B.balanceOf(wallet.address)))
    log.debug('DGAS amount', convertBigNumber(await DGAS.balanceOf(wallet.address)))
    await TOKEN_B.approve(PLATFORM.address, expandTo18Decimals(10000))
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(20000))
    tx = await PLATFORM.addLiquidity(
      TOKEN_B.address,
      DGAS.address,
      expandTo18Decimals(10000),
      expandTo18Decimals(20000),
      expandTo18Decimals(10000),
      expandTo18Decimals(20000),
      Math.trunc(Date.now() / 1000) + 1000
    )
    await tx.wait()

    log.debug('add liqulity tokenA/tokenB  1000/25')

    await TOKEN_A.approve(PLATFORM.address, expandTo18Decimals(1000))
    await TOKEN_B.approve(PLATFORM.address, expandTo18Decimals(25))
    tx = await PLATFORM.addLiquidity(
      TOKEN_A.address,
      TOKEN_B.address,
      expandTo18Decimals(1000),
      expandTo18Decimals(25),
      expandTo18Decimals(1000),
      expandTo18Decimals(25),
      Math.trunc(Date.now() / 1000) + 1000
    )
    await tx.wait()
  })

  it('remove tokenA/tokenB liqulity', async () => {
    const result = await PLATFORM.getReserves(TOKEN_A.address, TOKEN_B.address)
    log.debug('pair reserve tokenA ', result[0].toString())
    log.debug('pair reserve tokenB ', result[1].toString())
    const userTokenABalance = await TOKEN_A.balanceOf(userAccount)
    const userTokenBBalance = await TOKEN_B.balanceOf(userAccount)
    log.debug('user tokenA balance', userTokenABalance.toString())
    log.debug('user tokenB balance', userTokenBBalance.toString())
    const [liquidity, total] = await getLiquidity(wallet.address, TOKEN_A.address, TOKEN_B.address)
    log.debug('liqulidity wallet[0] ', liquidity.toString())
    log.debug('liqulidity total', total.toString())
    let tx = await PLATFORM.removeLiquidity(
      TOKEN_A.address,
      TOKEN_B.address,
      liquidity,
      expandTo18Decimals(1),
      expandTo18Decimals(1),
      userAccount,
      Math.trunc(Date.now() / 1000) + 1000
    )
    let receipt = await tx.wait()
    log.debug('removeLiquidity gas:', receipt.gasUsed.toString())
    let liquiditys = await getLiquidity(wallet.address, TOKEN_A.address, TOKEN_B.address)
    log.debug('reserve liqulidity wallet[0] ', liquiditys[0].toString())
    log.debug('reserve liqulidity total', liquiditys[1].toString())

    const reverserAfter = await PLATFORM.getReserves(TOKEN_A.address, TOKEN_B.address)
    log.debug('after reserve tokenA ', reverserAfter[0].toString())
    log.debug('after reserve tokenB', reverserAfter[1].toString())
    const transferTokenA = liquidity
      .div(2)
      .mul(result[0])
      .div(total)
    const transferTokenB = liquidity
      .div(2)
      .mul(result[1])
      .div(total)
    log.debug('calc remove tokenA liqulidity ', transferTokenA.toString())
    log.debug('calc remove tokenB liqulidity', transferTokenB.toString())
    expect(reverserAfter[0].add(transferTokenA).toString()).to.eq(result[0].toString())
    expect(reverserAfter[1].add(transferTokenB).toString()).to.eq(result[1].toString())
    const userTokenAAfterBalance = await TOKEN_A.balanceOf(userAccount)
    const userTokenBAfterBalance = await TOKEN_B.balanceOf(userAccount)
    log.debug('userTokenAAfterBalance', userTokenAAfterBalance.toString())
    log.debug('userTokenBAfterBalance', userTokenBAfterBalance.toString())
    expect(userTokenABalance.add(transferTokenA).toString()).eq(userTokenAAfterBalance.toString())
    expect(userTokenBBalance.add(transferTokenB).toString()).eq(userTokenBAfterBalance.toString())
  })

  it('swap exact tokenA for tokenB', async () => {
    const pairAddress = await PLATFORM.pairFor(TOKEN_A.address, TOKEN_B.address)
    const result = await PLATFORM.getReserves(TOKEN_A.address, TOKEN_B.address)
    const resultDgas = await PLATFORM.getReserves(TOKEN_A.address, DGAS.address)
    await TOKEN_A.approve(PLATFORM.address, expandTo18Decimals(1000))
    await sleep(500)
    const senderTokenABalance = await TOKEN_A.balanceOf(wallet.address)
    const userTokenBBalance = await TOKEN_B.balanceOf(userAccount)
    const pairTokenABalance = await TOKEN_A.balanceOf(pairAddress)
    const pairTokenBBalance = await TOKEN_B.balanceOf(pairAddress)
    expect(pairTokenABalance.toString()).to.eq(result[0].toString())
    expect(pairTokenBBalance.toString()).to.eq(result[1].toString())

    const rewardsAccountDgasAmount = await DGAS.balanceOf(GOVERNANCE.address)
    log.debug('before rewards account  dgas amount ' + rewardsAccountDgasAmount.toString())
    await sleep(500)
    const tx = await PLATFORM.swapExactTokensForTokens(
      expandTo18Decimals(1000),
      expandTo18Decimals(1),
      [TOKEN_A.address, TOKEN_B.address],
      userAccount,
      Math.trunc(Date.now() / 1000) + 1000
    )
    let receipt = await tx.wait()
    log.debug('swap gas used ', receipt.gasUsed.toString())
    const resultAfter = await PLATFORM.getReserves(TOKEN_A.address, TOKEN_B.address)
    const numerator = expandTo18Decimals(1000)
      .mul(997)
      .mul(result[1])
    const denominator = result[0].mul(1000).add(expandTo18Decimals(1000).mul(997))
    expect(resultAfter[0].toString()).to.eq(
      result[0].add(
        expandTo18Decimals(1000)
          .mul(997)
          .div(1000)
      )
    )
    expect(resultAfter[1].toString()).to.eq(result[1].sub(numerator.div(denominator)))
    log.debug('----before--AB->', result[0].toString(), result[1].toString())
    log.debug('----after--AB->', resultAfter[0].toString(), resultAfter[1].toString())
    const resultDgasAfter = await PLATFORM.getReserves(TOKEN_A.address, DGAS.address)
    const DgasValue = expandTo18Decimals(1000)
      .mul(3)
      .div(1000)
    const numeratorDgas = DgasValue.mul(resultDgas[1])
    const denominatorDgas = resultDgas[0].add(DgasValue)
    expect(resultDgasAfter[0].toString()).to.eq(resultDgas[0].add(DgasValue))
    expect(resultDgasAfter[1].toString()).to.eq(resultDgas[1].sub(numeratorDgas.div(denominatorDgas)))
    const userTokenABalanceAfter = await TOKEN_A.balanceOf(wallet.address)
    expect(userTokenABalanceAfter.toString()).to.eq(senderTokenABalance.sub(expandTo18Decimals(1000)))
    const userTokenBBalanceAfter = await TOKEN_B.balanceOf(userAccount)
    expect(userTokenBBalanceAfter.toString()).to.eq(userTokenBBalance.add(numerator.div(denominator)))
    const rewardsAccountDgasAmountAfter = await DGAS.balanceOf(GOVERNANCE.address)
    log.debug('after rewards account dgas amount ' + rewardsAccountDgasAmountAfter.toString())
    expect(rewardsAccountDgasAmount.add(bigNumberify('299910026991902429')).toString()).to.eq(
      rewardsAccountDgasAmountAfter.toString()
    )
  })

  it('swap exact tokenA --> weth for tokenB', async () => {
    const pairAWAddress = await PLATFORM.pairFor(TOKEN_A.address, WETH.address)
    const pairBWAddress = await PLATFORM.pairFor(TOKEN_B.address, WETH.address)

    const pairADGASAddress = await PLATFORM.pairFor(TOKEN_A.address, DGAS.address)
    const pairBDGSAddress = await PLATFORM.pairFor(TOKEN_B.address, DGAS.address)
    const pairWDGSAddress = await PLATFORM.pairFor(WETH.address, DGAS.address)
    let productAETh = await DGAS.getProductivity(pairAWAddress)
    let productBETh = await DGAS.getProductivity(pairBWAddress)
    let productBDGAS = await DGAS.getProductivity(pairBDGSAddress)
    let productADGAS = await DGAS.getProductivity(pairADGASAddress)
    let productWDGAS = await DGAS.getProductivity(pairWDGSAddress)
    log.debug('take a/eth', convertBigNumber(productAETh[0]), convertBigNumber(productAETh[1]))
    log.debug('take b/eth', convertBigNumber(productBETh[0]), convertBigNumber(productBETh[1]))
    log.debug('take a/dgas', convertBigNumber(productADGAS[0]), convertBigNumber(productADGAS[1]))
    log.debug('take b/dgas', convertBigNumber(productBDGAS[0]), convertBigNumber(productBDGAS[1]))
    log.debug('take eth/dgas', convertBigNumber(productWDGAS[0]), convertBigNumber(productWDGAS[1]))
    let reserveAW = await PLATFORM.getReserves(TOKEN_A.address, WETH.address)
    log.debug('pair tokenA/weth reserve ', expandToString(reserveAW[0]), expandToString(reserveAW[1]))
    let reserveBW = await PLATFORM.getReserves(TOKEN_B.address, WETH.address)
    log.debug('pair tokenB/weth reserve ', reserveBW[0].toString(), reserveBW[1].toString())

    let reserveADGas = await PLATFORM.getReserves(TOKEN_A.address, DGAS.address)
    log.debug('pair tokenA/Dgas reserve ', convertBigNumber(reserveADGas[0]), convertBigNumber(reserveADGas[1]))

    let reserveWDGas = await PLATFORM.getReserves(WETH.address, DGAS.address)
    log.debug('pair weth/Dgas reserve ', reserveWDGas[0].toString(), reserveWDGas[1].toString())

    let senderTokenABalance = await TOKEN_A.balanceOf(wallet.address)
    log.debug('before swap sender balance of tokenA ', senderTokenABalance.toString())
    let receiverTokenBBalance = await TOKEN_B.balanceOf(userAccount)
    log.debug('before swap receiver balance of tokenB ', receiverTokenBBalance.toString())
    let rewardsAccountDgasAmount = await DGAS.balanceOf(GOVERNANCE.address)
    log.debug('before swap rewards account dgas amount ' + rewardsAccountDgasAmount.toString())

    await TOKEN_A.approve(PLATFORM.address, expandTo18Decimals(1000))
    const tx = await PLATFORM.swapExactTokensForTokens(
      expandTo18Decimals(1000),
      expandTo18Decimals(1),
      [TOKEN_A.address, WETH.address, TOKEN_B.address],
      userAccount,
      Math.trunc(Date.now() / 1000) + 1000
    )
    await tx.wait()
    await sleep(500)
    productAETh = await DGAS.getProductivity(pairAWAddress)
    productBETh = await DGAS.getProductivity(pairBWAddress)
    productBDGAS = await DGAS.getProductivity(pairBDGSAddress)
    productADGAS = await DGAS.getProductivity(pairADGASAddress)
    productWDGAS = await DGAS.getProductivity(pairWDGSAddress)
    log.debug('after take a/eth', convertBigNumber(productAETh[0]), convertBigNumber(productAETh[1]))
    log.debug('after take b/eth', convertBigNumber(productBETh[0]), convertBigNumber(productBETh[1]))
    log.debug('after take a/dgas', convertBigNumber(productADGAS[0]), convertBigNumber(productADGAS[1]))
    log.debug('after take b/dgas', convertBigNumber(productBDGAS[0]), convertBigNumber(productBDGAS[1]))
    log.debug('after take eth/dgas', convertBigNumber(productWDGAS[0]), convertBigNumber(productWDGAS[1]))

    reserveAW = await PLATFORM.getReserves(TOKEN_A.address, WETH.address)
    log.debug('after tokenA/weth reserve ', reserveAW[0].toString(), reserveAW[1].toString())
    reserveBW = await PLATFORM.getReserves(TOKEN_B.address, WETH.address)
    log.debug('after tokenB/weth reserve ', reserveBW[0].toString(), reserveBW[1].toString())

    reserveADGas = await PLATFORM.getReserves(TOKEN_A.address, DGAS.address)
    log.debug('after tokenA/Dgas reserve ', convertBigNumber(reserveADGas[0]), convertBigNumber(reserveADGas[1]))
    reserveWDGas = await PLATFORM.getReserves(WETH.address, DGAS.address)
    log.debug('after weth/Dgas reserve ', reserveWDGas[0].toString(), reserveWDGas[1].toString())

    senderTokenABalance = await TOKEN_A.balanceOf(wallet.address)
    log.debug('after swap sender balance of tokenA ', senderTokenABalance.toString())
    receiverTokenBBalance = await TOKEN_B.balanceOf(userAccount)
    log.debug('after swap receiver balance of tokenB ', receiverTokenBBalance.toString())
    rewardsAccountDgasAmount = await DGAS.balanceOf(GOVERNANCE.address)
    log.debug('after swap rewards account dgas amount ' + rewardsAccountDgasAmount.toString())
  })

  it('swap exact tokenA --> dgas --> for tokenB', async () => {
    const pairAWAddress = await PLATFORM.pairFor(TOKEN_A.address, WETH.address)
    const pairBWAddress = await PLATFORM.pairFor(TOKEN_B.address, WETH.address)
    const pairADGASAddress = await PLATFORM.pairFor(TOKEN_A.address, DGAS.address)
    const pairBDGSAddress = await PLATFORM.pairFor(TOKEN_B.address, DGAS.address)
    const pairWDGSAddress = await PLATFORM.pairFor(WETH.address, DGAS.address)
    let productAETh = await DGAS.getProductivity(pairAWAddress)
    let productBETh = await DGAS.getProductivity(pairBWAddress)
    let productBDGAS = await DGAS.getProductivity(pairBDGSAddress)
    let productADGAS = await DGAS.getProductivity(pairADGASAddress)
    let productWDGAS = await DGAS.getProductivity(pairWDGSAddress)
    log.debug('take a/eth', convertBigNumber(productAETh[0]), convertBigNumber(productAETh[1]))
    log.debug('take b/eth', convertBigNumber(productBETh[0]), convertBigNumber(productBETh[1]))
    log.debug('take a/dgas', convertBigNumber(productADGAS[0]), convertBigNumber(productADGAS[1]))
    log.debug('take b/dgas', convertBigNumber(productBDGAS[0]), convertBigNumber(productBDGAS[1]))
    log.debug('take eth/dgas', convertBigNumber(productWDGAS[0]), convertBigNumber(productWDGAS[1]))

    let reserveAW = await PLATFORM.getReserves(TOKEN_A.address, WETH.address)
    log.debug('pair tokenA/weth reserve ', expandToString(reserveAW[0]), expandToString(reserveAW[1]))
    let reserveBW = await PLATFORM.getReserves(TOKEN_B.address, WETH.address)
    log.debug('pair tokenB/weth reserve ', reserveBW[0].toString(), reserveBW[1].toString())

    let reserveADGas = await PLATFORM.getReserves(TOKEN_A.address, DGAS.address)
    log.debug('pair tokenA/Dgas reserve ', convertBigNumber(reserveADGas[0]), convertBigNumber(reserveADGas[1]))

    let reserveWDGas = await PLATFORM.getReserves(WETH.address, DGAS.address)
    log.debug('pair weth/Dgas reserve ', reserveWDGas[0].toString(), reserveWDGas[1].toString())

    let senderTokenABalance = await TOKEN_A.balanceOf(wallet.address)
    log.debug('before swap sender balance of tokenA ', senderTokenABalance.toString())
    let receiverTokenBBalance = await TOKEN_B.balanceOf(userAccount)
    log.debug('before swap receiver balance of tokenB ', receiverTokenBBalance.toString())
    let rewardsAccountDgasAmount = await DGAS.balanceOf(GOVERNANCE.address)
    log.debug('before swap rewards account dgas amount ' + rewardsAccountDgasAmount.toString())

    await TOKEN_A.approve(PLATFORM.address, expandTo18Decimals(1000))
    const tx = await PLATFORM.swapExactTokensForTokens(
      expandTo18Decimals(1000),
      expandTo18Decimals(1),
      [TOKEN_A.address, DGAS.address, TOKEN_B.address],
      userAccount,
      Math.trunc(Date.now() / 1000) + 1000
    )
    await tx.wait()
    await sleep(500)
    productAETh = await DGAS.getProductivity(pairAWAddress)
    productBETh = await DGAS.getProductivity(pairBWAddress)
    productBDGAS = await DGAS.getProductivity(pairBDGSAddress)
    productADGAS = await DGAS.getProductivity(pairADGASAddress)
    productWDGAS = await DGAS.getProductivity(pairWDGSAddress)
    log.debug('after take a/eth', convertBigNumber(productAETh[0]), convertBigNumber(productAETh[1]))
    log.debug('after take b/eth', convertBigNumber(productBETh[0]), convertBigNumber(productBETh[1]))
    log.debug('after take a/dgas', convertBigNumber(productADGAS[0]), convertBigNumber(productADGAS[1]))
    log.debug('after take b/dgas', convertBigNumber(productBDGAS[0]), convertBigNumber(productBDGAS[1]))
    log.debug('after take eth/dgas', convertBigNumber(productWDGAS[0]), convertBigNumber(productWDGAS[1]))

    reserveAW = await PLATFORM.getReserves(TOKEN_A.address, WETH.address)
    log.debug('after tokenA/weth reserve ', reserveAW[0].toString(), reserveAW[1].toString())
    reserveBW = await PLATFORM.getReserves(TOKEN_B.address, WETH.address)
    log.debug('after tokenB/weth reserve ', reserveBW[0].toString(), reserveBW[1].toString())

    reserveADGas = await PLATFORM.getReserves(TOKEN_A.address, DGAS.address)
    log.debug('after tokenA/Dgas reserve ', convertBigNumber(reserveADGas[0]), convertBigNumber(reserveADGas[1]))

    reserveWDGas = await PLATFORM.getReserves(WETH.address, DGAS.address)
    log.debug('after weth/Dgas reserve ', reserveWDGas[0].toString(), reserveWDGas[1].toString())

    senderTokenABalance = await TOKEN_A.balanceOf(wallet.address)
    log.debug('after swap sender balance of tokenA ', senderTokenABalance.toString())
    receiverTokenBBalance = await TOKEN_B.balanceOf(userAccount)
    log.debug('after swap receiver balance of tokenB ', receiverTokenBBalance.toString())
    rewardsAccountDgasAmount = await DGAS.balanceOf(GOVERNANCE.address)
    log.debug('after swap rewards account dgas amount ' + rewardsAccountDgasAmount.toString())
  })
})

describe('removeLiqulity on duration', async () => {
  before(async () => {
    await makeContractAndInitialize()
    await getDGAS()
  })

  it('add liqulity dgas/eth 10000/10', async () => {
    await DGAS.approve(PLATFORM.address, expandTo18Decimals(10000))
    let tx = await PLATFORM.addLiquidityETH(
      DGAS.address,
      expandTo18Decimals(10000),
      expandTo18Decimals(10000),
      expandTo18Decimals(10),
      Math.trunc(Date.now() / 1000) * 2,
      {
        value: expandTo18Decimals(10)
      }
    )
    await tx.wait()
    const contract = await getPairContract(DGAS.address, WETH.address)
    log.debug('add block number ', (await contract.lastMintBlock(wallet.address)).toString())
  })

  it('change config to 4 block', async () => {
    let tx = await CONFIG.changeConfigValueNoCheck(formatBytes32String('REMOVE_LIQUIDITY_DURATION'), 4)
    await tx.wait()
    const newRemoveValue = await CONFIG.getConfigValue(formatBytes32String('REMOVE_LIQUIDITY_DURATION'))
    log.debug('change block is ', newRemoveValue.toNumber())
    expect(newRemoveValue.toNumber()).equal(4)
  })

  it('try remove should be fail ', async () => {
    const contract = await getPairContract(DGAS.address, WETH.address)
    log.debug('last add block', (await contract.lastMintBlock(wallet.address)).toString())
    log.debug('try remove block number ', (await provider.getBlockNumber()).toString())
    const [liquidity] = await getLiquidity(wallet.address, DGAS.address, WETH.address)
    console.log('-----liquidity-------', convertBigNumber(liquidity))
    // const result = await DGAS.getProductivity(await PLATFORM.pairFor(WETH.address, DGAS.address))
    // console.log('------------', convertBigNumber(result[0]))
    // console.log('------------', convertBigNumber(result[1]))
    console.log('------------', userAccount)
    try {
      await PLATFORM.removeLiquidityETH(
        DGAS.address,
        liquidity.div(2),
        expandTo18Decimals(1),
        expandTo18Decimals(1),
        userAccount,
        Math.trunc(Date.now() / 1000) * 2
      )
      expect('remove fail').equals('remove success')
    } catch (error) {
      expect(error.message).equals("VM Exception while processing transaction: revert DEMAX PLATFORM : REMOVE LIQUIDITY DURATION FAIL")
    }
  })

  it('try remove should be success', async () => {
    await runBlock(3)
    const contract = await getPairContract(DGAS.address, WETH.address)
    log.debug('last add block', (await contract.lastMintBlock(wallet.address)).toString())
    log.debug('try remove block number ', (await provider.getBlockNumber()).toString())
    const [liquidity] = await getLiquidity(wallet.address, DGAS.address, WETH.address)
    console.log('-----liquidity-------', convertBigNumber(liquidity))
    await sleep(100)
    let tx = await PLATFORM.removeLiquidityETH(
      DGAS.address,
      liquidity.div(2),
      expandTo18Decimals(1),
      expandTo18Decimals(1),
      userAccount,
      Math.trunc(Date.now() / 1000) * 2
    )
    await tx.wait()
  })

})
