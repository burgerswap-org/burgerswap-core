pragma solidity >=0.5.16;
import './modules/ERC20Token.sol';
import './modules/Ownable.sol';

contract BurgerMainToken is ERC20Token, Ownable {
    uint public maxSupply = 21000000 * 10 ** 18;

    event Minted(address indexed user, uint amount);

	constructor() public {
        name = 'Burger Token';
        symbol = 'BURGER';
        totalSupply = 10000000 * 10 ** 18;
        balanceOf[msg.sender] = totalSupply;
    }

    function mint(uint amount) external onlyOwner returns (uint) {
        require(amount > 0, 'Invalid amount');
        if(amount.add(totalSupply) > maxSupply) {
            amount = maxSupply.sub(totalSupply);
        }
        balanceOf[msg.sender] += amount;
        totalSupply += amount;
        emit Minted(msg.sender, amount);
        return amount;
    }

}
