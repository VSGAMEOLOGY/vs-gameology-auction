import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminAuctionList } from "@/components/admin/admin-auction-list";
import { Button } from "@/components/ui/button";
import { Plus, Calendar } from "lucide-react";

export default async function AdminAuctionsPage() {
  const supabase = await createClient();
  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auction Management</h1>
          <p className="mt-1 text-gray-600">{auctions?.length ?? 0} total auctions</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/auctions/schedule">
            <Button variant="outline">
              <Calendar className="h-4 w-4" />
              Schedule Preview
            </Button>
          </Link>
          <Link href="/admin/auctions/bulk">
            <Button variant="outline">Bulk Create</Button>
          </Link>
          <Link href="/admin/auctions/new">
            <Button>
              <Plus className="h-4 w-4" />
              New Auction
            </Button>
          </Link>
        </div>
      </div>

      <AdminAuctionList initialAuctions={auctions ?? []} />
    </div>
  );
}
