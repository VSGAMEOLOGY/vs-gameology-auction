import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  const { error: activateError } = await supabase.rpc("activate_scheduled_auctions");
  if (activateError) errors.push(`activate: ${activateError.message}`);

  const { error: endError } = await supabase.rpc("end_expired_auctions");
  if (endError) errors.push(`end: ${endError.message}`);

  if (errors.length > 0) {
    return NextResponse.json({ success: false, timestamp, errors }, { status: 500 });
  }

  return NextResponse.json({ success: true, timestamp });
}
