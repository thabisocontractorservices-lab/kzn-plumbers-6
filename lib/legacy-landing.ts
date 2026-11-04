// The historical landing templates contain universal verification, price and response
// claims. Replace only the known template at presentation time; the source record is
// never changed. Editorial content without the signature is left as supplied.
export type LegacyLandingInput = {
  slug: string;
  group_name: string | null;
  city_focus: string | null;
  body_html: string;
};

type Topic = { label: string; service: string | null; advice: string[] };
const TOPICS: Record<string, Topic> = {
  general: { label: "Plumbers", service: null, advice: ["Describe the problem and your exact suburb when contacting a business.", "Ask for a written quote that separates call-out, labour and materials."] },
  geyser: { label: "Geyser repair", service: "geyser-repair", advice: ["Describe whether the geyser is leaking, not heating or producing discoloured water.", "Ask who will complete any required plumbing and electrical work and provide the relevant documentation."] },
  burst: { label: "Burst pipe repairs", service: "burst-pipes", advice: ["If safe, isolate the water and keep clear of electrical equipment near the leak.", "Ask the provider about the call-out, finding the leak and reinstating any affected surfaces."] },
  drain: { label: "Blocked drains", service: "blocked-drains", advice: ["Explain whether one fixture or several drains are affected.", "Ask what is included in clearing the blockage and whether inspection is available if it returns."] },
  leak: { label: "Leak detection", service: "leak-detection", advice: ["Describe damp patches, meter movement or other signs you have noticed.", "Ask whether locating the leak and repairing it are quoted separately."] },
  solar: { label: "Solar geysers", service: "solar-geyser", advice: ["Describe the existing system and whether you need a repair or installation.", "Ask for the equipment, responsibilities, warranty and any required documentation in writing."] },
  gas: { label: "Gas fitting", service: "gas-fitting", advice: ["Confirm that the professional has the registration required for your specific gas work.", "If you smell gas, avoid switches and flames, leave the area and contact an emergency professional."] },
  compliance: { label: "Plumbing compliance", service: null, advice: ["Explain the work or inspection you need and ask which documentation applies to your situation.", "Check the professional's current registration directly and obtain a written scope and quote."] },
  installation: { label: "Plumbing installation", service: null, advice: ["List the fixtures or equipment to be installed and who will supply them.", "Ask whether the written quote includes labour, materials, testing and any required documentation."] },
  comparison: { label: "Compare plumbers", service: null, advice: ["Ask each business to quote for the same scope so you can compare like for like.", "Check travel, call-out, materials and any workmanship terms before booking."] },
  pricing: { label: "Plumber pricing", service: null, advice: ["Request itemised quotes and ask whether call-out, labour and materials are included.", "Confirm any after-hours charges and approval process before work starts."] },
  loadshedding: { label: "Plumbing and power outages", service: null, advice: ["Explain which equipment is affected when the power goes off.", "Ask a suitably qualified professional about the options, installation responsibilities and written costs."] },
  advice: { label: "Plumbing advice", service: null, advice: ["Describe the issue and when it started before requesting advice.", "Ask what diagnosis and next steps are included in a written quote."] },
  complaint: { label: "Plumbing complaints", service: null, advice: ["Keep the quote, invoices, photos and correspondence related to the work.", "Raise the concern with the business and ask how it will be addressed."] },
  find: { label: "Find a plumber", service: null, advice: ["Give the business your exact address and explain the work required.", "Check the relevant credentials and request a written scope and quote."] },
};

export type SafeLanding = {
  heading: string; title: string; description: string; serviceSlug: string | null;
  advice: string[]; location: string | null;
};

export function safeLegacyLanding(page: LegacyLandingInput): SafeLanding | null {
  if ((page.group_name ?? "").trim().toLowerCase() !== "landing pages") return null;
  // This exact shared boilerplate was observed in the historical generated pages.
  // Requiring it protects newer and individually edited landing pages.
  if (!/every\s+plumber\s+listed\s+for\b/i.test(page.body_html)) return null;
  const topic = TOPICS[page.slug.split("-")[0]];
  if (!topic) return null;
  const raw = (page.city_focus ?? "").trim();
  const location = raw && !/^(general|other|unknown|kwa\s?zulu[- ]?natal|kzn|south africa)$/i.test(raw) ? raw : null;
  const heading = location ? `${topic.label} in ${location}` : `${topic.label} in KwaZulu-Natal`;
  return {
    heading, title: `${heading} | KZN Plumbers`,
    description: `Compare directory records for ${topic.label.toLowerCase()}${location ? ` in ${location}` : " in KwaZulu-Natal"}. Check each listing's details and confirm services, coverage and costs directly.`,
    serviceSlug: topic.service, advice: topic.advice, location,
  };
}
