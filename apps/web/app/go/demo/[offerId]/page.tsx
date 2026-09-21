import { offers } from "@serendipity/catalog";
import { notFound } from "next/navigation";
import Link from "next/link";

const names = { viator: "Viator", gyg: "GetYourGuide", booking: "Booking.com" };

export default async function DemoGoPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const offer = offers.find((item) => item.id === offerId);
  if (!offer) notFound();
  return (
    <main className="shell shell-narrow">
      <p className="label">Affiliate handoff · prototype</p>
      <h1>This would open {names[offer.providerId]}</h1>
      <p className="lede">
        {offer.title} from {offer.supplierName}. In production this URL would log a first-party
        click_id and redirect with <code>rel=&quot;sponsored&quot;</code>.
      </p>
      <div className="disclosure">
        Serendipity would earn a commission if you booked. Ranking on the previous page was not
        influenced by that commission.
      </div>
      <p style={{ marginTop: "1.5rem" }}>
        <Link className="button ghost" href={`/p/${offer.phenomenonSlugs[0]}`}>
          Back to the phenomenon
        </Link>
      </p>
    </main>
  );
}
