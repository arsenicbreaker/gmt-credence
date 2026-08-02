import { useEffect, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi'
import {
  ArrowLeft,
  BadgeCheck,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  LogOut,
  Search,
  UserCheck,
  XCircle,
} from 'lucide-react'
import Landing from './Landing'

const CONTRACT_ADDRESS = '0x1b5c75806a5Ac1fa1428D9df45D79DD4d769f6b6'

const ABI = [
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'date', type: 'uint256' },
      { name: 'metadata', type: 'string' },
    ],
    name: 'createEvent',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'eventId', type: 'uint256' }],
    name: 'attend',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'eventId', type: 'uint256' },
      { name: 'recipient', type: 'address' },
    ],
    name: 'issueCredential',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'credentialId', type: 'uint256' }],
    name: 'verifyCredential',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'eventId', type: 'uint256' }],
    name: 'getAttendees',
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEventCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'events',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'date', type: 'uint256' },
      { name: 'metadata', type: 'string' },
      { name: 'organizer', type: 'address' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

/* ─────────────────────────────────────────────────────────
 * DASHBOARD STORYBOARD
 *
 *    0ms   header static
 *   60ms   status / toast
 *  120ms   action cards grid
 *  280ms   verify + events (stagger)
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  toast: 60,
  grid: 120,
  rest: 280,
}

const SPRING = { type: 'spring', stiffness: 350, damping: 28 }
const LIST = {
  stagger: 0.04,
  offsetY: 10,
  spring: { type: 'spring', stiffness: 400, damping: 30 },
}

function truncate(addr) {
  if (!addr || addr.length < 10) return addr || '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function StatusBanner({ status, isSuccess, isError, onDismiss }) {
  if (!status) return null

  const tone = isSuccess
    ? 'border-border bg-muted text-foreground'
    : isError
      ? 'border-destructive bg-muted text-foreground'
      : 'border-border bg-muted text-foreground'

  const Icon = isSuccess ? CheckCircle2 : isError ? XCircle : Loader2

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`mb-6 flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${tone}`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${!isSuccess && !isError ? 'animate-spin' : ''} ${
          isSuccess ? 'text-success' : isError ? 'text-destructive' : 'text-muted-foreground'
        }`}
        aria-hidden
      />
      <p className="flex-1 leading-relaxed">{status}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="btn btn-ghost h-8 min-h-8 px-2 text-xs text-muted-foreground"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      )}
    </motion.div>
  )
}

function Dashboard() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient()
  const reduceMotion = useReducedMotion()

  const { writeContract, data: hash, error, isPending, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventMetadata, setEventMetadata] = useState('')
  const [attendEventId, setAttendEventId] = useState('')
  const [issueEventId, setIssueEventId] = useState('')
  const [issueRecipient, setIssueRecipient] = useState('')
  const [verifyCredId, setVerifyCredId] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [events, setEvents] = useState([])
  const [txStatus, setTxStatus] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [stage, setStage] = useState(reduceMotion ? 3 : 0)

  useEffect(() => {
    if (reduceMotion) {
      setStage(3)
      return
    }
    const timers = [
      setTimeout(() => setStage(1), TIMING.toast),
      setTimeout(() => setStage(2), TIMING.grid),
      setTimeout(() => setStage(3), TIMING.rest),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reduceMotion])

  const { data: eventCount, refetch: refetchCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getEventCount',
  })

  useEffect(() => {
    let cancelled = false

    const fetchEvents = async () => {
      const count = Number(eventCount ?? 0)
      if (!count || !publicClient) {
        if (!cancelled) {
          setEvents([])
          setIsLoadingEvents(false)
        }
        return
      }

      setIsLoadingEvents(true)
      const evs = []

      for (let i = 0; i < count; i++) {
        try {
          const result = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'events',
            args: [BigInt(i)],
          })
          // result is tuple: [id, name, date, metadata, organizer, isActive]
          evs.push({
            id: i,
            name: result[1],
            date: result[2],
            metadata: result[3],
            organizer: result[4],
            isActive: result[5],
          })
        } catch {
          evs.push({
            id: i,
            name: 'Unable to load',
            organizer: null,
            isActive: false,
          })
        }
      }

      if (!cancelled) {
        setEvents(evs)
        setIsLoadingEvents(false)
      }
    }

    fetchEvents()
    return () => {
      cancelled = true
    }
  }, [eventCount, publicClient])

  useEffect(() => {
    if (isPending) setTxStatus('Confirm in your wallet…')
    else if (isConfirming) setTxStatus('Waiting for confirmation…')
    else if (isSuccess) {
      setTxStatus('Transaction confirmed.')
      setFieldError('')
      refetchCount()
      setEventName('')
      setEventDate('')
      setEventMetadata('')
    } else if (error) {
      const msg = error.shortMessage || error.message || 'Transaction failed'
      // User rejection is not an error toast — quiet return
      if (/user rejected|denied|rejected the request/i.test(msg)) {
        setTxStatus('')
        reset()
      } else {
        setTxStatus(msg)
      }
    }
  }, [isPending, isConfirming, isSuccess, error, refetchCount, reset])

  const connector = connectors[0]

  const handleCreateEvent = (e) => {
    e.preventDefault()
    if (!eventName.trim() || !eventDate) {
      setFieldError('Name and date are required.')
      return
    }
    const timestamp = Math.floor(new Date(eventDate).getTime() / 1000)
    if (Number.isNaN(timestamp)) {
      setFieldError('Invalid date.')
      return
    }
    setFieldError('')
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'createEvent',
      args: [eventName.trim(), BigInt(timestamp), eventMetadata.trim() || ''],
    })
  }

  const handleAttend = (e) => {
    e.preventDefault()
    if (attendEventId === '' || attendEventId === null) {
      setFieldError('Enter an event ID.')
      return
    }
    setFieldError('')
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'attend',
      args: [BigInt(attendEventId)],
    })
  }

  const handleIssue = (e) => {
    e.preventDefault()
    if (issueEventId === '' || !issueRecipient.trim()) {
      setFieldError('Event ID and recipient are required.')
      return
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(issueRecipient.trim())) {
      setFieldError('Recipient must be a valid 0x address.')
      return
    }
    setFieldError('')
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'issueCredential',
      args: [BigInt(issueEventId), issueRecipient.trim()],
    })
  }

  const handleVerify = async (e) => {
    e.preventDefault()
    if (verifyCredId === '') {
      setVerifyError('Enter a credential ID.')
      setVerifyResult(null)
      return
    }
    if (!publicClient) {
      setVerifyError('RPC client unavailable.')
      return
    }
    setIsVerifying(true)
    setVerifyError(null)
    setVerifyResult(null)
    try {
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'verifyCredential',
        args: [BigInt(verifyCredId)],
      })
      setVerifyResult(Boolean(result))
    } catch {
      setVerifyError('Could not verify this ID. Check the network and try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const busy = isPending || isConfirming
  const show = (n) => (reduceMotion ? true : stage >= n)

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card w-full max-w-sm p-8 text-center shadow-soft">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            C
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Connect to continue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use MetaMask on BOT Chain to manage events and credentials.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-6 w-full"
            onClick={() => connector && connect({ connector })}
            disabled={isConnecting || !connector}
            aria-busy={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Connecting…
              </>
            ) : (
              'Connect MetaMask'
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground"
              aria-hidden
            >
              C
            </span>
            <h1 className="text-sm font-semibold tracking-tight">Dashboard</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              <span className="font-mono tabular-nums text-muted-foreground">
                {truncate(address)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-outline h-9 min-h-9 px-3 text-xs"
              onClick={() => disconnect()}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <AnimatePresence mode="wait">
          {(txStatus || fieldError) && (
            <StatusBanner
              status={fieldError || txStatus}
              isSuccess={!fieldError && isSuccess}
              isError={Boolean(fieldError || error)}
              onDismiss={() => {
                setTxStatus('')
                setFieldError('')
                reset()
              }}
            />
          )}
        </AnimatePresence>

        <motion.div
          className="grid gap-4 md:grid-cols-2"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{
            opacity: show(2) ? 1 : 0,
            y: show(2) ? 0 : 12,
          }}
          transition={SPRING}
        >
          {/* Create event */}
          <section className="card p-5 shadow-soft" aria-labelledby="create-heading">
            <div className="mb-4 flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-muted-foreground" aria-hidden />
              <h2 id="create-heading" className="section-title">
                Create event
              </h2>
            </div>
            <form className="space-y-3" onSubmit={handleCreateEvent}>
              <div>
                <label htmlFor="event-name" className="label">
                  Event name
                </label>
                <input
                  id="event-name"
                  className="input"
                  placeholder="BOT Chain Hackathon"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div>
                <label htmlFor="event-date" className="label">
                  Date & time
                </label>
                <input
                  id="event-date"
                  type="datetime-local"
                  className="input"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="event-meta" className="label">
                  Metadata
                  <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
                </label>
                <input
                  id="event-meta"
                  className="input font-mono text-xs"
                  placeholder="IPFS CID or JSON"
                  value={eventMetadata}
                  onChange={(e) => setEventMetadata(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={busy} aria-busy={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Submitting…
                  </>
                ) : (
                  'Create event'
                )}
              </button>
            </form>
          </section>

          {/* Attend + Issue */}
          <div className="flex flex-col gap-4">
            <section className="card p-5 shadow-soft" aria-labelledby="attend-heading">
              <div className="mb-4 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h2 id="attend-heading" className="section-title">
                  Attend
                </h2>
              </div>
              <form className="flex gap-2" onSubmit={handleAttend}>
                <div className="min-w-0 flex-1">
                  <label htmlFor="attend-id" className="sr-only">
                    Event ID
                  </label>
                  <input
                    id="attend-id"
                    type="number"
                    min="0"
                    className="input font-mono"
                    placeholder="Event ID"
                    value={attendEventId}
                    onChange={(e) => setAttendEventId(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary shrink-0" disabled={busy} aria-busy={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : 'Attend'}
                </button>
              </form>
            </section>

            <section className="card flex-1 p-5 shadow-soft" aria-labelledby="issue-heading">
              <div className="mb-4 flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h2 id="issue-heading" className="section-title">
                  Issue credential
                </h2>
              </div>
              <form className="space-y-3" onSubmit={handleIssue}>
                <div>
                  <label htmlFor="issue-event" className="label">
                    Event ID
                  </label>
                  <input
                    id="issue-event"
                    type="number"
                    min="0"
                    className="input font-mono"
                    placeholder="0"
                    value={issueEventId}
                    onChange={(e) => setIssueEventId(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="issue-recipient" className="label">
                    Recipient
                  </label>
                  <input
                    id="issue-recipient"
                    className="input font-mono text-xs"
                    placeholder="0x…"
                    value={issueRecipient}
                    onChange={(e) => setIssueRecipient(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={busy} aria-busy={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Issuing…
                    </>
                  ) : (
                    'Issue credential'
                  )}
                </button>
              </form>
            </section>
          </div>
        </motion.div>

        <motion.section
          className="card mt-4 p-5 shadow-soft"
          aria-labelledby="verify-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{
            opacity: show(3) ? 1 : 0,
            y: show(3) ? 0 : 12,
          }}
          transition={SPRING}
        >
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 id="verify-heading" className="section-title">
              Verify credential
            </h2>
          </div>
          <form className="flex flex-wrap gap-2" onSubmit={handleVerify}>
            <div className="min-w-[160px] flex-1">
              <label htmlFor="verify-id" className="sr-only">
                Credential ID
              </label>
              <input
                id="verify-id"
                type="number"
                min="0"
                className="input font-mono"
                placeholder="Credential ID"
                value={verifyCredId}
                onChange={(e) => setVerifyCredId(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isVerifying}
              aria-busy={isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Checking…
                </>
              ) : (
                'Verify'
              )}
            </button>
          </form>

          <AnimatePresence mode="wait">
            {verifyResult !== null && (
              <motion.div
                key={verifyResult ? 'valid' : 'invalid'}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  verifyResult
                    ? 'border-border bg-muted'
                    : 'border-destructive bg-muted'
                }`}
                role="status"
              >
                {verifyResult ? (
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                )}
                {verifyResult ? 'Valid credential' : 'Invalid credential'}
              </motion.div>
            )}
            {verifyError && (
              <motion.p
                key="verr"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-sm text-destructive"
                role="alert"
              >
                {verifyError}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.section>

        <motion.section
          className="card mt-4 p-5 shadow-soft"
          aria-labelledby="events-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{
            opacity: show(3) ? 1 : 0,
            y: show(3) ? 0 : 12,
          }}
          transition={{ ...SPRING, delay: reduceMotion ? 0 : 0.06 }}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 id="events-heading" className="section-title">
              Events
            </h2>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {eventCount !== undefined ? String(eventCount) : '—'} total
            </span>
          </div>

          {isLoadingEvents ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading events">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-md bg-muted"
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium">No events yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create the first event above to get started.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {events.map((ev, i) => (
                <motion.li
                  key={ev.id}
                  initial={reduceMotion ? false : { opacity: 0, y: LIST.offsetY }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...LIST.spring,
                    delay: reduceMotion ? 0 : Math.min(i, 8) * LIST.stagger,
                  }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        #{ev.id}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {ev.name || 'Untitled'}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          ev.isActive
                            ? 'bg-secondary text-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {ev.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {ev.organizer && (
                      <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                        {truncate(ev.organizer)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline h-9 min-h-9 px-3 text-xs"
                    onClick={() => setAttendEventId(String(ev.id))}
                  >
                    Use ID
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.section>

        <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowLeft className="h-3 w-3" aria-hidden />
          Disconnect to return to the landing page
        </p>
      </main>
    </div>
  )
}

function App() {
  const { isConnected } = useAccount()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isConnected ? 'dash' : 'land'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {isConnected ? <Dashboard /> : <Landing />}
      </motion.div>
    </AnimatePresence>
  )
}

export default App
