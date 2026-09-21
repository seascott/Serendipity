"use client";

import { MapContainer, Marker, Popup, TileLayer, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { useEffect } from "react";
import { imagerySrc } from "../lib/imagery";
import type { JourneyPin } from "../lib/pins";
import "leaflet/dist/leaflet.css";

function pinIcon(family: string, tier?: number) {
  return L.divIcon({
    className: `map-pin fam-${family} tier-${tier ?? 1}`,
    html: "<span></span>",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

/** MapContainer reads center/zoom only on mount; keep the viewport following prop changes. */
function ViewportSync({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true });
  }, [map, lat, lng, zoom]);
  return null;
}

export default function JourneyMapInner({
  pins,
  center,
  zoom,
  origin,
}: {
  pins: JourneyPin[];
  center: [number, number];
  zoom: number;
  origin?: { lat: number; lng: number; name: string };
}) {
  return (
    <MapContainer center={center} zoom={zoom} className="journey-map" scrollWheelZoom={false}>
      <ViewportSync center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {origin ? (
        <CircleMarker
          center={[origin.lat, origin.lng]}
          radius={9}
          pathOptions={{ color: "#c45c26", weight: 2, fillColor: "#fffaf1", fillOpacity: 1 }}
        >
          <Popup>
            <strong>{origin.name}</strong>
            <p className="explainer">Your base for this window</p>
          </Popup>
        </CircleMarker>
      ) : null}
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={pinIcon(pin.family, pin.tier)}>
          <Popup>
            <article className="map-popup">
              {imagerySrc(pin.slug) ? (
                <img src={imagerySrc(pin.slug)!} alt="" />
              ) : null}
              <strong>{pin.name}</strong>
              <p>
                {pin.place}
                {pin.note ? ` · ${pin.note}` : ""}
              </p>
              <Link href={pin.href}>See how →</Link>
            </article>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
