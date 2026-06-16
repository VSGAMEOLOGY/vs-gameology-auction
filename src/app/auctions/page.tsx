import { createClient } from "@/lib/supabase/server";
import { AuctionCard } from "@/components/auctions/auction-card";
import type { AuctionStatus } from "@/types/database";

interface SearchParams {
  status?: AuctionStatus;
  q?: string;
}

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("auctions")
    .select("*")
    .neq("status", "draft")
    .order("created_at", { ascending: false });

  if (params.status) {
    query = query.eq("status", params.status);
  }
  if (params.q) {
    query = query.ilike("title", `%${params.q}%`);
  }

  const { data: auctions } = await query;

  const statuses: { value: AuctionStatus | ""; label: string }[] = [
    { value: "", label: "All" },
    { value: "active", label: "Active" },
    { value: "scheduled", label: "Scheduled" },
    { value: "ended", label: "Ended" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Auctions</h1>
        <form className="flex gap-2">
          <input
            name="q"
            type="search"
            placeholder="Search auctions..."
            defaultValue={params.q}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button type="submit" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Search
          </button>
        </form>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <a
            key={s.value || "all"}
            href={s.value ? `/auctions?status=${s.value}` : "/auctions"}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              (params.status || "") === s.value
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>

      {auctions && auctions.length > 0 ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center text-gray-500">
          <p className="text-lg">No auctions found</p>
          <p className="mt-1 text-sm">Check back soon for new listings</p>
        </div>
      )}
    </div>
  );
}
