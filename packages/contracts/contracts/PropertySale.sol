// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISecurityToken {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IIdentityRegistry {
    function isVerified(address user) external view returns (bool);
}

/**
 * @title PropertySale
 * @dev Primary market: investor pays native ETH → receives official ERC-3643 security tokens.
 */
contract PropertySale is Ownable, ReentrancyGuard {
    ISecurityToken public immutable securityToken;
    IIdentityRegistry public immutable identityRegistry;
    address public treasury;

    /// @dev Wei per 1 full token (1e18 base units)
    uint256 public tokenPriceWei;
    uint256 public tokensAvailable;

    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 ethPaid);
    event InventoryDeposited(uint256 amount);
    event TokenPriceUpdated(uint256 newPrice);

    constructor(
        address securityToken_,
        address identityRegistry_,
        address treasury_,
        uint256 tokenPriceWei_
    ) Ownable(msg.sender) {
        securityToken = ISecurityToken(securityToken_);
        identityRegistry = IIdentityRegistry(identityRegistry_);
        treasury = treasury_;
        tokenPriceWei = tokenPriceWei_;
    }

    function depositTokens(uint256 amount) external onlyOwner {
        require(securityToken.transferFrom(msg.sender, address(this), amount), "PS: deposit failed");
        tokensAvailable += amount;
        emit InventoryDeposited(amount);
    }

    function buy(uint256 tokenAmount) external payable nonReentrant {
        require(tokenAmount > 0, "PS: zero amount");
        require(tokensAvailable >= tokenAmount, "PS: insufficient inventory");
        require(identityRegistry.isVerified(msg.sender), "PS: KYC required");

        uint256 ethCost = (tokenAmount * tokenPriceWei) / 1e18;
        require(ethCost > 0, "PS: below minimum");
        require(msg.value == ethCost, "PS: incorrect ETH sent");

        tokensAvailable -= tokenAmount;
        require(securityToken.transfer(msg.sender, tokenAmount), "PS: token transfer failed");

        (bool sent, ) = treasury.call{value: ethCost}("");
        require(sent, "PS: treasury transfer failed");

        emit TokensPurchased(msg.sender, tokenAmount, ethCost);
    }

    function setTokenPrice(uint256 newPrice) external onlyOwner {
        tokenPriceWei = newPrice;
        emit TokenPriceUpdated(newPrice);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        treasury = newTreasury;
    }
}
