pragma solidity >=0.5.16;

import './Governable.sol';


contract SwitchFeature is Governable {
    bool public enable = true;

    event Switched(bool _value);

    constructor() public {
    }

    function switchOn() external onlyGovernor returns (bool) {
        require(!enable, 'SWITCH_NOCHANGE');
        enable = true;
        emit Switched(enable);
        return true;
    }

    function switchOff() external onlyGovernor returns (bool) {
        require(enable, 'SWITCH_NOCHANGE');
        enable = false;
        emit Switched(enable);
        return true;
    }
}