// Fact-based profile presentation. Never fills gaps with invented business claims.
import { DIRECTORY_SERVICES } from "@/lib/directory";
import { usableProfileAbout } from "@/lib/content-quality";

type Input = {
  trading_name: string; area: string; specialties?: string[] | null;
  profile_id?: string | null; about?: string | null;
};

export function profileSummary(p: Input): string {
  const name = p.trading_name.trim();
  const services = [...new Set((p.specialties || []).map(s => s.trim()).filter(Boolean))];
  const sentences = [`${name} is listed in the KZN Plumbers Directory under ${p.area}.`];
  if (services.length) sentences.push(`The services recorded on this listing are ${services.join(", ")}.`);
  else sentences.push("Specific services have not yet been added to this listing.");
  sentences.push(p.profile_id
    ? "This business has claimed its profile. Ownership does not by itself confirm professional registration or availability."
    : "This listing has not been claimed by the business. Confirm the details directly before arranging work.");
  sentences.push("The listed area is a directory location, not confirmation that the business serves every nearby suburb.");
  return sentences.join(" ");
}

const QUESTIONS: Record<string, string[]> = {
  "Drain cleaning": ["Where is the blockage: one fixture, several fixtures or the outside drain?", "Does the price include clearing, or are camera inspection and high-pressure jetting separate?"],
  "Burst pipes": ["Where is the leak, and can the water supply be turned off safely?", "Does the quote include opening and reinstating walls, paving or flooring?"],
  "Geyser repair": ["What is the geyser size, and is it leaking or failing to heat?", "Which parts, labour and safety checks are included in the quote?"],
  "Leak detection": ["Is the leak visible, or is unexplained water usage the main symptom?", "Are detection and the eventual repair quoted separately?"],
  "Bathroom fitting": ["Is this a repair, fixture replacement or a full bathroom installation?", "Who supplies the fittings, and are tiling and waterproofing included?"],
  "Solar geyser": ["Is the request for an existing system repair or a new installation?", "Which equipment, installation and compliance documents are included?"],
  "Gas fitting": ["What appliance and gas installation does the job involve?", "Ask for proof of registration appropriate to the work and confirm the required compliance documentation."],
  "Commercial": ["What type of premises is involved, and what access restrictions apply?", "Will the work interrupt the water supply, and can a written scope and schedule be provided?"],
  "Industrial": ["Which system or equipment is involved, and are drawings or specifications available?", "What site induction and safety requirements must the contractor meet?"],
  "Pipe relining": ["Has the pipe condition been established through an inspection?", "What length is being relined, and what access, warranty and reinstatement are included?"],
};

export function serviceGuidance(specialties?: string[] | null) {
  return [...new Set((specialties || []).map(s => s.trim()).filter(Boolean))].map(label => ({
    label,
    questions: QUESTIONS[label] || ["Describe the work you need done and ask whether it is covered by the business's services.", "Request a written breakdown of labour, materials and any call-out charge."],
    guidePath: (() => { const service = DIRECTORY_SERVICES.find(s => s.dbValue === label); return service ? `/services/${service.key}` : null; })(),
  }));
}

export function profileCompletion(p: Input) {
  const missing: string[] = [];
  if (!usableProfileAbout(p.about)) missing.push("a business-written description explaining the work you do");
  if (!p.specialties?.length) missing.push("your services");
  return missing;
}
