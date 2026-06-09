import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Copy, Calendar } from "lucide-react";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger" | "info" | "brand"> = {
  draft: "default",
  scheduled: "info",
  active: "success",
  ended: "danger",
  cancelled: "warning",
};

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

      <div className="mt-6 space-y-3">
        {auctions?.map((auction) => (
          <Card key={auction.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-gray-900">{auction.title}</p>
                  <Badge variant={statusVariant[auction.status]}>{auction.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  {formatCurrency(auction.current_price || auction.starting_price)}
                  {auction.end_time && ` · Ends ${formatDate(auction.end_time)}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/admin/auctions/${auction.id}/edit`}>
                  <Button variant="outline" size="sm">Edit</Button>
                </Link>
                <Link href={`/admin/auctions/${auction.id}/clone`}>
                  <Button variant="ghost" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/auctions/${auction.id}`}>
                  <Button variant="ghost" size="sm">View</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
