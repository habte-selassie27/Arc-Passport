// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/IAttestationRegistry.sol";
import "./interfaces/ISchemaRegistry.sol";
import "./errors/ArcPassErrors.sol";

/// @title AttestationRegistry
/// @notice Core credential store for ArcPass. Manages issuance, revocation, and lifecycle
///         of onchain attestation claims. Uses UUPS upgradeable pattern.
///
/// @dev    GDPR-compliant architecture: raw PII is stored off-chain (encrypted on IPFS).
///         Only keccak256 commitments (Merkle roots) are stored onchain. When a subject
///         exercises right-to-erasure, off-chain data is deleted and the onchain commitment
///         becomes an orphaned hash that cannot be verified — satisfying Article 17.
///
/// @custom:storage-layout V1
///   Slot 0-49:  AccessControlUpgradeable inherited storage
///   Slot 50:    schemaRegistry (ISchemaRegistry)              ← __gap[0] consumed
///   Slot 51:    _claimNonce (uint256)                          ← __gap[1] consumed
///   Slot 52:    _issuerList.length (uint256, implicit from dynamic array header)
///   Slot 53:    _issuerList[0..N] (dynamic array elements)
///   Slot 54:    _isIssuer mapping root
///   Slot 55-56: mappings (_claims, _activeClaim) have no physical slots
///   Slots 57-102: __gap[46]
contract AttestationRegistry is
    IAttestationRegistry,
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant ISSUER_ROLE  = keccak256("ISSUER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    ISchemaRegistry public schemaRegistry;

    mapping(bytes32 => Claim) private _claims;
    mapping(address => mapping(bytes32 => mapping(address => bytes32))) private _activeClaim;
    uint256 private _claimNonce;

    address[] private _issuerList;
    mapping(address => bool) private _isIssuer;

    uint256[46] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /// @notice Initialize the upgradeable contract. Called once via proxy.
    /// @param  multisig          Address of the protocol admin multisig.
    /// @param  _schemaRegistry   Address of the SchemaRegistry contract.
    function initialize(address multisig, address _schemaRegistry) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, multisig);
        _grantRole(UPGRADER_ROLE,      multisig);
        _grantRole(PAUSER_ROLE,        multisig);

        schemaRegistry = ISchemaRegistry(_schemaRegistry);
    }

    /// @notice Returns the contract version for upgrade tracking.
    function version() public pure virtual returns (string memory) {
        return "1.0.0";
    }

    /// @inheritdoc IAttestationRegistry
    function attest(
        address   subject,
        bytes32   schemaId,
        bytes32   dataCommitment,
        uint256   expiresAt
    ) external onlyRole(ISSUER_ROLE) nonReentrant whenNotPaused returns (bytes32 claimId) {
        if (subject == address(0)) revert ArcPass__InvalidSubject();
        if (dataCommitment == bytes32(0)) revert ArcPass__EmptyData();
        if (!schemaRegistry.isRegistered(schemaId)) revert ArcPass__InvalidSchemaId();
        if (expiresAt != 0 && expiresAt <= block.timestamp) revert ArcPass__InvalidExpiry();

        bytes32 existing = _activeClaim[subject][schemaId][msg.sender];
        if (existing != bytes32(0)) {
            Claim storage c = _claims[existing];
            if (!c.revoked && (c.expiresAt == 0 || block.timestamp < c.expiresAt)) {
                revert ArcPass__ActiveClaimExists(subject, schemaId, msg.sender);
            }
        }

        claimId = keccak256(abi.encode(subject, schemaId, msg.sender, block.timestamp, _claimNonce++));

        _claims[claimId] = Claim({
            claimId:        claimId,
            subject:        subject,
            schemaId:       schemaId,
            issuer:         msg.sender,
            dataCommitment: dataCommitment,
            issuedAt:       block.timestamp,
            expiresAt:      expiresAt,
            revoked:        false
        });

        _activeClaim[subject][schemaId][msg.sender] = claimId;

        emit ClaimIssued(claimId, subject, msg.sender, schemaId);
    }

    /// @inheritdoc IAttestationRegistry
    function revoke(bytes32 claimId) external onlyRole(REVOKER_ROLE) nonReentrant whenNotPaused {
        Claim storage c = _claims[claimId];
        if (c.claimId == bytes32(0)) revert ArcPass__ClaimNotFound(claimId);
        if (c.revoked) revert ArcPass__ClaimAlreadyRevoked(claimId);

        c.revoked = true;

        emit ClaimRevoked(claimId, msg.sender, block.timestamp);
    }

    /// @inheritdoc IAttestationRegistry
    function getClaim(bytes32 claimId) external view returns (Claim memory) {
        if (_claims[claimId].claimId == bytes32(0)) revert ArcPass__ClaimNotFound(claimId);
        return _claims[claimId];
    }

    /// @inheritdoc IAttestationRegistry
    function isValid(bytes32 claimId) public view returns (bool) {
        Claim memory c = _claims[claimId];
        if (c.claimId == bytes32(0)) return false;
        if (c.revoked) return false;
        if (c.expiresAt != 0 && block.timestamp >= c.expiresAt) return false;
        return true;
    }

    /// @inheritdoc IAttestationRegistry
    function getActiveClaim(
        address subject,
        bytes32 schemaId,
        address issuer
    ) external view returns (bytes32) {
        return _activeClaim[subject][schemaId][issuer];
    }

    /// @inheritdoc IAttestationRegistry
    function getIssuers() external view returns (address[] memory) {
        return _issuerList;
    }

    /// @inheritdoc AccessControlUpgradeable
    function hasRole(bytes32 role, address account)
        public view virtual override(IAttestationRegistry, AccessControlUpgradeable) returns (bool)
    {
        return super.hasRole(role, account);
    }

    /// @inheritdoc IAttestationRegistry
    function getIssuersCount() external view returns (uint256) {
        return _issuerList.length;
    }

    /// @notice Pause all state-mutating functions. Only callable by PAUSER_ROLE.
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }

    /// @notice Unpause the contract. Only callable by PAUSER_ROLE.
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImpl) internal override onlyRole(UPGRADER_ROLE) {}

    /// @notice Hook into AccessControl's _grantRole to maintain the issuer list.
    /// @return bool True if the role was newly granted.
    function _grantRole(bytes32 role, address account) internal override returns (bool) {
        bool newly = super._grantRole(role, account);
        if (role == ISSUER_ROLE && newly && !_isIssuer[account]) {
            _isIssuer[account] = true;
            _issuerList.push(account);
        }
        return newly;
    }

    /// @notice Hook into AccessControl's _revokeRole to maintain the issuer list.
    /// @return bool True if the role was revoked.
    function _revokeRole(bytes32 role, address account) internal override returns (bool) {
        bool removed = super._revokeRole(role, account);
        if (role == ISSUER_ROLE && removed && _isIssuer[account]) {
            _isIssuer[account] = false;
            uint256 len = _issuerList.length;
            for (uint256 i = 0; i < len; i++) {
                if (_issuerList[i] == account) {
                    _issuerList[i] = _issuerList[len - 1];
                    _issuerList.pop();
                    break;
                }
            }
        }
        return removed;
    }
}
