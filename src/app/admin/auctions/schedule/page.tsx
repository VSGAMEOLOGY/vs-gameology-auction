import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SchedulePreview } from "@/components/admin/schedule-preview";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function SchedulePreviewPage() {
  const supabase = await createClient();

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .in("status", ["scheduled", "draft"])
    .order("start_at", { ascending: true, nullsFirst: false });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule Preview</h1>
          <p className="mt-1 text-gray-600">
            Upcoming and draft auctions grouped by start date
          </p>
        </div>
        <div className="flex gap-2">
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

      <div className="mt-8">
        <SchedulePreview auctions={auctions ?? []} />
      </div>
    </div>
  );
}
