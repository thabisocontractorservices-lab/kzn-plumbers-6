import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <div className="font-display text-7xl text-gray-300 mb-4">404</div>
        <h1 className="font-display text-3xl mb-2">Page not found</h1>
        <p className="text-gray-500 mb-6">
          The page you're looking for doesn't exist. It may have been moved, or
          the URL might be slightly off.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/" className="btn-primary">
            Browse plumbers
          </Link>
          <Link href="/register" className="btn-secondary">
            List your business
          </Link>
        </div>
      </div>
    </div>
  );
}
