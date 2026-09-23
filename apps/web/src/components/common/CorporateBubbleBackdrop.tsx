import React from 'react';
import { motion } from 'framer-motion';

export const CorporateBubbleBackdrop: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Soft Ambient Subtle Grid Mask */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />

      {/* Primary Floating Ambient Orbs */}
      <motion.div
        animate={{
          x: [0, 25, 0],
          y: [0, -30, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute -top-24 -left-20 w-96 h-96 rounded-full bg-gradient-to-br from-emerald-400/15 via-teal-300/10 to-transparent blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, -30, 0],
          y: [0, 25, 0],
          scale: [1, 1.08, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
        className="absolute -bottom-24 -right-20 w-[28rem] h-[28rem] rounded-full bg-gradient-to-tl from-emerald-500/15 via-teal-400/10 to-transparent blur-3xl"
      />

      <motion.div
        animate={{
          x: [0, 20, 0],
          y: [0, 20, 0],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 4,
        }}
        className="absolute top-1/4 -right-24 w-80 h-80 rounded-full bg-gradient-to-bl from-teal-400/10 via-slate-300/10 to-transparent blur-2xl"
      />

      {/* Floating Translucent Corporate Bubble Elements */}
      <motion.div
        animate={{
          y: [0, -22, 0],
          x: [0, 12, 0],
          opacity: [0.35, 0.6, 0.35],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-16 left-[15%] w-24 h-24 rounded-full border border-emerald-400/30 bg-emerald-100/20 backdrop-blur-xs shadow-xs"
      />

      <motion.div
        animate={{
          y: [0, 28, 0],
          x: [0, -16, 0],
          opacity: [0.25, 0.5, 0.25],
        }}
        transition={{
          duration: 17,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1.5,
        }}
        className="absolute bottom-20 left-[10%] w-36 h-36 rounded-full border border-teal-400/25 bg-teal-50/20 backdrop-blur-xs shadow-xs"
      />

      <motion.div
        animate={{
          y: [0, -25, 0],
          x: [0, -15, 0],
          opacity: [0.3, 0.55, 0.3],
        }}
        transition={{
          duration: 19,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 3,
        }}
        className="absolute top-28 right-[18%] w-28 h-28 rounded-full border border-emerald-400/25 bg-emerald-50/25 backdrop-blur-xs shadow-xs"
      />

      <motion.div
        animate={{
          y: [0, 20, 0],
          x: [0, 15, 0],
          opacity: [0.2, 0.45, 0.2],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 5,
        }}
        className="absolute bottom-32 right-[12%] w-20 h-20 rounded-full border border-slate-300/40 bg-slate-200/20 backdrop-blur-xs shadow-xs"
      />

      <motion.div
        animate={{
          y: [0, -15, 0],
          scale: [1, 1.15, 1],
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2.5,
        }}
        className="absolute top-1/2 left-[5%] w-14 h-14 rounded-full border border-emerald-300/35 bg-emerald-200/15 backdrop-blur-xs"
      />
    </div>
  );
};
