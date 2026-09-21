import { DEMO_NOW } from "@serendipity/catalog";

export function demoNow(override?: string | null): Date {
  if (!override) return DEMO_NOW;
  const parsed = new Date(override);
  return Number.isNaN(parsed.getTime()) ? DEMO_NOW : parsed;
}

export const ORIGINS = {
  rome: { slug: "rome", name: "Rome", lat: 41.9028, lng: 12.4964 },
  florence: { slug: "florence", name: "Florence", lat: 43.7696, lng: 11.2558 },
  venice: { slug: "venice", name: "Venice", lat: 45.4408, lng: 12.3155 },
} as const;

export type OriginKey = keyof typeof ORIGINS;
