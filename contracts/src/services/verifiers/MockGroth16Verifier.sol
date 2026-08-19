// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockGroth16Verifier
/// @notice Test-only Groth16 verifier that returns true if proof starts with 0xab,
///         false otherwise. Used in Foundry tests to exercise ZKVerifier without
///         a real ZK circuit.
contract MockGroth16Verifier {
    bool public shouldPass;

    constructor(bool _shouldPass) {
        shouldPass = _shouldPass;
    }

    function setShouldPass(bool _val) external {
        shouldPass = _val;
    }

    /// @notice Mock Groth16 proof verification.
    function verifyProof(
        bytes calldata,
        uint256[] calldata
    ) external view returns (bool) {
        return shouldPass;
    }
}
