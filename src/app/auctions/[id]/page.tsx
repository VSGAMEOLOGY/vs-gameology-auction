import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuctionDetailClient } from "@/components/auctions/auction-detail-client";
import type { Auction } from "@/types/database";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auctionData } = await supabase
    .from("auctions")
    .select("*, category:categories(name)")
    .eq("id", id)
    .single();

  if (!auctionData || auctionData.status === "draft") {
    notFound();
  }

  const { category, ...auction } = auctionData as Auction & {
    category?: { name: string } | null;
  };
  const categoryName = category?.name ?? null;

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AuctionDetailClient
        initialAuction={auction}
        categoryName={categoryName}
        userId={user?.id}
      />
    </div>
  );
}
