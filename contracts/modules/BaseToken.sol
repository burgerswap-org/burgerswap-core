pragma solidity >=0.5.16;

contract BaseToken {
    address public baseToken;

    // called after deployment
    function initBaseToken(address _baseToken) internal {
        require(baseToken == address(0), 'INITIALIZED');
        require(_baseToken != address(0), 'ADDRESS_IS_ZERO');
        baseToken = _baseToken;  // it should be dgas token address
    }
}