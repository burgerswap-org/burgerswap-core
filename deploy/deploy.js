const fs = require("fs")
const ethers = require('ethers')
const erc20 = require('../build/ERC20.json')
const platform = require('../build/demaxPlatform.json')
const demaxConfig = require('../build/DemaxConfig')
const dgas = require('../build/Dgas')
const usdt = require('../build/usdt')
const demaxPair = require('../build/DemaxPair')
const weth = require('../build/WETH9.json')
const demaxFactory = require('../build/DemaxFactory.json')
const demaxGovernance = require('../build/DemaxGovernance.json')
const ballotFactory = require('../build/DemaxBallotFactory.json')
const transferListener = require('../build/DemaxTransferListener.json')

const { bigNumberify } = require('ethers/utils')
const { exit } = require("process")
const VOTE_DURATION ='0x564f54455f4455524154494f4e00000000000000000000000000000000000000'
let ALL_ERC20_TOKENS = []
let DGAS_ADDRESS = ''
let PLATFORM_ADDRESS = ''
let GOVERNANCE_ADDRESS = ''
let CONFIG_ADDRESS = ''
let BALLOT_FACTORY_ADDRESS = ''
let FACTORY_ADDRESS = ''
let WETH_ADDRESS = ''
let TRANSFER_LISTENER_ADDRESS = ''
let TOKENA_ADDRESS = ''
let USDT_ADDRESS = ''
let PLATFORM
const web3 = new (require('web3'))()
const user1 = '0x4A2DaA71CB58138dFe05B914fBd98c7b9822cbF6'
const user2 = '0xA768267D5b04f0454272664F4166F68CFc447346'

if (!fs.existsSync('./.config.js')) {
  console.error('Not found .config.js, Please refer to config.example.js');
  exit(255);
}

process.on('uncaughtException', function (err) {
  console.error(err, __filename+':Caught exception: ');
});

const args = process.argv.slice(2);
const action = args[0];
const config = require('./.config.js')

if (action != 'dev') {
  WETH_ADDRESS = config.wethAddr
  USDT_ADDRESS = config.usdtAddr
  if (!WETH_ADDRESS || !USDT_ADDRESS) {
    console.error('not found WETH_ADDRESS or USDT_ADDRESS');
    exit(255);
  }
}

const provider = new ethers.providers.JsonRpcProvider(config.httpProvider)
const wallet = new ethers.Wallet(config.privateKey, provider);
const platformOwnerAddress = wallet.address
console.log('wallet address:', platformOwnerAddress)

function expandTo18Decimals(n, p = 18) {
  return bigNumberify(n).mul(bigNumberify(10).pow(p))
}

function usage() {
  console.log('please input [dev]')
}

function getPlatformIns() {
  if (!PLATFORM) {
    PLATFORM = new ethers.Contract(PLATFORM_ADDRESS, platform.abi, wallet)
  }
  return PLATFORM
}

async function manualListToken() {
  let ins = new ethers.Contract(CONFIG_ADDRESS, demaxConfig.abi, wallet)
  let tx = await ins.updateToken(TOKENA_ADDRESS, 3)
  await waitForMint(tx.hash)
}

const sleep = ms =>
  new Promise(resolve =>
    setTimeout(() => {
      resolve()
    }, ms)
  )

async function waitForMint(tx) {
  let result = null
  do {
    result = await provider.getTransactionReceipt(tx)
    // console.log('---------',result)
    if (result) {
      if (result.status === 0) throw 'transaction error ' + tx
      for (let log of result.logs) {
        if (
          log.topics[0] ===
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
        ) {
          // transfer
          // console.log(
          //   `transfer from 0x${log.topics[1].slice(
          //     -20
          //   )} to 0x${log.topics[2].slice(-20)} ${web3.utils.fromWei(
          //     log.data,
          //     'ether'
          //   )}`
          // )
        }
      }
    }
    await sleep(100)
  } while (result === null)
  await sleep(100)
}

async function getBlockNumber() {
  return await provider.getBlockNumber()
}

async function initialize() {
  console.log('start initialize')

  let ins = new ethers.Contract(
    TRANSFER_LISTENER_ADDRESS,
    transferListener.abi,
    wallet
  )
  let tx = await ins.initialize(
    DGAS_ADDRESS,
    FACTORY_ADDRESS,
    WETH_ADDRESS,
    PLATFORM_ADDRESS
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(
    GOVERNANCE_ADDRESS,
    demaxGovernance.abi,
    wallet
  )
  tx = await ins.initialize(
    PLATFORM_ADDRESS,
    CONFIG_ADDRESS,
    BALLOT_FACTORY_ADDRESS
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(PLATFORM_ADDRESS, platform.abi, wallet)
  tx = await ins.initialize(
    DGAS_ADDRESS,
    CONFIG_ADDRESS,
    FACTORY_ADDRESS,
    WETH_ADDRESS,
    GOVERNANCE_ADDRESS,
    TRANSFER_LISTENER_ADDRESS
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(CONFIG_ADDRESS, demaxConfig.abi, wallet)
  tx = await ins.initialize(
    DGAS_ADDRESS,
    platformOwnerAddress,
    ALL_ERC20_TOKENS
  )
  await waitForMint(tx.hash)
  console.log('have list tokens length ', (await ins.tokenCount()).toString())
  console.log(
    'the first list token address ',
    (await ins.tokenList(0)).toString()
  )

  ins = new ethers.Contract(DGAS_ADDRESS, dgas.abi, wallet)
  tx = await ins.upgradeImpl(TRANSFER_LISTENER_ADDRESS)
  await waitForMint(tx.hash)
}

async function approvePlatformTransferDGAS() {
  let ins = new ethers.Contract(DGAS_ADDRESS, dgas.abi, wallet)
  console.log((await ins.balanceOf(platformOwnerAddress)).toString())
  let tx = await ins.approve(
    PLATFORM_ADDRESS,
    expandTo18Decimals(1000000000000000)
  )
  await waitForMint(tx.hash)
  ins = new ethers.Contract(ALL_ERC20_TOKENS[0], erc20.abi, wallet)
  tx = await ins.approve(PLATFORM_ADDRESS, expandTo18Decimals(1000000000000000))
  console.log((await ins.balanceOf(platformOwnerAddress)).toString())
  await waitForMint(tx.hash)
}

async function addETHForDAGSLiquidity() {
  let ins = new ethers.Contract(USDT_ADDRESS, usdt.abi, wallet)
  let tx = await ins.approve(
    PLATFORM_ADDRESS,
    expandTo18Decimals(1000000000000000)
  )
  await waitForMint(tx.hash)
  let insDGAS = new ethers.Contract(DGAS_ADDRESS, dgas.abi, wallet)
  tx = await insDGAS.approve(
    PLATFORM_ADDRESS,
    expandTo18Decimals(1000000000000000)
  )
  await waitForMint(tx.hash)
  console.log(
    'before mined dgas amount ',
    (await insDGAS.balanceOf(platformOwnerAddress)).toString(),
    await getBlockNumber()
  )
  ins = new ethers.Contract(PLATFORM_ADDRESS, platform.abi, wallet)
  tx = await ins.addLiquidityETH(
    USDT_ADDRESS,
    expandTo18Decimals(10000),
    expandTo18Decimals(10000),
    expandTo18Decimals(1),
    Math.trunc(Date.now() / 1000) + 1000,
    {
      value: expandTo18Decimals(1)
    }
  )
  await waitForMint(tx.hash)
  const pairInstance = new ethers.Contract(
    await ins.pairFor(USDT_ADDRESS, WETH_ADDRESS),
    demaxPair.abi,
    wallet
  )
  tx = await pairInstance.mintReward()
  await waitForMint(tx.hash)
  console.log(
    'after mined dgas amount ',
    (await insDGAS.balanceOf(platformOwnerAddress)).toString(),
    await getBlockNumber()
  )
  await sleep(3000)
  tx = await ins.addLiquidityETH(
    DGAS_ADDRESS,
    expandTo18Decimals(1000),
    expandTo18Decimals(1000),
    expandTo18Decimals(10),
    Math.trunc(Date.now() / 1000) + 1000,
    {
      value: expandTo18Decimals(10)
    }
  )
  await waitForMint(tx.hash)
  console.log('addETHForDAGSLiquidity done')
}

async function addLiquidity() {
  console.log('start addLiquidity')
  let tx = await getPlatformIns().addLiquidityETH(
    DGAS_ADDRESS,
    expandTo18Decimals(100000),
    expandTo18Decimals(100000),
    expandTo18Decimals(10),
    Math.trunc(Date.now() / 1000) * 2,
    {
      value: expandTo18Decimals(10)
    }
  )
  await waitForMint(tx.hash)
  for (let i = 0; i < ALL_ERC20_TOKENS.length; i += 2) {
    let txResult = await getPlatformIns().addLiquidity(
      ALL_ERC20_TOKENS[0],
      DGAS_ADDRESS,
      expandTo18Decimals(1000),
      expandTo18Decimals(100000),
      expandTo18Decimals(1000),
      expandTo18Decimals(100000),
      Math.trunc(Date.now() / 1000) * 2
    )
    await waitForMint(txResult.hash)
  }
}

async function deploy() {
  let walletWithProvider = wallet
  let address = walletWithProvider.signingKey.address
  // WETH
  if (action == 'dev') {
    let factory = new ethers.ContractFactory(
      weth.abi,
      weth.bytecode,
      walletWithProvider
    )
    const wethIns = await factory.deploy()
    WETH_ADDRESS = wethIns.address
    await waitForMint(wethIns.deployTransaction.hash)
    console.log('weth contract address ' + wethIns.address)
  }
  
  ALL_ERC20_TOKENS.push(WETH_ADDRESS)
  // PLATFORM
  factory = new ethers.ContractFactory(
    platform.abi,
    platform.bytecode,
    walletWithProvider
  )
  const platformIns = await factory.deploy()
  PLATFORM = platformIns
  await waitForMint(platformIns.deployTransaction.hash)
  console.log('platform contract address ' + platformIns.address)
  PLATFORM_ADDRESS = platformIns.address
  // DGAS
  factory = new ethers.ContractFactory(
    dgas.abi,
    dgas.bytecode,
    walletWithProvider
  )
  const dgasIns = await factory.deploy()
  await waitForMint(dgasIns.deployTransaction.hash)
  console.log('dgas contract address ' + dgasIns.address)
  DGAS_ADDRESS = dgasIns.address
  ALL_ERC20_TOKENS.unshift(DGAS_ADDRESS)

  //USDT
  if (action == 'dev') {
    factory = new ethers.ContractFactory(
      usdt.abi,
      usdt.bytecode,
      walletWithProvider
    )
    const usdtIns = await factory.deploy()
    await waitForMint(usdtIns.deployTransaction.hash)
    console.log('usdt ' + ' ' + usdtIns.address)
    USDT_ADDRESS = usdtIns.address
      
    ALL_ERC20_TOKENS.push(USDT_ADDRESS)

    let tx = await usdtIns.transfer(
      user1,
      expandTo18Decimals(1000000, 6)
    )
    await waitForMint(tx.hash)
    tx = await usdtIns.transfer(user2, expandTo18Decimals(1000000, 6))
    await waitForMint(tx.hash)
  }


  // DEMAX GOVERNANCE
  factory = new ethers.ContractFactory(
    demaxGovernance.abi,
    demaxGovernance.bytecode,
    walletWithProvider
  )
  const governanceIns = await factory.deploy(DGAS_ADDRESS)
  GOVERNANCE_ADDRESS = governanceIns.address
  await waitForMint(governanceIns.deployTransaction.hash)
  console.log('governance contract address ' + governanceIns.address)

  // DEMAX CONFIG
  factory = new ethers.ContractFactory(
    demaxConfig.abi,
    demaxConfig.bytecode,
    walletWithProvider
  )
  const configIns = await factory.deploy()
  CONFIG_ADDRESS = configIns.address
  await waitForMint(configIns.deployTransaction.hash)
  console.log('config contract address ' + configIns.address)

  // BALLOT FACTORY
  factory = new ethers.ContractFactory(
    ballotFactory.abi,
    ballotFactory.bytecode,
    walletWithProvider
  )
  const ballotIns = await factory.deploy(GOVERNANCE_ADDRESS)
  await waitForMint(ballotIns.deployTransaction.hash)
  BALLOT_FACTORY_ADDRESS = ballotIns.address
  console.log('ballotFactory contract address ' + ballotIns.address)

  // DEMAX transfer listener
  factory = new ethers.ContractFactory(
    transferListener.abi,
    transferListener.bytecode,
    walletWithProvider
  )
  const demaxTransferListenerIns = await factory.deploy()
  TRANSFER_LISTENER_ADDRESS = demaxTransferListenerIns.address
  await waitForMint(demaxTransferListenerIns.deployTransaction.hash)
  console.log(
    'transfer listener contract address ' + demaxTransferListenerIns.address
  )

  // DEMAX FACTORY
  factory = new ethers.ContractFactory(
    demaxFactory.abi,
    demaxFactory.bytecode,
    walletWithProvider
  )
  const demaxFactorIns = await factory.deploy(
    DGAS_ADDRESS,
    CONFIG_ADDRESS,
    PLATFORM_ADDRESS
  )
  FACTORY_ADDRESS = demaxFactorIns.address
  await waitForMint(demaxFactorIns.deployTransaction.hash)
  console.log('factory contract address ' + demaxFactorIns.address)
  // erc20
  factory = new ethers.ContractFactory(
    erc20.abi,
    erc20.bytecode,
    walletWithProvider
  )
  const ERC20FactorIns = await factory.deploy(
    expandTo18Decimals(10000000000000),
    'tokenA',
    'A'
  )
  console.log('tokenA address ' + ERC20FactorIns.address)
  await waitForMint(ERC20FactorIns.deployTransaction.hash)
  TOKENA_ADDRESS = ERC20FactorIns.address
  tx = await ERC20FactorIns.transfer(
    user1,
    expandTo18Decimals(1000000)
  )
  await waitForMint(tx.hash)
  tx = await ERC20FactorIns.transfer(user2, expandTo18Decimals(1000000))
  await waitForMint(tx.hash)
}

// main //
if (action == 'help') {
  usage();
  return;
} else if (action == 'dev') {
  deploy()
  .then(initialize)
  .then(manualListToken)
  .then(addETHForDAGSLiquidity)
} else {
  deploy()
  .then(initialize)
}


