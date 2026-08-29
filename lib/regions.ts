export type RegionConfig = {
  slug: string;
  name: string;
  shortName: string;
  queryAreas: string[];
  intro: string;
  localNotes: string[];
  nearby: string[];
};

export const REGIONS: RegionConfig[] = [
  {
    slug: "durban",
    name: "Durban and eThekwini",
    shortName: "Durban",
    queryAreas: ["Durban North", "Durban South", "Pinetown"],
    intro: "Compare plumbers serving Durban, from the northern suburbs and Umhlanga corridor to the Berea, Inner West and South Durban basin.",
    localNotes: [
      "Confirm whether the quoted call-out covers your suburb and after-hours travel.",
      "For geyser and compliance work, ask who will issue the required certificate before work starts.",
      "Coastal air can accelerate corrosion, so recurring leaks may need more than a patch repair.",
    ],
    nearby: ["Umhlanga", "Durban North", "Berea", "Pinetown", "Amanzimtoti"],
  },
  {
    slug: "pietermaritzburg",
    name: "Pietermaritzburg and the Midlands",
    shortName: "Pietermaritzburg",
    queryAreas: ["PMB"],
    intro: "Find plumbers serving Pietermaritzburg, Hilton, Howick and nearby Midlands communities, with direct contact and visible credential status.",
    localNotes: [
      "State your suburb clearly because travel between PMB, Hilton and Howick changes response time.",
      "Ask whether parts, travel and the call-out are included in the written quote.",
      "For older properties, describe pipe material and previous repairs if you know them.",
    ],
    nearby: ["Scottsville", "Hayfields", "Hilton", "Howick", "Northdale"],
  },
  {
    slug: "ballito-north-coast",
    name: "Ballito and the North Coast",
    shortName: "Ballito",
    queryAreas: ["Ballito"],
    intro: "Compare plumbers covering Ballito, Salt Rock, Sheffield Beach and the wider North Coast growth corridor.",
    localNotes: [
      "Ask whether the plumber regularly works in estates and understands access requirements.",
      "Coastal corrosion and high-use holiday properties can change the right repair approach.",
      "For drain work, confirm whether CCTV inspection or hydro-jetting is available when needed.",
    ],
    nearby: ["Ballito", "Salt Rock", "Sheffield Beach", "Tongaat", "KwaDukuza"],
  },
  {
    slug: "richards-bay",
    name: "Richards Bay and uMhlathuze",
    shortName: "Richards Bay",
    queryAreas: ["Richards Bay"],
    intro: "Browse plumbers serving Richards Bay, Empangeni and surrounding uMhlathuze communities.",
    localNotes: [
      "Confirm the actual service area before requesting an urgent call-out.",
      "Industrial capability and domestic plumbing are different; match the provider to the job.",
      "Ask for the expected arrival window and whether diagnostic equipment is included.",
    ],
    nearby: ["Richards Bay", "Empangeni", "Meerensee", "Arboretum", "Esikhawini"],
  },
  {
    slug: "newcastle",
    name: "Newcastle and northern KZN",
    shortName: "Newcastle",
    queryAreas: ["Newcastle"],
    intro: "Find plumbers serving Newcastle and surrounding northern KwaZulu-Natal communities without sorting through national listings.",
    localNotes: [
      "Check the provider's travel radius for outlying areas before confirming a booking.",
      "For urgent work, ask whether the listed availability was confirmed recently.",
      "Get labour, materials and certificate costs separated in writing.",
    ],
    nearby: ["Newcastle Central", "Arbor Park", "Aviary Hill", "Madadeni", "Osizweni"],
  },
  {
    slug: "pinetown-hillcrest",
    name: "Pinetown, Hillcrest and the Upper Highway",
    shortName: "Pinetown and Hillcrest",
    queryAreas: ["Pinetown", "Durban North"],
    intro: "Compare plumbers for Pinetown, Westville, Kloof, Hillcrest and the wider Upper Highway area.",
    localNotes: [
      "Clarify whether your address falls inside the provider's normal call-out zone.",
      "Steep sites and long pipe runs can affect leak detection and drainage work.",
      "Ask whether the quote includes testing after the repair is complete.",
    ],
    nearby: ["Pinetown", "Westville", "Kloof", "Hillcrest", "Waterfall"],
  },
  {
    slug: "south-coast",
    name: "KZN South Coast",
    shortName: "South Coast",
    queryAreas: ["South Coast", "Durban South", "Other KZN"],
    intro: "Find plumbers covering Port Shepstone, Margate, Scottburgh and communities along the KwaZulu-Natal South Coast.",
    localNotes: [
      "Give the exact town or estate because South Coast travel distances are substantial.",
      "For holiday properties, confirm access arrangements and request completion photos.",
      "Coastal exposure makes material choice important for external pipework and fittings.",
    ],
    nearby: ["Port Shepstone", "Margate", "Scottburgh", "Shelly Beach", "Hibberdene"],
  },
];

export function getRegion(slug: string): RegionConfig | null {
  return REGIONS.find((region) => region.slug === slug) ?? null;
}

export function regionForArea(area: string): RegionConfig | null {
  return REGIONS.find((region) => region.queryAreas.includes(area)) ?? null;
}
