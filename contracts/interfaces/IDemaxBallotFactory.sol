pragma solidity >=0.5.0;

interface IDemaxBallotFactory {
    function create(
        address _proposer,
        uint _value,
        uint _endBlockNumber,
        string calldata _subject,
        string calldata _content
    ) external returns (address);
}
