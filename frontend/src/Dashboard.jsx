import { useEffect, useState, useCallback } from 'react'
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
  BadgeCheck,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
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
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

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

  const connector = connectors[0]

  const navigate = useCallback((id) => {
    setView(id)
    setSidebarOpen(false)
    setFieldError('')
    setVerifyError(null)
  }, [])

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
      if (/user rejected|denied|rejected the request/i.test(msg)) {
        setTxStatus('')
        reset()
      } else {
        setTxStatus(msg)
      }
    }
  }, [isPending, isConfirming, isSuccess, error, refetchCount, reset])

  // Esc closes mobile sidebar
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const busy = isPending || isConfirming
  const count = Number(eventCount ?? 0)
  const activeCount = events.filter((e) => e.isActive).length
  const currentNav = NAV.find((n) => n.id === view)

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
    e?.preventDefault?.()
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
    create: 'Publish a new event to BOT Chain.',
    attend: 'Check in to an event with your wallet.',
    issue: 'Mint a credential to an attendee.',
    verify: 'Confirm a credential by ID.',
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
                    fieldError || error
                      ? 'error'
                      : isSuccess
                        ? 'success'
                        : 'pending'
                  }
                  onDismiss={() => {
                    setTxStatus('')
                    setFieldError('')
                    reset()
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
                            desc: 'Check in with your wallet',
                          },
                          {
                            id: 'issue',
                            icon: BadgeCheck,
                            title: 'Issue credential',
                            desc: 'Mint to an attendee address',
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
                                        <button
                                          type="button"
                                          className="btn btn-primary h-9 text-xs"
                                          onClick={() => selectEventForAttend(ev)}
                                        >
                                          <UserCheck className="h-3.5 w-3.5" aria-hidden />
                                          Attend
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-outline h-9 text-xs"
                                          onClick={() => selectEventForIssue(ev)}
                                        >
                                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                                          Issue credential
                                        </button>
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

                {/* ── Attend ── */}
                {view === 'attend' && (
                  <div className="mx-auto max-w-lg space-y-6">
                    <div>
                      <h2 className="text-2xl font-semibold tracking-tight">Attend</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Check in to an event with one transaction.
                      </p>
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
                          onChange={(e) => setAttendEventId(e.target.value)}
                          required
                        />
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
                              Submitting…
                            </>
                          ) : (
                            'Attend event'
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
                        Mint a verifiable credential to an attendee.
                      </p>
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
                          Recipient address
                        </label>
                        <input
                          id="issue-recipient"
                          className="input font-mono text-xs"
                          placeholder="0x…"
                          value={issueRecipient}
                          onChange={(e) => setIssueRecipient(e.target.value)}
                          autoComplete="off"
                          spellCheck={false}
                          required
                        />
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
    </div>
  )
}
