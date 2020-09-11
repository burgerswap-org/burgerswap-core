pragma solidity >=0.5.0;

interface IDemaxGovernance {
    function addPair(address _tokenA, address _tokenB) external returns (bool);
    function addReward(uint _value) external returns (bool);
}

