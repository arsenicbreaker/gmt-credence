// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Credence — verifiable event credentials on BOT Chain.
 *
 * Gas model:
 *   - createEvent      → on-chain (organizer pays gas)
 *   - issueCredential  → on-chain (organizer pays gas)
 *   - Attendance       → off-chain free check-in (wallet signature only).
 *     The frontend records a signed message; organizers issue to attendee
 *     addresses. Issuing also records the recipient as an attendee on-chain.
 */
contract Credence {
    struct Event {
        uint256 id;
        string name;
        uint256 date;
        string metadata;
        address organizer;
        bool isActive;
    }

    struct Credential {
        uint256 id;
        uint256 eventId;
        address recipient;
        uint256 issuedAt;
        bool isValid;
    }

    Event[] public events;
    Credential[] public credentials;

    /// eventId => wallet => recognized for this event (set when credential is issued)
    mapping(uint256 => mapping(address => bool)) public attendance;
    /// eventId => recipient => already issued (prevents double credentials)
    mapping(uint256 => mapping(address => bool)) public hasCredential;
    mapping(uint256 => uint256[]) public eventCredentials;
    mapping(uint256 => address[]) private eventAttendees;

    event EventCreated(uint256 indexed eventId, string name, address organizer);
    event CredentialIssued(uint256 indexed credentialId, uint256 indexed eventId, address recipient);

    modifier onlyOrganizer(uint256 eventId) {
        require(events[eventId].organizer == msg.sender, "Not organizer");
        _;
    }

    modifier eventExists(uint256 eventId) {
        require(eventId < events.length, "Event does not exist");
        _;
    }

    function createEvent(string memory name, uint256 date, string memory metadata) external {
        uint256 id = events.length;
        events.push(Event({
            id: id,
            name: name,
            date: date,
            metadata: metadata,
            organizer: msg.sender,
            isActive: true
        }));
        emit EventCreated(id, name, msg.sender);
    }

    /**
     * Issue a credential to an attendee. Only the event organizer may call this.
     * Check-in itself is free/off-chain (signed message in the app); this is the
     * on-chain step that mints the verifiable credential (costs gas).
     */
    function issueCredential(uint256 eventId, address recipient) external
        eventExists(eventId)
        onlyOrganizer(eventId)
    {
        require(events[eventId].isActive, "Event not active");
        // Credential goes to attendees, not to the organizer themselves
        require(recipient != msg.sender, "Cannot issue to yourself");
        require(recipient != events[eventId].organizer, "Cannot issue to organizer");
        require(!hasCredential[eventId][recipient], "Already issued");

        // Record recipient as recognized for this event (audit trail)
        if (!attendance[eventId][recipient]) {
            attendance[eventId][recipient] = true;
            eventAttendees[eventId].push(recipient);
        }

        uint256 credId = credentials.length;
        credentials.push(Credential({
            id: credId,
            eventId: eventId,
            recipient: recipient,
            issuedAt: block.timestamp,
            isValid: true
        }));

        hasCredential[eventId][recipient] = true;
        eventCredentials[eventId].push(credId);
        emit CredentialIssued(credId, eventId, recipient);
    }

    function verifyCredential(uint256 credentialId) external view returns (bool) {
        require(credentialId < credentials.length, "Credential does not exist");
        return credentials[credentialId].isValid;
    }

    function getAttendees(uint256 eventId) external view eventExists(eventId) returns (address[] memory) {
        return eventAttendees[eventId];
    }

    function getEventCount() external view returns (uint256) {
        return events.length;
    }

    function getCredentialCount() external view returns (uint256) {
        return credentials.length;
    }
}
