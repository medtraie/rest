import React from "react";
import { motion } from "framer-motion";
import TransferLiveStudio from "@/components/exchanges/TransferLiveStudio";

const Transfer = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="app-page-shell p-4 md:p-8 space-y-6 bg-slate-50/30 min-h-screen"
    >
      <TransferLiveStudio />
    </motion.div>
  );
};

export default Transfer;
