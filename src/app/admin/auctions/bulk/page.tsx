import { createClient } from "@/lib/supabase/server";
import { BulkAuctionForm } from "@/components/admin/bulk-auction-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BulkAuctionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Bulk Create Auctions</h1>
      <p className="mt-1 text-gray-600">Create multiple auctions at once</p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Bulk Import</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkAuctionForm userId={user!.id} />
        </CardContent>
      </Card>
    </div>
  );
}
