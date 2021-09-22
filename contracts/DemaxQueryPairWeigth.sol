// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >= 0.5.1;
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
    function allPairsLength() external view returns(uint);
    function isPair(address _pair) external view returns(bool);
    function allPairs(uint _index) external view returns(address);
}

interface IDemaxPair {
    function token0() external view returns(address);
    function token1() external view returns(address);
}


interface IDemaxTransferListener {
    function pairWeights(address pair) external view returns(uint);
}

pragma experimental ABIEncoderV2;

contract DemaxQueryPairWeigth is Ownable {
    address public factory;
    address public transferListener;
    
    struct PairWeight {
        address pair;
        uint weight;
        address token0;
        address token1;
        string token0Symbol;
        string token1Symbol;
    }
    
    constructor() public {
    }
    
    function initialize(address _factory, address _transferListener) public onlyOwner {
        factory = _factory;
        transferListener = _transferListener;
    }


    function getPairWeight(address _pair) public view returns (PairWeight memory info) {
        if(!IDemaxFactory(factory).isPair(_pair)) return info;
        info.pair = _pair;
        info.weight = IDemaxTransferListener(transferListener).pairWeights(_pair);
        info.token0 = IDemaxPair(_pair).token0();
        info.token1 = IDemaxPair(_pair).token1();
        info.token0Symbol = IERC20(info.token0).symbol();
        info.token1Symbol = IERC20(info.token1).symbol();
        return info;
    }
 
    function iteratePairWeightList(uint _start, uint _end) public view returns (PairWeight[] memory result){
        require(_start <= _end && _start >= 0 && _end >= 0, "INVAID_PARAMTERS");
        uint count = IDemaxFactory(factory).allPairsLength();
        if (_end > count) _end = count;
        count = _end - _start;
        result = new PairWeight[](count);
        if (count == 0) return result;
        uint index = 0;
        for(uint i = _start;i < _end;i++) {
            address _pool = IDemaxFactory(factory).allPairs(i);
            result[index] = getPairWeight(_pool);
            index++;
        }
        return result;
    }

    
}