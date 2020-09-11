pragma solidity >=0.5.16;

import '../modules/ERC20Token.sol';

contract ERC20 is ERC20Token {
    constructor(uint _totalSupply, string memory _name, string memory _symbol) public {
        name = _name;
        symbol = _symbol;
        totalSupply = _totalSupply;
        balanceOf[msg.sender] = totalSupply;
    }
}
