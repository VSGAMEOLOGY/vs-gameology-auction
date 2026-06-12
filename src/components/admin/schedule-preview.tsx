"use client";

import Link from "next/link";
import { Calendar, Clock, Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Auction } from "@/types/database";

interface SchedulePreviewProps {
  auctions: Auction[];
}

function groupByDate(auctions: Auction[]) {
  const groups: Record<string, Auction[]> = {};

  for (const auction of auctions) {
    const key = auction.start_at
      ? new Date(auction.start_at).toLocaleDateString("en-AU", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Unscheduled";

    if (!groups[key]) groups[key] = [];
    groups[key].push(auction);
  }

  return Object.entries(groups).sort(([a], [b]) => {
    if (a === "Unscheduled") return 1;
    if (b === "Unscheduled") return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });
}

export function SchedulePreview({ auctions }: SchedulePreviewProps) {
  const scheduled = auctions.filter((a) => a.status === "scheduled" || a.status === "draft");
  const groups = groupByDate(scheduled);

  if (scheduled.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-gray-500">No scheduled or draft auctions</p>
          <Link href="/admin/auctions/new" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
            Create an auction
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="rounded-lg bg-blue-100 p-3">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Scheduled</p>
              <p className="text-2xl font-bold">{scheduled.filter((a) => a.status === "scheduled").length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="rounded-lg bg-gray-100 p-3">
              <Gavel className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Drafts</p>
              <p className="text-2xl font-bold">{scheduled.filter((a) => a.status === "draft").length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="rounded-lg bg-green-100 p-3">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Next Start</p>
              <p className="text-sm font-bold">
                {scheduled.find((a) => a.start_at && a.status === "scheduled")
                  ? formatDate(scheduled.find((a) => a.start_at && a.status === "scheduled")!.start_at)
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {groups.map(([date, items]) => (
        <Card key={date}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-brand-600" />
              {date}
              <Badge variant="info">{items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-gray-100 p-0">
            {items
              .sort((a, b) => {
                if (!a.start_at) return 1;
                if (!b.start_at) return -1;
                return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
              })
              .map((auction) => (
                <div key={auction.id} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/auctions/${auction.id}/edit`}
                        className="font-medium text-gray-900 hover:text-brand-600"
                      >
                        {auction.title}
                      </Link>
                      <Badge variant={auction.status === "scheduled" ? "info" : "default"}>
                        {auction.status}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-500">
                      {auction.start_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Start: {formatDate(auction.start_at)}
                        </span>
                      )}
                      {auction.end_at && (
                        <span>End: {formatDate(auction.end_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-brand-600">
                      {formatCurrency(auction.starting_price)}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{auction.shipping_type}</p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
