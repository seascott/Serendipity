import { createHmac } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { affiliateSecret } from "../../../lib/env";
import { createServiceSupabase } from "../../../lib/supabase/service";

function sign(clickId: string): string {
  return createHmac("sha256", affiliateSecret()).update(clickId).digest("hex").slice(0, 16);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ clickId: string }> },
) {
  const { clickId } = await context.params;
  const url = new URL(request.url);
  const sig = url.searchParams.get("sig");
  if (!sig || sig !== sign(clickId)) {
    return new NextResponse("Invalid click", { status: 400 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return new NextResponse("Affiliate redirect needs SUPABASE_SERVICE_ROLE_KEY", { status: 503 });
  }

  const { data: click, error } = await supabase
    .from("affiliate_click")
    .select("offer_id")
    .eq("click_id", clickId)
    .maybeSingle();

  if (error || !click) {
    return new NextResponse("Unknown click", { status: 404 });
  }

  const { data: offer } = await supabase
    .from("booking_offer")
    .select("url")
    .eq("id", click.offer_id)
    .maybeSingle();

  if (!offer?.url) {
    return new NextResponse("Offer has no destination", { status: 404 });
  }

  return NextResponse.redirect(offer.url, { status: 302 });
}
