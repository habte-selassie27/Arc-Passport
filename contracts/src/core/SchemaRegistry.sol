// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./interfaces/ISchemaRegistry.sol";
import "./errors/ArcPassErrors.sol";

/// @title SchemaRegistry
/// @notice Stores claim schema definitions for ArcPass. Schemas are identified by
///         a deterministic bytes32 schemaId and are immutable once registered.
///
/// @dev    Any address may register a schema. Schemas cannot be updated — a new version
///         requires registering a new schema with a different version string.
///
/// @custom:storage-layout V1
///   Slot 0-49:  AccessControlUpgradeable inherited storage
///   Slot 50:    _schemas mapping root
///   Slot 51:    _registered mapping root
///   Slot 52:    _schemaList.length (dynamic array header)
///   Slot 53:    _schemaList[0..N] (dynamic array elements)
///   Slots 54-101: __gap[48]
contract SchemaRegistry is
    ISchemaRegistry,
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    UUPSUpgradeable
{
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    mapping(bytes32 => Schema) private _schemas;
    mapping(bytes32 => bool)    private _registered;
    bytes32[] private _schemaList;

    uint256[48] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    /// @notice Initialize the upgradeable contract. Called once via proxy.
    /// @param  multisig  Address of the protocol admin multisig.
    function initialize(address multisig) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, multisig);
        _grantRole(UPGRADER_ROLE,      multisig);
        _grantRole(PAUSER_ROLE,        multisig);
    }

    /// @notice Returns the contract version for upgrade tracking.
    function version() public pure virtual returns (string memory) {
        return "1.0.0";
    }

    /// @inheritdoc ISchemaRegistry
    function registerSchema(
        string calldata name,
        string calldata version_,
        string calldata fieldsJson
    ) external nonReentrant whenNotPaused returns (bytes32 schemaId) {
        if (bytes(name).length == 0) revert ArcPass__EmptySchemaName();
        if (bytes(version_).length == 0) revert ArcPass__EmptyVersion();
        if (bytes(fieldsJson).length == 0) revert ArcPass__EmptyFieldsJson();

        schemaId = keccak256(abi.encodePacked(name, version_, fieldsJson));
        if (_registered[schemaId]) revert ArcPass__SchemaAlreadyExists(schemaId);

        _registered[schemaId] = true;
        _schemas[schemaId] = Schema({
            schemaId:     schemaId,
            name:         name,
            version:      version_,
            fieldsJson:   fieldsJson,
            registrant:   msg.sender,
            registeredAt: block.timestamp
        });
        _schemaList.push(schemaId);

        emit SchemaRegistered(schemaId, msg.sender, name, version_);
    }

    /// @inheritdoc ISchemaRegistry
    function getSchema(bytes32 schemaId) external view returns (Schema memory) {
        if (!_registered[schemaId]) revert ArcPass__SchemaNotFound(schemaId);
        return _schemas[schemaId];
    }

    /// @inheritdoc ISchemaRegistry
    function isRegistered(bytes32 schemaId) external view returns (bool) {
        return _registered[schemaId];
    }

    /// @inheritdoc ISchemaRegistry
    function getSchemaCount() external view returns (uint256) {
        return _schemaList.length;
    }

    /// @inheritdoc ISchemaRegistry
    function getSchemas(uint256 offset, uint256 limit) external view returns (bytes32[] memory result) {
        uint256 len = _schemaList.length;
        if (offset >= len) return new bytes32[](0);
        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 count = end - offset;
        result = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = _schemaList[offset + i];
        }
    }

    /// @notice Pause schema registration. Only callable by PAUSER_ROLE.
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }

    /// @notice Unpause schema registration. Only callable by PAUSER_ROLE.
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    /// @inheritdoc UUPSUpgradeable
    function _authorizeUpgrade(address newImpl) internal override onlyRole(UPGRADER_ROLE) {}
}
