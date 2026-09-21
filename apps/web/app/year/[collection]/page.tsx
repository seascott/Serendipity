import { redirect } from "next/navigation";

export default async function YearPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = await params;
  redirect(`/plan?collection=${collection}`);
}
