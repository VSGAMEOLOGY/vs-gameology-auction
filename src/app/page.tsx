import Link from "next/link";
import { Gavel, Shield, Zap, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AuctionCard } from "@/components/auctions/auction-card";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .eq("status", "active")
    .order("end_time", { ascending: true })
    .limit(6);

  return (
    <>
      <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              VS GAMEOLOGY Auction
            </h1>
            <p className="mt-4 text-lg text-brand-100">
              Discover rare collectibles, bid in real-time, and win exclusive items
              from the VS GAMEOLOGY collection.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/auctions">
                <Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50">
                  Browse Auctions
                </Button>
              </Link>
              {!user && (
                <Link href="/register">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                    Create Account
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Gavel, title: "Live Bidding", desc: "Bid in real-time with instant updates" },
            { icon: Shield, title: "Secure Payments", desc: "Bank transfer with admin verification" },
            { icon: Zap, title: "Instant Updates", desc: "Get notified when you're outbid" },
            { icon: Clock, title: "Scheduled Auctions", desc: "Browse upcoming auctions before they go live" },
          ].map((feature) => (
            <div key={feature.title} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {auctions && auctions.length > 0 && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Live Auctions</h2>
              <Link href="/auctions" className="text-sm font-medium text-brand-600 hover:text-brand-700">
                View all &rarr;
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {auctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
