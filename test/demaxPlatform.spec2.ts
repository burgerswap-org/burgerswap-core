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
    log.debug('liqulidity wallet[0] ', liquidity.toString(), liquidity.div(2).toString())
    log.debug('liqulidity total', total.toString())
    let tx = await PLATFORM.removeLiquidity(
      TOKEN_A.address,
      TOKEN_B.address,
      liquidity.div(2),
      expandTo18Decimals(1),
      expandTo18Decimals(1),
      userAccount,
      Math.trunc(Date.now() / 1000) + 1000
    )
    let receipt = await tx.wait()
    log.debug('removeLiquidity gas:', receipt.gasUsed.toString())
    // let liquiditys = await getLiquidity(wallet.address, TOKEN_A.address, TOKEN_B.address)
    // log.debug('reserve liqulidity wallet[0] ', liquiditys[0].toString())
    // log.debug('reserve liqulidity total', liquiditys[1].toString())

    // const result2 = await PLATFORM.getReserves(TOKEN_A.address, TOKEN_B.address)
    // log.debug('after remove tokenA ', result2[0].toString())
    // log.debug('after remove tokenB ', result2[1].toString())

    // const transferTokenA = liquidity
    //   .div(2)
    //   .mul(result[0])
    //   .div(total)
    // const transferTokenB = liquidity
    //   .div(2)
    //   .mul(result[1])
    //   .div(total)
    // log.debug('calc remove tokenA liqulidity ', transferTokenA.toString())
    // log.debug('calc remove tokenB liqulidity', transferTokenB.toString())
    // expect(result2[0].add(transferTokenA).toString()).to.eq(result[0].toString())
    // expect(result2[1].add(transferTokenB).toString()).to.eq(result[1].toString())
    // const userTokenAAfterBalance = await TOKEN_A.balanceOf(userAccount)
    // const userTokenBAfterBalance = await TOKEN_B.balanceOf(userAccount)
    // log.debug('userTokenAAfterBalance', userTokenAAfterBalance.toString())
    // log.debug('userTokenBAfterBalance', userTokenBAfterBalance.toString())
    // expect(userTokenABalance.add(transferTokenA).toString()).eq(userTokenAAfterBalance.toString())
    // expect(userTokenBBalance.add(transferTokenB).toString()).eq(userTokenBAfterBalance.toString())
  })


})
