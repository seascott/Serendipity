type Hop = {
  id: string;
  name: string;
  place: string;
  line: string;
};

export function TransitPanel({
  originName,
  hops,
}: {
  originName?: string;
  hops: Hop[];
}) {
  return (
    <aside className="transit-panel">
      <p className="label">Distance &amp; transit</p>
      <p className="explainer">
        {originName
          ? `From ${originName}. Great-circle estimates — road under 80 km, rail under 350 km, otherwise a flight.`
          : "Between consecutive stops. Great-circle estimates — road, rail, or flight."}
      </p>
      {hops.length ? (
        <ul>
          {hops.map((hop) => (
            <li key={hop.id}>
              <strong>{hop.name}</strong>
              <span>
                {hop.place} · {hop.line}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="explainer">No placed stops in this filter.</p>
      )}
    </aside>
  );
}
