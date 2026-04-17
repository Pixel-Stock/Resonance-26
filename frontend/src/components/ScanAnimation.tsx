"use client";

import { motion } from "framer-motion";

interface ScanAnimationProps {
  phase: "uploading" | "analyzing";
}

export function ScanAnimation({ phase }: ScanAnimationProps) {
  const label = phase === "uploading" ? "Transmitting payload..." : "Analyzing telemetry anomalies...";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center min-h-[40vh] w-full"
    >
      <div className="relative flex items-center justify-center w-24 h-24 mb-6">
        {/* Sleek dual rippling rings for premium aesthetic */}
        <motion.div
           animate={{ scale: [1, 1.6, 2.2], opacity: [0.6, 0.2, 0] }}
           transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
           className="absolute inset-0 rounded-full border-[1.5px] border-violet-400"
        />
        <motion.div
           animate={{ scale: [1, 1.6, 2.2], opacity: [0.6, 0.2, 0] }}
           transition={{ duration: 2.5, delay: 1.25, repeat: Infinity, ease: "easeOut" }}
           className="absolute inset-0 rounded-full border-[1.5px] border-teal-400"
        />
        
        {/* Core pulsing orb */}
        <motion.div 
           animate={{ scale: [1, 1.05, 1], rotate: [0, 180, 360] }}
           transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
           className="w-12 h-12 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 shadow-[0_0_24px_rgba(139,92,246,0.6)] border-2 border-white/80" 
        />
      </div>
      
      <h3 className="text-xl font-semibold text-stone-800 tracking-tight">{label}</h3>
      <p className="mt-4 text-sm font-medium text-stone-500 max-w-sm text-center leading-relaxed">
         {phase === "uploading" 
            ? "Encrypting local log dump and establishing a secure channel to the Sentinel core."
            : "Running unsupervised Isolation Forest machine learning to extract edge-case deviations from the baseline."}
      </p>

      {/* Subtle minimalist progress pulse */}
      <div className="mt-6 w-[200px] h-1 bg-black/5 rounded-full overflow-hidden">
         <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-violet-400 to-transparent"
         />
      </div>
    </motion.div>
  );
}
