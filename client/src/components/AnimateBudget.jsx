/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { useSpring, motion } from "framer-motion";
import { Wallet } from "lucide-react";

/**
 * AnimateBudget
 * Smoothly animates a numeric budget value with safety checks.
 * Props:
 *  - budget: number | string
 *  - label: string (optional)
 */
const AnimateBudget = ({ budget = 0, label = "Remaining" }) => {
  // 🧮 Convert budget safely to number
  const safeBudget = Number(budget) || 0;

  // Create spring for smooth transition
  const springBudget = useSpring(safeBudget, { stiffness: 120, damping: 18 });

  // State to show formatted display
  const [displayBudget, setDisplayBudget] = useState(safeBudget.toFixed(2));

  // Listen for spring changes
  useEffect(() => {
    const unsubscribe = springBudget.on("change", (v) => {
      if (!isNaN(v)) setDisplayBudget(v.toFixed(2));
    });
    return () => unsubscribe();
  }, [springBudget]);

  // Trigger animation whenever budget changes
  useEffect(() => {
    springBudget.set(safeBudget);
  }, [safeBudget, springBudget]);

  return (
    <motion.div
      className="flex items-center gap-2 text-white font-semibold text-base"
      initial={{ scale: 1 }}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.4 }}
    >
      <Wallet className="w-4 h-4 text-success" />

      <span className="text-text text-sm font-text">
        {displayBudget} Cr
      </span>
    </motion.div>
  );
};

export default AnimateBudget;
