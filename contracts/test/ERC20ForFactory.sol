pragma solidity >=0.5.16;

import '../modules/ERC20Token.sol';

contract ERC20ForFactory is ERC20Token {
    address public owner;
    bool private initialized;
    constructor() public {
        owner = msg.sender;
    }

    function initialize(address _to, uint _totalSupply, uint8 _decimals, string memory _name, string memory _symbol) public {
        require(!initialized, 'initialized');
        owner = _to;
        initialized = true;
        name = _name;
        symbol = _symbol;
        totalSupply = _totalSupply;
        decimals = _decimals;
        balanceOf[_to] = totalSupply;
    }
}
