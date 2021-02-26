pragma solidity >=0.5.1;

interface IDemaxBallot {
    function proposer() external view returns(address);
    function endBlockNumber() external view returns(uint);
    function value() external view returns(uint);
    function result() external view returns(bool);
    function end() external returns (bool);
    function total() external view returns(uint);
    function weight(address user) external view returns (uint);
}
