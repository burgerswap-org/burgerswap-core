pragma solidity >=0.6.6;

import '../DemaxGovernance.sol';

contract DemaxGovernanceTest is DemaxGovernance {

    constructor (address _dgas) DemaxGovernance(_dgas) public {
    }
    
    function changeLockTime(uint _value) external returns (bool) {
        lockTime = _value;
    }

}