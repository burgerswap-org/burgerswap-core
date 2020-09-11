pragma solidity >=0.6.6;

import '../DemaxConfig.sol';

contract DemaxConfigTest is DemaxConfig {
    
    function changeConfigValueNoCheck(bytes32 _name, uint _value) external returns (bool) {
        Config storage config = configs[_name];
        require(config.enable == 1, "demax config: disable");
        uint old = config.value;
        config.value = _value;
        emit ConfigValueChanged(_name, old, _value);
        return true;
    }

    function changeTokenStatus(address _token, uint _status) external returns (bool) {
        return _updateToken(_token, _status);
    }

}