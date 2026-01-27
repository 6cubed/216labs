import { motion } from "framer-motion";

interface AudioVisualizerProps {
  isPlaying: boolean;
}

export function AudioVisualizer({ isPlaying }: AudioVisualizerProps) {
  // Generate a few bars for the visualizer
  const bars = Array.from({ length: 12 });

  return (
    <div className="flex items-end justify-center gap-1.5 h-16 w-full max-w-[200px]">
      {bars.map((_, i) => (
        <motion.div
          key={i}
          className="w-2 bg-primary/80 rounded-t-sm"
          animate={
            isPlaying
              ? {
                  height: [
                    "10%",
                    `${Math.random() * 60 + 20}%`,
                    `${Math.random() * 90 + 10}%`,
                    "10%",
                  ],
                }
              : { height: "5%" }
          }
          transition={{
            duration: 0.4,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: i * 0.05, // Stagger effect
          }}
          style={{
            opacity: isPlaying ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}
