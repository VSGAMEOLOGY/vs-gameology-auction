import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuctionDetailClient } from "@/components/auctions/auction-detail-client";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auction } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", id)
    .single();

  if (!auction || auction.status === "draft") {
    notFound();
  }

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AuctionDetailClient initialAuction={auction} userId={user?.id} />
    </div>
  );
}
