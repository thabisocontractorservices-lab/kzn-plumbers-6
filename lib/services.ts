import { DIRECTORY_SERVICES } from "@/lib/directory";

export type ServiceGuide = {
  slug: string;
  name: string;
  specialty: string;
  intro: string;
  questions: string[];
  urgentNote: string;
};

const guidance: Record<string, Omit<ServiceGuide, "slug" | "name" | "specialty">> = {
  "burst-pipes": {
    intro: "Compare KZN plumbers who list burst-pipe repairs. For active flooding, isolate the water supply if it is safe and keep clear of electrical points.",
    questions: [
      "Can you give an estimated arrival window for my suburb?",
      "Does the call-out include diagnosis and pressure testing?",
      "Will you provide photos and a written description for an insurance claim?",
    ],
    urgentNote: "If water is near electrical equipment, switch power off only if it is safe to reach the distribution board.",
  },
  "blocked-drains": {
    intro: "Find plumbers who list drain cleaning and compare whether they offer rods, hydro-jetting or CCTV inspection for recurring blockages.",
    questions: [
      "What drain-clearing equipment will you bring?",
      "Is CCTV inspection available if the blockage returns?",
      "Does the quote include cleanup and a written finding?",
    ],
    urgentNote: "Stop using affected fixtures if sewage is backing up and keep children and pets away from contaminated water.",
  },
  "geyser-repair": {
    intro: "Compare plumbers who list geyser repair across KwaZulu-Natal. Ask who will certify regulated work and what the written warranty covers.",
    questions: [
      "Are labour, valves, fittings and the call-out itemised?",
      "Will a plumbing certificate be issued when required?",
      "Can you document the cause for an insurer or landlord?",
    ],
    urgentNote: "A leaking or burst geyser can damage ceilings quickly. Isolate the water and electricity only if you can do so safely.",
  },
  "leak-detection": {
    intro: "Compare KZN plumbers who list leak detection. A useful diagnosis should identify the likely source before unnecessary breaking or replacement work begins.",
    questions: [
      "Which diagnostic method will you use?",
      "Is the detection fee separate from the repair quote?",
      "Will you provide a written location and recommended repair?",
    ],
    urgentNote: "Record the water-meter reading with all taps closed; continued movement can help confirm an active leak.",
  },
  "bathroom-plumbing": {
    intro: "Find plumbers who list bathroom plumbing, installations or renovations, and compare scope, sequencing and compliance before work starts.",
    questions: [
      "Who supplies fittings and who carries the product warranty?",
      "Does the quote include waterproofing interfaces and testing?",
      "What certificate or inspection is required for the planned work?",
    ],
    urgentNote: "Use a written scope for renovations so plumbing, tiling and waterproofing responsibilities are clear.",
  },
  "solar-geyser": {
    intro: "Compare providers who list solar-geyser work. Confirm the exact system, installer credentials and warranty before accepting a replacement or conversion quote.",
    questions: [
      "Which system and components are included?",
      "Who is responsible for electrical and roof work?",
      "What installation certificate and warranty documents will I receive?",
    ],
    urgentNote: "Roof access and electrical work need competent tradespeople; do not choose on headline price alone.",
  },
  "gas-fitting": {
    intro: "Find providers who list gas fitting and verify the required registration for the exact work before booking.",
    questions: [
      "Which professional registration covers this gas work?",
      "Will the required certificate be issued after testing?",
      "Does the quote include ventilation and compliance checks?",
    ],
    urgentNote: "If you smell gas, avoid switches or flames, ventilate if safe, leave the area and contact an emergency professional.",
  },
  commercial: {
    intro: "Compare KZN providers who list commercial plumbing and ask about response cover, reporting, insurance and site-safety requirements.",
    questions: [
      "Can you provide proof of insurance and relevant registrations?",
      "What response and escalation times can you commit to?",
      "Will job reports, photos and asset history be supplied?",
    ],
    urgentNote: "For managed properties, confirm purchase-order, access and after-hours escalation rules before dispatch.",
  },
};

export const SERVICE_GUIDES: ServiceGuide[] = DIRECTORY_SERVICES.map((service) => ({
  slug: service.key,
  name: service.label,
  specialty: service.dbValue,
  ...guidance[service.key],
}));

export function getServiceGuide(slug: string): ServiceGuide | null {
  return SERVICE_GUIDES.find((service) => service.slug === slug) ?? null;
}
