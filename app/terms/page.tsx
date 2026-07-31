import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — KZN Plumbers Directory",
  description: "Terms and conditions for using kznplumbers.co.za — the verified plumber directory for KwaZulu-Natal.",
};

export default function TermsPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-display text-2xl sm:text-4xl font-extrabold mb-2">Terms of Service</h1>
          <p className="text-sm opacity-80">Last updated: 1 August 2026</p>
        </div>
      </section>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 prose prose-gray max-w-none prose-headings:font-display prose-headings:font-bold">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using KZN Plumbers Directory (kznplumbers.co.za), you agree to be bound by these Terms of
          Service. If you do not agree to these terms, please do not use our website.
        </p>

        <h2>2. Description of Service</h2>
        <p>
          KZN Plumbers Directory is an online platform that connects homeowners in KwaZulu-Natal with plumbing
          professionals. We provide a directory listing service — we are not a plumbing company, and we do not employ
          or subcontract any of the plumbers listed on our platform.
        </p>

        <h2>3. User Accounts</h2>
        <h3>Registration</h3>
        <p>
          To access certain features (listing a business, claiming a listing, leaving reviews), you must create an
          account. You agree to provide accurate, current, and complete information during registration.
        </p>
        <h3>Account security</h3>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us
          immediately of any unauthorised use of your account.
        </p>
        <h3>Account types</h3>
        <ul>
          <li><strong>Plumber accounts:</strong> For registered plumbing businesses to manage their directory listings.</li>
          <li><strong>Homeowner accounts:</strong> For homeowners to leave reviews and submit booking requests.</li>
          <li><strong>Admin accounts:</strong> For platform administrators to manage listings and users.</li>
        </ul>

        <h2>4. Plumber Listings</h2>
        <h3>Verification</h3>
        <p>
          All plumber listings are subject to verification by our admin team before going live on the directory. We
          reserve the right to reject, suspend, or remove any listing at our sole discretion.
        </p>
        <h3>Accuracy</h3>
        <p>
          Plumbers are responsible for ensuring that all information in their listing is accurate and up to date,
          including contact details, certifications, areas of operation, and pricing.
        </p>
        <h3>Claiming</h3>
        <p>
          Plumbers may claim existing listings by verifying their identity through our claim process. We reserve the
          right to require additional verification before approving a claim.
        </p>

        <h2>5. Reviews</h2>
        <p>Users who leave reviews agree that:</p>
        <ul>
          <li>Reviews must be based on genuine experiences</li>
          <li>Reviews must not contain defamatory, abusive, or misleading content</li>
          <li>Reviews must not violate any applicable laws</li>
          <li>We reserve the right to remove reviews that violate these guidelines</li>
        </ul>

        <h2>6. Prohibited Conduct</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the platform for any unlawful purpose</li>
          <li>Impersonate any person or entity</li>
          <li>Submit false, misleading, or fraudulent information</li>
          <li>Scrape, harvest, or collect data from the platform without permission</li>
          <li>Interfere with or disrupt the platform&apos;s operation</li>
          <li>Post spam, unsolicited advertising, or promotional material</li>
          <li>Attempt to gain unauthorised access to any part of the platform</li>
        </ul>

        <h2>7. Disclaimer of Warranties</h2>
        <p>
          KZN Plumbers Directory is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of
          any kind, either express or implied. We do not guarantee:
        </p>
        <ul>
          <li>The quality, safety, or legality of any plumbing services provided by listed plumbers</li>
          <li>The accuracy of any information provided by plumbers</li>
          <li>The qualifications, certifications, or insurance status of any plumber</li>
          <li>That the platform will be uninterrupted, error-free, or secure</li>
        </ul>

        <h2>8. Limitation of Liability</h2>
        <p>
          KZN Plumbers Directory is a directory and listing platform. We are not a party to any agreement between
          homeowners and plumbers. We are not liable for:
        </p>
        <ul>
          <li>Any damages arising from plumbing services provided by listed plumbers</li>
          <li>Any disputes between homeowners and plumbers</li>
          <li>Any loss or damage resulting from reliance on information on the platform</li>
          <li>Any indirect, consequential, or punitive damages</li>
        </ul>

        <h2>9. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless KZN Plumbers Directory, its owners, employees, and affiliates from
          any claims, damages, losses, or expenses arising from your use of the platform or violation of these terms.
        </p>

        <h2>10. Intellectual Property</h2>
        <p>
          All content on KZN Plumbers Directory, including text, graphics, logos, and software, is the property of KZN
          Plumbers Directory or its content suppliers and is protected by South African intellectual property laws.
        </p>

        <h2>11. Termination</h2>
        <p>
          We reserve the right to suspend or terminate your account at any time for any reason, including violation of
          these Terms of Service. You may also delete your account at any time by contacting us.
        </p>

        <h2>12. Governing Law</h2>
        <p>
          These Terms of Service are governed by the laws of the Republic of South Africa. Any disputes arising from
          these terms will be subject to the exclusive jurisdiction of the courts of KwaZulu-Natal, South Africa.
        </p>

        <h2>13. Changes to These Terms</h2>
        <p>
          We may update these Terms of Service from time to time. We will notify users of material changes by posting
          the updated terms on this page. Continued use of the platform after changes are posted constitutes acceptance
          of the revised terms.
        </p>

        <h2>14. Contact Us</h2>
        <p>If you have questions about these Terms of Service, contact us at:</p>
        <ul>
          <li><strong>Email:</strong> <a href="mailto:thabiso@kznplumbers.co.za">thabiso@kznplumbers.co.za</a></li>
          <li><strong>Website:</strong> <a href="/contact">kznplumbers.co.za/contact</a></li>
        </ul>
      </article>
    </>
  );
}
