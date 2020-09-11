pragma solidity >=0.5.16;
import './Ownable.sol';
contract Controller is  Ownable{
    address public controller;

    event ControllerChanged(address indexed _oldController, address indexed _newController);
  
    modifier onlyController {
        require(msg.sender == controller, "controller : no permission");
        _;
    }
    
    function setController (address _controller) onlyOwner  public {
        require(_controller != address(0), 'controller : INVALID_ADDRESS');
        emit ControllerChanged(controller, _controller);
        controller = _controller;
      
    }
}
