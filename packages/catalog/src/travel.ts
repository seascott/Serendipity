const EARTH_M = 6_371_000;

export function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function estimateTravel(distM: number): { minutes: number; mode: "drive" | "rail" | "fly" } {
  const km = distM / 1000;
  if (km < 80) return { minutes: Math.max(8, Math.round((km / 55) * 60)), mode: "drive" };
  if (km < 350) return { minutes: Math.round((km / 90) * 60) + 20, mode: "rail" };
  return { minutes: Math.round((km / 420) * 60) + 150, mode: "fly" };
}

export function distanceKm(distM: number): number {
  return Math.max(0, Math.round(distM / 1000));
}

export function travelLine(
  distM: number,
  travel: { minutes: number; mode: "drive" | "rail" | "fly" },
): string {
  if (distM < 8000 || travel.minutes < 5) return "In town";
  if (travel.mode === "fly" && travel.minutes >= 480) {
    return `${distanceKm(distM).toLocaleString("en-US")} km · long-haul flight`;
  }
  return `${distanceKm(distM)} km · ${travelPhrase(travel)}`;
}

export function travelPhrase(travel: { minutes: number; mode: "drive" | "rail" | "fly" }): string {
  if (travel.minutes < 5) return "Right here";
  const hours = Math.floor(travel.minutes / 60);
  const mins = travel.minutes % 60;
  const clock = hours === 0 ? `${mins} min` : mins === 0 ? `${hours} h` : `${hours} h ${mins}`;
  if (travel.mode === "drive") return `${clock} by road`;
  if (travel.mode === "rail") return `${clock} by rail`;
  return `${clock} incl. transfers`;
}
