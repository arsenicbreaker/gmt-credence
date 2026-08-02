import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAccount, useConnect } from 'wagmi'
import {
  ArrowRight,
  BadgeCheck,
  CalendarPlus,
  Search,
  UserCheck,
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────
 * PAGE CONTENT STORYBOARD
 *
 * Static shell (nav) never re-animates.
 * Only page content cascades in on mount.
 *
 *    0ms   blank — content not yet visible
 *   40ms   badge fades in
 *  100ms   hero title slides up
 *  180ms   subtitle fades in
 *  260ms   CTA appears
 *  380ms   feature cards stagger (60ms each)
 *  620ms   footer fades in
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  badge: 40,
  title: 100,
  subtitle: 180,
  cta: 260,
  features: 380,
  footer: 620,
}

const SPRING = { type: 'spring', stiffness: 350, damping: 28 }
const CARDS = {
  stagger: 0.06,
  offsetY: 16,
  spring: { type: 'spring', stiffness: 280, damping: 26 },
}

const FEATURES = [
  {
    icon: CalendarPlus,
    title: 'Create events',
    desc: 'Publish an on-chain event with name, date, and metadata.',
  },
  {
    icon: UserCheck,
    title: 'Attend',
    desc: 'Connect a wallet and check in with a single transaction.',
  },
  {
    icon: BadgeCheck,
    title: 'Issue credentials',
    desc: 'Mint a verifiable credential to any attendee address.',
  },
  {
    icon: Search,
    title: 'Verify',
    desc: 'Anyone can check authenticity by credential ID.',
  },
]

function truncate(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export default function Landing() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const reduceMotion = useReducedMotion()
  const [stage, setStage] = useState(reduceMotion ? 6 : 0)

  useEffect(() => {
    if (reduceMotion) {
      setStage(6)
      return
    }
    const timers = [
      setTimeout(() => setStage(1), TIMING.badge),
      setTimeout(() => setStage(2), TIMING.title),
      setTimeout(() => setStage(3), TIMING.subtitle),
      setTimeout(() => setStage(4), TIMING.cta),
      setTimeout(() => setStage(5), TIMING.features),
      setTimeout(() => setStage(6), TIMING.footer),
    ]
    return () => timers.forEach(clearTimeout)
  }, [reduceMotion])

  const connector = connectors[0]
  const handleConnect = () => {
    if (connector) connect({ connector })
  }

  const visible = (n) => (reduceMotion ? true : stage >= n)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav — static shell */}
      <header className="sticky top-0 z-20 border-b border-border bg-background backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground"
              aria-hidden
            >
              C
            </span>
            Credence
          </a>

          <div className="flex items-center gap-2">
            {!isConnected ? (
              <button
                type="button"
                className="btn btn-primary h-9 px-3 text-sm"
                onClick={handleConnect}
                disabled={isPending || !connector}
                aria-busy={isPending}
              >
                {isPending ? 'Connecting…' : 'Connect wallet'}
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-success"
                  aria-hidden
                />
                <span className="font-mono tabular-nums text-muted-foreground">
                  {truncate(address)}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto flex max-w-5xl flex-col items-start px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{
              opacity: visible(1) ? 1 : 0,
              y: visible(1) ? 0 : 8,
            }}
            transition={SPRING}
          >
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              BOT Chain · Verifiable credentials
            </span>
          </motion.div>

          <motion.h1
            className="mt-6 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{
              opacity: visible(2) ? 1 : 0,
              y: visible(2) ? 0 : 16,
            }}
            transition={SPRING}
          >
            Credentials you can prove.
            <span className="mt-1 block text-muted-foreground">
              On-chain. Immutable.
            </span>
          </motion.h1>

          <motion.p
            className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{
              opacity: visible(3) ? 1 : 0,
              y: visible(3) ? 0 : 12,
            }}
            transition={SPRING}
          >
            Issue, attend, and verify credentials on BOT Chain. No middlemen.
            No screenshots as proof.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center gap-3"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{
              opacity: visible(4) ? 1 : 0,
              y: visible(4) ? 0 : 12,
            }}
            transition={SPRING}
          >
            {!isConnected ? (
              <button
                type="button"
                className="btn btn-primary h-11 px-5"
                onClick={handleConnect}
                disabled={isPending || !connector}
                aria-busy={isPending}
              >
                {isPending ? 'Connecting…' : 'Connect wallet'}
                {!isPending && <ArrowRight className="h-4 w-4" aria-hidden />}
              </button>
            ) : (
              <a href="#dashboard" className="btn btn-primary h-11 px-5">
                Open dashboard
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            )}
            <a
              href="#how"
              className="btn btn-outline h-11 px-5"
            >
              How it works
            </a>
          </motion.div>
        </section>

        {/* Features */}
        <section
          id="how"
          className="border-t border-border bg-muted"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
            <h2
              id="features-heading"
              className="text-sm font-medium uppercase tracking-wider text-muted-foreground"
            >
              How it works
            </h2>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f, i) => {
                const Icon = f.icon
                return (
                  <motion.article
                    key={f.title}
                    className="card p-5 shadow-soft"
                    initial={reduceMotion ? false : { opacity: 0, y: CARDS.offsetY }}
                    animate={{
                      opacity: visible(5) ? 1 : 0,
                      y: visible(5) ? 0 : CARDS.offsetY,
                    }}
                    transition={{
                      ...CARDS.spring,
                      delay: reduceMotion ? 0 : i * CARDS.stagger,
                    }}
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background">
                      <Icon className="h-4 w-4 text-foreground" aria-hidden />
                    </div>
                    <h3 className="section-title">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {f.desc}
                    </p>
                  </motion.article>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      <motion.footer
        className="border-t border-border"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: visible(6) ? 1 : 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
          <span>Built for Girl Meets Tech · BOT Chain Hackathon</span>
          <span className="font-mono tabular-nums">Credence v1</span>
        </div>
      </motion.footer>
    </div>
  )
}
