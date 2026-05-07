import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 mt-auto">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <h4 className="text-white font-display text-xl mb-2">
            KZN Plumbers Directory
          </h4>
          <p className="text-sm leading-relaxed">
            The most trusted way to find verified, PIRB-registered plumbers
            across KwaZulu-Natal. Free for homeowners, free to list.
          </p>
        </div>

        <FooterCol
          title="For Homeowners"
          links={[
            { href: "/", label: "Find a plumber" },
            { href: "/?filter=emergency", label: "Emergency callouts" },
            { href: "/about", label: "How it works" },
            { href: "/trust", label: "Trust & safety" },
          ]}
        />
        <FooterCol
          title="For Plumbers"
          links={[
            { href: "/register", label: "List your business" },
            { href: "/login", label: "Login" },
            { href: "/dashboard", label: "Dashboard" },
            { href: "/help", label: "Help center" },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { href: "/about", label: "About" },
            { href: "/contact", label: "Contact" },
            { href: "/privacy", label: "Privacy" },
            { href: "/terms", label: "Terms" },
          ]}
        />
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 border-t border-white/10 flex justify-between flex-wrap gap-2 text-xs">
        <div>© {new Date().getFullYear()} KZN Plumbers Directory · A South African business</div>
        <div>Built with Next.js + Supabase · Deployed on Vercel</div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h5 className="text-white text-xs uppercase tracking-wider mb-3 font-semibold">
        {title}
      </h5>
      <div className="flex flex-col gap-1.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-sm hover:text-white transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
