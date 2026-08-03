import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAccount, useConnect } from 'wagmi'
import {
  ArrowRight,
  BadgeCheck,
  Box,
  CalendarPlus,
  Check,
  ExternalLink,
  Lock,
  Search,
  ShieldCheck,
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
 *  300ms   certificate mockup enters
 *  380ms   feature cards stagger (60ms each)
 *  620ms   footer fades in
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  badge: 40,
  title: 100,
  subtitle: 180,
  cta: 260,
  cert: 300,
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
    desc: 'Free check-in with a wallet signature — no gas.',
  },
  {
    icon: BadgeCheck,
    title: 'Issue credentials',
    desc: 'Mint a verifiable credential on-chain (uses gas).',
  },
  {
    icon: Search,
    title: 'Verify',
    desc: 'Anyone can check authenticity by credential ID.',
  },
]

/** Side info cards — match Refrence.png stack on the right */
const SIDE_CARDS = [
  {
    id: 'verified',
    title: 'Verified',
    desc: 'Cryptographically verifiable',
    icon: ShieldCheck,
    delay: 0,
  },
  {
    id: 'nft',
    title: 'NFT Credential',
    desc: 'Stored on-chain as NFT',
    icon: Box,
    delay: 0.35,
  },
  {
    id: 'immutable',
    title: 'Immutable',
    desc: 'Tamper-proof and permanent',
    icon: Lock,
    delay: 0.7,
  },
]

function truncate(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Decorative QR-style grid — visual mockup only */
function QrMock({ size = 84 }) {
  const n = 13
  const inFinder = (r, c, r0, c0) => r >= r0 && r < r0 + 3 && c >= c0 && c < c0 + 3
  const finderOn = (r, c, r0, c0) => {
    const rr = r - r0
    const cc = c - c0
    return rr === 0 || rr === 2 || cc === 0 || cc === 2 || (rr === 1 && cc === 1)
  }
  const cells = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let fill = false
      if (inFinder(r, c, 0, 0)) fill = finderOn(r, c, 0, 0)
      else if (inFinder(r, c, 0, n - 3)) fill = finderOn(r, c, 0, n - 3)
      else if (inFinder(r, c, n - 3, 0)) fill = finderOn(r, c, n - 3, 0)
      else fill = (r * 5 + c * 11 + r * c) % 3 === 0 || (r + c * 2) % 5 === 0
      cells.push(fill)
    }
  }

  return (
    <div
      className="shrink-0 rounded-lg border border-[#E5E5E5] bg-white p-2 dark:border-border dark:bg-card"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <div
        className="grid h-full w-full gap-[1px]"
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
      >
        {cells.map((on, i) => (
          <span
            key={i}
            className={on ? 'rounded-[0.5px] bg-foreground' : 'bg-transparent'}
          />
        ))}
      </div>
    </div>
  )
}

function HexagonWatermark() {
  return (
    <div
      className="pointer-events-none absolute right-4 top-16 select-none sm:right-6 sm:top-14"
      aria-hidden
    >
      <svg
        width="148"
        height="160"
        viewBox="0 0 148 160"
        fill="none"
        className="text-foreground opacity-[0.06] dark:opacity-[0.09]"
      >
        <path
          d="M74 4L140 42V118L74 156L8 118V42L74 4Z"
          stroke="currentColor"
          strokeWidth="3.5"
          fill="none"
        />
        <path
          d="M74 28L116 52V100L74 124L32 100V52L74 28Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.7"
        />
        <text
          x="74"
          y="92"
          textAnchor="middle"
          className="fill-current font-sans"
          style={{ fontSize: 42, fontWeight: 600, letterSpacing: '-0.04em' }}
        >
          C
        </text>
      </svg>
    </div>
  )
}

/**
 * Premium SaaS certificate mockup — layout matches frontend/Refrence.png
 * (HackQuest Bootcamp · Ocean · side property cards · dark explorer footer)
 */
function CertificateMockup({ reduceMotion, visible }) {
  const floatTransition = reduceMotion
    ? { duration: 0 }
    : {
        y: {
          duration: 4.5,
          repeat: Infinity,
          repeatType: 'mirror',
          ease: 'easeInOut',
        },
      }

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[440px] select-none lg:max-w-none"
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
      animate={{
        opacity: visible ? 1 : 0,
        y: visible ? 0 : 20,
        scale: visible ? 1 : 0.98,
      }}
      transition={SPRING}
      role="img"
      aria-label="Sample digital certificate of attendance for Ocean, issued by HackQuest"
    >
      {/* Dotted grid backdrop */}
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] opacity-70 dark:opacity-25 sm:-inset-10"
        style={{
          backgroundImage:
            'radial-gradient(circle, oklch(0.72 0 0 / 0.5) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      />

      {/* Ambient soft shadow pool */}
      <div
        className="pointer-events-none absolute inset-x-10 bottom-2 -z-10 h-20 translate-y-4 rounded-full bg-foreground/[0.05] blur-3xl dark:bg-foreground/[0.12]"
        aria-hidden
      />

      <div className="relative flex items-stretch gap-3 sm:gap-4">
        {/* Main certificate — float + hover */}
        <motion.div
          className="relative z-10 min-w-0 flex-1 origin-center"
          animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
          transition={floatTransition}
          whileHover={reduceMotion ? undefined : { scale: 1.015 }}
        >
          <div className="overflow-hidden rounded-[24px] border border-[#E5E5E5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06),0_24px_56px_rgba(0,0,0,0.06)] dark:border-border dark:bg-card dark:shadow-[0_1px_2px_rgba(0,0,0,0.25),0_20px_48px_rgba(0,0,0,0.4)]">
            {/* Body */}
            <div className="relative px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
              <HexagonWatermark />

              {/* Header: label + verified */}
              <div className="relative flex items-start justify-between gap-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Certificate of Attendance
                </p>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[oklch(0.72_0.08_150)] bg-[oklch(0.96_0.03_150)] px-2.5 py-1 text-[11px] font-medium text-[oklch(0.42_0.1_150)] dark:border-[oklch(0.55_0.1_150)]/40 dark:bg-[oklch(0.72_0.12_150)]/10 dark:text-[oklch(0.78_0.1_150)]">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  Verified
                </span>
              </div>

              {/* Issuer */}
              <div className="relative mt-5 flex items-center gap-2.5">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] text-[11px] font-semibold tracking-tight text-foreground dark:border-border dark:bg-muted"
                  aria-hidden
                >
                  HQ
                </span>
                <div>
                  <p className="text-sm font-medium leading-none tracking-tight">
                    HackQuest
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Issuer</p>
                </div>
              </div>

              {/* Recipient */}
              <div className="relative mt-6 max-w-[70%]">
                <p className="text-3xl font-semibold tracking-tight sm:text-[2rem]">
                  Ocean
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  has successfully attended
                </p>
                <p className="mt-2 text-base font-semibold tracking-tight sm:text-lg">
                  HackQuest Bootcamp
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Web3 Developer Program
                </p>
              </div>

              {/* Meta + QR */}
              <div className="relative mt-7 flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-wrap gap-5">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Credential ID
                    </p>
                    <p className="mt-1.5 inline-flex rounded-md border border-[#E5E5E5] bg-[#FAFAFA] px-2.5 py-1 font-mono text-xs tabular-nums text-foreground dark:border-border dark:bg-muted">
                      0x9a31…de45
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Issued on
                    </p>
                    <p className="mt-1.5 text-sm font-medium tabular-nums">
                      Aug 2, 2026
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <QrMock size={84} />
                  <p className="text-[10px] text-muted-foreground">Scan to verify</p>
                </div>
              </div>

              {/* Chain verification note */}
              <div className="relative mt-6 flex items-start gap-2.5 border-t border-[#E5E5E5] pt-4 dark:border-border">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[oklch(0.96_0.03_150)] text-[oklch(0.42_0.1_150)] dark:bg-[oklch(0.72_0.12_150)]/15 dark:text-[oklch(0.78_0.1_150)]">
                  <ShieldCheck className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-medium">Verified on BOT Chain</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    This credential is minted as an NFT and stored on-chain.
                  </p>
                </div>
              </div>
            </div>

            {/* Dark product footer */}
            <div className="flex items-center justify-between gap-3 bg-[#1A1A1A] px-5 py-3.5 text-white dark:bg-[#0F0F0F] sm:px-6">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded bg-white/10"
                  aria-hidden
                >
                  <Box className="h-3 w-3 text-white/90" strokeWidth={2} />
                </span>
                <span className="text-xs font-medium tracking-tight">BOT Chain</span>
              </div>
              <a
                href="https://scan.bohr.life/address/0xb73E31CA3eAD386661dcf92A7Fb461e02aC1518C"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-white/80 transition-colors duration-100 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                onClick={(e) => e.stopPropagation()}
              >
                View on explorer
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          </div>
        </motion.div>

        {/* Right stack — glass property cards (as in reference) */}
        <div className="relative z-20 hidden w-[132px] shrink-0 flex-col justify-center gap-2.5 sm:flex sm:w-[148px]">
          {/* Connector line */}
          <div
            className="pointer-events-none absolute -left-3 top-1/2 hidden h-[58%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-[#D4D4D4] to-transparent dark:via-border lg:block"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -left-3 top-1/2 hidden h-1.5 w-1.5 -translate-x-[2.5px] -translate-y-1/2 rounded-full border border-[#D4D4D4] bg-white dark:border-border dark:bg-card lg:block"
            aria-hidden
          />

          {SIDE_CARDS.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.id}
                className="rounded-xl border border-[#E5E5E5]/90 bg-white/75 p-3 shadow-[0_2px_12px_rgba(0,0,0,0.04)] backdrop-blur-md dark:border-border dark:bg-card/80 dark:shadow-[0_2px_12px_rgba(0,0,0,0.25)]"
                initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                animate={
                  reduceMotion
                    ? { opacity: visible ? 1 : 0 }
                    : {
                        opacity: visible ? 1 : 0,
                        x: visible ? 0 : 12,
                        y: [0, -5, 0],
                      }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        opacity: { duration: 0.35, delay: 0.15 + i * 0.08 },
                        x: { type: 'spring', stiffness: 300, damping: 28, delay: 0.15 + i * 0.08 },
                        y: {
                          duration: 3.6 + i * 0.35,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: card.delay,
                        },
                      }
                }
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#E5E5E5] bg-white dark:border-border dark:bg-muted">
                    <Icon className="h-3 w-3 text-foreground/70" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold leading-tight tracking-tight">
                      {card.title}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Mobile: horizontal chips under certificate */}
      <div className="mt-3 flex flex-wrap gap-2 sm:hidden">
        {SIDE_CARDS.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white/80 px-2.5 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur-sm dark:border-border dark:bg-card/80"
            >
              <Icon className="h-3 w-3 text-foreground/70" aria-hidden />
              {card.title}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
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
  // Certificate enters with CTA (stage 4)
  const certVisible = visible(4)

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav — full width, brand left / action right */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <a
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          >
            <img
              src="/logo.png"
              alt=""
              width={24}
              height={24}
              className="h-6 w-6 rounded-md object-cover"
              aria-hidden
            />
            Credence
          </a>

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
      </header>

      <main>
        {/* Hero — two column: left copy unchanged, right certificate */}
        <section className="relative mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-12 lg:max-w-6xl lg:grid-cols-2 lg:gap-8 lg:pb-20 lg:pt-14 xl:max-w-7xl xl:gap-12">
          {/* LEFT — unchanged content */}
          <div className="flex flex-col items-start">
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
          </div>

          {/* RIGHT — certificate mockup (elevated, matches Refrence.png) */}
          <div className="relative z-10 w-full lg:translate-y-4 xl:translate-y-6">
            <CertificateMockup reduceMotion={reduceMotion} visible={certVisible} />
          </div>
        </section>

        {/* Features */}
        <section
          id="how"
          className="border-t border-border bg-muted"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:max-w-6xl">
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
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6 lg:max-w-6xl">
          <span>Built for Girl Meets Tech · BOT Chain Hackathon</span>
          <span className="font-mono tabular-nums">Credence v1</span>
        </div>
      </motion.footer>
    </div>
  )
}
