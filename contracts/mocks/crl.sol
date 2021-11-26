// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract CRL is ERC20Burnable {

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {

    }

    function mint(address who, uint256 amount) external {
        _mint(who, amount);
    }

    function decimals() public view override returns (uint8) {
        return 9;
    }

}
