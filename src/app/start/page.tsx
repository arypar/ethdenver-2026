"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

// ─── Scene definitions ──────────────────────────────────────────────────────────
type Scene =
  | "titleDrop"
  | "theHook"
  | "pillarsReveal"
  | "howItWorks"
  | "connectWallet"
  | "launchCta";

const SCENES: Scene[] = [
  "titleDrop",
  "theHook",
  "pillarsReveal",
  "howItWorks",
  "connectWallet",
  "launchCta",
];

const SCENE_DURATIONS: Record<Scene, number | null> = {
  titleDrop: 9000,
  theHook: 8500,
  pillarsReveal: 10000,
  howItWorks: 5000,
  connectWallet: null,
  launchCta: null,
};

// ─── Shared transition ──────────────────────────────────────────────────────────
const pageTransition = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

// ─── Pillar data ────────────────────────────────────────────────────────────────
const PILLARS = [
  {
    id: "intelligence",
    title: "Intelligence",
    quote:
      "Real-time charts on any pool — price, volume, fees, liquidity — streaming live.",
    tags: ["Uniswap V3", "nad.fun", "QuickNode"],
    color: "#FF007A",
    colorRgb: "255,0,122",
  },
  {
    id: "rules",
    title: "Rules Engine",
    quote:
      "Drag. Drop. Automate. Your strategy watches the chain 24/7.",
    tags: ["Drag & Drop", "Conditions", "Triggers"],
    color: "#7B61FF",
    colorRgb: "123,97,255",
  },
  {
    id: "actions",
    title: "Actions",
    quote:
      "When your rules fire, act instantly. One click to swap.",
    tags: ["Swap", "Alerts", "Execute"],
    color: "#34D399",
    colorRgb: "52,211,153",
  },
];

// ─── Seeded random for SSR-safe positions ───────────────────────────────────────
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ─── Chaintology Logo SVG (scaled) ──────────────────────────────────────────────
function ChaintologyLogo({ size = 120 }: { size?: number }) {
  const id = useMemo(() => `ct-g-${Math.floor(seededRandom(42) * 1e6)}`, []);
  return (
    <div
      className="relative flex items-center justify-center rounded-3xl"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, rgba(255,0,122,0.14), rgba(123,97,255,0.14))",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        style={{ width: size * 0.6, height: size * 0.6 }}
      >
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF007A" />
            <stop offset="100%" stopColor="#7B61FF" />
          </linearGradient>
        </defs>
        <path
          d="M15 7a5 5 0 1 0 0 10"
          stroke={`url(#${id})`}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="15" cy="7" r="1.8" fill="#FF007A" />
        <circle cx="15" cy="17" r="1.8" fill="#7B61FF" />
        <circle cx="9.5" cy="12" r="1.2" fill="white" fillOpacity="0.55" />
      </svg>
      <div
        className="absolute inset-0 rounded-3xl border border-white/[0.06]"
        style={{
          boxShadow:
            "0 0 30px rgba(255,0,122,0.15), 0 0 60px rgba(123,97,255,0.08)",
        }}
      />
    </div>
  );
}

// ─── Pillar Icon SVGs ───────────────────────────────────────────────────────────
function IntelligenceIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      style={{ width: size, height: size }}
    >
      <path
        d="M4 24 L8 16 L12 20 L16 8 L20 14 L24 6 L28 12"
        stroke="#FF007A"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="8" r="2" fill="#FF007A" fillOpacity="0.6" />
      <circle cx="24" cy="6" r="2" fill="#FF007A" fillOpacity="0.4" />
    </svg>
  );
}

function RulesIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      style={{ width: size, height: size }}
    >
      <rect
        x="4"
        y="4"
        width="10"
        height="10"
        rx="2"
        stroke="#7B61FF"
        strokeWidth="2"
      />
      <rect
        x="18"
        y="18"
        width="10"
        height="10"
        rx="2"
        stroke="#7B61FF"
        strokeWidth="2"
      />
      <path
        d="M14 9 L18 9 M23 14 L23 18"
        stroke="#7B61FF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
      <circle cx="23" cy="9" r="3" fill="#7B61FF" fillOpacity="0.3" />
    </svg>
  );
}

function ActionsIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      style={{ width: size, height: size }}
    >
      <path
        d="M18 2 L8 18 H16 L14 30 L24 14 H16 Z"
        fill="#34D399"
        fillOpacity="0.2"
        stroke="#34D399"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Floating Particles Background ──────────────────────────────────────────────
function FloatingParticles({
  count = 10,
  seed = 0,
}: {
  count?: number;
  seed?: number;
}) {
  const PARTICLE_COLORS = ["#FF007A", "#7B61FF", "#ffffff"];

  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        x: Math.round(seededRandom(seed + i * 7) * 100),
        y: Math.round(seededRandom(seed + i * 13) * 100),
        size: Math.round(seededRandom(seed + i * 19) * 4 + 3),
        delay: Math.round(seededRandom(seed + i * 23) * 60) / 10,
        duration: Math.round(seededRandom(seed + i * 29) * 80 + 100) / 10,
        drift: Math.round((seededRandom(seed + i * 37) - 0.5) * 60),
        colorIdx: Math.floor(seededRandom(seed + i * 43) * PARTICLE_COLORS.length),
      })),
    [count, seed] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: PARTICLE_COLORS[p.colorIdx],
            boxShadow: `0 0 ${p.size * 2}px ${PARTICLE_COLORS[p.colorIdx]}`,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.15, 0.08, 0.15, 0],
            y: [0, p.drift, -p.drift, 0],
            x: [0, p.drift * 0.5, -p.drift * 0.3, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

// ─── Particle Rain (title + CTA screens) ───────────────────────────────────────
function ParticleRain({
  count = 30,
  colors,
}: {
  count?: number;
  colors?: string[];
}) {
  const palette = colors || ["#FF007A", "#7B61FF", "#ffffff"];

  const dots = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        x: Math.round(seededRandom(i * 43 + 7) * 100),
        delay: Math.round(seededRandom(i * 17 + 3) * 40) / 10,
        duration: Math.round(seededRandom(i * 11 + 5) * 30 + 30) / 10,
        size: Math.round(seededRandom(i * 23 + 9) * 4 + 3),
        wobble: Math.round((seededRandom(i * 41 + 1) - 0.5) * 80),
        colorIdx: Math.floor(seededRandom(i * 53 + 8) * palette.length),
      })),
    [count, palette.length]
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {dots.map((s, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: -10,
            width: s.size,
            height: s.size,
            backgroundColor: palette[s.colorIdx],
            boxShadow: `0 0 ${s.size * 2}px ${palette[s.colorIdx]}`,
          }}
          animate={{
            y: [0, 1000],
            x: [0, s.wobble],
            opacity: [0.5, 0.3, 0],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────────
function ProgressBar({
  sceneIndex,
  total,
}: {
  sceneIndex: number;
  total: number;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const isActive = sceneIndex === i;
        const isDone = sceneIndex > i;
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              background: isActive
                ? "#FF007A"
                : isDone
                  ? "rgba(255,255,255,0.3)"
                  : "rgba(255,255,255,0.1)",
              boxShadow: isActive
                ? "0 0 12px rgba(255,0,122,0.5)"
                : "none",
            }}
            initial={false}
            animate={{
              width: isActive ? 28 : 8,
              height: 8,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          />
        );
      })}
    </div>
  );
}

// ─── Navigation Hint ────────────────────────────────────────────────────────────
function NavHint() {
  return (
    <motion.div
      className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.5 }}
    >
      <span
        className="text-[10px] tracking-[0.2em] uppercase"
        style={{ color: "rgba(255,255,255,0.2)" }}
      >
        use arrow keys
      </span>
    </motion.div>
  );
}

// ─── Scene 1: Title Drop ────────────────────────────────────────────────────────
function TitleDropScene() {
  const [phase, setPhase] = useState<"pre" | "slam" | "shake" | "settled">(
    "pre"
  );

  useEffect(() => {
    const t0 = requestAnimationFrame(() => setPhase("slam"));
    const t1 = setTimeout(() => setPhase("shake"), 600);
    const t2 = setTimeout(() => setPhase("settled"), 1100);
    return () => {
      cancelAnimationFrame(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={
        phase === "shake"
          ? {
              x: [0, -12, 14, -10, 8, -4, 2, 0],
              y: [0, 8, -6, 10, -8, 4, -2, 0],
            }
          : { x: 0, y: 0 }
      }
      transition={
        phase === "shake" ? { duration: 0.5, ease: "easeOut" } : {}
      }
      className="flex flex-col items-center justify-center h-full relative"
    >
      <ParticleRain count={35} />
      <FloatingParticles count={12} seed={42} />

      {/* Impact flash */}
      <AnimatePresence>
        {phase === "shake" && (
          <motion.div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{ background: "white" }}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>

      {/* Impact ring */}
      <AnimatePresence>
        {(phase === "shake" || phase === "settled") && (
          <motion.div
            className="absolute rounded-full z-10 pointer-events-none"
            style={{ border: "3px solid rgba(255,0,122,0.3)" }}
            initial={{ width: 0, height: 0, opacity: 0.8 }}
            animate={{ width: 1200, height: 1200, opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {/* Cycling gradient glow */}
      {phase === "settled" && (
        <motion.div
          className="absolute w-72 h-72 rounded-full"
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            background: [
              "radial-gradient(circle, rgba(255,0,122,0.15) 0%, transparent 70%)",
              "radial-gradient(circle, rgba(123,97,255,0.15) 0%, transparent 70%)",
              "radial-gradient(circle, rgba(255,0,122,0.15) 0%, transparent 70%)",
            ],
            scale: [2, 2.8, 2],
          }}
          transition={{
            opacity: { duration: 0.5 },
            background: { duration: 6, repeat: Infinity, ease: "linear" },
            scale: { duration: 6, repeat: Infinity, ease: "linear" },
          }}
        />
      )}

      {/* Logo — slams in */}
      <motion.div
        className="relative z-20"
        initial={{ y: -800, scale: 5, opacity: 0 }}
        animate={
          phase === "pre"
            ? { y: -800, scale: 5, opacity: 0 }
            : { y: 0, scale: 1, opacity: 1 }
        }
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <ChaintologyLogo size={120} />
      </motion.div>

      {/* Brand name */}
      <AnimatePresence>
        {phase === "settled" && (
          <motion.h1
            className="text-4xl sm:text-6xl mt-6 tracking-tight z-20 text-center font-bold"
            style={{ color: "#FFFFFF" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            Chaintology
          </motion.h1>
        )}
      </AnimatePresence>

      {/* Tagline */}
      <AnimatePresence>
        {phase === "settled" && (
          <motion.p
            className="text-base sm:text-lg mt-3 tracking-wide z-20 text-center"
            style={{ color: "rgba(255,255,255,0.45)" }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            On-chain intelligence, automated
          </motion.p>
        )}
      </AnimatePresence>

      {/* Powered by logos */}
      <AnimatePresence>
        {phase === "settled" && (
          <motion.div
            className="flex flex-col items-center z-20 mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.6 }}
          >
            <motion.p
              className="text-[10px] uppercase tracking-[0.35em] font-semibold mb-4"
              style={{ color: "rgba(255,255,255,0.2)" }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              Powered by
            </motion.p>
            <div className="flex items-center gap-6">
              {[
                { src: "/uniswap-uni-logo.png", alt: "Uniswap", w: 40 },
                { src: "/quicknode.webp", alt: "QuickNode", w: 40 },
                { src: "/monad.png", alt: "Monad", w: 40 },
              ].map((logo, i) => (
                <motion.div
                  key={logo.alt}
                  className="relative"
                  initial={{ opacity: 0, y: 16, scale: 0.7 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: 1.4 + i * 0.15,
                    type: "spring",
                    stiffness: 300,
                    damping: 18,
                  }}
                >
                  <motion.div
                    className="rounded-xl flex items-center justify-center"
                    style={{
                      width: 56,
                      height: 56,
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      backdropFilter: "blur(12px)",
                    }}
                    animate={{
                      boxShadow: [
                        "0 0 0px rgba(255,255,255,0)",
                        "0 0 20px rgba(255,255,255,0.06)",
                        "0 0 0px rgba(255,255,255,0)",
                      ],
                    }}
                    transition={{
                      duration: 3,
                      delay: i * 0.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.src}
                      alt={logo.alt}
                      style={{
                        width: logo.w,
                        height: logo.w,
                        objectFit: "contain",
                      }}
                      draggable={false}
                    />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slow rotating glow behind logo */}
      <motion.div
        className="absolute z-0 select-none rounded-full"
        style={{ width: 400, height: 400, opacity: 0.06 }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #FF007A, #7B61FF, #FF007A)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}

// ─── Scene 2: The Hook (sequential story) ───────────────────────────────────────
function TheHookScene() {
  const [beat, setBeat] = useState(0);
  const [counter, setCounter] = useState(0);
  const counterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setBeat(1), 1800);
    const t2 = setTimeout(() => setBeat(2), 4500);
    const t3 = setTimeout(() => setBeat(3), 6500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  useEffect(() => {
    if (beat !== 1) return;
    const id = setInterval(() => {
      setCounter((c) => {
        if (c >= 2400000000) {
          clearInterval(id);
          return 2400000000;
        }
        return Math.min(
          c + Math.floor(Math.random() * 80000000 + 20000000),
          2400000000
        );
      });
    }, 50);
    counterRef.current = id;
    return () => {
      clearInterval(id);
      counterRef.current = null;
    };
  }, [beat]);

  return (
    <motion.div
      {...pageTransition}
      className="flex flex-col items-center justify-center h-full relative px-6"
    >
      <FloatingParticles count={10} seed={99} />

      <AnimatePresence mode="wait">
        {beat === 0 && (
          <motion.div
            key="beat0"
            className="flex flex-col items-center z-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}
          >
            <h2
              className="text-3xl sm:text-5xl font-bold text-center leading-tight"
              style={{ color: "#FFFFFF" }}
            >
              Every second, thousands of
              <br />
              swaps hit the chain.
            </h2>
            <p
              className="text-base sm:text-lg mt-4 text-center"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Uniswap alone. Across every pool.
            </p>
          </motion.div>
        )}

        {beat === 1 && (
          <motion.div
            key="beat1"
            className="flex flex-col items-center z-10"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <p
              className="text-sm uppercase tracking-[0.3em] mb-4"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              daily swap volume
            </p>
            <span
              className="text-6xl sm:text-8xl font-bold tabular-nums"
              style={{
                letterSpacing: "-3px",
                color: "#FFFFFF",
                textShadow:
                  counter >= 2400000000
                    ? "0 0 40px rgba(255,0,122,0.3)"
                    : "none",
              }}
            >
              ${counter.toLocaleString()}
            </span>
          </motion.div>
        )}

        {beat === 2 && (
          <motion.div
            key="beat2"
            className="flex flex-col items-center z-10 px-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.5 }}
          >
            <h2
              className="text-3xl sm:text-5xl font-bold text-center leading-tight"
              style={{ color: "#FFFFFF" }}
            >
              Most traders see noise.
            </h2>
            <p
              className="text-base mt-4 text-center"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Thousands of swaps. No signal.
            </p>
          </motion.div>
        )}

        {beat === 3 && (
          <motion.div
            key="beat3"
            className="flex flex-col items-center z-10 px-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <h2
              className="text-3xl sm:text-5xl font-bold text-center leading-tight"
              style={{ color: "#FFFFFF" }}
            >
              What if you could see the
              <br />
              <span style={{ color: "#FF007A" }}>signals</span> — and{" "}
              <span style={{ color: "#7B61FF" }}>act on them</span>
              <br />
              instantly?
            </h2>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Scene 3: Pillars Reveal ────────────────────────────────────────────────────
function PillarsRevealScene() {
  const [phase, setPhase] = useState<"intro" | "reveal" | "showcase">("intro");
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 1200);
    const t2 = setTimeout(() => {
      setPhase("showcase");
      setActiveIdx(0);
    }, 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (phase !== "showcase" || activeIdx < 0) return;
    if (activeIdx >= PILLARS.length - 1) return;
    const t = setTimeout(() => setActiveIdx((prev) => prev + 1), 1800);
    return () => clearTimeout(t);
  }, [phase, activeIdx]);

  const pillarIcons = [
    <IntelligenceIcon key="int" size={36} />,
    <RulesIcon key="rul" size={36} />,
    <ActionsIcon key="act" size={36} />,
  ];

  return (
    <motion.div
      {...pageTransition}
      className="flex flex-col items-center justify-center h-full relative px-4 overflow-hidden"
    >
      <FloatingParticles count={8} seed={200} />

      {/* Title */}
      <motion.h2
        className="text-3xl sm:text-4xl font-bold z-10 mb-2 text-center"
        style={{ color: "#FFFFFF" }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.1,
          type: "spring",
          stiffness: 200,
          damping: 15,
        }}
      >
        Three pillars of Chaintology
      </motion.h2>
      <motion.p
        className="text-sm z-10 mb-10"
        style={{ color: "rgba(255,255,255,0.35)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Intelligence. Rules. Actions.
      </motion.p>

      {/* Pillar cards */}
      <div className="flex flex-col sm:flex-row gap-5 z-10 w-full max-w-3xl px-4">
        {PILLARS.map((pillar, i) => {
          const isVisible = phase === "reveal" || phase === "showcase";
          const isActive = phase === "showcase" && activeIdx === i;
          const isDone = phase === "showcase" && activeIdx > i;

          return (
            <motion.div
              key={pillar.id}
              className="flex-1 relative rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.04)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              initial={{ opacity: 0, y: 60, scale: 0.85 }}
              animate={{
                opacity: isVisible ? (isActive ? 1 : isDone ? 0.6 : 0.4) : 0,
                y: isVisible ? 0 : 60,
                scale: isActive ? 1.04 : 1,
              }}
              transition={{
                delay: isVisible ? 0.2 + i * 0.2 : 0,
                type: "spring",
                stiffness: 250,
                damping: 20,
              }}
            >
              {/* Top border glow */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${pillar.color}, transparent)`,
                  opacity: isActive ? 1 : 0.3,
                  transition: "opacity 0.5s ease",
                }}
              />

              <div className="p-6">
                {/* Icon */}
                <motion.div
                  className="mb-4"
                  animate={
                    isActive
                      ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }
                      : {}
                  }
                  transition={{
                    duration: 1.5,
                    repeat: isActive ? Infinity : 0,
                    repeatDelay: 0.5,
                  }}
                >
                  {pillarIcons[i]}
                </motion.div>

                {/* Title */}
                <h3
                  className="text-xl font-bold mb-2"
                  style={{
                    color: isActive ? pillar.color : "rgba(255,255,255,0.7)",
                    transition: "color 0.5s ease",
                  }}
                >
                  {pillar.title}
                </h3>

                {/* Quote */}
                <p
                  className="text-sm leading-relaxed mb-4"
                  style={{
                    color: isActive
                      ? "rgba(255,255,255,0.6)"
                      : "rgba(255,255,255,0.3)",
                    transition: "color 0.5s ease",
                  }}
                >
                  {pillar.quote}
                </p>

                {/* Tags */}
                <div className="flex gap-1.5 flex-wrap">
                  {pillar.tags.map((tag, j) => (
                    <motion.span
                      key={tag}
                      className="text-[10px] px-2.5 py-[3px] rounded-md font-semibold tracking-wide"
                      style={{
                        background: isActive
                          ? `rgba(${pillar.colorRgb}, 0.12)`
                          : "rgba(255,255,255,0.04)",
                        color: isActive
                          ? pillar.color
                          : "rgba(255,255,255,0.3)",
                        transition: "all 0.4s ease",
                      }}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: isActive ? 0.3 + j * 0.08 : 0.4 + i * 0.2,
                        type: "spring",
                        stiffness: 350,
                        damping: 18,
                      }}
                    >
                      {tag}
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* Active glow */}
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{
                    boxShadow: `inset 0 0 30px rgba(${pillar.colorRgb}, 0.06), 0 4px 30px rgba(${pillar.colorRgb}, 0.1)`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Pillar progress dots */}
      <motion.div
        className="flex items-center gap-2 z-10 mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "showcase" ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {PILLARS.map((pillar, i) => (
          <motion.div
            key={pillar.id}
            className="rounded-full"
            animate={{
              width: activeIdx === i ? 24 : 8,
              height: 8,
              background:
                activeIdx >= i ? pillar.color : "rgba(255,255,255,0.1)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── Scene 4: How It Works ──────────────────────────────────────────────────────
function HowItWorksScene() {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setBeat(1), 1200);
    const t2 = setTimeout(() => setBeat(2), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const beats = [
    {
      icon: <IntelligenceIcon size={40} />,
      text: "Track any pool",
      sub: "Live swap data, your way",
    },
    {
      icon: <span className="text-3xl">⚡</span>,
      text: "Build your rules",
      sub: "Set conditions, automate signals",
    },
    {
      icon: <span className="text-3xl">🎯</span>,
      text: "Execute instantly",
      sub: "One-click swaps when rules trigger",
    },
  ];

  const stepColors = [
    { color: "#FF007A", colorRgb: "255,0,122" },
    { color: "#7B61FF", colorRgb: "123,97,255" },
    { color: "#34D399", colorRgb: "52,211,153" },
  ];

  return (
    <motion.div
      {...pageTransition}
      className="flex flex-col items-center justify-center h-full px-6 relative overflow-hidden"
    >
      <FloatingParticles count={6} seed={500} />

      {/* Background glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(255,0,122,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Title */}
      <motion.h3
        className="text-3xl sm:text-4xl font-bold z-10 mb-2 text-center"
        style={{ color: "#FFFFFF" }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: 0.05,
          type: "spring",
          stiffness: 200,
          damping: 15,
        }}
      >
        How it works
      </motion.h3>
      <motion.p
        className="text-sm z-10 mb-10"
        style={{ color: "rgba(255,255,255,0.35)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        Three steps to automated DeFi
      </motion.p>

      {/* Steps with numbered connectors */}
      <div className="flex flex-col gap-0 z-10 w-full max-w-md">
        {beats.map((b, i) => {
          const active = beat >= i;
          const current = beat === i;
          const sc = stepColors[i];
          const num = `0${i + 1}`;

          return (
            <div key={i} className="flex items-stretch gap-0">
              {/* Left: number + connector line */}
              <div
                className="flex flex-col items-center"
                style={{ width: 48 }}
              >
                <motion.div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                  style={{
                    background: active ? sc.color : "rgba(255,255,255,0.06)",
                    color: active ? "#FFFFFF" : "rgba(255,255,255,0.2)",
                    boxShadow: current
                      ? `0 4px 16px rgba(${sc.colorRgb}, 0.3)`
                      : "none",
                    transition: "all 0.5s ease",
                  }}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{
                    scale: current ? 1.1 : 1,
                    opacity: 1,
                  }}
                  transition={{
                    delay: 0.1 + i * 0.08,
                    type: "spring",
                    stiffness: 300,
                    damping: 18,
                  }}
                >
                  {num}
                </motion.div>
                {i < beats.length - 1 && (
                  <motion.div
                    className="flex-1 w-0.5 my-1"
                    style={{
                      background:
                        beat > i
                          ? `linear-gradient(to bottom, ${sc.color}, ${stepColors[i + 1].color})`
                          : "rgba(255,255,255,0.06)",
                      transition: "background 0.6s ease",
                      minHeight: 24,
                    }}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                  />
                )}
              </div>

              {/* Right: step card */}
              <motion.div
                className="flex items-center gap-4 rounded-2xl px-5 py-4 mb-3 flex-1 ml-3"
                style={{
                  background: current
                    ? `linear-gradient(135deg, rgba(${sc.colorRgb}, 0.08), rgba(${sc.colorRgb}, 0.02))`
                    : active
                      ? "rgba(255,255,255,0.04)"
                      : "rgba(255,255,255,0.02)",
                  border: current
                    ? `1.5px solid rgba(${sc.colorRgb}, 0.2)`
                    : "1.5px solid transparent",
                  boxShadow: current
                    ? `0 4px 20px rgba(${sc.colorRgb}, 0.1)`
                    : "none",
                  transition: "all 0.5s ease",
                }}
                initial={{ opacity: 0, x: -30 }}
                animate={{
                  opacity: active ? 1 : 0.3,
                  x: 0,
                  scale: current ? 1.02 : 1,
                }}
                transition={{
                  delay: 0.15 + i * 0.12,
                  type: "spring",
                  stiffness: 250,
                  damping: 20,
                }}
              >
                <motion.div
                  className="shrink-0"
                  animate={
                    current
                      ? { scale: [1, 1.12, 1], rotate: [0, 6, -6, 0] }
                      : {}
                  }
                  transition={{
                    duration: 1.2,
                    repeat: current ? Infinity : 0,
                    repeatDelay: 0.6,
                  }}
                >
                  {b.icon}
                </motion.div>
                <div>
                  <p
                    className="text-lg sm:text-xl font-bold leading-tight"
                    style={{
                      color: active ? sc.color : "rgba(255,255,255,0.2)",
                      transition: "color 0.5s ease",
                    }}
                  >
                    {b.text}
                  </p>
                  <p
                    className="text-xs mt-0.5 font-medium"
                    style={{
                      color: active
                        ? "rgba(255,255,255,0.4)"
                        : "rgba(255,255,255,0.15)",
                      transition: "color 0.5s ease",
                    }}
                  >
                    {b.sub}
                  </p>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Scene 6: Connect Wallet ────────────────────────────────────────────────────
function ConnectWalletScene({
  onConnected,
}: {
  onConnected: () => void;
}) {
  const { isConnected, address } = useAccount();
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    if (isConnected && !celebrated) {
      setCelebrated(true);
      const timer = setTimeout(() => onConnected(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, celebrated, onConnected]);

  const confettiDots = useMemo(
    () =>
      Array.from({ length: 30 }).map((_, i) => ({
        x: seededRandom(i * 47 + 3) * 100,
        delay: seededRandom(i * 11) * 1,
        duration: seededRandom(i * 19) * 2 + 2,
        size: seededRandom(i * 23 + 9) * 5 + 3,
        color:
          i % 3 === 0
            ? "#FF007A"
            : i % 3 === 1
              ? "#7B61FF"
              : "#34D399",
        rotate: seededRandom(i * 31) * 720 - 360,
      })),
    []
  );

  return (
    <motion.div
      {...pageTransition}
      className="flex flex-col items-center justify-center h-full relative px-6"
    >
      <FloatingParticles count={12} seed={777} />

      {/* Confetti particle shower on connect */}
      {celebrated && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
          {confettiDots.map((dot, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${dot.x}%`,
                top: -10,
                width: dot.size,
                height: dot.size,
                backgroundColor: dot.color,
                boxShadow: `0 0 ${dot.size * 2}px ${dot.color}`,
              }}
              animate={{
                y: [0, 1000],
                rotate: [0, dot.rotate],
                opacity: [1, 0.6, 0],
              }}
              transition={{
                duration: dot.duration,
                delay: dot.delay,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      <motion.p
        className="text-xs uppercase tracking-[0.4em] mb-3 z-10"
        style={{ color: "rgba(255,255,255,0.25)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        Almost there
      </motion.p>

      {!isConnected ? (
        <>
          <motion.h2
            className="text-2xl sm:text-4xl font-bold mb-3 text-center z-10"
            style={{ color: "#FFFFFF" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Connect to unlock Chaintology
          </motion.h2>

          <motion.p
            className="text-sm mb-10 z-10"
            style={{ color: "rgba(255,255,255,0.3)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            You&apos;ll need a wallet to track positions and execute swaps
          </motion.p>

          <motion.div
            className="z-20"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.6,
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
          >
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => {
                const ready = mounted;
                return (
                  <div
                    {...(!ready && {
                      "aria-hidden": true,
                      style: {
                        opacity: 0,
                        pointerEvents: "none" as const,
                        userSelect: "none" as const,
                      },
                    })}
                  >
                    <motion.button
                      onClick={openConnectModal}
                      className="relative px-10 py-4 rounded-2xl text-lg font-bold tracking-wider cursor-pointer"
                      style={{
                        background:
                          "linear-gradient(135deg, #FF007A, #7B61FF)",
                        color: "white",
                        border: "none",
                        boxShadow:
                          "0 4px 20px rgba(255,0,122,0.25)",
                      }}
                      whileHover={{
                        scale: 1.06,
                        boxShadow:
                          "0 6px 30px rgba(255,0,122,0.35)",
                      }}
                      whileTap={{ scale: 0.96 }}
                    >
                      Connect Wallet
                    </motion.button>
                  </div>
                );
              }}
            </ConnectButton.Custom>
          </motion.div>
        </>
      ) : (
        <>
          <motion.h2
            className="text-2xl sm:text-4xl font-bold mb-4 text-center z-10"
            style={{ color: "#FFFFFF" }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 15,
            }}
          >
            Welcome to Chaintology
          </motion.h2>

          <motion.div
            className="px-6 py-3 rounded-2xl z-10 flex items-center gap-3"
            style={{
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: "#34D399",
                boxShadow: "0 0 8px rgba(52,211,153,0.5)",
              }}
            />
            <span
              className="text-sm font-mono"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : ""}
            </span>
          </motion.div>

          <motion.p
            className="text-sm mt-4 z-10"
            style={{ color: "rgba(255,255,255,0.3)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Taking you to the dashboard...
          </motion.p>
        </>
      )}
    </motion.div>
  );
}

// ─── Scene 6: Launch CTA ────────────────────────────────────────────────────────
function LaunchCtaScene() {
  const router = useRouter();

  const enter = useCallback(() => {
    router.push("/");
  }, [router]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") enter();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enter]);

  const orbitParticles = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => ({
        x: (seededRandom(i * 47 + 1) - 0.5) * 500,
        y: (seededRandom(i * 53 + 2) - 0.5) * 500,
        size: seededRandom(i * 59 + 3) * 5 + 2,
        delay: seededRandom(i * 61 + 4) * 2,
        duration: seededRandom(i * 67 + 5) * 3 + 3,
        color:
          i % 3 === 0
            ? "#FF007A"
            : i % 3 === 1
              ? "#7B61FF"
              : "#34D399",
      })),
    []
  );

  return (
    <motion.div
      {...pageTransition}
      className="flex flex-col items-center justify-center h-full relative overflow-hidden"
    >
      <ParticleRain count={35} colors={["#FF007A", "#7B61FF", "#34D399"]} />
      <FloatingParticles count={8} seed={999} />

      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: "radial-gradient(ellipse 80% 65% at 50% 40%, rgba(255,0,122,0.12) 0%, transparent 65%)",
        }}
      />

      {/* Expanding rings */}
      <motion.div
        className="absolute z-0 pointer-events-none"
        style={{
          width: 500,
          height: 500,
          border: "2px solid rgba(255,0,122,0.06)",
          borderRadius: "50%",
        }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 1, ease: "easeOut" }}
      />
      <motion.div
        className="absolute z-0 pointer-events-none"
        style={{
          width: 650,
          height: 650,
          border: "1.5px dashed rgba(123,97,255,0.04)",
          borderRadius: "50%",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="absolute z-0 pointer-events-none"
        style={{
          width: 800,
          height: 800,
          border: "1px dashed rgba(255,0,122,0.03)",
          borderRadius: "50%",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating colored particles */}
      {orbitParticles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full z-0"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            left: "50%",
            top: "50%",
            opacity: 0,
          }}
          animate={{
            x: [0, p.x],
            y: [0, p.y],
            opacity: [0, 0.35, 0],
            scale: [0, 1.3, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Logo */}
      <motion.div
        className="z-10 mb-8"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          delay: 0.1,
          type: "spring",
          stiffness: 160,
          damping: 14,
        }}
      >
        <ChaintologyLogo size={140} />
      </motion.div>

      {/* Brand */}
      <motion.h1
        className="text-3xl sm:text-5xl font-bold z-10 mb-8 text-center"
        style={{ color: "#FFFFFF" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Chaintology
      </motion.h1>

      {/* CTA Button */}
      <motion.button
        onClick={enter}
        initial={{ opacity: 0, scale: 0.85, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          delay: 0.5,
          type: "spring",
          stiffness: 200,
          damping: 15,
        }}
        whileHover={{
          scale: 1.04,
          y: -2,
          boxShadow: "0 8px 30px rgba(255,0,122,0.35)",
        }}
        whileTap={{ scale: 0.97 }}
        className="relative z-10 rounded-full text-lg font-bold tracking-wide cursor-pointer"
        style={{
          padding: "16px 48px",
          background: "linear-gradient(135deg, #FF007A, #7B61FF)",
          color: "white",
          border: "none",
          boxShadow: "0 4px 20px rgba(255,0,122,0.25)",
        }}
      >
        Enter Chaintology
      </motion.button>

      {/* Press Enter hint */}
      <motion.p
        className="text-[10px] tracking-[0.3em] uppercase mt-6 z-10"
        style={{ color: "rgba(255,255,255,0.15)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.1, 0.3, 0.1] }}
        transition={{
          delay: 1,
          duration: 2.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        or press Enter
      </motion.p>
    </motion.div>
  );
}

// ─── Main Start Page ────────────────────────────────────────────────────────────
export default function StartPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [walletDone, setWalletDone] = useState(false);

  const scene = SCENES[sceneIndex];

  const canAdvance = useCallback(() => {
    if (scene === "connectWallet" && !walletDone) return false;
    return sceneIndex < SCENES.length - 1;
  }, [scene, sceneIndex, walletDone]);

  const canGoBack = sceneIndex > 0;

  const advance = useCallback(() => {
    setSceneIndex((prev) => Math.min(prev + 1, SCENES.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setSceneIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Auto-advance for timed scenes
  useEffect(() => {
    const duration = SCENE_DURATIONS[scene];
    if (duration === null) return;
    const timer = setTimeout(advance, duration);
    return () => clearTimeout(timer);
  }, [scene, advance]);

  // Arrow key navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && canAdvance()) {
        e.preventDefault();
        advance();
      }
      if (e.key === "ArrowLeft" && canGoBack) {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canAdvance, canGoBack, advance, goBack]);

  const handleWalletConnected = useCallback(() => {
    setWalletDone(true);
    advance();
  }, [advance]);

  const handleSkip = () => {
    router.push("/");
  };

  // If wallet already connected when reaching that scene, auto-advance
  useEffect(() => {
    if (scene === "connectWallet" && isConnected) {
      setWalletDone(true);
      const timer = setTimeout(advance, 1500);
      return () => clearTimeout(timer);
    }
  }, [scene, isConnected, advance]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
      style={{ background: "#08080F" }}
    >
      {/* Skip button */}
      <motion.button
        onClick={handleSkip}
        className="absolute top-5 right-6 z-50 text-[11px] uppercase tracking-[0.2em] transition-colors cursor-pointer flex items-center gap-1.5"
        style={{ color: "rgba(255,255,255,0.2)" }}
        whileHover={{ color: "rgba(255,255,255,0.5)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        Skip →
      </motion.button>

      {/* Scene counter */}
      <div className="absolute top-5 left-6 z-50 flex items-center gap-3">
        <motion.div
          className="text-[10px] uppercase tracking-widest font-mono"
          style={{ color: "rgba(255,255,255,0.15)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          {sceneIndex + 1}/{SCENES.length}
        </motion.div>
      </div>

      {/* Screen content */}
      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          {scene === "titleDrop" && (
            <TitleDropScene key="titleDrop" />
          )}
          {scene === "theHook" && (
            <TheHookScene key="theHook" />
          )}
          {scene === "pillarsReveal" && (
            <PillarsRevealScene key="pillarsReveal" />
          )}
          {scene === "howItWorks" && (
            <HowItWorksScene key="howItWorks" />
          )}
          {scene === "connectWallet" && (
            <ConnectWalletScene
              key="connectWallet"
              onConnected={handleWalletConnected}
            />
          )}
          {scene === "launchCta" && (
            <LaunchCtaScene key="launchCta" />
          )}
        </AnimatePresence>
      </div>

      {/* Navigation hint */}
      <NavHint />

      {/* Progress bar */}
      <ProgressBar sceneIndex={sceneIndex} total={SCENES.length} />
    </div>
  );
}
