import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — KZN Plumbers Directory",
  description: "Privacy policy for kznplumbers.co.za — how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold mb-2">Privacy Policy</h1>
          <p className="text-sm opacity-80">Last updated: 1 August 2026</p>
        </div>
      </section>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 prose prose-gray max-w-none prose-headings:font-display prose-headings:font-bold">
        <h2>1. Introduction</h2>
        <p>
          KZN Plumbers Directory (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the website
          kznplumbers.co.za. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
          when you visit our website or use our services.
        </p>
        <p>
          We are committed to protecting your privacy in accordance with the Protection of Personal Information Act
          (POPIA) of South Africa.
        </p>

        <h2>2. Information We Collect</h2>
        <h3>Personal information you provide</h3>
        <ul>
          <li><strong>Plumber accounts:</strong> Full name, email address, phone number, WhatsApp number, business trading name, area of operation, PIRB registration number, specialties, hourly rate, profile photos, work photos, certifications, website and social media links.</li>
          <li><strong>Homeowner accounts:</strong> Full name, email address, area.</li>
          <li><strong>Reviews:</strong> Reviewer name, star rating, review text.</li>
          <li><strong>Bookings:</strong> Customer name, phone number, email, job description, preferred date/time.</li>
          <li><strong>Contact form:</strong> Name, email, phone, message.</li>
          <li><strong>Invoices:</strong> Customer name, address, phone, email, line item details.</li>
        </ul>

        <h3>Information collected automatically</h3>
        <ul>
          <li><strong>Analytics:</strong> We use Google Analytics 4 to collect anonymised usage data including pages visited, time on site, device type, and approximate location (city level).</li>
          <li><strong>Cookies:</strong> We use essential cookies for authentication sessions. No advertising or tracking cookies are used.</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>To create and manage your account</li>
          <li>To display your plumber profile on the public directory</li>
          <li>To process bookings and connect homeowners with plumbers</li>
          <li>To send email notifications (registration confirmations, booking alerts, claim updates)</li>
          <li>To improve our website and services</li>
          <li>To comply with legal obligations</li>
        </ul>

        <h2>4. How We Share Your Information</h2>
        <p>We do not sell your personal information to third parties. We may share information with:</p>
        <ul>
          <li><strong>Service providers:</strong> Supabase (database hosting), Vercel (website hosting), Resend (email delivery), Google (analytics and reviews API). These providers process data on our behalf under their own privacy policies.</li>
          <li><strong>Public display:</strong> Plumber profiles (trading name, area, specialties, ratings, photos, certifications) are publicly visible on the directory. This is the core purpose of the service.</li>
          <li><strong>Legal requirements:</strong> We may disclose information if required by law or to protect our rights.</li>
        </ul>

        <h2>5. Data Security</h2>
        <p>
          We use industry-standard security measures to protect your data, including encrypted connections (HTTPS/SSL),
          secure authentication (Supabase Auth), and row-level security policies on our database. Passwords are hashed
          and never stored in plain text.
        </p>

        <h2>6. Your Rights Under POPIA</h2>
        <p>As a South African data subject, you have the right to:</p>
        <ul>
          <li>Access your personal information</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your personal information</li>
          <li>Object to the processing of your personal information</li>
          <li>Lodge a complaint with the Information Regulator</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:thabiso@kznplumbers.co.za">thabiso@kznplumbers.co.za</a>.
        </p>

        <h2>7. Data Retention</h2>
        <p>
          We retain your personal information for as long as your account is active or as needed to provide our services.
          If you request account deletion, we will remove your personal information within 30 days, except where we are
          required to retain it by law.
        </p>

        <h2>8. Children&apos;s Privacy</h2>
        <p>
          Our services are not intended for children under 18. We do not knowingly collect personal information from
          children.
        </p>

        <h2>9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify users of material changes by posting the
          updated policy on this page with a new &ldquo;Last updated&rdquo; date.
        </p>

        <h2>10. Contact Us</h2>
        <p>If you have questions about this Privacy Policy, contact us at:</p>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:thabiso@kznplumbers.co.za">thabiso@kznplumbers.co.za</a></li>
          <li><strong>Website:</strong> <a href="/contact">kznplumbers.co.za/contact</a></li>
        </ul>
      </article>
    </>
  );
}
