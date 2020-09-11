pragma solidity >=0.6.6;
import '../libraries/SafeMath.sol';

contract BaseMintField {
    using SafeMath for uint;
    struct Productivity {
        uint product;           // user's productivity
        uint total;             // total productivity
        uint block;             // record's block number
        uint user;              // accumulated products
        uint global;            // global accumulated products
    }

    Productivity private global;
    mapping(address => Productivity)    public users;

    event AmountPerBlockChanged (uint oldValue, uint newValue);
    event ProductivityIncreased (address indexed user, uint value);
    event ProductivityDecreased (address indexed user, uint value);

    uint private unlocked = 1;

    modifier lock() {
        require(unlocked == 1, 'Locked');
        unlocked = 0;
        _;
        unlocked = 1;
    }


    // compute productivity returns total productivity of a user.
    function _computeProductivity(Productivity memory user) private view returns (uint) {
        uint blocks = block.number.sub(user.block);
        return user.product + user.total.mul(blocks);
    }

    // update users' productivity by value with boolean value indicating increase  or decrease.
    function _updateProductivity(Productivity storage user, uint value, bool increase) private {
        user.product      = _computeProductivity(user);
        global.product    = _computeProductivity(global);

        require(global.product <= uint(-1), 'BaseMintField: GLOBAL_PRODUCT_OVERFLOW');

        user.block      = block.number;
        global.block    = block.number;
        if(increase) {
            user.total   = user.total.add(value);
            global.total = global.total.add(value);
        }
        else {
            require(user.total >= value, 'BaseMintField: INVALID_DECREASE_USER_POWER');
            require(global.total >= value, 'BaseMintField: INVALID_DECREASE_GLOBAL_POWER');
            user.total   = user.total.sub(value);
            global.total = global.total.sub(value);
        }
    }

    function _increaseProductivity(address user, uint value) internal returns (bool) {
        require(value > 0, 'BaseMintField: PRODUCTIVITY_VALUE_MUST_BE_GREATER_THAN_ZERO');
        Productivity storage product        = users[user];
        _updateProductivity(product, value, true);
        emit ProductivityIncreased(user, value);
        return true;
    }


    function _decreaseProductivity(address user, uint value) internal returns (bool) {
        Productivity storage product = users[user];
        require(value > 0 && product.total >= value, 'BaseMintField: INSUFFICIENT_PRODUCTIVITY');
        _updateProductivity(product, value, false);
        emit ProductivityDecreased(user, value);
        return true;
    }
 
    function _updateProductValue() internal returns (bool) {
        Productivity storage product = users[msg.sender];
        
        product.user  = _computeProductivity(product);
        product.global = _computeProductivity(global);
        
        return true;
    }

    function _computeUserPercentage() internal view returns (uint numerator, uint denominator) {
        Productivity memory product    = users[msg.sender];
        
        uint userProduct     = _computeProductivity(product);
        uint globalProduct   = _computeProductivity(global);

        numerator          = userProduct.sub(product.user);
        denominator        = globalProduct.sub(product.global);
    }
    
}