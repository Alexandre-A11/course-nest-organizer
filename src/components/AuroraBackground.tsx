import { motion } from "framer-motion";

/**
 * Aurora / Mesh-gradient background.
 *
 * Two big blurred blobs that float and pulse very slowly behind every page.
 * Colors shift between Light and Dark mode — soft pastels in light, deep
 * indigo/violet in dark. Sits at -z-10 and is non-interactive.
 */
export function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#fafbff] dark:bg-[#0a0a0f]"
    >
      <motion.div
        className="absolute -left-32 -top-32 h-[42rem] w-[42rem] rounded-full bg-blue-300/30 blur-[120px] dark:bg-indigo-900/40"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-40 top-1/3 h-[36rem] w-[36rem] rounded-full bg-purple-300/25 blur-[120px] dark:bg-violet-900/35"
        animate={{ x: [0, -50, 30, 0], y: [0, -30, 40, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[30rem] w-[30rem] rounded-full bg-pink-200/25 blur-[120px] dark:bg-fuchsia-900/25"
        animate={{ x: [0, 40, -30, 0], y: [0, -20, 30, 0], scale: [1, 1.05, 0.95, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}