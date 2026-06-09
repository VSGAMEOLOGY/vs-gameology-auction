import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold text-brand-600">404</h1>
      <p className="mt-4 text-xl text-gray-600">Page not found</p>
      <Link href="/" className="mt-8">
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}
