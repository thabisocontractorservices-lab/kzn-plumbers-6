export type RegionConfig = {
  slug: string;
  name: string;
  shortName: string;
  queryAreas: string[];
  intro: string;
  coverageNote: string;
  localNotes: string[];
  nearby: string[];
};

export const REGIONS: RegionConfig[] = [
  {
    slug: "durban",
    name: "Durban and eThekwini",
    shortName: "Durban",
    queryAreas: ["Durban North", "Durban South", "Pinetown"],
    intro: "Browse records labelled Durban North, Durban South or Pinetown in the eThekwini directory. Ask each business whether it serves your exact suburb.",
    coverageNote: "The source records use broad area labels, not verified street-level service boundaries. A Durban listing is not proof of coverage in every eThekwini suburb.",
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
    intro: "Compare records labelled PMB for Pietermaritzburg, with direct contact details and clearly separated credential and ownership states.",
    coverageNote: "These records are labelled PMB. Coverage of Hilton, Howick or other Midlands towns is not established by that label; ask the business directly.",
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
    intro: "Browse records labelled Ballito and compare listed plumbing services, contact details and credential status before arranging a North Coast call-out.",
    coverageNote: "Ballito is the stored area label. Coverage of Salt Rock, Sheffield Beach, Tongaat or KwaDukuza is not confirmed by this collection.",
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
    intro: "Browse records labelled Richards Bay and compare their listed services. Confirm the exact address and travel charges before arranging a call-out.",
    coverageNote: "The source area is Richards Bay. Do not assume a listed business also serves Empangeni or every part of uMhlathuze.",
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
    intro: "Compare records labelled Newcastle in northern KwaZulu-Natal, without mixing in unrelated national listings.",
    coverageNote: "A Newcastle label does not confirm coverage in surrounding towns or settlements. Contact the business with your exact address.",
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
    shortName: "Pinetown",
    queryAreas: ["Pinetown"],
    intro: "Browse records explicitly labelled Pinetown, with local questions for a Pinetown or Upper Highway job.",
    coverageNote: "Only Pinetown-labelled records are included. Durban North records are not treated as Pinetown or Hillcrest providers; coverage of Westville, Kloof, Hillcrest and Waterfall must be confirmed.",
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
    queryAreas: ["South Coast"],
    intro: "Browse records explicitly labelled South Coast and confirm the town, travel distance and listed capability directly with the business.",
    coverageNote: "The legacy directory may not have a separate South Coast area label. Durban South and Other KZN records are not evidence of South Coast coverage, so an empty collection is a known coverage limitation.",
    localNotes: [
      "Give the exact town or estate because South Coast travel distances are substantial.",
      "For holiday properties, confirm access arrangements and request completion photos.",
      "Coastal exposure makes material choice important for external pipework and fittings.",
    ],
    nearby: ["Port Shepstone", "Margate", "Scottburgh", "Shelly Beach", "Hibberdene"],
  },
];

/** Exact stored labels/known city aliases only; never infer a suburb from a broad region name. */
export function guideAreaMatch(cityFocus?: string | null): { areas: string[]; region: RegionConfig | null } | null {
  const value = cityFocus?.trim().toLowerCase();
  if (!value) return null;
  const aliases: Record<string, string[]> = {
    "durban": ["Durban North", "Durban South", "Pinetown"],
    "ethekwini": ["Durban North", "Durban South", "Pinetown"],
    "pietermaritzburg": ["PMB"], "pmb": ["PMB"],
    "durban north": ["Durban North"], "durban south": ["Durban South"],
    "pinetown": ["Pinetown"], "ballito": ["Ballito"],
    "richards bay": ["Richards Bay"], "newcastle": ["Newcastle"],
    "estcourt": ["Estcourt"], "south coast": ["South Coast"],
  };
  const areas = aliases[value];
  if (!areas) return null;
  const region = value === "durban" || value === "ethekwini" ? getRegion("durban") : regionForArea(areas[0]);
  return { areas, region };
}

export function getRegion(slug: string): RegionConfig | null {
  return REGIONS.find((region) => region.slug === slug) ?? null;
}

export function regionForArea(area: string): RegionConfig | null {
  const matches = REGIONS.filter((region) => region.queryAreas.some((value) => value.toLowerCase() === area.trim().toLowerCase()));
  return matches.find((region) => region.queryAreas.length === 1) ?? matches[0] ?? null;
}
