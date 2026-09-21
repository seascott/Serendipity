import type { YearRow } from "@serendipity/catalog";
import Link from "next/link";

function pctInYear(date: Date, year: number) {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.max(0, Math.min(100, ((date.getTime() - start) / (end - start)) * 100));
}

export function YearChart({
  rows,
  year,
  activeSlugs = [],
}: {
  rows: YearRow[];
  year: number;
  activeSlugs?: string[];
}) {
  const today = pctInYear(new Date("2026-09-20T09:00:00+02:00"), year);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="year-chart" style={{ ["--today" as string]: String(today / 100) }}>
      <div className="year-head">
        <div />
        <div className="year-months">
          {months.map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </div>
      {rows.map((row) => {
        const isNow = activeSlugs.includes(row.phenomenon.slug);
        return (
          <Link
            key={row.phenomenon.slug}
            href={`/p/${row.phenomenon.slug}`}
            className={isNow ? "year-row is-now" : "year-row"}
          >
            <div className="pname">{row.phenomenon.name}</div>
            <div className="band">
              {row.windows.map((window, index) => {
                const left = pctInYear(window.start, year);
                const right = pctInYear(window.end, year);
                return (
                  <span
                    key={`${row.phenomenon.slug}-${index}`}
                    className={`seg ${row.phenomenon.family}`}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(1.4, right - left)}%`,
                    }}
                    title={`${row.phenomenon.name} · ${row.place?.name ?? "several places"}`}
                  />
                );
              })}
              {row.windows.map((window, index) =>
                window.peak ? (
                  <span
                    key={`${row.phenomenon.slug}-p-${index}`}
                    className="seg peak"
                    style={{
                      left: `${pctInYear(window.peak.start, year)}%`,
                      width: `${Math.max(1, pctInYear(window.peak.end, year) - pctInYear(window.peak.start, year))}%`,
                    }}
                  />
                ) : null,
              )}
            </div>
          </Link>
        );
      })}
      {year === 2026 ? (
        <div className="today-line">
          <span className="today-flag">Today</span>
        </div>
      ) : null}
      <p className="legend">
        <span>
          <i className="swatch window" /> Window
        </span>
        <span>
          <i className="swatch peak" /> Peak
        </span>
        <span>
          <i className="swatch wildlife" /> Wildlife
        </span>
        {year === 2026 ? <span>Amber names are in window on 20 Sep</span> : null}
      </p>
    </div>
  );
}
