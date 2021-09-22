// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >= 0.6.6;
import './modules/Ownable.sol';

interface IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);
}


interface IDemaxFactory {
    function getPair(address _token0, address _token1) external view returns (address);
    function allPairsLength() external view returns(uint);
    function isPair(address _pair) external view returns(bool);
    function allPairs(uint _index) external view returns(address);
}

interface IDemaxPair {
    function totalSupply() external view returns(uint256);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IDemaxTransferListener {
    function pairWeights(address pair) external view returns(uint);
}

pragma experimental ABIEncoderV2;

contract DemaxQueryPair is Ownable {
    address public factory;
    address public transferListener;
    address public baseToken;
    address[] public routerTokens;

    struct PairInfo {
        address pair;
        uint weight;
        uint tvl;
        uint totalSupply;
        address token0;
        address token1;
        string token0Symbol;
        string token1Symbol;
    }
    
    constructor() public {
    }
    
    function initialize(address _factory, address _transferListener, address _baseToken) public onlyOwner {
        factory = _factory;
        transferListener = _transferListener;
        baseToken = _baseToken;
    }

    
    function addRouterTokens(address[] memory tokens) public onlyOwner {
        for(uint i; i< tokens.length; i++) {
            addRouterToken(tokens[i]);
        }
    }

    function addRouterToken(address token) public onlyOwner {
        if(isRouterToken(token) == false) {
            routerTokens.push(token);
        }
    }

    function removeRouterTokens(address[] memory tokens) public onlyOwner {
        for(uint i; i< tokens.length; i++) {
            removeRouterToken(tokens[i]);
        }
    }

    function removeRouterToken(address token) public onlyOwner {
        uint index = indexRouterToken(token);
        if(index == routerTokens.length) {
            return;
        }
        if(index < routerTokens.length -1) {
            routerTokens[index] = routerTokens[routerTokens.length-1];
        }
        routerTokens.pop();
    }

    function isRouterToken(address token) public view returns (bool) {
        for(uint i = 0;i < routerTokens.length;i++) {
            if(token == routerTokens[i]) {
                return true;
            }
        }
        return false;
    }
    
    function indexRouterToken(address token) public view returns (uint) {
        for(uint i; i< routerTokens.length; i++) {
            if(routerTokens[i] == token) {
                return i;
            }
        }
        return routerTokens.length;
    }

    function countRouterToken() public view returns (uint) {
        return routerTokens.length;
    }


    function getPair(address _token0, address _token1) public view returns (address) {
        return IDemaxFactory(factory).getPair(_token0, _token1);
    }

    function getSwapPairReserve(address _pair) public view returns (address token0, address token1, uint decimals0, uint decimals1, uint reserve0, uint reserve1, uint totalSupply) {
        totalSupply = IDemaxPair(_pair).totalSupply();
        token0 = IDemaxPair(_pair).token0();
        token1 = IDemaxPair(_pair).token1();
        decimals0 = IERC20(token0).decimals();
        decimals1 = IERC20(token1).decimals();
        (reserve0, reserve1, ) = IDemaxPair(_pair).getReserves();
    }

    function getSwapPairReserveByTokens(address _token0, address _token1) public view returns (address token0, address token1, uint decimals0, uint decimals1, uint reserve0, uint reserve1, uint totalSupply) {
        address _pair = getPair(_token0, _token1);
        totalSupply = IDemaxPair(_pair).totalSupply();
        token0 = IDemaxPair(_pair).token0();
        token1 = IDemaxPair(_pair).token1();
        decimals0 = IERC20(token0).decimals();
        decimals1 = IERC20(token1).decimals();
        (reserve0, reserve1, ) = IDemaxPair(_pair).getReserves();
    }

    // _tokenB is base token
    function getLpValueByFactory(address _factory, address _tokenA, address _tokenB, uint _amount) public view returns (uint, uint) {
        address pair = IDemaxFactory(_factory).getPair(_tokenA, _tokenB);
        if(pair == address(0)) {
            return (0, 0);
        }
        (, address token1, uint decimals0, uint decimals1, uint reserve0, uint reserve1, uint totalSupply) = getSwapPairReserve(pair);
        if(_amount == 0 || totalSupply == 0) {
            return (0, 0);
        }
        uint decimals = decimals0;
        uint total = reserve0 * 2;
        if(_tokenB == token1) {
            total = reserve1 * 2;
            decimals = decimals1;
        }
        return (_amount*total/totalSupply, decimals);
    }

    function getCurrentRate(address _tokenIn, uint256 _amount) public view returns (uint256) {
        address pair = IDemaxFactory(factory).getPair(_tokenIn, baseToken);
        if(pair == address(0)) {
            return 0;
        }
        (uint112 reserve0, uint112 reserve1, ) = IDemaxPair(pair).getReserves();
        if(reserve0 == 0 || reserve1 ==0) {
            return 0;
        }
        uint256 tokenInReserve = uint256(reserve0);
        uint256 tokenOutReserve = uint256(reserve1);
        uint256 tokenInDecimals = uint256(IERC20(_tokenIn).decimals());
        uint256 tokenOutDecimals = uint256(IERC20(baseToken).decimals());
        if(IDemaxPair(pair).token0() != _tokenIn) {
            tokenInDecimals = IERC20(baseToken).decimals();
            tokenOutDecimals = IERC20(_tokenIn).decimals();
            tokenInReserve = uint256(reserve1);
            tokenOutReserve = uint256(reserve0);
        }
        if(tokenInDecimals > tokenOutDecimals) {
            tokenOutReserve = tokenOutReserve * 10** (tokenInDecimals - tokenOutDecimals);
        } else if(tokenInDecimals < tokenOutDecimals) {
            tokenInReserve = tokenInReserve * 10** (tokenOutDecimals - tokenInDecimals);
        }

        return _amount * tokenOutReserve / tokenInReserve;
    }

    function getLpBaseTokenValue(address _pair) public view returns (address token0, address token1, uint decimals0, uint decimals1, uint reserve0, uint reserve1, uint totalSupply, uint tvl) {
        (token0, token1, decimals0, decimals1, reserve0, reserve1, totalSupply) = getSwapPairReserve(_pair);
        if(token0 == baseToken) {
            tvl = reserve0 * 2;
        } else if(token1 == baseToken) {
            tvl = reserve1 * 2;
        } else if (isRouterToken(token0)) {
            tvl = getCurrentRate(token0, reserve0*2);
        } else if (isRouterToken(token1)) {
            tvl = getCurrentRate(token1, reserve1*2);
        }
    }


    function getPairInfo(address _pair) public view returns (PairInfo memory info) {
        if(!IDemaxFactory(factory).isPair(_pair)) return info;
        info.pair = _pair;
        info.weight = IDemaxTransferListener(transferListener).pairWeights(_pair);
        info.token0 = IDemaxPair(_pair).token0();
        info.token1 = IDemaxPair(_pair).token1();
        (, , , , , , uint totalSupply, uint tvl) = getLpBaseTokenValue(_pair);
        info.token0Symbol = IERC20(info.token0).symbol();
        info.token1Symbol = IERC20(info.token1).symbol();
        info.totalSupply = totalSupply;
        info.tvl = tvl;
        return info;
    }
 
    function iteratePairInfoList(uint _start, uint _end) public view returns (PairInfo[] memory result){
        require(_start <= _end && _start >= 0 && _end >= 0, "INVAID_PARAMTERS");
        uint count = IDemaxFactory(factory).allPairsLength();
        if (_end > count) _end = count;
        count = _end - _start;
        result = new PairInfo[](count);
        if (count == 0) return result;
        uint index = 0;
        for(uint i = _start;i < _end;i++) {
            address _pool = IDemaxFactory(factory).allPairs(i);
            result[index] = getPairInfo(_pool);
            index++;
        }
        return result;
    }

}