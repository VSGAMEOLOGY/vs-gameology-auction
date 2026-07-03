import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    try {
      await requireAdmin(supabase);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthorized";
      console.error("/api/admin/customer-email: admin check failed", message);
      return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 401 });
    }

    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) {
      console.error("/api/admin/customer-email: missing userId query param");
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await service.auth.admin.getUserById(userId);
    if (error) {
      console.error("/api/admin/customer-email: getUserById failed", userId, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ email: data.user?.email ?? null });
  } catch (err) {
    console.error("/api/admin/customer-email: unhandled error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
