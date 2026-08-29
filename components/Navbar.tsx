import Image from "next/image";
import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { MobileMenu } from "@/components/MobileMenu";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-brand shadow-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6" aria-label="Primary navigation">
        <Link href="/" className="flex min-w-0 items-center" aria-label="KZN Plumbers Directory home">
          <Image src="/logo.svg" alt="" width={180} height={36} priority className="h-9 w-auto brightness-0 invert" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <Link href="/#directory-results" className="rounded-lg px-3 py-2 text-sm font-bold text-white/85 hover:bg-white/10 hover:text-white">Find a plumber</Link>
          <Link href="/#regions" className="rounded-lg px-3 py-2 text-sm font-bold text-white/85 hover:bg-white/10 hover:text-white">Areas</Link>
          <Link href="/#services" className="rounded-lg px-3 py-2 text-sm font-bold text-white/85 hover:bg-white/10 hover:text-white">Services</Link>
          <Link href="/trust" className="rounded-lg px-3 py-2 text-sm font-bold text-white/85 hover:bg-white/10 hover:text-white">How we verify</Link>
          <Link href="/blog" className="rounded-lg px-3 py-2 text-sm font-bold text-white/85 hover:bg-white/10 hover:text-white">Guides</Link>
        </div>

        <div className="flex items-center gap-2">
          <AuthNav />
          <MobileMenu />
        </div>
      </nav>
    </header>
  );
}
