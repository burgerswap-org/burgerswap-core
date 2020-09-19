const ethers = require("ethers")
const erc20 = require("../build/ERC20.json")
const platform = require("../build/DemaxPlatform.json")
const demaxConfig = require("../build/DemaxConfig")
const dgas = require("../build/Dgas")
const usdt = require("../build/usdt")
const demaxPair = require("../build/DemaxPair")
const weth = require("../build/WETH9.json")
const demaxFactory = require("../build/DemaxFactory.json")
const demaxGovernance = require("../build/DemaxGovernance.json")
const ballotFactory = require("../build/DemaxBallotFactory.json")
const transferListener = require("../build/DemaxTransferListener.json")
const demaxQuery = require("../build/DemaxQuery.json")
const {bigNumberify} = require("ethers/utils")
const Web3 = require("web3")
const web3 = new (require("web3"))()
const privateKey =
  "979f3f09fea3e8d2aa8628cfa4a49989f7469b7008ae401b4e14f42fc7bc178e"
const platformOwnerAddress = web3.eth.accounts.privateKeyToAccount(privateKey)
  .address
const swapUserReceiveAddress = "0xbCf2CE8F0C281C0d2be76E76c2429B13F5F07Ee2"
const swapUserRewardsAddress = "0x971c290EE9e7fb77394c7404F7dD4CB61ceaE07A"
const VOTE_DURATION =
  "0x564f54455f4455524154494f4e00000000000000000000000000000000000000"

let ALL_ERC20_TOKENS = []
let DGAS_ADDRESS = "0x3c9a812AB0805Ed0206CE71DCa3b49703c9bE6C3"
let USDT_ADDRESS = "0x946D5172Cd69990c220abBdA108846e0566B05a4"
let WETH_ADDRESS = "0x080bFBa2935DE6c8d748C177338ff78b79502605"
let PLATFORM_ADDRESS = "0xd6be473FBB7E775125A4b3FE41238eC7eE4F79B7"
let GOVERNANCE_ADDRESS = "0x0F1665076D31c4E56A67Ff1dE11Da6d0006c577b"
let CONFIG_ADDRESS = "0xF7D7086868f355779fF81fFCB1Fa101F30A98ae5"
let BALLOT_FACTORY_ADDRESS = "0xc42097906ecd1F9546eD59f4f1e459821e9A0805"
let FACTORY_ADDRESS = "0x65577b44bAC10e1f6d30D7998c2AF68C64962d5a"
let TRANSFER_LISTENER_ADDRESS = "0x30F344B09b2A37A6D61e14B8ABd5D7Dd1cd0775D"
let DEMAX_QUERY_ADDRESS = "0x30F344B09b2A37A6D61e14B8ABd5D7Dd1cd0775D"
// ALL_ERC20_TOKENS.push(DGAS_ADDRESS, USDT_ADDRESS, WETH_ADDRESS)
let TOKENA_ADDRESS = ""
let PLATFORM

const XIAOWU_ADDRESS = "0x4A2DaA71CB58138dFe05B914fBd98c7b9822cbF6"
const XIGUA_ADDRESS = "0xA768267D5b04f0454272664F4166F68CFc447346"
const WANG_KUI = "0xc03C12101AE20B8e763526d6841Ece893248a069"
const LAO_YI_ADDRESS = "0x866e43291293892bd0980ADc4Ec5166F33623D86"

const NEED_TRANSFER_ADDRESS = [
  XIAOWU_ADDRESS,
  XIGUA_ADDRESS,
  WANG_KUI,
  LAO_YI_ADDRESS
]

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

const ETHER_SEND_CONFIG = {
  gasPrice: ethers.utils.parseUnits("10", "gwei")
}

const isLocalEtherNetWork = false
const connectUrl =
  isLocalEtherNetWork
  ? "http://47.75.205.56:8545"
  : "https://koava.infura.io/v3/f855a808a4174908b39f21093b10803a"
console.log("current endpoint  ",connectUrl)
let provider = new ethers.providers.JsonRpcProvider(connectUrl)

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
  let tx = await ins.modifyGovernor(platformOwnerAddress)
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
  let tx = await ins.initialize(
    DGAS_ADDRESS,
    FACTORY_ADDRESS,
    WETH_ADDRESS,
    PLATFORM_ADDRESS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(
    GOVERNANCE_ADDRESS,
    demaxGovernance.abi,
    getWallet()
  )
  tx = await ins.initialize(
    PLATFORM_ADDRESS,
    CONFIG_ADDRESS,
    BALLOT_FACTORY_ADDRESS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(PLATFORM_ADDRESS, platform.abi, getWallet())
  tx = await ins.initialize(
    DGAS_ADDRESS,
    CONFIG_ADDRESS,
    FACTORY_ADDRESS,
    WETH_ADDRESS,
    GOVERNANCE_ADDRESS,
    TRANSFER_LISTENER_ADDRESS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)

  ins = new ethers.Contract(CONFIG_ADDRESS, demaxConfig.abi, getWallet())
  tx = await ins.initialize(
    DGAS_ADDRESS,
    GOVERNANCE_ADDRESS,
    PLATFORM_ADDRESS,
    platformOwnerAddress,
    ALL_ERC20_TOKENS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(tx.hash)
  console.log("have list tokens length ", (await ins.tokenCount()).toString())
  console.log(
    "the first list token address ",
    (await ins.tokenList(0)).toString()
  )
  await sleep(1000)
  ins = new ethers.Contract(DGAS_ADDRESS, dgas.abi, getWallet())
  tx = await ins.upgradeImpl(TRANSFER_LISTENER_ADDRESS, {
    ...ETHER_SEND_CONFIG
  })
  await waitForMint(tx.hash)
  tx = await ins.upgradeGovernance(GOVERNANCE_ADDRESS, {
    ...ETHER_SEND_CONFIG
  })
  await waitForMint(tx.hash)
}

async function addETHForDAGSLiquidity() {
  console.log("---addETHForDAGSLiquidity1")
  let nonce = await provider.getTransactionCount(platformOwnerAddress)
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
    (await insDGAS.balanceOf(platformOwnerAddress)).toString(),
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
    (await insDGAS.balanceOf(platformOwnerAddress)).toString(),
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

  // DEMAX QUERY
  factory = new ethers.ContractFactory(
    demaxQuery.abi,
    demaxQuery.bytecode,
    walletWithProvider
  )
  // const demaxQueryIns = await factory.deploy(CONFIG_ADDRESS,PLATFORM_ADDRESS,FACTORY_ADDRESS,GOVERNANCE_ADDRESS, CONFIG_ADDRESS)
  const demaxQueryIns = await factory.deploy(
    CONFIG_ADDRESS,
    PLATFORM_ADDRESS,
    FACTORY_ADDRESS,
    GOVERNANCE_ADDRESS,
    ETHER_SEND_CONFIG
  )
  await waitForMint(demaxQueryIns.deployTransaction.hash)
  console.log("demax query address" + demaxQueryIns.address)

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
  .then(addETHForDAGSLiquidity)

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
