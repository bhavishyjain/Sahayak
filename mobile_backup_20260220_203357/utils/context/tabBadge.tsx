import { createContext, useContext, useState } from "react";

type TabBadgeContextType = {
  totalOrderCount: number;
  setTotalOrderCount: (n: number) => void;
  newOrderCount: number;
  setNewOrderCount: (n: number) => void;
};

const TabBadgeContext = createContext<TabBadgeContextType | null>(null);

export function TabBadgeProvider({ children }: { children: React.ReactNode }) {
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [newOrderCount, setNewOrderCount] = useState(0);

  return (
    <TabBadgeContext.Provider
      value={{
        totalOrderCount,
        setTotalOrderCount,
        newOrderCount,
        setNewOrderCount,
      }}
    >
      {children}
    </TabBadgeContext.Provider>
  );
}

export function useTabBadges() {
  const ctx = useContext(TabBadgeContext);
  if (!ctx) {
    throw new Error("useTabBadges must be used inside TabBadgeProvider");
  }
  return ctx;
}
