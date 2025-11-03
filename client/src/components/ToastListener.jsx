/* eslint-disable no-unused-vars */
import { useEffect } from "react";
import { ToastContainer, toast, Slide } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import "react-toastify/dist/ReactToastify.css";
import socket from "../socket";
import { X, Gavel } from "lucide-react";

// ⚡ ToastBox – Premium Auction Look
const ToastBox = ({ message, type, duration = 2500, closeToast }) => {
  const isError = type === "error";

  const theme = {
    // 🌈 Vibrant, contrasting color palettes
    bg: isError
      ? "bg-gradient-to-br from-[#fff0f0] to-[#ffe5e5] border border-[#f87171] shadow-[0_4px_16px_rgba(248,113,113,0.2)]"
      : "bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] border border-[#34d399] shadow-[0_4px_16px_rgba(52,211,153,0.25)]",

    title: isError ? "text-[#b91c1c]" : "text-[#065f46]",
    message: "text-[#111827]",
    icon: isError ? (
      <X size={22} className="text-[#ef4444] drop-shadow-sm" />
    ) : (
      <Gavel size={22} className="text-[#10b981] drop-shadow-sm" />
    ),
    bar: isError
      ? "bg-gradient-to-r from-[#ef4444] to-[#f97316]"
      : "bg-gradient-to-r from-[#10b981] to-[#84cc16]",
  };

  return (
    <AnimatePresence>
      <motion.div
        key="toast"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.9 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`relative w-[90vw] max-w-md mx-auto p-5 rounded-xl flex items-start gap-3 ${theme.bg}`}
      >
        {/* Icon */}
        <div className="mt-[3px]">{theme.icon}</div>

        {/* Message */}
        <div className="flex-1">
          <p className={`text-sm font-bold tracking-wide ${theme.title}`}>
            🏆 Auction Update
          </p>
          <p className={`text-[14px] leading-snug ${theme.message}`}>
            {message}
          </p>
        </div>

      

        {/* Progress Bar */}
        <div className="absolute bottom-2 left-5 right-5 h-1 bg-black/10 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: duration / 1000, ease: "linear" }}
            className={`absolute top-0 left-0 h-full ${theme.bar}`}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// 🎯 Socket Listener
const ToastListener = () => {
  useEffect(() => {
    const handlePlayerSold = ({ player, winner }) => {
      const isUnsold = winner === "No one";

      toast(
        ({ closeToast }) => (
          <ToastBox
            message={
              isUnsold
                ? `${player.name} went unsold `
                : `${player.name} sold to ${winner} for ₹${player.price.toFixed(
                    2
                  )} Cr `
            }
            type={isUnsold ? "error" : "success"}
            duration={isUnsold ? 2300 : 2700}
            closeToast={closeToast}
          />
        ),
        {
          position: "top-center",
          autoClose: isUnsold ? 2300 : 2700,
          pauseOnHover: false,
          draggable: false,
          hideProgressBar: true,
        }
      );
    };

    socket.on("player-sold", handlePlayerSold);
    return () => socket.off("player-sold", handlePlayerSold);
  }, []);

  return (
    <ToastContainer
      position="top-center"
      transition={Slide}
      newestOnTop
      closeOnClick={false}
      pauseOnHover={false}
      draggable={false}
      limit={3}
      hideProgressBar
      toastClassName="!bg-transparent !shadow-none !p-0 !m-0"
      className="z-[100]"
    />
  );
};

export default ToastListener;
