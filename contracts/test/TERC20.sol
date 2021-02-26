pragma solidity >=0.5.16;

import '../modules/ERC20Token.sol';

contract TERC20 is ERC20Token {
    constructor(uint _totalSupply, uint8 _decimals, string memory _name, string memory _symbol) public {
        name = _name;
        symbol = _symbol;
        totalSupply = _totalSupply;
        decimals = _decimals;
        balanceOf[msg.sender] = totalSupply;
    }
}
