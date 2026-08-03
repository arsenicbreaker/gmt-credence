// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Credence — gas-efficient verifiable credentials on BOT Chain.
 *
 * Flow:
 *   1. Organizer  createEvent        (pays gas)
 *   2. Attendee   attend             (pays small gas — 1 mapping write)
 *   3. Organizer  issueCredential    (pays gas — only if recipient attended)
 *   4. Anyone     verifyCredential   (view, free)
 *
 * Gas design choices:
 *   - Custom errors (no expensive revert strings)
 *   - calldata for string inputs
 *   - Packed Event / Credential structs
 *   - Single status mapping (attended / issued) instead of two bool maps + arrays
 *   - No attendee/credential index arrays (array push is costly)
 *   - No redundant id fields (use array index)
 *   - Lean events (indexed ids/addresses only)
 */
contract Credence {
    // ── Custom errors (cheaper than require("string")) ──────────────────────
    error EventMissing();
    error NotOrganizer();
    error EventInactive();
    error OrganizerCannotAttend();
    error AlreadyAttended();
    error NotAttended();
    error AlreadyIssued();
    error BadRecipient();
    error CredentialMissing();

    // status: 0 = none, 1 = attended, 2 = issued
    uint8 private constant STATUS_NONE = 0;
    uint8 private constant STATUS_ATTENDED = 1;
    uint8 private constant STATUS_ISSUED = 2;

    /**
     * Packed: organizer (20) + date (8) + isActive (1) share slot 0.
     * name / metadata each use dynamic slots (unavoidable for strings).
     * No `id` field — use the array index.
     */
    struct Event {
        address organizer;
        uint64 date;
        bool isActive;
        string name;
        string metadata;
    }

    /**
     * Packed into two slots:
     *   slot0: recipient (20) + eventId (8) + 4 bytes free
     *   slot1: issuedAt (8)
     * No `id` / `isValid` — id is array index; all stored creds are valid.
     */
    struct Credential {
        address recipient;
        uint64 eventId;
        uint64 issuedAt;
    }

    Event[] public events;
    Credential[] public credentials;

    /// eventId => wallet => STATUS_*
    mapping(uint256 => mapping(address => uint8)) public status;

    event EventCreated(uint256 indexed eventId, address indexed organizer);
    event Attended(uint256 indexed eventId, address indexed attendee);
    event CredentialIssued(
        uint256 indexed credentialId,
        uint256 indexed eventId,
        address indexed recipient
    );

    // ── Writes ──────────────────────────────────────────────────────────────

    /// @notice Create an event. Caller becomes the organizer.
    function createEvent(
        string calldata name,
        uint64 date,
        string calldata metadata
    ) external {
        uint256 id = events.length;
        events.push(
            Event({
                organizer: msg.sender,
                date: date,
                isActive: true,
                name: name,
                metadata: metadata
            })
        );
        emit EventCreated(id, msg.sender);
    }

    /// @notice Check in to an event. Organizer cannot attend their own event.
    /// @dev One cold SSTORE on first check-in — intentionally minimal.
    function attend(uint256 eventId) external {
        if (eventId >= events.length) revert EventMissing();

        Event storage ev = events[eventId];
        if (!ev.isActive) revert EventInactive();
        if (ev.organizer == msg.sender) revert OrganizerCannotAttend();

        uint8 s = status[eventId][msg.sender];
        if (s != STATUS_NONE) revert AlreadyAttended();

        status[eventId][msg.sender] = STATUS_ATTENDED;
        emit Attended(eventId, msg.sender);
    }

    /// @notice Organizer mints a credential to a wallet that already attended.
    function issueCredential(uint256 eventId, address recipient) external {
        if (eventId >= events.length) revert EventMissing();

        Event storage ev = events[eventId];
        if (ev.organizer != msg.sender) revert NotOrganizer();
        if (!ev.isActive) revert EventInactive();
        if (recipient == address(0) || recipient == msg.sender) revert BadRecipient();

        uint8 s = status[eventId][recipient];
        if (s == STATUS_NONE) revert NotAttended();
        if (s == STATUS_ISSUED) revert AlreadyIssued();

        // s == STATUS_ATTENDED
        status[eventId][recipient] = STATUS_ISSUED;

        uint256 credId = credentials.length;
        credentials.push(
            Credential({
                recipient: recipient,
                eventId: uint64(eventId),
                issuedAt: uint64(block.timestamp)
            })
        );
        emit CredentialIssued(credId, eventId, recipient);
    }

    // ── Views ───────────────────────────────────────────────────────────────

    function verifyCredential(uint256 credentialId) external view returns (bool) {
        if (credentialId >= credentials.length) revert CredentialMissing();
        return true; // every stored credential is valid
    }

    function getEventCount() external view returns (uint256) {
        return events.length;
    }

    function getCredentialCount() external view returns (uint256) {
        return credentials.length;
    }

    /// @notice True if wallet checked in (attended or already issued).
    function attendance(uint256 eventId, address wallet) external view returns (bool) {
        return status[eventId][wallet] >= STATUS_ATTENDED;
    }

    /// @notice True if a credential was already issued to wallet for this event.
    function hasCredential(uint256 eventId, address wallet) external view returns (bool) {
        return status[eventId][wallet] == STATUS_ISSUED;
    }
}
