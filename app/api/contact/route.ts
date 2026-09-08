import { NextRequest } from "next/server";
import { z } from "zod";
import { sendContactMessage } from "@/lib/email";
import { accessFailure, privateJson, requireSameOrigin } from "@/lib/server-access";
import { readAuthFlowJson } from "@/lib/auth-flow-input";

const Schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().default(""),
  subject: z.enum(["Listing help", "Report issue", "Claim listing", "Correction", "Complaint", "Privacy", "Partnership", "General"]),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(0).optional().default(""),
});

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
    const parsed = Schema.safeParse(await readAuthFlowJson(request, 16384));
    if (!parsed.success) return privateJson({ error: "Check the form fields." }, 400);
    // A filled honeypot is rejected by the schema, not disguised as delivered mail.
    const sent = await sendContactMessage(parsed.data);
    if (!sent) return privateJson({ error: "Message delivery is temporarily unavailable. Please use email or WhatsApp." }, 503);
    return privateJson({ sent: true }, 201);
  } catch (error) { return accessFailure(error); }
}
