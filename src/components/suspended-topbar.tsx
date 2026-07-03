import { Gavel } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

export function SuspendedTopbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Gavel className="h-7 w-7 text-brand-600" />
          <span className="text-lg font-bold text-gray-900">
            VS <span className="text-brand-600">GAMEOLOGY</span>
          </span>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
