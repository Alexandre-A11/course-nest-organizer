import { motion } from "framer-motion";

/**
 * Aurora / Mesh-gradient background.
 *
 * Three large blurred blobs that continuously float and pulse behind every
 * page. Colors are strictly tied to the active theme via `dark:` variants —
 * pastel washes in light mode and deep, low-luminance jewel tones in dark
 * mode so they never glare on the eyes.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <motion.div
        className="absolute -left-40 -top-40 h-[38rem] w-[38rem] rounded-full bg-sky-300/30 blur-[130px] dark:bg-indigo-950/50"
        animate={{ x: [0, 80, -40, 0], y: [0, 60, -40, 0], scale: [1, 1.15, 0.9, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-48 top-1/4 h-[34rem] w-[34rem] rounded-full bg-violet-300/30 blur-[130px] dark:bg-violet-950/45"
        animate={{ x: [0, -70, 40, 0], y: [0, -50, 60, 0], scale: [1, 0.85, 1.1, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 left-1/4 h-[30rem] w-[30rem] rounded-full bg-rose-200/25 blur-[130px] dark:bg-slate-900/60"
        animate={{ x: [0, 60, -50, 0], y: [0, -40, 50, 0], scale: [1, 1.1, 0.9, 1] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}