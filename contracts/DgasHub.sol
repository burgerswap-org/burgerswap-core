// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0;

import './modules/Initializable.sol';
import './libraries/SafeMath.sol';
import "./interfaces/IERC2917.sol";
import './modules/Configable.sol';

contract  DgasHub is Configable, Initializable {
    using SafeMath for uint;
    address public team;
    IERC2917 public dgas;
    uint public teamRate;
    mapping (address => uint) public funds;

    event TeamChanged(address indexed _user, address indexed _old, address indexed _new);
    event TeamRateChanged(address indexed _user, uint indexed _old, uint indexed _new);
    event FundChanged(address indexed _user, uint indexed _old, uint indexed _new);

    modifier onlyTeam() {
        require(msg.sender == team || msg.sender == owner, "forbidden");
        _;
    }
    
    modifier onlyOwnerAndAdmin() {
        require(msg.sender == admin() || msg.sender == owner, "forbidden");
        _;
    }

    function initialize(address _dgas) external initializer {
        owner = msg.sender;
        team = msg.sender;
        dgas = IERC2917(_dgas);
    }

    function changeDgas(address _dgas) external onlyDev {
        dgas = IERC2917(_dgas);
    }
    
    function changeTeam(address _user) external onlyTeam {
        require(team != _user, 'no change');
        emit TeamChanged(msg.sender, team, _user);
        team = _user;
    }

    function changeTeamRate(uint _teamRate) external onlyOwnerAndAdmin {
        require(teamRate != _teamRate, 'no change');
        emit TeamRateChanged(msg.sender, teamRate, _teamRate);
        teamRate = _teamRate;
    }

    function increaseFund (address _user, uint _value) public onlyOwnerAndAdmin {
        require(_value > 0, 'zero');
        uint _old = funds[_user];
        funds[_user] = _old.add(_value);
        emit FundChanged(msg.sender, _old, funds[_user]);
    }

    function decreaseFund (address _user, uint _value) public onlyOwnerAndAdmin {
        uint _old = funds[_user];
        require(_value > 0, 'zero');
        require(_old >= _value, 'insufficient');
        funds[_user] = _old.sub(_value);
        emit FundChanged(msg.sender, _old, funds[_user]);
    }
    
    function increaseFunds (address[] calldata _users, uint[] calldata _values) external onlyOwnerAndAdmin {
        require(_users.length == _values.length, 'invalid parameters');
        for (uint i=0; i<_users.length; i++){
            increaseFund(_users[i], _values[i]);
        }
    }
    
    function decreaseFunds (address[] calldata _users, uint[] calldata _values) external onlyOwnerAndAdmin {
        require(_users.length == _values.length, 'invalid parameters');
        for (uint i=0; i<_users.length; i++){
            decreaseFund(_users[i], _values[i]);
        }
    }

    function upgradeImpl(address _newImpl) external onlyDev {
        dgas.upgradeImpl(_newImpl);
    }

    function upgradeGovernance(address _newGovernor) external onlyDev {
        dgas.upgradeGovernance(_newGovernor);
    }

    function changeInterestRatePerBlock(uint value) external onlyOwnerAndAdmin returns (bool) {
        return dgas.changeInterestRatePerBlock(value);
    }

    function increaseProductivity(address user, uint value) public returns (bool) {
        if(msg.sender == dev() || msg.sender == owner) {
            return dgas.increaseProductivity(user, value);
        }
        return false;
    }

    function decreaseProductivity(address user, uint value) public returns (bool) {
        if(msg.sender == dev() || msg.sender == owner) {
            return dgas.decreaseProductivity(user, value);
        }
        return false;
    }

    function increaseProductivities(address[] calldata _users, uint[] calldata _values) external onlyDev {
        require(_users.length == _values.length, 'invalid parameters');
        for (uint i=0; i<_users.length; i++){
            increaseProductivity(_users[i], _values[i]);
        }
    }

    function decreaseProductivities(address[] calldata _users, uint[] calldata _values) external onlyDev {
        require(_users.length == _values.length, 'invalid parameters');
        for (uint i=0; i<_users.length; i++){
            decreaseProductivity(_users[i], _values[i]);
        }
    }

    function getProductivity(address user) external view returns (uint, uint) {
        return dgas.getProductivity(user);
    }

    function mintDgas() external onlyManager returns (uint) {
        if(dgas.takeWithAddress(address(this)) > 0) {
            return dgas.mint();
        }
        return 0;
    }

    function take() public view returns (uint) {
        uint amount = funds[msg.sender];
        uint balance = dgas.balanceOf(address(this));
        if(amount > balance) {
            amount = balance;
        }
        return amount;
    }

    function _mint(address to, uint value) internal returns (bool) {
        if(value > dgas.balanceOf(address(this))) {
            dgas.mint();
        }
        require(dgas.balanceOf(address(this)) >= value, "mint insufficient");
        return dgas.transfer(to, value);
    }

    function mint(address to, uint value) external returns (bool) {
        require(take() >= value && funds[msg.sender] >= value, "fund insufficient");
        funds[msg.sender] = funds[msg.sender].sub(value);
        _mint(to, value);

        if(value > 0 && teamRate > 0 && team != to) {
            uint reward = value.div(teamRate);
            _mint(team, reward);
        }
        return true;
    }

    function name() external view returns (string memory) {
        return dgas.name();
    }

    function symbol() external view returns (string memory) {
        return dgas.symbol();
    }

    function decimals() external view returns (uint8) {
        return dgas.decimals();
    }

    function totalSupply() external view returns (uint) {
        return dgas.totalSupply();
    }

    function balanceOf(address user) external view returns (uint) {
        return dgas.balanceOf(user);
    }

    function allowance(address owner, address spender) external view returns (uint) {
        return dgas.allowance(owner, spender);
    }
}
