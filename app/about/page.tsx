import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us — KZN Plumbers Directory",
  description:
    "KZN Plumbers Directory helps KwaZulu-Natal homeowners compare plumbing businesses using local filters and transparent verification labels.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold mb-3">
            About Us
          </h1>
          <p className="text-sm sm:text-lg opacity-90 max-w-xl mx-auto">
            A local directory with clearer evidence and direct contact.
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Mission */}
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-bold mb-4">Our Mission</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Founded in 2026, KZN Plumbers Directory was created with a simple goal: to make it easier for people across
            KwaZulu-Natal to find trusted plumbing professionals while giving plumbers a dedicated platform to grow their
            businesses.
          </p>
          <p className="text-gray-700 leading-relaxed mb-4">
            We recognised a gap in the market where homeowners struggled to find reliable, qualified plumbers — and where
            hardworking plumbers had limited visibility online. KZN Plumbers Directory bridges that gap by providing a
            free, KZN-specific listing platform that helps homeowners compare relevant businesses directly.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Published profiles carry one of three states: credential verified, business claimed, or directory record.
            Those labels describe what evidence we hold; they do not guarantee workmanship, price, availability, or the
            registration required for every type of job.
          </p>
        </section>

        {/* How it works */}
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-bold mb-4">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "🔍",
                title: "Search",
                desc: "Search published KZN plumbing records by area, job type, trust state, and listed availability.",
              },
              {
                icon: "💬",
                title: "Connect",
                desc: "Contact plumbers directly via WhatsApp with a pre-filled message, or submit a booking request through their profile.",
              },
              {
                icon: "⭐",
                title: "Review",
                desc: "After the job is done, leave a review to help other homeowners find great plumbers — and help plumbers build their reputation.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="bg-white border border-gray-200 rounded-xl p-5 text-center"
              >
                <div className="text-3xl mb-3">{step.icon}</div>
                <h3 className="font-display font-bold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* For plumbers */}
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-bold mb-4">
            Want to List Your Plumbing Business?
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Listing your business on KZN Plumbers Directory is completely free. Here&apos;s what you get:
          </p>
          <ul className="space-y-2 text-gray-700 mb-6">
            {[
              "A business profile with a clearly labelled ownership and credential state",
              "Direct WhatsApp contact — customers message you instantly",
              "Google review integration — your real ratings displayed",
              "Photo gallery to showcase your work",
              "Credential labels only when the relevant evidence has been reviewed",
              "Booking requests from your profile page",
              "Invoice generation tools",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-brand shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link href="/register" className="btn-primary">
            List your business free →
          </Link>
        </section>

        {/* For homeowners */}
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-bold mb-4">
            Looking for a Plumber?
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Finding a trusted plumber shouldn&apos;t be stressful. KZN Plumbers Directory makes it simple:
          </p>
          <ul className="space-y-2 text-gray-700 mb-6">
            {[
              "Clear separation between checked credentials, claimed businesses, and unclaimed records",
              "Real Google reviews — not fabricated testimonials",
              "Direct WhatsApp contact — no middlemen",
              "Filter by area, specialty, and emergency availability",
              "Completely free to use — no charges, no commissions",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-brand shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <Link href="/" className="btn-primary">
            Find a plumber →
          </Link>
        </section>

        {/* Service area */}
        <section>
          <h2 className="font-display text-xl sm:text-2xl font-bold mb-4">
            Service Area
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            We currently cover the entire province of KwaZulu-Natal, including:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm text-gray-700">
            {[
              "Durban North",
              "Durban South",
              "Umhlanga",
              "Ballito",
              "Pinetown",
              "Hillcrest",
              "Pietermaritzburg",
              "Richards Bay",
              "Newcastle",
              "Estcourt",
              "Port Shepstone",
              "South Coast",
            ].map((area) => (
              <div key={area} className="flex gap-1.5 items-center">
                <span className="text-brand text-xs">📍</span>
                {area}
              </div>
            ))}
          </div>
        </section>

        {/* Follow us */}
        <section className="bg-brand-light rounded-xl p-6 text-center">
          <h2 className="font-display text-lg font-bold mb-2">Follow Us</h2>
          <p className="text-sm text-gray-600 mb-4">
            Stay updated with plumbing tips, industry news, and the latest directory listings.
          </p>
          <a
            href="https://whatsapp.com/channel/0029Vb8gADzG3R3pl9D5Qe1u"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp"
          >
            💬 Join our WhatsApp community
          </a>
        </section>
      </div>
    </>
  );
}
