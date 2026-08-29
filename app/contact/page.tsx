import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact Us — KZN Plumbers Directory",
  description:
    "Contact KZN Plumbers Directory about listing help, corrections, complaints, claims, privacy or partnerships.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-10 sm:py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold mb-3">
            Contact Us
          </h1>
          <p className="text-sm sm:text-lg opacity-90 max-w-xl mx-auto">
            Whether you&apos;re looking for help or want to provide feedback, we&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact form */}
          <div>
            <h2 className="font-display text-xl font-bold mb-4">Send us a message</h2>
            <ContactForm />
          </div>

          {/* Contact info */}
          <div className="space-y-6">
            <h2 className="font-display text-xl font-bold mb-4">Contact Information</h2>

            <div className="space-y-4">
              <ContactCard
                icon="📧"
                title="Email"
                value="thabiso@kznplumbers.co.za"
                href="mailto:thabiso@kznplumbers.co.za"
              />
              <ContactCard
                icon="💬"
                title="WhatsApp"
                value="060 992 2848"
                href="https://wa.me/27609922848?text=Hi%2C%20I%20have%20a%20question%20about%20KZN%20Plumbers%20Directory."
              />
              <ContactCard
                icon="🌐"
                title="Website"
                value="www.kznplumbers.co.za"
                href="https://www.kznplumbers.co.za"
              />
              <ContactCard
                icon="📍"
                title="Location"
                value="KwaZulu-Natal, South Africa"
              />
            </div>

            <div className="bg-brand-light rounded-xl p-5 mt-6">
              <h3 className="font-display font-bold mb-2">Response Times</h3>
              <p className="text-sm text-gray-600">
                We typically respond within 24 hours during business days. For urgent listing issues, WhatsApp is the
                fastest way to reach us.
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="font-display font-bold text-amber-900 mb-2">
                Need emergency plumbing help?
              </h3>
              <p className="text-sm text-amber-800 mb-3">
                We&apos;re a directory, not a plumbing company. For urgent plumbing issues, search our directory for
                24/7 emergency plumbers in your area.
              </p>
              <a href="/?filter=emergency" className="text-sm text-brand font-semibold hover:underline">
                Find emergency plumbers →
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ContactCard({
  icon,
  title,
  value,
  href,
}: {
  icon: string;
  title: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex gap-3 items-start p-4 bg-white border border-gray-200 rounded-xl hover:border-brand transition-colors">
      <div className="text-2xl shrink-0">{icon}</div>
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</div>
        <div className="text-sm font-medium text-gray-900">{value}</div>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return content;
}
