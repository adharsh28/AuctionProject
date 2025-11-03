/* eslint-disable no-unused-vars */
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="hero bg-bg min-h-screen">
      <div className="hero-content text-center">
        <div className="max-w-md flex flex-col gap-4 ">
        
          <h1 className="text-xl sm:text-2xl md:text-2xl font-text font-bold  text-text absolute left-5 top-5">
            AuctionPlay
          </h1>
          <motion.span
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
            className="text-4xl font-heading font-semibold sm:text-5xl md:text-5xl text-text"
          >
            Unleash the Power of the Bid
          </motion.span>
          <motion.p
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.4 }}
            className="text-text font-semibold font-text"
          >
            Experience the thrill of real-time auctions where every second can
            crown a winner.
          </motion.p>
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.6 }}
            className="flex flex-col gap-2 mt-4 md:flex-row sm:flex-row lg:flex-row justify-center items-center"
          >
            <button
              onClick={() => navigate("/create")}
              className="btn bg-main font-body  btn-wide text-white hover:scale-105 transition-all duration-200"
            >
              Create Room
            </button>
            <button
              onClick={() => navigate("/join")}
              className="btn bg-org font-body  btn-wide text-white hover:scale-105 transition-all duration-200"
            >
              Join Room
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default Home;
