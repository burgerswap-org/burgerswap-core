pragma solidity >=0.6.6;

import "./DemaxBallot.sol";

contract DemaxBallotFactory {

    event Created(address indexed proposer, address indexed ballotAddr, uint createTime);

    constructor () public {
    }

    function create(address _proposer, uint _value, uint _endBlockNumber, string calldata _subject, string calldata _content) external returns (address) {
        require(_value >= 0, 'DemaxBallotFactory: INVALID_PARAMTERS');
        address ballotAddr = address(
            new DemaxBallot(_proposer, _value, _endBlockNumber, msg.sender, _subject, _content)
        );
        emit Created(_proposer, ballotAddr, block.timestamp);
        return ballotAddr;
    }
}