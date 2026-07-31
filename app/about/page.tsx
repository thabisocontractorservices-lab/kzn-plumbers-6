import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us — KZN Plumbers Directory",
  description:
    "KZN Plumbers Directory connects KwaZulu-Natal homeowners with verified, PIRB-registered plumbers. Learn about our mission and how we work.",
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
            Connecting KwaZulu-Natal homeowners with trusted, verified plumbers.
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
            free, verified listing platform that connects the right plumber with the right customer.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Every plumber on our platform is verified before their listing goes live. We prioritise PIRB-registered
            tradespeople because certification matters — it means your plumber has been assessed against industry
            standards and carries the qualifications needed to do the job safely and correctly.
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
                desc: "Browse 1,200+ verified plumbers by area, specialty, or name. Filter by certification, availability, and emergency callout.",
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
              "A verified business profile visible to thousands of homeowners",
              "Direct WhatsApp contact — customers message you instantly",
              "Google review integration — your real ratings displayed",
              "Photo gallery to showcase your work",
              "Certification badges (PIRB, SESSA, LPGSA)",
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
              "Every plumber is verified before going live",
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
