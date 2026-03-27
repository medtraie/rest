import React, { createContext, useContext } from "react";

type Config = {
  duration: number;
  ease: "easeOut" | "easeInOut";
};

const defaultConfig: Config = { duration: 0.25, ease: "easeOut" };

const PageTransitionContext = createContext<Config>(defaultConfig);

export const PageTransitionProvider = ({ children }: { children: React.ReactNode }) => {
  return <PageTransitionContext.Provider value={defaultConfig}>{children}</PageTransitionContext.Provider>;
};

export const usePageTransition = () => useContext(PageTransitionContext);
