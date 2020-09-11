pragma solidity >=0.5.16;

import './Governable.sol';

/**
    Business Process
    step 1. publishToken
    step 2. addToken or removeToken
 */

contract TokenRegistry is Governable {
    mapping (address => uint) public tokenStatus;
    mapping (address => uint) public publishTime;
    uint public tokenCount;
    address[] public tokenList;
    uint public constant NONE = 0;
    uint public constant REGISTERED = 1;
    uint public constant PENDING = 2;
    uint public constant OPENED = 3;
    uint public constant CLOSED = 4;

    event TokenStatusChanged(address indexed _token, uint _status, uint _block);

    function registryToken(address _token) external onlyGovernor returns (bool) {
        return _updateToken(_token, REGISTERED);
    }

    function publishToken(address _token) external onlyGovernor returns (bool) {
        publishTime[_token] = block.number;
        return _updateToken(_token, PENDING);
    }

    function updateToken(address _token, uint _status) external onlyGovernor returns (bool) {
        return _updateToken(_token, _status);
    }

    function validTokens() external view returns (address[] memory) {
        uint count;
        for (uint i; i < tokenList.length; i++) {
            if (tokenStatus[tokenList[i]] == PENDING || tokenStatus[tokenList[i]] == OPENED) {
                count++;
            }
        }
        address[] memory res = new address[](count);
        uint index = 0;
        for (uint i; i < tokenList.length; i++) {
            if (tokenStatus[tokenList[i]] == PENDING || tokenStatus[tokenList[i]] == OPENED) {
                res[index] = tokenList[i];
                index++;
            }
        }
        return res;
    }

    function iterateValidTokens(uint _start, uint _end) external view returns (address[] memory) {
        require(_end <= tokenList.length, "TokenRegistry: OVERFLOW");
        require(_start <= _end && _start >= 0 && _end >= 0, "TokenRegistry: INVAID_PARAMTERS");
        uint count;
        for (uint i = _start; i < _end; i++) {
            if (tokenStatus[tokenList[i]] == PENDING || tokenStatus[tokenList[i]] == OPENED) {
                count++;
            }
        }
        address[] memory res = new address[](count);
        uint index = 0;
        for (uint i = _start; i < _end; i++) {
            if (tokenStatus[tokenList[i]] == PENDING || tokenStatus[tokenList[i]] == OPENED) {
                res[index] = tokenList[i];
                index++;
            }
        }
        return res;
    }

    function _updateToken(address _token, uint _status) internal returns (bool) {
        require(_token != address(0), 'TokenRegistry: INVALID_TOKEN');
        require(tokenStatus[_token] != _status, 'TokenRegistry: TOKEN_STATUS_NO_CHANGE');
        if (tokenStatus[_token] == NONE) {
            tokenCount++;
            require(tokenCount <= uint(-1), 'TokenRegistry: OVERFLOW');
            tokenList.push(_token);
        }
        tokenStatus[_token] = _status;
        emit TokenStatusChanged(_token, _status, block.number);
        return true;
    }

}