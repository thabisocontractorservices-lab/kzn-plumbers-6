import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 text-center">
      <div>
        <div className="font-display text-7xl text-gray-300 mb-4">404</div>
        <h1 className="font-display text-3xl mb-2">Plumber not found</h1>
        <p className="text-gray-500 mb-6">
          The page you're looking for doesn't exist or hasn't been verified yet.
        </p>
        <Link href="/" className="btn-primary">
          Browse the directory
        </Link>
      </div>
    </div>
  );
}
