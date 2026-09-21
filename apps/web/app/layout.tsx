import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";
import Link from "next/link";
import { TripProvider } from "../lib/trip-store";
import { NavLinks } from "../components/NavLinks";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Serendipity",
  description: "What is happening at this place at this time — and how to be there.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${sourceSans.variable}`}>
      <body>
        <TripProvider>
          <header className="masthead">
            <Link className="wordmark" href="/">
              Serendipity
            </Link>
            <NavLinks />
          </header>
          {children}
          <footer className="site-footer">
            <span>Serendipity · a time-and-place companion</span>
            <span>Affiliate relationships disclosed next to every booking link.</span>
          </footer>
        </TripProvider>
      </body>
    </html>
  );
}
