let fs = require("fs");
let path = require("path");
const ethers = require("ethers")
const erc20 = require("../build/ERC20.json")
const platform = require("../build/DemaxPlatform.json")
const demaxConfig = require("../build/DemaxConfig.json")
const dgas = require("../build/DgasTest.json")
const usdt = require("../build/usdt.json")
const demaxPair = require("../build/DemaxPair.json")
const weth = require("../build/WETH9.json")
const demaxPool = require("../build/DemaxPool.json")
const demaxFactory = require("../build/DemaxFactory.json")
const demaxGovernance = require("../build/DemaxGovernance.json")
const ballotFactory = require("../build/DemaxBallotFactory.json")
const transferListener = require("../build/DemaxTransferListener.json")
const demaxQuery = require("../build/DemaxQuery.json")
const demaxQuery2 = require("../build/DemaxQuery2.json")
const demaxDelegate = require("../build/demaxDelegate.json")
const {bigNumberify} = require("ethers/utils")
const Web3 = require("web3")
const web3 = new Web3()

let config = {
  "gasPrice": "10",
  "url": "",
  "pk": "",
  "users":[]
}

if(fs.existsSync(path.join(__dirname, ".config.json"))) {
  let _config = JSON.parse(fs.readFileSync(path.join(__dirname, ".config.json")).toString());
  for(let k in config) {
      config[k] = _config[k];
  }
}

let ETHER_SEND_CONFIG = {
  gasPrice: ethers.utils.parseUnits(config.gasPrice, "gwei")
}

console.log("current endpoint ", config.url)
let provider = new ethers.providers.JsonRpcProvider(config.url)

const privateKey = config.pk
const ownerAddress = web3.eth.accounts.privateKeyToAccount(privateKey).address
console.log('wallet ', ownerAddress)
const swapUserReceiveAddress = "0xbCf2CE8F0C281C0d2be76E76c2429B13F5F07Ee2"
const swapUserRewardsAddress = "0x971c290EE9e7fb77394c7404F7dD4CB61ceaE07A"
const VOTE_DURATION =
  "0x564f54455f4455524154494f4e00000000000000000000000000000000000000"

let ALL_ERC20_TOKENS = []
let DGAS_ADDRESS = ""
let USDT_ADDRESS = ""
let WETH_ADDRESS = ""
let PLATFORM_ADDRESS = ""
let GOVERNANCE_ADDRESS = ""
let CONFIG_ADDRESS = ""
let BALLOT_FACTORY_ADDRESS = ""
let FACTORY_ADDRESS = ""
let TRANSFER_LISTENER_ADDRESS = ""
let POOL_ADDRESS = ""
let QUERY_ADDRESS = ""
let QUERY2_ADDRESS = ""
let DELEGATE_ADDRESS = ""
// ALL_ERC20_TOKENS.push(DGAS_ADDRESS, USDT_ADDRESS, WETH_ADDRESS)
let TOKENA_ADDRESS = ""
let PLATFORM

const NEED_TRANSFER_ADDRESS = config.users

const MOCK_TOKENS = [
  {name: "tokenA", symbol: "A"}
  // { name: 'tokenB', symbol: 'B' },
  // { name: 'tokenC', symbol: 'C' },
  // { name: 'tokenD', symbol: 'D' },
  // { name: 'tokenE', symbol: 'E' },
  // { name: 'tokenF', symbol: 'F' },
  // { name: 'tokenG', symbol: 'G' },
  // { name: 'tokenH', symbol: 'H' },
  // { name: 'tokenI', symbol: 'I' },
  // { name: 'tokenJ', symbol: 'J' },
  // { name: 'tokenK', symbol: 'K' },
  // { name: 'tokenL', symbol: 'L' },
  // { name: 'token1', symbol: 's1' },
  // { name: 'token2', symbol: 's2' },
  // { name: 'token3', symbol: 's3' },
  // { name: 'token4', symbol: 's4' },
  // { name: 'token5', symbol: 's5' },
  // { name: 'token6', symbol: 's6' }
]

function expandTo18Decimals(n, p = 18) {
  return bigNumberify(n).mul(bigNumberify(10).pow(p))
}

function getWallet(key = privateKey) {
  return new ethers.Wallet(key, provider)
}

function getPlatformIns() {
  if (!PLATFORM) {
    PLATFORM = new ethers.Contract(
      PLATFORM_ADDRESS,
      platform.abi,
      getWallet()
    )
  }
  return PLATFORM
}

async function manualListToken() {
  console.log("---manualListToken------")
  let ins = new ethers.Contract(CONFIG_ADDRESS, demaxConfig.abi, getWallet())
  let tx = await ins.modifyGovernor(ownerAddress)
  await waitForMint(tx.hash)
  tx = await ins.registryToken(TOKENA_ADDRESS)
  await waitForMint(tx.hash)
  tx = await ins.updateToken(TOKENA_ADDRESS, 3)
  await waitForMint(tx.hash)
  await ins.modifyGovernor(GOVERNANCE_ADDRESS)
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
    await sleep(100)
  } while (result === null)
  await sleep(200)
}

async function getBlockNumber() {
  return await provider.getBlockNumber()
}

async function initialize() {
  console.log("start initialize")

  let ins = new ethers.Contract(
    TRANSFER_LISTENER_ADDRESS,
    transferListener.abi,
    getWallet()
  )
  console.log('transferListener initialize...')
  let tx = await ins.initialize(
    DGAS_ADDRESS,
    FACTORY_ADDRESS,
    WETH_ADDRESS,
    PLATFORM_ADDRESS,
    ownerAddress,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(
    GOVERNANCE_ADDRESS,
    demaxGovernance.abi,
    getWallet()
  )
  console.log('demaxGovernance initialize...')
  tx = await ins.initialize(
    POOL_ADDRESS,
    CONFIG_ADDRESS,
    BALLOT_FACTORY_ADDRESS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(PLATFORM_ADDRESS, platform.abi, getWallet())
  console.log('platform initialize...')
  tx = await ins.initialize(
    DGAS_ADDRESS,
    CONFIG_ADDRESS,
    FACTORY_ADDRESS,
    WETH_ADDRESS,
    GOVERNANCE_ADDRESS,
    TRANSFER_LISTENER_ADDRESS,
    POOL_ADDRESS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(POOL_ADDRESS, demaxPool.abi, getWallet())
  console.log('demaxPool initialize...')
  tx = await ins.initialize(
    DGAS_ADDRESS,
    WETH_ADDRESS,
    FACTORY_ADDRESS,
    PLATFORM_ADDRESS,
    CONFIG_ADDRESS,
    GOVERNANCE_ADDRESS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(CONFIG_ADDRESS, demaxConfig.abi, getWallet())
  console.log('demaxConfig initialize...')
  tx = await ins.initialize(
    DGAS_ADDRESS,
    GOVERNANCE_ADDRESS,
    PLATFORM_ADDRESS,
    ownerAddress,
    ALL_ERC20_TOKENS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  // set FEE_LP_REWARD_PERCENT
  tx = await ins.changeConfig(
    '0x4645455f4c505f5245574152445f50455243454e540000000000000000000000',
    1000,
    6000,
    250,
    4000,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  // set FEE_GOVERNANCE_REWARD_PERCENT
  tx = await ins.changeConfig(
    '0x4645455f474f5645524e414e43455f5245574152445f50455243454e54000000',
    1000,
    6000,
    250,
    5000,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  console.log("have list tokens length ", (await ins.tokenCount()).toString())
  console.log(
    "the first list token address ",
    (await ins.tokenList(0)).toString()
  )

  console.log("dgas upgradeImpl ", TRANSFER_LISTENER_ADDRESS)
  ins = new ethers.Contract(DGAS_ADDRESS, dgas.abi, getWallet())
  tx = await ins.upgradeImpl(TRANSFER_LISTENER_ADDRESS, {
    ...ETHER_SEND_CONFIG
  })
  await waitForMint(tx.hash)

  console.log("dgas upgradeGovernance ", GOVERNANCE_ADDRESS)
  tx = await ins.upgradeGovernance(GOVERNANCE_ADDRESS, {
    ...ETHER_SEND_CONFIG
  })
  await waitForMint(tx.hash)

  // DEMAX QUERY
  console.log("demaxQuery upgrade ", GOVERNANCE_ADDRESS)
  ins = new ethers.Contract(QUERY_ADDRESS, demaxQuery.abi, getWallet())
  tx = await ins.upgrade(CONFIG_ADDRESS, PLATFORM_ADDRESS, FACTORY_ADDRESS, GOVERNANCE_ADDRESS, TRANSFER_LISTENER_ADDRESS, ETHER_SEND_CONFIG)
  await waitForMint(tx.hash)

  // DEMAX QUERY2
  console.log("demaxQuery2 upgrade ", GOVERNANCE_ADDRESS)
  ins = new ethers.Contract(QUERY2_ADDRESS, demaxQuery2.abi, getWallet())
  tx = await ins.upgrade(CONFIG_ADDRESS, PLATFORM_ADDRESS, FACTORY_ADDRESS, GOVERNANCE_ADDRESS, TRANSFER_LISTENER_ADDRESS, DELEGATE_ADDRESS, ETHER_SEND_CONFIG)
  await waitForMint(tx.hash)
}

async function addETHForDAGSLiquidity() {
  console.log("---addETHForDAGSLiquidity1")
  let nonce = await provider.getTransactionCount(ownerAddress)
  let ins = new ethers.Contract(USDT_ADDRESS, usdt.abi, getWallet())
  let tx = await ins.approve(PLATFORM_ADDRESS, expandTo18Decimals(1000), {
    ...ETHER_SEND_CONFIG,
    nonce: nonce
  })
  await waitForMint(tx.hash)
  console.log("---addETHForDAGSLiquidity2")
  let insDGAS = new ethers.Contract(DGAS_ADDRESS, dgas.abi, getWallet())
  tx = await insDGAS.approve(
    PLATFORM_ADDRESS,
    expandTo18Decimals(10000000000),
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)
  console.log(
    "before mined dgas amount ",
    (await insDGAS.balanceOf(ownerAddress)).toString(),
    await getBlockNumber()
  )

  ins = new ethers.Contract(PLATFORM_ADDRESS, platform.abi, getWallet())
  tx = await ins.addLiquidityETH(
    USDT_ADDRESS,
    expandTo18Decimals(100, 6),
    expandTo18Decimals(100, 6),
    expandTo18Decimals(1),
    Math.trunc(Date.now() / 1000) * 2,
    {
      value: expandTo18Decimals(1),
      ...ETHER_SEND_CONFIG
    }
  )
  await waitForMint(tx.hash)
  const pairInstance = new ethers.Contract(
    await ins.pairFor(USDT_ADDRESS, WETH_ADDRESS),
    demaxPair.abi,
    getWallet()
  )
  tx = await pairInstance.mintReward(ETHER_SEND_CONFIG)
  await waitForMint(tx.hash)
  console.log(
    "after mined dgas amount ",
    (await insDGAS.balanceOf(ownerAddress)).toString(),
    await getBlockNumber()
  )
  tx = await ins.addLiquidityETH(
    DGAS_ADDRESS,
    expandTo18Decimals(10),
    expandTo18Decimals(10),
    expandTo18Decimals(1),
    Math.trunc(Date.now() / 1000) * 2,
    {
      value: expandTo18Decimals(1),
      ...ETHER_SEND_CONFIG
    }
  )
  await waitForMint(tx.hash)
}

async function deploy() {
  let walletWithProvider = new ethers.Wallet(privateKey, provider)
  // let address = walletWithProvider.signingKey.address
  // WETH
  let factory = new ethers.ContractFactory(
    weth.abi,
    weth.bytecode,
    walletWithProvider
  )
  const wethIns = await factory.deploy(ETHER_SEND_CONFIG)
  WETH_ADDRESS = wethIns.address
  await waitForMint(wethIns.deployTransaction.hash)
  console.log("weth address " + wethIns.address)
  ALL_ERC20_TOKENS.push(WETH_ADDRESS)
  // PLATFORM
  factory = new ethers.ContractFactory(
    platform.abi,
    platform.bytecode,
    walletWithProvider
  )
  const platformIns = await factory.deploy(ETHER_SEND_CONFIG)
  PLATFORM = platformIns
  await waitForMint(platformIns.deployTransaction.hash)
  console.log("platform address " + platformIns.address)
  PLATFORM_ADDRESS = platformIns.address
  // DGAS
  factory = new ethers.ContractFactory(
    dgas.abi,
    dgas.bytecode,
    walletWithProvider
  )
  const dgasIns = await factory.deploy(ETHER_SEND_CONFIG)
  await waitForMint(dgasIns.deployTransaction.hash)
  console.log("dgas address " + dgasIns.address)
  DGAS_ADDRESS = dgasIns.address
  ALL_ERC20_TOKENS.unshift(DGAS_ADDRESS)

  factory = new ethers.ContractFactory(
    usdt.abi,
    usdt.bytecode,
    walletWithProvider
  )
  const usdtIns = await factory.deploy(ETHER_SEND_CONFIG)
  await waitForMint(usdtIns.deployTransaction.hash)
  console.log("usdt  address " + " " + usdtIns.address)
  USDT_ADDRESS = usdtIns.address
  ALL_ERC20_TOKENS.push(usdtIns.address)
  for (let addr of NEED_TRANSFER_ADDRESS) {
    let tx = await usdtIns.transfer(
      addr,
      expandTo18Decimals(1000000, 6),
      ETHER_SEND_CONFIG
    )
    await waitForMint(tx.hash)
  }
  // DEMAX GOVERNANCE
  factory = new ethers.ContractFactory(
    demaxGovernance.abi,
    demaxGovernance.bytecode,
    walletWithProvider
  )
  const governanceIns = await factory.deploy(DGAS_ADDRESS, ETHER_SEND_CONFIG)
  GOVERNANCE_ADDRESS = governanceIns.address
  await waitForMint(governanceIns.deployTransaction.hash)
  console.log("governance address " + governanceIns.address)

  // DEMAX CONFIG
  factory = new ethers.ContractFactory(
    demaxConfig.abi,
    demaxConfig.bytecode,
    walletWithProvider
  )
  const configIns = await factory.deploy(ETHER_SEND_CONFIG)
  CONFIG_ADDRESS = configIns.address
  await waitForMint(configIns.deployTransaction.hash)
  console.log("config address " + configIns.address)

  // BALLOT FACTORY
  factory = new ethers.ContractFactory(
    ballotFactory.abi,
    ballotFactory.bytecode,
    walletWithProvider
  )
  const ballotIns = await factory.deploy(ETHER_SEND_CONFIG)
  await waitForMint(ballotIns.deployTransaction.hash)
  BALLOT_FACTORY_ADDRESS = ballotIns.address
  console.log("ballotFactory address " + ballotIns.address)

  // DEMAX transfer listener
  factory = new ethers.ContractFactory(
    transferListener.abi,
    transferListener.bytecode,
    walletWithProvider
  )
  const demaxTransferListenerIns = await factory.deploy(ETHER_SEND_CONFIG)
  TRANSFER_LISTENER_ADDRESS = demaxTransferListenerIns.address
  await waitForMint(demaxTransferListenerIns.deployTransaction.hash)
  console.log("transfer listener address " + demaxTransferListenerIns.address)

  // DEMAX FACTORY
  factory = new ethers.ContractFactory(
    demaxFactory.abi,
    demaxFactory.bytecode,
    walletWithProvider
  )
  const demaxFactoryIns = await factory.deploy(DGAS_ADDRESS, CONFIG_ADDRESS)
  FACTORY_ADDRESS = demaxFactoryIns.address
  await waitForMint(demaxFactoryIns.deployTransaction.hash)
  console.log("demax factory address  " + demaxFactoryIns.address)

  //DEMAX POOL 
  factory = new ethers.ContractFactory(
    demaxPool.abi,
    demaxPool.bytecode,
    walletWithProvider
  )
  const demaxPoolIns = await factory.deploy()
  POOL_ADDRESS = demaxPoolIns.address
  await waitForMint(demaxPoolIns.deployTransaction.hash)
  console.log("demax pool address  " + demaxPoolIns.address)

  //DEMAX DELEGATE 
  factory = new ethers.ContractFactory(
    demaxDelegate.abi,
    demaxDelegate.bytecode,
    walletWithProvider
  )
  const demaxDelegateIns = await factory.deploy(PLATFORM_ADDRESS, POOL_ADDRESS, DGAS_ADDRESS)
  DELEGATE_ADDRESS = demaxDelegateIns.address
  await waitForMint(demaxDelegateIns.deployTransaction.hash)
  console.log("demax delegate address  " + demaxDelegateIns.address)

  // DEMAX QUERY
  factory = new ethers.ContractFactory(
    demaxQuery.abi,
    demaxQuery.bytecode,
    walletWithProvider
  )
  
  const demaxQueryIns = await factory.deploy()
  QUERY_ADDRESS = demaxQueryIns.address
  await waitForMint(demaxQueryIns.deployTransaction.hash)
  console.log("demax query address" + demaxQueryIns.address)

  // DEMAX QUERY2
  factory = new ethers.ContractFactory(
    demaxQuery2.abi,
    demaxQuery2.bytecode,
    walletWithProvider
  )
  
  const demaxQuery2Ins = await factory.deploy()
  QUERY2_ADDRESS = demaxQuery2Ins.address
  await waitForMint(demaxQuery2Ins.deployTransaction.hash)
  console.log("demax query2 address" + demaxQuery2Ins.address)

  // erc20
  factory = new ethers.ContractFactory(
    erc20.abi,
    erc20.bytecode,
    walletWithProvider
  )
  for (let mock_token of MOCK_TOKENS) {
    const ERC20FactorIns = await factory.deploy(
      expandTo18Decimals(100000000000000),
      mock_token.name,
      mock_token.symbol,
      ETHER_SEND_CONFIG
    )
    console.log(mock_token.name + " address " + ERC20FactorIns.address)
    await waitForMint(ERC20FactorIns.deployTransaction.hash)
    if (mock_token.name === "tokenA") {
      TOKENA_ADDRESS = ERC20FactorIns.address
    }
    for (let addr of NEED_TRANSFER_ADDRESS) {
      let tx = await ERC20FactorIns.transfer(
        addr,
        expandTo18Decimals(1000000),
        ETHER_SEND_CONFIG
      )
      await waitForMint(tx.hash)
    }
  }
}

deploy()
  .then(initialize)
  // .then(manualListToken)
  // .then(addETHForDAGSLiquidity)

// const w3 = new Web3(
//     'https://rinkeby.infura.io/v3/f855a808a4174908b39f21093b10803a'
// )
//
// let ins = new w3.eth.Contract(
//     erc20.abi,
//     '0xc56F17386B2c8EF0D58c64A39BAd24001e2D35B9'
// )
// ins.getPastEvents("Transfer",{fromBlock:7152979,toBlock:7152979}).then(function (events) {
//     console.log(events)
// })
