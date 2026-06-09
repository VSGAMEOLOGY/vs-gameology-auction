import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuctionForm } from "@/components/admin/auction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditAuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: auction } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", id)
    .single();

  if (!auction) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Edit Auction</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{auction.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <AuctionForm auction={auction} userId={user!.id} mode="edit" />
        </CardContent>
      </Card>
    </div>
  );
}
