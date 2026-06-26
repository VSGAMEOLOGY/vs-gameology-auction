import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Read the user's profile via the Supabase REST API using the service role key.
// Raw fetch() is edge-runtime safe; the service role Bearer token bypasses RLS so
// the read works regardless of which SELECT policies are active on profiles.
async function fetchProfile(
  userId: string,
  columns: string
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=${columns}&limit=1`,
      {
        cache: "no-store",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
      }
    );
    if (!res.ok) return null;
    const rows: Record<string, string>[] = await res.json();
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // @supabase/ssr client — edge-compatible, used only for auth (getUser / getSession)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/register");
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
  const isProtectedPage =
    request.nextUrl.pathname.startsWith("/profile") ||
    request.nextUrl.pathname.startsWith("/watchlist") ||
    request.nextUrl.pathname.startsWith("/payments") ||
    isAdminPage;

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user) {
    // One fetch for both role and status — avoids two round-trips
    const profile = await fetchProfile(user.id, "role,status");

    // Admin gate
    if (isAdminPage && (!profile || profile.role !== "admin")) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Suspension gate
    if (!isAuthPage && profile?.status === "suspended") {
      // lift_expired_suspension() uses auth.uid() internally, so it must be
      // called with the user's own JWT — get it from the local session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/lift_expired_suspension`,
          {
            method: "POST",
            cache: "no-store",
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: "{}",
          }
        );
      }

      // Re-check status after the lift attempt
      const current = await fetchProfile(user.id, "status");
      if (
        current?.status === "suspended" &&
        !request.nextUrl.pathname.startsWith("/suspended")
      ) {
        const url = request.nextUrl.clone();
        url.pathname = "/suspended";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
