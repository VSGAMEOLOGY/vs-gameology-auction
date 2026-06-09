"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Bell, Gavel, Menu, User, X, Shield } from "lucide-react";
import type { Profile } from "@/types/database";

const navLinks = [
  { href: "/auctions", label: "Auctions" },
  { href: "/watchlist", label: "Watchlist", auth: true },
  { href: "/payments", label: "Payments", auth: true },
];

export function Header() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      setUnreadCount(count ?? 0);
    }
    load();
  }, [supabase, pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Gavel className="h-7 w-7 text-brand-600" />
          <span className="text-lg font-bold text-gray-900">
            VS <span className="text-brand-600">GAMEOLOGY</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => {
            if (link.auth && !profile) return null;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-brand-600",
                  pathname.startsWith(link.href) ? "text-brand-600" : "text-gray-600"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          {profile?.role === "admin" && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-1 text-sm font-medium transition-colors hover:text-brand-600",
                pathname.startsWith("/admin") ? "text-brand-600" : "text-gray-600"
              )}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {profile ? (
            <>
              <Link href="/notifications" className="relative p-2 text-gray-600 hover:text-brand-600">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="sm">
                  <User className="h-4 w-4" />
                  {profile.full_name || "Profile"}
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Login</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Register</Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="p-2 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => {
              if (link.auth && !profile) return null;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-700"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
            {profile?.role === "admin" && (
              <Link href="/admin" className="text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>
                Admin Panel
              </Link>
            )}
            {profile ? (
              <>
                <Link href="/notifications" className="flex items-center gap-2 text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>
                  <Bell className="h-4 w-4" /> Notifications {unreadCount > 0 && `(${unreadCount})`}
                </Link>
                <Link href="/profile" className="text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>
                  Profile
                </Link>
                <button onClick={handleLogout} className="text-left text-sm font-medium text-red-600">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-gray-700" onClick={() => setMobileOpen(false)}>Login</Link>
                <Link href="/register" className="text-sm font-medium text-brand-600" onClick={() => setMobileOpen(false)}>Register</Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
