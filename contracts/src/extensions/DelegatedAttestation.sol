// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../core/interfaces/IAttestationRegistry.sol";
import "../core/errors/ArcPassErrors.sol";

/// @title DelegatedAttestation
/// @notice Enables an issuer to delegate attestation authority to another address.
///         The delegate can issue claims on the issuer's behalf using an ECDSA signature
///         from the issuer authorizing the specific claim parameters.
///
/// @dev    Each delegation is schema-specific and single-use. The issuer must hold ISSUER_ROLE
///         on the AttestationRegistry for the delegated claim to succeed.
contract DelegatedAttestation {

    IAttestationRegistry public registry;

    struct Delegation {
        address delegate;
        bytes32 schemaId;
        uint256 expiresAt;
        bool    used;
    }

    mapping(address => mapping(bytes32 => Delegation)) private _delegations;

    event DelegationSet(address indexed issuer, address indexed delegate, bytes32 indexed schemaId, uint256 expiresAt);
    event DelegationRevoked(address indexed issuer, address indexed delegate, bytes32 indexed schemaId);
    event DelegatedClaimIssued(bytes32 indexed claimId, address indexed issuer, address indexed delegate, address subject);

    /// @notice Construct the delegator with the AttestationRegistry address.
    /// @param  _registry  The AttestationRegistry address.
    constructor(address _registry) {
        if (_registry == address(0)) revert ArcPass__ZeroAddress();
        registry = IAttestationRegistry(_registry);
    }

    /// @notice Authorize a delegate to issue claims for a specific schema.
    /// @param  delegate    The address authorized to issue claims.
    /// @param  schemaId    The schema the delegate may use (bytes32(0) = any schema).
    /// @param  expiration  Unix timestamp when the delegation expires (0 = never).
    function setDelegate(address delegate, bytes32 schemaId, uint256 expiration) external {
        if (delegate == address(0)) revert ArcPass__ZeroAddress();
        bytes32 key = keccak256(abi.encode(delegate, schemaId));
        _delegations[msg.sender][key] = Delegation({
            delegate: delegate,
            schemaId: schemaId,
            expiresAt: expiration,
            used: false
        });
        emit DelegationSet(msg.sender, delegate, schemaId, expiration);
    }

    /// @notice Revoke a previously set delegation.
    /// @param  delegate   The delegate address.
    /// @param  schemaId   The schema the delegation was for.
    function revokeDelegate(address delegate, bytes32 schemaId) external {
        bytes32 key = keccak256(abi.encode(delegate, schemaId));
        delete _delegations[msg.sender][key];
        emit DelegationRevoked(msg.sender, delegate, schemaId);
    }

    /// @notice Issue a claim as a delegate. Requires a valid EIP-191 signature from the issuer.
    /// @param  subject        The address the claim is about.
    /// @param  schemaId       The schema to issue under.
    /// @param  dataCommitment Merkle root of the claim fields.
    /// @param  expiresAt      Claim expiry timestamp.
    /// @param  issuer         The original issuer whose delegation is being used.
    /// @param  signature      EIP-191 signature from issuer authorizing this specific claim.
    /// @return claimId        The issued claim ID.
    function delegatedAttest(
        address subject,
        bytes32 schemaId,
        bytes32 dataCommitment,
        uint256 expiresAt,
        address issuer,
        bytes calldata signature
    ) external returns (bytes32 claimId) {
        {
            bytes32 key = keccak256(abi.encode(msg.sender, schemaId));
            Delegation storage del = _delegations[issuer][key];

            if (del.delegate != msg.sender && schemaId != bytes32(0)) {
                bytes32 anyKey = keccak256(abi.encode(msg.sender, bytes32(0)));
                del = _delegations[issuer][anyKey];
            }

            if (del.delegate != msg.sender) revert ArcPass__NotDelegatedSigner();
            if (del.expiresAt != 0 && block.timestamp >= del.expiresAt) revert ArcPass__DelegationExpired();
            if (del.used) revert ArcPass__DelegationExpired();

            bytes32 message = keccak256(abi.encode(subject, schemaId, dataCommitment, expiresAt, block.chainid));
            bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(message);
            if (ECDSA.recover(ethHash, signature) != msg.sender)
                revert ArcPass__InvalidSignature();

            del.used = true;
        }

        claimId = registry.attest(subject, schemaId, dataCommitment, expiresAt);
        emit DelegatedClaimIssued(claimId, issuer, msg.sender, subject);
    }

    /// @notice Get delegation details.
    /// @param  issuer    The issuer address.
    /// @param  delegate  The delegate address.
    /// @param  schemaId  The schema ID.
    /// @return Delegation struct.
    function getDelegation(address issuer, address delegate, bytes32 schemaId)
        external view returns (Delegation memory)
    {
        bytes32 key = keccak256(abi.encode(delegate, schemaId));
        return _delegations[issuer][key];
    }
}
