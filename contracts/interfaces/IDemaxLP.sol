pragma solidity >=0.6.6;

interface IDemaxLP {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);

    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
    function queryReward() external view returns (uint);
    function mintReward() external returns (uint amount);
}