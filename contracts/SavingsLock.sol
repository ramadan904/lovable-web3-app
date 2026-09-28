// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title SavingsLock
/// @notice An ETH piggy bank that nobody - not even its owner - can open before `unlockTime`.
///         Anyone may deposit; only the owner may withdraw, and only after the unlock time.
contract SavingsLock {
    address public immutable owner;
    uint256 public immutable unlockTime;

    /// @dev Guards against typos that would lock funds for decades.
    uint256 public constant MAX_LOCK = 5 * 365 days;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    error UnlockTimeInvalid();
    error NotOwner();
    error StillLocked(uint256 unlockTime);
    error TransferFailed();

    constructor(uint256 _unlockTime) payable {
        if (_unlockTime <= block.timestamp || _unlockTime > block.timestamp + MAX_LOCK) revert UnlockTimeInvalid();
        owner = msg.sender;
        unlockTime = _unlockTime;
        if (msg.value > 0) emit Deposited(msg.sender, msg.value);
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Sends the whole balance to the owner once the lock has expired.
    function withdraw() external {
        if (msg.sender != owner) revert NotOwner();
        if (block.timestamp < unlockTime) revert StillLocked(unlockTime);
        uint256 amount = address(this).balance;
        emit Withdrawn(owner, amount);
        (bool ok, ) = owner.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
