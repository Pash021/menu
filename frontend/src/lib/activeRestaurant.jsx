import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "qrmenu_active_restaurant_id";
const ActiveRestaurantContext = createContext(null);

function parseId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function ActiveRestaurantProvider({ children }) {
  const [restaurantId, setRestaurantId] = useState(() => {
    if (typeof window === "undefined") return null;
    return parseId(window.localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    if (restaurantId == null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, String(restaurantId));
  }, [restaurantId]);

  const value = useMemo(() => ({ restaurantId, setRestaurantId }), [restaurantId]);
  return <ActiveRestaurantContext.Provider value={value}>{children}</ActiveRestaurantContext.Provider>;
}

export function useActiveRestaurant() {
  const ctx = useContext(ActiveRestaurantContext);
  if (!ctx) throw new Error("useActiveRestaurant must be used within ActiveRestaurantProvider");
  return ctx;
}

