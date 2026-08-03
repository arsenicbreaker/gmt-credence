import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  usePublicClient,
  useSignMessage,
} from 'wagmi'
import { parseEventLogs } from 'viem'
import {
  BadgeCheck,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Copy,
  LayoutDashboard,
  List,
  Loader2,
  LogOut,
  Menu,
  Search,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react'

const CONTRACT_ADDRESS = '0xa52A5686fC9bf0Ba33E0501D7f775E09f8a76cD7'

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
    inputs: [],
    name: 'getEventCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCredentialCount',
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
  {
    inputs: [{ name: '', type: 'uint256' }],
    name: 'credentials',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'eventId', type: 'uint256' },
      { name: 'recipient', type: 'address' },
      { name: 'issuedAt', type: 'uint256' },
      { name: 'isValid', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    type: 'event',
    name: 'EventCreated',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'organizer', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CredentialIssued',
    inputs: [
      { name: 'credentialId', type: 'uint256', indexed: true },
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'recipient', type: 'address', indexed: false },
    ],
  },
  {
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    name: 'hasCredential',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
]

/* ─────────────────────────────────────────────────────────
 * DASHBOARD STORYBOARD
 *
 * Static shell (sidebar + topbar) never re-animates.
 * Panel content fades/slides on view switch.
 *
 *    0ms   shell visible
 *   80ms   panel header
 *  160ms   panel body
 *  240ms   list items stagger
 * ───────────────────────────────────────────────────────── */

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'events', label: 'Events', icon: List },
  { id: 'create', label: 'Create event', icon: CalendarPlus },
  { id: 'attend', label: 'Attend', icon: UserCheck },
  { id: 'issue', label: 'Issue', icon: BadgeCheck },
  { id: 'verify', label: 'Verify', icon: Search },
]

const SPRING = { type: 'spring', stiffness: 350, damping: 30 }
const PANEL = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
}

function truncate(addr) {
  if (!addr || addr.length < 10) return addr || '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function sameAddress(a, b) {
  if (!a || !b) return false
  return String(a).toLowerCase() === String(b).toLowerCase()
}

/** Gasless check-in storage (signed message — no chain tx, no gas). */
const CHECKIN_STORAGE_KEY = 'credence:checkins'

function buildCheckInMessage(eventId, attendee) {
  return [
    'Credence free check-in',
    `Event ID: ${eventId}`,
    `Attendee: ${attendee}`,
    'Network: BOT Chain',
    'This is not a transaction and costs no gas.',
  ].join('\n')
}

function readCheckIns() {
  try {
    const raw = localStorage.getItem(CHECKIN_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function getLocalCheckIn(eventId, attendee) {
  if (eventId === '' || eventId === null || !attendee) return null
  const all = readCheckIns()
  const byEvent = all[String(eventId)]
  if (!byEvent) return null
  return byEvent[String(attendee).toLowerCase()] || null
}

function saveLocalCheckIn(eventId, attendee, payload) {
  const all = readCheckIns()
  const key = String(eventId)
  const addr = String(attendee).toLowerCase()
  if (!all[key]) all[key] = {}
  all[key][addr] = payload
  localStorage.setItem(CHECKIN_STORAGE_KEY, JSON.stringify(all))
}

function formatDate(ts) {
  if (ts === undefined || ts === null) return '—'
  try {
    const n = Number(ts)
    if (!n) return '—'
    return new Date(n * 1000).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

function StatusBanner({ status, tone, onDismiss }) {
  if (!status) return null
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : Loader2
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-3 rounded-lg border border-border bg-muted px-4 py-3 text-sm"
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${
          tone === 'success'
            ? 'text-success'
            : tone === 'error'
              ? 'text-destructive'
              : 'animate-spin text-muted-foreground'
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

/**
 * Success popup after create / attend / issue.
 * Closable: X button, backdrop click, Escape.
 */
function ActionResultModal({ result, onClose, onVerify, onCopy, copied, reduceMotion }) {
  useEffect(() => {
    if (!result) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    // Lock body scroll while open
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [result, onClose])

  if (!result) return null

  const hasCredential =
    result.credentialId !== undefined && result.credentialId !== null
  const hasEventOnly =
    result.eventId !== undefined &&
    result.eventId !== null &&
    !hasCredential

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] dark:bg-foreground/40"
        aria-label="Close dialog"
        onClick={onClose}
      />

      {/* Dialog */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-dialog-title"
        initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 400, damping: 32 }
        }
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-[0_8px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2
                id="result-dialog-title"
                className="text-sm font-semibold tracking-tight"
              >
                {result.title}
              </h2>
              {result.detail && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {result.detail}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost h-8 w-8 min-h-8 shrink-0 p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {hasCredential && (
            <div className="rounded-lg border border-border bg-muted px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Credential ID
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-3xl font-semibold tabular-nums tracking-tight">
                  {String(result.credentialId)}
                </span>
                <button
                  type="button"
                  className="btn btn-outline h-8 min-h-8 px-2.5 text-xs"
                  onClick={() => onCopy?.(String(result.credentialId))}
                  aria-label="Copy credential ID"
                >
                  <Copy className="h-3 w-3" aria-hidden />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Use this ID on the Verify page to check authenticity.
              </p>
            </div>
          )}

          {hasEventOnly && (
            <div className="rounded-lg border border-border bg-muted px-3 py-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Event ID
              </p>
              <p className="mt-1.5 font-mono text-3xl font-semibold tabular-nums tracking-tight">
                {String(result.eventId)}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-outline h-9" onClick={onClose}>
            Close
          </button>
          {hasCredential && onVerify && (
            <button
              type="button"
              className="btn btn-primary h-9"
              onClick={() => {
                onVerify(String(result.credentialId))
                onClose?.()
              }}
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              Verify this credential
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function StatCard({ label, value, hint, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card w-full p-5 text-left transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        active ? 'border-primary bg-secondary' : 'hover:bg-accent'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint && (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          {hint}
          <ChevronRight className="h-3 w-3" aria-hidden />
        </p>
      )}
    </button>
  )
}

function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary mt-5" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const publicClient = usePublicClient()
  const reduceMotion = useReducedMotion()

  const { writeContract, data: hash, error, isPending, reset } = useWriteContract()
  const {
    signMessageAsync,
    isPending: isSigning,
    error: signError,
    reset: resetSign,
  } = useSignMessage()
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess,
  } = useWaitForTransactionReceipt({ hash })

  const [view, setView] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
  const [selectedEvent, setSelectedEvent] = useState(null)

  const [events, setEvents] = useState([])
  const [txStatus, setTxStatus] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  /** 'create' | 'issue' | null — attend is gasless (no tx) */
  const [pendingAction, setPendingAction] = useState(null)
  const [lastResult, setLastResult] = useState(null)
  const [copied, setCopied] = useState(false)
  /** True while reading chain before wallet prompt */
  const [isPreChecking, setIsPreChecking] = useState(false)
  /** Bumps when local gasless check-in is saved */
  const [checkInVersion, setCheckInVersion] = useState(0)
  const handledHash = useRef(null)

  const connector = connectors[0]

  const navigate = useCallback((id) => {
    setView(id)
    setSidebarOpen(false)
    setFieldError('')
    setVerifyError(null)
  }, [])

  const goVerify = useCallback(
    (credId) => {
      setVerifyCredId(credId)
      setVerifyResult(null)
      setVerifyError(null)
      navigate('verify')
    },
    [navigate]
  )

  const copyId = useCallback(async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }, [])

  const { data: eventCount, refetch: refetchCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getEventCount',
  })

  const { data: credentialCount, refetch: refetchCredCount } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getCredentialCount',
  })

  // Gasless check-in is stored locally after a free wallet signature (no gas).
  const attendIdParsed =
    attendEventId !== '' && attendEventId !== null && !Number.isNaN(Number(attendEventId))
      ? BigInt(attendEventId)
      : null
  // checkInVersion forces re-read from localStorage after a successful sign
  const alreadyAttended = Boolean(
    checkInVersion >= 0 &&
      address &&
      attendIdParsed !== null &&
      getLocalCheckIn(Number(attendEventId), address)
  )

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
            date: 0n,
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
    if (isSigning) setTxStatus('Sign the free check-in in your wallet (no gas)…')
    else if (isPending) setTxStatus('Confirm in your wallet…')
    else if (isConfirming) setTxStatus('Waiting for confirmation…')
    else if (error || signError) {
      const err = error || signError
      const msg = err.shortMessage || err.message || 'Request failed'
      if (/user rejected|denied|rejected the request/i.test(msg)) {
        setTxStatus('')
        setPendingAction(null)
        reset()
        resetSign()
      } else {
        // Surface common revert reasons in plain language
        let friendly = msg
        if (/Not organizer/i.test(msg)) {
          friendly =
            'Only the event organizer can issue credentials for this event.'
        } else if (/Cannot issue to yourself|Cannot issue to organizer/i.test(msg)) {
          friendly =
            'You cannot issue a credential to yourself. Enter an attendee wallet address.'
        } else if (/Event not active/i.test(msg)) {
          friendly = 'This event is not active.'
        } else if (/Event does not exist/i.test(msg)) {
          friendly = 'Event ID not found. Check the ID and try again.'
        } else if (/Already issued/i.test(msg)) {
          friendly =
            'A credential was already issued to this address for this event. One credential per attendee.'
        }
        setTxStatus(friendly)
        setFieldError('')
        setPendingAction(null)
      }
    }
  }, [isPending, isConfirming, isSigning, error, signError, reset, resetSign])

  // Parse logs on confirmed receipt → surface Event ID / Credential ID
  useEffect(() => {
    if (!isSuccess || !receipt || !hash) return
    if (handledHash.current === hash) return
    handledHash.current = hash

    const action = pendingAction
    setPendingAction(null)
    setFieldError('')
    setTxStatus('')
    refetchCount()
    refetchCredCount()

    let logs = []
    try {
      logs = parseEventLogs({
        abi: ABI,
        logs: receipt.logs,
      })
    } catch {
      logs = []
    }

    const resolve = async () => {
      if (action === 'create') {
        const created = logs.find((l) => l.eventName === 'EventCreated')
        let eventId =
          created?.args?.eventId !== undefined
            ? Number(created.args.eventId)
            : null
        if (eventId === null && publicClient) {
          try {
            const n = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: ABI,
              functionName: 'getEventCount',
            })
            eventId = Math.max(0, Number(n) - 1)
          } catch {
            eventId = 0
          }
        }
        setLastResult({
          title: 'Event created',
          detail:
            'Share this Event ID so participants can check in for free (no gas).',
          eventId: eventId ?? 0,
        })
        setEventName('')
        setEventDate('')
        setEventMetadata('')
        return
      }

      if (action === 'issue') {
        const issued = logs.find((l) => l.eventName === 'CredentialIssued')
        let credentialId =
          issued?.args?.credentialId !== undefined
            ? Number(issued.args.credentialId)
            : null
        const eventIdFromLog =
          issued?.args?.eventId !== undefined
            ? Number(issued.args.eventId)
            : issueEventId !== ''
              ? Number(issueEventId)
              : null

        // Fallback: latest credential index from chain after this tx
        if (credentialId === null && publicClient) {
          try {
            const n = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: ABI,
              functionName: 'getCredentialCount',
            })
            if (Number(n) > 0) credentialId = Number(n) - 1
          } catch {
            /* ignore */
          }
        }

        setLastResult({
          title: 'Credential issued',
          detail: 'Save this Credential ID — it is what you verify with.',
          credentialId: credentialId ?? 0,
          eventId: eventIdFromLog,
        })
        return
      }

      setLastResult({
        title: 'Transaction confirmed',
        detail: hash ? `Tx ${truncate(hash)}` : undefined,
      })
    }

    resolve()
  }, [
    isSuccess,
    receipt,
    hash,
    pendingAction,
    refetchCount,
    refetchCredCount,
    publicClient,
    issueEventId,
  ])

  // Esc closes mobile sidebar
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const busy = isPending || isConfirming || isPreChecking || isSigning
  const count = Number(eventCount ?? 0)
  const activeCount = events.filter((e) => e.isActive).length
  const currentNav = NAV.find((n) => n.id === view)

  // Resolve selected attend event from list (for organizer / already-attended UI)
  const attendEventMeta =
    attendIdParsed !== null
      ? events.find((e) => e.id === Number(attendEventId)) ||
        (selectedEvent && selectedEvent.id === Number(attendEventId)
          ? selectedEvent
          : null)
      : null
  const isOrganizerOfAttendEvent = Boolean(
    address &&
      attendEventMeta?.organizer &&
      sameAddress(address, attendEventMeta.organizer)
  )

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
    setLastResult(null)
    setPendingAction('create')
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'createEvent',
      args: [eventName.trim(), BigInt(timestamp), eventMetadata.trim() || ''],
    })
  }

  const handleAttend = async (e) => {
    e?.preventDefault?.()
    if (attendEventId === '' || attendEventId === null) {
      setFieldError('Enter an event ID.')
      return
    }
    if (!address) {
      setFieldError('Connect your wallet first.')
      return
    }
    if (!publicClient) {
      setFieldError('RPC client unavailable. Try again in a moment.')
      return
    }

    const eventIdNum = Number(attendEventId)
    const eventId = BigInt(attendEventId)

    // Already checked in locally (gasless)
    if (getLocalCheckIn(eventIdNum, address)) {
      setFieldError(
        'This wallet already checked in to this event (free check-in on this device).'
      )
      setCheckInVersion((v) => v + 1)
      return
    }

    // Read-only RPC checks — no write tx, no gas
    setIsPreChecking(true)
    setFieldError('')
    setTxStatus('')
    try {
      const total = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'getEventCount',
      })
      if (eventId >= total) {
        setFieldError('Event ID not found. Check the ID and try again.')
        return
      }

      const ev = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'events',
        args: [eventId],
      })
      // events(): [id, name, date, metadata, organizer, isActive]
      if (ev[5] !== true) {
        setFieldError('This event is not active.')
        return
      }

      // Organizer hosts — only other wallets may check in
      if (sameAddress(ev[4], address)) {
        setFieldError(
          'You created this event — organizers cannot check in to their own event. Share the Event ID so others can check in free.'
        )
        return
      }
    } catch {
      setFieldError('Could not load this event. Check the network and try again.')
      return
    } finally {
      setIsPreChecking(false)
    }

    // Free wallet signature only — not a transaction, costs no gas
    setLastResult(null)
    setTxStatus('Sign the free check-in in your wallet (no gas)…')
    const message = buildCheckInMessage(eventIdNum, address)
    try {
      const signature = await signMessageAsync({ message })
      saveLocalCheckIn(eventIdNum, address, {
        signature,
        message,
        signedAt: Date.now(),
        attendee: address,
        eventId: eventIdNum,
      })
      setCheckInVersion((v) => v + 1)
      setTxStatus('')
      setFieldError('')
      setLastResult({
        title: 'Checked in — free',
        detail:
          'No gas used. Share your wallet address with the organizer so they can issue your credential on-chain.',
        eventId: eventIdNum,
      })
    } catch (err) {
      const msg = err?.shortMessage || err?.message || ''
      if (/user rejected|denied|rejected the request/i.test(msg)) {
        setTxStatus('')
        resetSign()
        return
      }
      setTxStatus('')
      setFieldError(msg || 'Check-in signature failed.')
    }
  }

  const handleIssue = async (e) => {
    e.preventDefault()
    if (issueEventId === '' || !issueRecipient.trim()) {
      setFieldError('Event ID and recipient are required.')
      return
    }
    const recipient = issueRecipient.trim()
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      setFieldError('Recipient must be a valid 0x address.')
      return
    }

    // Pre-check before wallet prompt — avoid failed txs in testnet history
    if (publicClient) {
      setIsPreChecking(true)
      setFieldError('')
      try {
        const eventId = BigInt(issueEventId)
        const total = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: 'getEventCount',
        })
        if (eventId >= total) {
          setFieldError('Event ID not found. Check the ID and try again.')
          return
        }

        const ev = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: ABI,
          functionName: 'events',
          args: [eventId],
        })
        // events(): [id, name, date, metadata, organizer, isActive]
        const organizer = ev[4]
        if (!sameAddress(organizer, address)) {
          setFieldError(
            'Only the event organizer can issue credentials for this event.'
          )
          return
        }
        if (ev[5] !== true) {
          setFieldError('This event is not active.')
          return
        }
        // Organizer issues to attendees — never to themselves
        if (sameAddress(recipient, address) || sameAddress(recipient, organizer)) {
          setFieldError(
            'You cannot issue a credential to yourself. Enter an attendee wallet address.'
          )
          return
        }

        // Check-in is gasless/off-chain; issue is the on-chain step (gas).
        // Prefer on-chain mapping if contract was redeployed with hasCredential
        try {
          const already = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'hasCredential',
            args: [eventId, recipient],
          })
          if (already) {
            setFieldError(
              'Credential already issued to this address for this event. One per attendee.'
            )
            return
          }
        } catch {
          // Old contract without hasCredential — scan credentials array
          const n = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'getCredentialCount',
          })
          const credCount = Number(n)
          const eventIdNum = Number(issueEventId)
          const recipientLower = recipient.toLowerCase()
          for (let i = 0; i < credCount; i++) {
            const cred = await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: ABI,
              functionName: 'credentials',
              args: [BigInt(i)],
            })
            // [id, eventId, recipient, issuedAt, isValid]
            if (
              Number(cred[1]) === eventIdNum &&
              String(cred[2]).toLowerCase() === recipientLower &&
              cred[4] === true
            ) {
              setFieldError(
                `Already issued (Credential ID ${i}). One credential per attendee.`
              )
              return
            }
          }
        }
      } catch {
        // If pre-check fails, still allow tx — contract may revert
      } finally {
        setIsPreChecking(false)
      }
    }

    setFieldError('')
    setLastResult(null)
    setPendingAction('issue')
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName: 'issueCredential',
      args: [BigInt(issueEventId), recipient],
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

  const selectEventForAttend = (ev) => {
    setAttendEventId(String(ev.id))
    setSelectedEvent(ev)
    navigate('attend')
  }

  const selectEventForIssue = (ev) => {
    setIssueEventId(String(ev.id))
    setSelectedEvent(ev)
    navigate('issue')
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card w-full max-w-sm p-8 text-center shadow-soft">
          <img
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            className="mx-auto mb-4 h-10 w-10 rounded-lg object-cover"
            aria-hidden
          />
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

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <img
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded-md object-cover"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">Credence</p>
          <p className="truncate text-[11px] text-muted-foreground">BOT Chain</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost ml-auto h-9 w-9 min-h-9 p-0 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Dashboard">
        <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Menu
        </p>
        {NAV.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Wallet footer */}
      <div className="border-t border-border p-3">
        <div className="mb-2 rounded-md border border-border bg-muted px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Wallet
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums">{truncate(address)}</p>
        </div>
        <button
          type="button"
          className="btn btn-outline h-9 w-full text-xs"
          onClick={() => disconnect()}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Disconnect
        </button>
      </div>
    </div>
  )

  const panelTitle = currentNav?.label ?? 'Dashboard'
  const panelDesc = {
    overview: 'Snapshot of your on-chain activity.',
    events: 'Browse and act on published events.',
    create: 'Publish a new event on-chain (uses gas).',
    attend: 'Free check-in — sign a message, no gas.',
    issue: 'Mint a credential on-chain (uses gas).',
    verify: 'Confirm a credential by ID (free).',
  }[view]

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-border bg-card lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 border-r border-border bg-card shadow-soft lg:hidden"
              initial={reduceMotion ? false : { x: -280 }}
              animate={{ x: 0 }}
              exit={reduceMotion ? undefined : { x: -280 }}
              transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            className="btn btn-ghost h-9 w-9 min-h-9 p-0 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">{panelTitle}</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {panelDesc}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              <span className="font-mono tabular-nums text-muted-foreground">
                {truncate(address)}
              </span>
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <AnimatePresence mode="wait">
              {(txStatus || fieldError) && (
                <StatusBanner
                  key="status"
                  status={fieldError || txStatus}
                  tone={
                    fieldError || error || signError
                      ? 'error'
                      : isSigning ||
                          isPending ||
                          isConfirming ||
                          /Confirm|Waiting|Sign the free/i.test(txStatus || '')
                        ? 'pending'
                        : isSuccess
                          ? 'success'
                          : 'pending'
                  }
                  onDismiss={() => {
                    setTxStatus('')
                    setFieldError('')
                    reset()
                    resetSign()
                  }}
                />
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={reduceMotion ? false : PANEL.initial}
                animate={PANEL.animate}
                exit={reduceMotion ? undefined : PANEL.exit}
                transition={reduceMotion ? { duration: 0 } : PANEL.transition}
              >
                {/* ── Overview ── */}
                {view === 'overview' && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Manage credentials end-to-end from one place.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <StatCard
                        label="Total events"
                        value={eventCount !== undefined ? String(count) : '—'}
                        hint="View all"
                        onClick={() => navigate('events')}
                      />
                      <StatCard
                        label="Active"
                        value={isLoadingEvents ? '—' : String(activeCount)}
                        hint="Browse active"
                        onClick={() => navigate('events')}
                      />
                      <StatCard
                        label="Network"
                        value="BOT"
                        hint="Issue credential"
                        onClick={() => navigate('issue')}
                      />
                    </div>

                    <div className="card p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="section-title">Quick actions</h3>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {[
                          {
                            id: 'create',
                            icon: CalendarPlus,
                            title: 'Create event',
                            desc: 'Publish a new on-chain event',
                          },
                          {
                            id: 'attend',
                            icon: UserCheck,
                            title: 'Attend event',
                            desc: 'Free check-in · no gas',
                          },
                          {
                            id: 'issue',
                            icon: BadgeCheck,
                            title: 'Issue credential',
                            desc: 'On-chain mint · uses gas',
                          },
                          {
                            id: 'verify',
                            icon: Search,
                            title: 'Verify credential',
                            desc: 'Look up by credential ID',
                          },
                        ].map((a) => {
                          const Icon = a.icon
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => navigate(a.id)}
                              className="flex items-start gap-3 rounded-md border border-border bg-background p-4 text-left transition-colors duration-100 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                                <Icon className="h-4 w-4" aria-hidden />
                              </span>
                              <span>
                                <span className="block text-sm font-medium">{a.title}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {a.desc}
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="card p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="section-title">Recent events</h3>
                        <button
                          type="button"
                          className="btn btn-ghost h-8 min-h-8 px-2 text-xs"
                          onClick={() => navigate('events')}
                        >
                          View all
                        </button>
                      </div>
                      {isLoadingEvents ? (
                        <div className="space-y-2" aria-busy="true">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
                          ))}
                        </div>
                      ) : events.length === 0 ? (
                        <EmptyState
                          title="No events yet"
                          description="Create the first event to get started."
                          actionLabel="Create event"
                          onAction={() => navigate('create')}
                        />
                      ) : (
                        <ul className="divide-y divide-border">
                          {events
                            .slice()
                            .reverse()
                            .slice(0, 5)
                            .map((ev, i) => (
                              <motion.li
                                key={ev.id}
                                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  ...SPRING,
                                  delay: reduceMotion ? 0 : i * 0.04,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEvent(ev)
                                    navigate('events')
                                  }}
                                  className="flex w-full items-center justify-between gap-3 rounded-sm px-1 py-3 text-left transition-colors duration-100 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                        #{ev.id}
                                      </span>
                                      <span className="truncate text-sm font-medium">
                                        {ev.name || 'Untitled'}
                                      </span>
                                    </div>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {formatDate(ev.date)}
                                    </p>
                                  </div>
                                  <ChevronRight
                                    className="h-4 w-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                  />
                                </button>
                              </motion.li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Events ── */}
                {view === 'events' && (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-semibold tracking-tight">Events</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="font-mono tabular-nums">{count}</span> on-chain
                          {activeCount > 0 && (
                            <>
                              {' · '}
                              <span className="font-mono tabular-nums">{activeCount}</span> active
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => navigate('create')}
                      >
                        <CalendarPlus className="h-4 w-4" aria-hidden />
                        New event
                      </button>
                    </div>

                    {isLoadingEvents ? (
                      <div className="space-y-2" aria-busy="true" aria-label="Loading events">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
                        ))}
                      </div>
                    ) : events.length === 0 ? (
                      <EmptyState
                        title="No events yet"
                        description="Create the first event to get started."
                        actionLabel="Create event"
                        onAction={() => navigate('create')}
                      />
                    ) : (
                      <ul className="space-y-2">
                        {events
                          .slice()
                          .reverse()
                          .map((ev, i) => {
                            const selected = selectedEvent?.id === ev.id
                            return (
                              <motion.li
                                key={ev.id}
                                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                  ...SPRING,
                                  delay: reduceMotion ? 0 : Math.min(i, 10) * 0.03,
                                }}
                                className={`card overflow-hidden transition-colors duration-100 ${
                                  selected ? 'border-primary' : ''
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedEvent(selected ? null : ev)
                                  }
                                  className="flex w-full items-start justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                  aria-expanded={selected}
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                        #{ev.id}
                                      </span>
                                      <span className="text-sm font-medium">
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
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {formatDate(ev.date)}
                                      {ev.organizer && (
                                        <>
                                          {' · '}
                                          <span className="font-mono tabular-nums">
                                            {truncate(ev.organizer)}
                                          </span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  <ChevronRight
                                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${
                                      selected ? 'rotate-90' : ''
                                    }`}
                                    aria-hidden
                                  />
                                </button>

                                <AnimatePresence initial={false}>
                                  {selected && (
                                    <motion.div
                                      initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                      className="overflow-hidden border-t border-border"
                                    >
                                      <div className="flex flex-wrap gap-2 bg-muted p-4">
                                        {(() => {
                                          const isMine =
                                            address &&
                                            ev.organizer &&
                                            sameAddress(address, ev.organizer)
                                          return (
                                            <>
                                              {!isMine && (
                                                <button
                                                  type="button"
                                                  className="btn btn-primary h-9 text-xs"
                                                  onClick={() => selectEventForAttend(ev)}
                                                >
                                                  <UserCheck
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden
                                                  />
                                                  Attend
                                                </button>
                                              )}
                                              {isMine && (
                                                <button
                                                  type="button"
                                                  className="btn btn-primary h-9 text-xs"
                                                  onClick={() => selectEventForIssue(ev)}
                                                >
                                                  <BadgeCheck
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden
                                                  />
                                                  Issue credential
                                                </button>
                                              )}
                                              {isMine && (
                                                <p className="w-full text-[11px] text-muted-foreground">
                                                  You are the organizer — others check in free
                                                  (no gas); you issue credentials (uses gas).
                                                </p>
                                              )}
                                            </>
                                          )
                                        })()}
                                        {ev.metadata && (
                                          <p className="w-full break-all font-mono text-[11px] text-muted-foreground">
                                            {ev.metadata}
                                          </p>
                                        )}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </motion.li>
                            )
                          })}
                      </ul>
                    )}
                  </div>
                )}

                {/* ── Create ── */}
                {view === 'create' && (
                  <div className="mx-auto max-w-lg space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">Create event</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Data is stored immutably on BOT Chain.
                      </p>
                    </div>
                    <form className="card space-y-4 p-5" onSubmit={handleCreateEvent}>
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
                          <span className="ml-1 font-normal text-muted-foreground">
                            (optional)
                          </span>
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
                      <button
                        type="submit"
                        className="btn btn-primary w-full"
                        disabled={busy}
                        aria-busy={busy}
                      >
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
                  </div>
                )}

                {/* ── Attend (gasless) ── */}
                {view === 'attend' && (
                  <div className="mx-auto max-w-lg space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">Attend</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Free check-in: sign a message in your wallet.{' '}
                        <span className="font-medium text-foreground">No gas</span> — this
                        is not a blockchain transaction. Organizers pay gas only when they
                        issue credentials.
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Gas free:</span> Attend
                      uses a signature only. On-chain gas is only for{' '}
                      <span className="text-foreground">Create event</span> and{' '}
                      <span className="text-foreground">Issue credential</span>.
                    </div>
                    <form className="card space-y-4 p-5" onSubmit={handleAttend}>
                      {selectedEvent && (
                        <div className="rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
                          <p className="text-xs text-muted-foreground">Selected event</p>
                          <p className="mt-0.5 font-medium">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{selectedEvent.id}
                            </span>{' '}
                            {selectedEvent.name}
                          </p>
                        </div>
                      )}
                      <div>
                        <label htmlFor="attend-id" className="label">
                          Event ID
                        </label>
                        <input
                          id="attend-id"
                          type="number"
                          min="0"
                          className="input font-mono"
                          placeholder="0"
                          value={attendEventId}
                          onChange={(e) => {
                            setAttendEventId(e.target.value)
                            setFieldError('')
                          }}
                          required
                        />
                      </div>
                      {isOrganizerOfAttendEvent && (
                        <div
                          role="status"
                          className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-sm"
                        >
                          <XCircle
                            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                            aria-hidden
                          />
                          <p className="leading-relaxed text-muted-foreground">
                            <span className="font-medium text-foreground">
                              You are the organizer.
                            </span>{' '}
                            Share Event ID #{String(attendEventId)} so others can check in
                            free. Then use <span className="text-foreground">Issue</span>{' '}
                            to mint their credentials (you pay gas for issue).
                          </p>
                        </div>
                      )}
                      {!isOrganizerOfAttendEvent &&
                        alreadyAttended &&
                        attendIdParsed !== null && (
                        <div
                          role="status"
                          className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-sm"
                        >
                          <CheckCircle2
                            className="mt-0.5 h-4 w-4 shrink-0 text-success"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="leading-relaxed text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Already checked in (free).
                              </span>{' '}
                              Share this address with the organizer so they can issue your
                              credential:
                            </p>
                            <p className="break-all font-mono text-xs text-foreground">
                              {address}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          className="btn btn-primary flex-1"
                          disabled={
                            busy ||
                            alreadyAttended ||
                            isOrganizerOfAttendEvent
                          }
                          aria-busy={isPreChecking || isSigning}
                        >
                          {isPreChecking ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              Checking…
                            </>
                          ) : isSigning ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              Sign in wallet…
                            </>
                          ) : isOrganizerOfAttendEvent ? (
                            'Organizers cannot attend'
                          ) : alreadyAttended ? (
                            'Already checked in'
                          ) : (
                            'Check in free · no gas'
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => navigate('events')}
                        >
                          Pick from list
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ── Issue ── */}
                {view === 'issue' && (
                  <div className="mx-auto max-w-lg space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">
                        Issue credential
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        On-chain mint to an attendee wallet (uses gas). Check-in for them
                        is free; this step writes the credential to BOT Chain.
                        After success, a <strong className="font-medium text-foreground">Credential ID</strong> appears for verification.
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                      Requirements: you must be the{' '}
                      <span className="text-foreground">event organizer</span>, enter the
                      attendee&apos;s wallet (not yours), and this transaction uses gas.
                    </div>
                    <form className="card space-y-4 p-5" onSubmit={handleIssue}>
                      {selectedEvent && (
                        <div className="rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
                          <p className="text-xs text-muted-foreground">Selected event</p>
                          <p className="mt-0.5 font-medium">
                            <span className="font-mono text-xs text-muted-foreground">
                              #{selectedEvent.id}
                            </span>{' '}
                            {selectedEvent.name}
                          </p>
                        </div>
                      )}
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
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="issue-recipient" className="label">
                          Recipient address (attendee)
                        </label>
                        <input
                          id="issue-recipient"
                          className="input font-mono text-xs"
                          placeholder="0x… wallet that attended"
                          value={issueRecipient}
                          onChange={(e) => setIssueRecipient(e.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          required
                        />
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Paste the attendee&apos;s wallet (they check in free). Not your
                          own organizer address.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          className="btn btn-primary flex-1"
                          disabled={busy}
                          aria-busy={busy}
                        >
                          {busy ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                              Issuing…
                            </>
                          ) : (
                            'Issue credential'
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => navigate('events')}
                        >
                          Pick event
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ── Verify ── */}
                {view === 'verify' && (
                  <div className="mx-auto max-w-lg space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">
                        Verify credential
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Anyone can check authenticity by credential ID.
                      </p>
                    </div>
                    <form className="card space-y-4 p-5" onSubmit={handleVerify}>
                      <div>
                        <label htmlFor="verify-id" className="label">
                          Credential ID
                        </label>
                        <input
                          id="verify-id"
                          type="number"
                          min="0"
                          className="input font-mono"
                          placeholder="0"
                          value={verifyCredId}
                          onChange={(e) => setVerifyCredId(e.target.value)}
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary w-full"
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

                      <AnimatePresence mode="wait">
                        {verifyResult !== null && (
                          <motion.div
                            key={verifyResult ? 'valid' : 'invalid'}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2.5 text-sm"
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
                            className="text-sm text-destructive"
                            role="alert"
                          >
                            {verifyError}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </form>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Success popup — closable overlay */}
      <AnimatePresence>
        {lastResult && (
          <ActionResultModal
            key={`result-${lastResult.title}-${lastResult.credentialId ?? lastResult.eventId}`}
            result={lastResult}
            copied={copied}
            onCopy={copyId}
            onClose={() => setLastResult(null)}
            reduceMotion={reduceMotion}
            onVerify={
              lastResult.credentialId !== undefined && lastResult.credentialId !== null
                ? goVerify
                : undefined
            }
          />
        )}
      </AnimatePresence>
    </div>
  )
}
