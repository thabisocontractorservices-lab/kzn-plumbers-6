import Image from "next/image";
import Link from "next/link";
import { REGIONS } from "@/lib/regions";

export function Footer() {
  return (
    <footer className="mt-auto bg-slate-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <Image src="/logo.svg" alt="KZN Plumbers Directory" width={190} height={36} className="h-9 w-auto brightness-0 invert" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
            A KwaZulu-Natal-specific directory for comparing plumbing businesses by area, listed service and transparent verification state.
          </p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-500">
            KZN Plumbers is not a plumbing company, regulator or guarantee of workmanship. Confirm scope, price, availability and required credentials directly.
          </p>
        </div>

        <FooterCol title="Browse by area" links={REGIONS.slice(0, 6).map((region) => ({ href: `/plumbers/${region.slug}`, label: region.shortName }))} />
        <FooterCol
          title="Homeowner help"
          links={[
            { href: "/trust", label: "Verification method" },
            { href: "/help", label: "Help centre" },
            { href: "/resources", label: "KZN homeowner resources" },
            { href: "/corrections", label: "Request a correction" },
            { href: "/complaints", label: "Complaints" },
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
          ]}
        />
        <FooterCol
          title="For plumbing businesses"
          links={[
            { href: "/register", label: "List a business" },
            { href: "/all-plumbers", label: "Find your listing" },
            { href: "/login", label: "Sign in" },
            { href: "/dashboard", label: "Dashboard" },
            { href: "/contact", label: "Contact the directory" },
          ]}
        />
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} KZN Plumbers Directory · KwaZulu-Natal, South Africa</span>
          <span>Direct contact · No sold leads · Verification is never for sale</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-white">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link href={link.href} className="text-sm text-slate-400 transition-colors hover:text-white">{link.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
