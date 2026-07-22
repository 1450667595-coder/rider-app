import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

const COLORS = ["#FFD100", "#FF6B35", "#00D2FF", "#7B2FF7", "#FF4081", "#00E676"];
const SHAPES = ["circle", "square", "triangle"];

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  rotation: number;
  delay: number;
  shape: string;
}

export default function Confetti({ active, onComplete }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (active) {
      const newParticles: Particle[] = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
        delay: Math.random() * 0.5,
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
      }));
      setParticles(newParticles);
      if (onComplete) {
        setTimeout(onComplete, 3000);
      }
    } else {
      setParticles([]);
    }
  }, [active, onComplete]);

  return (
    <AnimatePresence>
      {active && (
        <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              className="absolute top-0"
              style={{
                left: `${p.x}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                borderRadius: p.shape === "circle" ? "50%" : p.shape === "triangle" ? "0" : "2px",
                clipPath:
                  p.shape === "triangle"
                    ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                    : undefined,
                rotate: p.rotation,
              }}
              initial={{ y: -20, opacity: 1 }}
              animate={{
                y: window.innerHeight + 20,
                opacity: [1, 1, 0],
                rotate: p.rotation + 360,
                x: [0, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200],
              }}
              transition={{
                duration: 2 + Math.random() * 1.5,
                delay: p.delay,
                ease: "easeIn",
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}