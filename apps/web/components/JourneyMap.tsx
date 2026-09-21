"use client";

import dynamic from "next/dynamic";
import type { JourneyPin } from "../lib/pins";

const Inner = dynamic(() => import("./JourneyMapInner"), {
  ssr: false,
  loading: () => <div className="journey-map-fallback">Loading map…</div>,
});

export function JourneyMap(props: {
  pins: JourneyPin[];
  center: [number, number];
  zoom: number;
  origin?: { lat: number; lng: number; name: string };
}) {
  return <Inner {...props} />;
}
