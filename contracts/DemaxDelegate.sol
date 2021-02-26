// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.6;

import './DemaxLP.sol';
import './modules/Ownable.sol';

interface IDemaxLP {
    function addLiquidity(
        address user,
        uint256 amountA,
        uint256 amountB,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline) external returns (
            uint256 _amountA,
            uint256 _amountB,
            uint256 _liquidity
        );
     function removeLiquidity(
        address user,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline) external returns (
            uint256 _amountA,
            uint256 _amountB
        );
    function addLiquidityETH(
        address user,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint256 deadline) external payable returns (
            uint256 _amountToken,
            uint256 _amountETH,
            uint256 _liquidity
        );
    function removeLiquidityETH (
        address user,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint256 deadline) external returns (uint256 _amountToken, uint256 _amountETH);
    function initialize(address _tokenA, address _tokenB, address _DGAS, address _POOL, address _PLATFORM, address _WETH) external;
    function upgrade(address _PLATFORM) external;
}

contract DemaxDelegate is Ownable{
    using SafeMath for uint;
    
    address public PLATFORM;
    address public POOL;
    address public DGAS;
    address public WETH;
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    mapping(address => address[]) public playerPairs;
    mapping(address => mapping(address => bool)) isAddPlayerPair;

    bytes32 public contractCodeHash;
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);
    
    constructor(address _PLATFORM, address _POOL, address _DGAS, address _WETH) public {
        PLATFORM = _PLATFORM;
        POOL = _POOL;
        DGAS = _DGAS;
        WETH = _WETH;
    }
    
    receive() external payable {
    }
    
    function upgradePlatform(address _PLATFORM) external onlyOwner {
        for(uint i = 0; i < allPairs.length;i++) {
            IDemaxLP(allPairs[i]).upgrade(_PLATFORM);
        }
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function getPlayerPairCount(address player) external view returns (uint256) {
        return playerPairs[player].length;
    }
    
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        uint256 deadline
        ) payable external returns (
            uint256 _amountToken,
            uint256 _amountETH,
            uint256 _liquidity
        ) {
        address pair = getPair[token][WETH];
            if(pair == address(0)) {
                pair = _createPair(token, WETH);
            }
            
            if (isAddPlayerPair[msg.sender][pair] == false) {
                isAddPlayerPair[msg.sender][pair] = true;
                playerPairs[msg.sender].push(pair);
            }

            TransferHelper.safeTransferFrom(token, msg.sender, address(this), amountTokenDesired);
            TransferHelper.safeApprove(token, pair, amountTokenDesired);
            (_amountToken, _amountETH, _liquidity) = IDemaxLP(pair).addLiquidityETH{value: msg.value}(msg.sender, amountTokenDesired, amountTokenMin, amountETHMin, deadline);
    }
    
    
    
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline) external returns (
            uint256 _amountA,
            uint256 _amountB,
            uint256 _liquidity
        ) {
            address pair = getPair[tokenA][tokenB];
            if(pair == address(0)) {
                pair = _createPair(tokenA, tokenB);
            }

            if (isAddPlayerPair[msg.sender][pair] == false) {
                isAddPlayerPair[msg.sender][pair] = true;
                playerPairs[msg.sender].push(pair);
            }
            
            TransferHelper.safeTransferFrom(tokenA, msg.sender, address(this), amountA);
            TransferHelper.safeTransferFrom(tokenB, msg.sender, address(this), amountB);
            TransferHelper.safeApprove(tokenA, pair, amountA);
            TransferHelper.safeApprove(tokenB, pair, amountB);
            (_amountA, _amountB, _liquidity) = IDemaxLP(pair).addLiquidity(msg.sender, amountA, amountB, amountAMin, amountBMin, deadline);
    }
    
    function removeLiquidityETH(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountETHMin,
        uint deadline
        ) external returns (uint _amountToken, uint _amountETH) {
            address pair = getPair[token][WETH];
            (_amountToken, _amountETH) = IDemaxLP(pair).removeLiquidityETH(msg.sender, liquidity, amountTokenMin, amountETHMin, deadline);
        }
    
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        uint256 deadline) external returns (
            uint256 _amountA,
            uint256 _amountB
        ) {
        address pair = getPair[tokenA][tokenB];
        (_amountA, _amountB) = IDemaxLP(pair).removeLiquidity(msg.sender, liquidity, amountAMin, amountBMin, deadline);
    }

    function _createPair(address tokenA, address tokenB) internal returns (address pair){
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), 'DEMAX FACTORY: ZERO_ADDRESS');
        require(getPair[token0][token1] == address(0), 'DEMAX FACTORY: PAIR_EXISTS'); // single check is sufficient
        bytes memory bytecode = type(DemaxLP).creationCode;
        if (uint256(contractCodeHash) == 0) {
            contractCodeHash = keccak256(bytecode);
        }
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IDemaxLP(pair).initialize(token0, token1, DGAS, POOL, PLATFORM, WETH);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }
}
