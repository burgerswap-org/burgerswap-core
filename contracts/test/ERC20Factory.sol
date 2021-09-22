pragma solidity >=0.5.16;

import './ERC20ForFactory.sol';

contract ERC20Factory {
    address public owner;
    address[] public allTokens;

    event TokenCreated(address indexed token);

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 'ERC20Factory: Only Owner');
        _;
    }

    function changeOwner(address _user) external onlyOwner {
        require(owner != _user, 'ERC20Factory: NO CHANGE');
        owner = _user;
    }

    function createToken(address _to, uint _totalSupply, uint8 _decimals, string memory _name, string memory _symbol) public returns (address token) {
        bytes memory bytecode = type(ERC20ForFactory).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_symbol, block.number));
        assembly {
            token := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        ERC20ForFactory(token).initialize(_to, _totalSupply, _decimals, _name, _symbol);
        allTokens.push(token);
        emit TokenCreated(token);
    }
    
    function allTokensLength() external view returns (uint) {
        return allTokens.length;
    }
}
