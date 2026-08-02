import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'

// Contract ABI and address — update after deploy
const CONTRACT_ADDRESS = '0x...' // TODO: set after deploy

const ABI = [
  {
    "inputs": [{ "name": "name", "type": "string" }, { "name": "date", "type": "uint256" }, { "name": "metadata", "type": "string" }],
    "name": "createEvent",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "eventId", "type": "uint256" }],
    "name": "attend",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "eventId", "type": "uint256" }, { "name": "recipient", "type": "address" }],
    "name": "issueCredential",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "name": "credentialId", "type": "uint256" }],
    "name": "verifyCredential",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "eventId", "type": "uint256" }],
    "name": "getAttendees",
    "outputs": [{ "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getEventCount",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "name": "", "type": "uint256" }],
    "name": "events",
    "outputs": [{ "name": "id", "type": "uint256" }, { "name": "name", "type": "string" }, { "name": "date", "type": "uint256" }, { "name": "metadata", "type": "string" }, { "name": "organizer", "type": "address" }, { "name": "isActive", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  }
]

function App() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventMetadata, setEventMetadata] = useState('')
  const [attendEventId, setAttendEventId] = useState('')
  const [issueEventId, setIssueEventId] = useState('')
  const [issueRecipient, setIssueRecipient] = useState('')
  const [verifyCredId, setVerifyCredId] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [events, setEvents] = useState([])

  // Load events
  const { data: eventCount, refetch: refetchCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getEventCount',
  })

  useEffect(() => {
    if (eventCount !== undefined && eventCount > 0) {
      const fetchEvents = async () => {
        const evs = []
        for (let i = 0; i < Number(eventCount); i++) {
          const ev = await window.contract?.events(i) // simplified; we'll use readContract
          // better: use readContract per event
        }
        // For demo, we'll just show count
      }
      fetchEvents()
    }
  }, [eventCount])

  // Simplified read: use readContract for each event
  const readEvent = (id) => {
    return useReadContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'events',
      args: [id],
    })
  }

  const handleCreateEvent = () => {
    const timestamp = Math.floor(new Date(eventDate).getTime() / 1000)
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'createEvent',
      args: [eventName, timestamp, eventMetadata],
    })
  }

  const handleAttend = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'attend',
      args: [BigInt(attendEventId)],
    })
  }

  const handleIssue = () => {
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'issueCredential',
      args: [BigInt(issueEventId), issueRecipient],
    })
  }

  const handleVerify = async () => {
    // use readContract
    try {
      const result = await window.contract?.verifyCredential(BigInt(verifyCredId))
      setVerifyResult(result)
    } catch (e) {
      alert('Error verifying')
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Credence</h1>
      <p>Verifiable Credentials on BOT Chain</p>

      {!isConnected ? (
        <button onClick={() => connect({ connector: connectors[0] })}>
          Connect MetaMask
        </button>
      ) : (
        <>
          <p>Connected: {address.slice(0,6)}...{address.slice(-4)}</p>
          <button onClick={disconnect}>Disconnect</button>
        </>
      )}

      {isConnected && (
        <>
          <hr />
          <h2>Create Event</h2>
          <input placeholder="Event Name" value={eventName} onChange={(e) => setEventName(e.target.value)} />
          <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <input placeholder="Metadata (IPFS CID)" value={eventMetadata} onChange={(e) => setEventMetadata(e.target.value)} />
          <button onClick={handleCreateEvent} disabled={isPending}>Create Event</button>

          <hr />
          <h2>Attend</h2>
          <input placeholder="Event ID" value={attendEventId} onChange={(e) => setAttendEventId(e.target.value)} />
          <button onClick={handleAttend} disabled={isPending}>Attend</button>

          <hr />
          <h2>Issue Credential</h2>
          <input placeholder="Event ID" value={issueEventId} onChange={(e) => setIssueEventId(e.target.value)} />
          <input placeholder="Recipient Address" value={issueRecipient} onChange={(e) => setIssueRecipient(e.target.value)} />
          <button onClick={handleIssue} disabled={isPending}>Issue</button>

          <hr />
          <h2>Verify Credential</h2>
          <input placeholder="Credential ID" value={verifyCredId} onChange={(e) => setVerifyCredId(e.target.value)} />
          <button onClick={handleVerify}>Verify</button>
          {verifyResult !== null && <p>{verifyResult ? '✅ Valid' : '❌ Invalid'}</p>}

          {hash && (
            <div>
              <p>Transaction: {hash}</p>
              {isConfirming && <p>Confirming...</p>}
              {isSuccess && <p>✅ Confirmed!</p>}
            </div>
          )}
          {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
        </>
      )}
    </div>
  )
}

export default App