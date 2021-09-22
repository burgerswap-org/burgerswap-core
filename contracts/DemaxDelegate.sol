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
    function tokenA() external returns(address);
}

contract DemaxDelegate is Ownable{
    using SafeMath for uint;

    address public PLATFORM;
    address public POOL;
    address public DGAS;
    address public WETH;
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;
    mapping(address => bool) public isPair;
    mapping(address => address[]) public playerPairs;
    mapping(address => mapping(address => bool)) public isAddPlayerPair;

    address[] public delegateHistory;

    bytes32 public contractCodeHash;
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256);
    
    function initialize(address _PLATFORM, address _POOL, address _DGAS, address _WETH) public onlyOwner {
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
  
    function batchUpgradePlatform(address _PLATFORM, address[] calldata pairs) external onlyOwner {
        for(uint i = 0; i < pairs.length;i++) {
            IDemaxLP(pairs[i]).upgrade(_PLATFORM);
        }
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function getPlayerPairCount(address player) external view returns (uint256) {
        return playerPairs[player].length;
    }

    function _addPlayerPair(address _user, address _pair) internal {
        if (isAddPlayerPair[_user][_pair] == false) {
            isAddPlayerPair[_user][_pair] = true;
            playerPairs[_user].push(_pair);
        }
    }

    function addPlayerPair(address _user) external {
        require(isPair[msg.sender], 'addPlayerPair Forbidden');
        _addPlayerPair(_user, msg.sender);
    }
    
    function approveContract(address token, address spender, uint amount) internal {
        uint allowAmount = IERC20(token).totalSupply();
        if(allowAmount < amount) {
            allowAmount = amount;
        }

        uint _allowance = IERC20(token).allowance(address(this), spender);
        if(_allowance < amount) {
            if(_allowance > 0) {
                TransferHelper.safeApprove(token, spender, 0); // workaround for usdt approve
            }
            TransferHelper.safeApprove(token, spender, allowAmount);
        }
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
            
            _addPlayerPair(msg.sender, pair);

            TransferHelper.safeTransferFrom(token, msg.sender, address(this), amountTokenDesired);
            approveContract(token, pair, amountTokenDesired);
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

            _addPlayerPair(msg.sender, pair);

            if(tokenA != IDemaxLP(pair).tokenA()) {
                (tokenA, tokenB) = (tokenB, tokenA);
                (amountA, amountB, amountAMin, amountBMin) = (amountB, amountA, amountBMin, amountAMin);
            }
            
            TransferHelper.safeTransferFrom(tokenA, msg.sender, address(this), amountA);
            TransferHelper.safeTransferFrom(tokenB, msg.sender, address(this), amountB);
            approveContract(tokenA, pair, amountA);
            approveContract(tokenB, pair, amountB);

            (_amountA, _amountB, _liquidity) = IDemaxLP(pair).addLiquidity(msg.sender, amountA, amountB, amountAMin, amountBMin, deadline);
            if(tokenA != IDemaxLP(pair).tokenA()) {
                (_amountA, _amountB) = (_amountB, _amountA);
            }
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
        require(checkDelegateHistory(tokenA, tokenB) == false, 'DEMAX OLD FACTORY: PAIR_EXISTS');
        bytes memory bytecode = type(DemaxLP).creationCode;
        if (uint256(contractCodeHash) == 0) {
            contractCodeHash = keccak256(bytecode);
        }
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        isPair[pair] = true;
        IDemaxLP(pair).initialize(token0, token1, DGAS, POOL, PLATFORM, WETH);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function addDelegateHistory(address _delegate) public onlyOwner {
        if(isDelegateHistory(_delegate) == false) {
            delegateHistory.push(_delegate);
        }
    }

    function removeDelegateHistory(address _delegate) public onlyOwner {
        uint index = indexDelegateHistory(_delegate);
        if(index == delegateHistory.length) {
            return;
        }
        if(index < delegateHistory.length -1) {
            delegateHistory[index] = delegateHistory[delegateHistory.length-1];
        }
        delegateHistory.pop();
    }

    function isDelegateHistory(address _delegate) public view returns (bool) {
        for(uint i = 0;i < delegateHistory.length;i++) {
            if(_delegate == delegateHistory[i]) {
                return true;
            }
        }
        return false;
    }
    
    function indexDelegateHistory(address _delegate) public view returns (uint) {
        for(uint i; i< delegateHistory.length; i++) {
            if(delegateHistory[i] == _delegate) {
                return i;
            }
        }
        return delegateHistory.length;
    }
 
    function countDelegateHistory() public view returns (uint) {
        return delegateHistory.length;
    }

    function checkDelegateHistory(address _tokenA, address _tokenB) public view returns (bool) {
        for(uint i; i< delegateHistory.length; i++) {
            if(IDemaxDelegate(delegateHistory[i]).getPair(_tokenA, _tokenB) != address(0)) {
                return true;
            }
        }
        return false;
    }

    function getDelegate(address _tokenA, address _tokenB) public view returns (address) {
        address pair = getPair[_tokenA][_tokenB];
        if(pair != address(0)) {
            return address(this);
        }

        for(uint i; i< delegateHistory.length; i++) {
            if(IDemaxDelegate(delegateHistory[i]).getPair(_tokenA, _tokenB) != address(0)) {
                return delegateHistory[i];
            }
        }
        return address(0);
    }

    function getDemaxLP(address _tokenA, address _tokenB) public view returns (address) {
        address pair = getPair[_tokenA][_tokenB];
        if(pair == address(0) && countDelegateHistory() > 0) {
            for(uint i; i< delegateHistory.length; i++) {
                pair = IDemaxDelegate(delegateHistory[i]).getPair(_tokenA, _tokenB);
                if(pair != address(0)) {
                    return pair;
                }
            }
        }
        return pair;
    }

    function getDemaxPair(address _tokenA, address _tokenB) public view returns (address) {
        return IDemaxPlatform(PLATFORM).pairFor(_tokenA, _tokenB);
    }
}
