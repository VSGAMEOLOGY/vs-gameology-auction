import Link from "next/link";
import { Gavel } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <Gavel className="h-6 w-6 text-brand-600" />
              <span className="font-bold text-gray-900">VS GAMEOLOGY</span>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Premium auction platform for collectors and enthusiasts.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Quick Links</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><Link href="/auctions" className="hover:text-brand-600">Browse Auctions</Link></li>
              <li><Link href="/register" className="hover:text-brand-600">Create Account</Link></li>
              <li><Link href="/profile" className="hover:text-brand-600">My Profile</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">Support</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><a href="mailto:support@vsgameology.com" className="hover:text-brand-600">Contact Us</a></li>
              <li><Link href="/terms" className="hover:text-brand-600">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-brand-600">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-100 pt-8 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} VS GAMEOLOGY. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
