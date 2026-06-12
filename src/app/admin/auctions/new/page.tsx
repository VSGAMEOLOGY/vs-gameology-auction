import { createClient } from "@/lib/supabase/server";
import { AuctionForm } from "@/components/admin/auction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewAuctionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        Create Auction
      </h1>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Auction Details</CardTitle>
        </CardHeader>

        <CardContent>
          <AuctionForm userId={user!.id} />
        </CardContent>
      </Card>
    </div>
  );
}