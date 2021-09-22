pragma solidity >=0.6.6;

contract DemaxProjectConfig {
    address public owner;
    address public dev;
    address public admin;

    constructor() public {
        owner = msg.sender;
        dev = msg.sender;
        admin = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, 'IFOConfig: Only Owner');
        _;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin || msg.sender == owner, "IFOConfig: FORBIDDEN");
        _;
    }
    
    modifier onlyDev() {
        require(msg.sender == dev || msg.sender == owner, "IFOConfig: FORBIDDEN");
        _;
    }

    function changeOwner(address _user) external onlyOwner {
        require(owner != _user, 'IFOConfig: NO CHANGE');
        owner = _user;
    }

    function changeDev(address _user) external onlyDev {
        require(dev != _user, 'IFOConfig: NO CHANGE');
        dev = _user;
    }

    function changeAdmin(address _user) external onlyAdmin {
        require(admin != _user, 'IFOConfig: NO CHANGE');
        admin = _user;
    }
}