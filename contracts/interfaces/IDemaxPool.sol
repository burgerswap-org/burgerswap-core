pragma solidity >=0.5.0;

interface IDemaxPool {
    function addRewardFromPlatform(address _pair, uint _amount) external;
    function preProductivityChanged(address _pair, address _user) external;
    function postProductivityChanged(address _pair, address _user) external;
}