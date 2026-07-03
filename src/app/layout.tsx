import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SuspensionListener } from "@/components/suspension-listener";
import { SuspendedNotice } from "@/components/suspended-notice";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "VS GAMEOLOGY Auction",
  description: "Premium auction platform for collectors and enthusiasts",
  icons: { icon: "/icon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let suspended = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single();
    suspended = profile?.status === "suspended";
  }

  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        {suspended ? (
          <SuspendedNotice />
        ) : (
          <>
            <SuspensionListener />
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </>
        )}
      </body>
    </html>
  );
}
