export const DIRECTORY_AREAS = [
  { key: "durban", label: "Durban / eThekwini", dbAreas: ["Durban North", "Durban South", "Pinetown"] },
  { key: "pietermaritzburg", label: "Pietermaritzburg / Midlands", dbAreas: ["PMB"] },
  { key: "ballito", label: "Ballito / North Coast", dbAreas: ["Ballito"] },
  { key: "richards-bay", label: "Richards Bay", dbAreas: ["Richards Bay"] },
  { key: "newcastle", label: "Newcastle", dbAreas: ["Newcastle"] },
  { key: "pinetown", label: "Pinetown / Upper Highway", dbAreas: ["Pinetown"] },
  { key: "estcourt", label: "Estcourt / central KZN", dbAreas: ["Estcourt"] },
  { key: "south-coast", label: "KZN South Coast", dbAreas: ["South Coast", "Durban South"] },
  { key: "other-kzn", label: "Other KZN", dbAreas: ["Other KZN"] },
] as const;

export const DIRECTORY_SERVICES = [
  { key: "burst-pipes", label: "Burst pipe or leak", dbValue: "Burst pipes" },
  { key: "blocked-drains", label: "Blocked drain", dbValue: "Drain cleaning" },
  { key: "geyser-repair", label: "Geyser repair", dbValue: "Geyser repair" },
  { key: "leak-detection", label: "Leak detection", dbValue: "Leak detection" },
  { key: "bathroom-plumbing", label: "Bathroom plumbing", dbValue: "Bathroom fitting" },
  { key: "solar-geyser", label: "Solar geyser", dbValue: "Solar geyser" },
  { key: "gas-fitting", label: "Gas fitting", dbValue: "Gas fitting" },
  { key: "commercial", label: "Commercial plumbing", dbValue: "Commercial" },
] as const;

export type AreaKey = (typeof DIRECTORY_AREAS)[number]["key"];
export type ServiceKey = (typeof DIRECTORY_SERVICES)[number]["key"];

export function getAreaConfig(key?: string | null) {
  return DIRECTORY_AREAS.find((area) => area.key === key) ?? null;
}

export function getServiceConfig(key?: string | null) {
  return DIRECTORY_SERVICES.find((service) => service.key === key) ?? null;
}

export function normaliseAreaKey(value?: string | null): string {
  if (!value) return "";
  const direct = getAreaConfig(value);
  if (direct) return direct.key;
  const match = DIRECTORY_AREAS.find((area) =>
    area.dbAreas.some((dbArea) => dbArea.toLowerCase() === value.toLowerCase()),
  );
  return match?.key ?? "";
}

export function normaliseServiceKey(value?: string | null): string {
  if (!value) return "";
  const direct = getServiceConfig(value);
  if (direct) return direct.key;
  const match = DIRECTORY_SERVICES.find(
    (service) => service.dbValue.toLowerCase() === value.toLowerCase(),
  );
  return match?.key ?? "";
}
