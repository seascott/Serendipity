"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TripItem = {
  id: string;
  phenomenonSlug: string;
  phenomenonName: string;
  placeName: string | null;
  windowLabel: string;
};

type TripContextValue = {
  items: TripItem[];
  add: (item: TripItem) => void;
  remove: (id: string) => void;
};

const TripContext = createContext<TripContextValue | null>(null);
const KEY = "serendipity.trip.v1";

export function TripProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<TripItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (raw) setItems(JSON.parse(raw) as TripItem[]);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const value = useMemo<TripContextValue>(
    () => ({
      items,
      add: (item) => setItems((current) => (current.some((row) => row.id === item.id) ? current : [...current, item])),
      remove: (id) => setItems((current) => current.filter((row) => row.id !== id)),
    }),
    [items],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const value = useContext(TripContext);
  if (!value) throw new Error("useTrip must be used inside TripProvider");
  return value;
}
