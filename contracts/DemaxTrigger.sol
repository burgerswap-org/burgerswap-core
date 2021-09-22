// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >= 0.5.1;

import './modules/Ownable.sol';

contract DemaxTrigger is Ownable {

    mapping(address => bool) whiteList;
    event Trigger(address indexed user, uint indexed signal);

    constructor() public {
        whiteList[msg.sender] = true;
    }

    function setWhite(address _user, bool _value) public onlyOwner {
        whiteList[_user] = _value;
    }

    function trigger(uint _signal) public {
        require(whiteList[msg.sender], "FORBIDDEN");
        emit Trigger(msg.sender, _signal);
    }
}