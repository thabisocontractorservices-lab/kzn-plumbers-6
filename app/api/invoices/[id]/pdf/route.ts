import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { AccessError, accessFailure, requireUser } from "@/lib/server-access";
import { asciiFilename, invoiceFilename, type BusinessInfo, type Invoice } from "@/lib/invoice";
import { loadLogo, renderInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

/**
 * GET /api/invoices/:id/pdf            → downloads "Invoice INV-0004 - Customer.pdf"
 * GET /api/invoices/:id/pdf?inline=1   → opens the PDF in the browser's viewer
 *
 * Auth: Supabase session cookie (normal browser navigation) or `Authorization: Bearer <access token>`.
 * Only the plumber who owns the invoice can fetch it.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!IdSchema.safeParse(id).success) throw new AccessError("Invoice not found.", 404);

    const user = await requireUser(request);
    const admin = getSupabaseAdmin();

    const { data: plumber, error: plumberError } = await admin
      .from("plumbers")
      .select("id, trading_name, area, whatsapp_number, pirb_number")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (plumberError) throw new AccessError("Could not load your business profile. Please try again.", 503);
    if (!plumber) throw new AccessError("Invoice not found.", 404);

    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("plumber_id", plumber.id)
      .maybeSingle();
    if (invoiceError) throw new AccessError("Could not load this invoice. Please try again.", 503);
    if (!invoice) throw new AccessError("Invoice not found.", 404);

    const { data: photo } = await admin
      .from("photos")
      .select("photo_url")
      .eq("plumber_id", plumber.id)
      .eq("is_profile_photo", true)
      .maybeSingle();

    const business: BusinessInfo = {
      trading_name: plumber.trading_name,
      area: plumber.area,
      whatsapp_number: plumber.whatsapp_number,
      pirb_number: plumber.pirb_number,
      logo_url: photo?.photo_url ?? null,
    };

    const pdf = await renderInvoicePdf(invoice as Invoice, business, await loadLogo(business.logo_url));
    const filename = invoiceFilename(invoice as Invoice);
    const inline = request.nextUrl.searchParams.get("inline") === "1";

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "Vary": "Cookie, Authorization",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (!(error instanceof AccessError)) console.error("[invoice-pdf] Failed to render invoice PDF", error);
    return accessFailure(error);
  }
}
