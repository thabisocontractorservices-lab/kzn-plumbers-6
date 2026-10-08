import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  balanceDue,
  computeTotals,
  displayStatus,
  formatInvoiceDate,
  formatRand,
  invoiceDateOf,
  lineTotal,
  type BusinessInfo,
  type Invoice,
} from "@/lib/invoice";

export type PdfLogo = { data: Buffer; format: "png" | "jpg" } | null;

const BRAND = "#1A5FBE";
const INK = "#111827";
const MUTED = "#6B7280";
const RULE = "#E5E7EB";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  topBar: { height: 4, backgroundColor: BRAND, position: "absolute", top: 0, left: 0, right: 0 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  brandBlock: { flexDirection: "row", alignItems: "flex-start", maxWidth: 300 },
  logo: { width: 64, height: 64, objectFit: "contain", marginRight: 14, borderRadius: 6 },
  logoFallback: { width: 64, height: 64, marginRight: 14, borderRadius: 6, backgroundColor: BRAND, alignItems: "center", justifyContent: "center" },
  logoFallbackText: { color: "#FFFFFF", fontSize: 22, fontFamily: "Helvetica-Bold" },
  businessName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  businessLine: { fontSize: 9, color: MUTED, lineHeight: 1.45 },
  titleBlock: { alignItems: "flex-end" },
  title: { fontSize: 26, lineHeight: 1, fontFamily: "Helvetica-Bold", color: BRAND, marginBottom: 12, letterSpacing: 1 },
  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { width: 72, textAlign: "right", color: MUTED, marginRight: 8 },
  metaValue: { width: 92, textAlign: "right", fontFamily: "Helvetica-Bold" },
  statusPill: { marginTop: 6, paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8, fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  billTo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  sectionLabel: { fontSize: 8, color: MUTED, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  customerName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  tableHead: { flexDirection: "row", backgroundColor: "#4B5563", color: "#FFFFFF", paddingVertical: 7, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9 },
  row: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: RULE },
  rowAlt: { backgroundColor: "#F9FAFB" },
  colQty: { width: 44 },
  colDesc: { flexGrow: 1, flexShrink: 1, paddingRight: 8 },
  colPrice: { width: 90, textAlign: "right" },
  colTotal: { width: 90, textAlign: "right" },
  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totals: { width: 230 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalsGrand: { flexDirection: "row", justifyContent: "space-between", paddingTop: 7, marginTop: 4, borderTopWidth: 1.5, borderTopColor: INK, fontFamily: "Helvetica-Bold", fontSize: 12 },
  balance: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingVertical: 7, paddingHorizontal: 8, backgroundColor: "#E8F0FB", fontFamily: "Helvetica-Bold", fontSize: 11, color: BRAND },
  notes: { marginTop: 26 },
  noteText: { fontSize: 9.5, color: "#374151", lineHeight: 1.45 },
  thanks: { marginTop: 24, fontSize: 10, fontFamily: "Helvetica-Oblique", color: "#374151" },
  // Do NOT add lineHeight here or on the Page: react-pdf silently drops `render` text (page numbers) when lineHeight is set.
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, fontSize: 7.5, color: "#9CA3AF", borderTopWidth: 1, borderTopColor: RULE, paddingTop: 6, textAlign: "center" },
  paidStamp: { position: "absolute", top: 300, left: 170, fontSize: 72, color: "#0F6E56", opacity: 0.12, fontFamily: "Helvetica-Bold", transform: "rotate(-24deg)" },
});

const STATUS_PDF: Record<string, { bg: string; fg: string }> = {
  Draft: { bg: "#F3F4F6", fg: "#374151" },
  Unpaid: { bg: "#FAEEDA", fg: "#BA7517" },
  Overdue: { bg: "#FEE2E2", fg: "#B91C1C" },
  Paid: { bg: "#DCF1E8", fg: "#0F6E56" },
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "KZN";
}

function lines(value: string | null | undefined): string[] {
  return (value || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export function InvoicePdfDocument({ invoice, business, logo }: { invoice: Invoice; business: BusinessInfo; logo: PdfLogo }) {
  const totals = computeTotals(invoice.line_items || [], invoice.include_vat, Number(invoice.discount_amount) || 0);
  const total = totals.total;
  const status = displayStatus(invoice);
  const pill = STATUS_PDF[status];
  const address = lines(invoice.business_address);
  const dateValue = formatInvoiceDate(invoiceDateOf(invoice));

  return (
    <Document title={`Invoice ${invoice.invoice_number}`} author={business.trading_name} creator="KZN Plumbers Directory" producer="kznplumbers.co.za">
      <Page size="A4" style={s.page}>
        <View style={s.topBar} fixed />

        <View style={s.header}>
          <View style={s.brandBlock}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt prop
              <Image style={s.logo} src={logo} />
            ) : (
              <View style={s.logoFallback}><Text style={s.logoFallbackText}>{initials(business.trading_name)}</Text></View>
            )}
            <View style={{ flexShrink: 1 }}>
              <Text style={s.businessName}>{business.trading_name}</Text>
              {address.length > 0 ? address.map((l, i) => <Text key={i} style={s.businessLine}>{l}</Text>) : <Text style={s.businessLine}>{business.area}</Text>}
              {business.whatsapp_number ? <Text style={s.businessLine}>Tel: {business.whatsapp_number}</Text> : null}
              {invoice.business_email ? <Text style={s.businessLine}>{invoice.business_email}</Text> : null}
              {business.pirb_number ? <Text style={s.businessLine}>PIRB reg: {business.pirb_number}</Text> : null}
              {invoice.vat_number ? <Text style={s.businessLine}>VAT no: {invoice.vat_number}</Text> : null}
            </View>
          </View>

          <View style={s.titleBlock}>
            <Text style={s.title}>INVOICE</Text>
            <View style={s.metaRow}><Text style={s.metaLabel}>Invoice No.</Text><Text style={s.metaValue}>{invoice.invoice_number}</Text></View>
            <View style={s.metaRow}><Text style={s.metaLabel}>Date</Text><Text style={s.metaValue}>{dateValue}</Text></View>
            {invoice.due_date ? <View style={s.metaRow}><Text style={s.metaLabel}>Due Date</Text><Text style={s.metaValue}>{formatInvoiceDate(invoice.due_date)}</Text></View> : null}
            {invoice.reference ? <View style={s.metaRow}><Text style={s.metaLabel}>Reference</Text><Text style={s.metaValue}>{invoice.reference}</Text></View> : null}
            <Text style={[s.statusPill, { backgroundColor: pill.bg, color: pill.fg }]}>{status}</Text>
          </View>
        </View>

        <View style={s.billTo}>
          <View style={{ maxWidth: 280 }}>
            <Text style={s.sectionLabel}>Bill To</Text>
            <Text style={s.customerName}>{invoice.customer_name}</Text>
            {lines(invoice.customer_address).map((l, i) => <Text key={i} style={s.businessLine}>{l}</Text>)}
            {invoice.customer_phone ? <Text style={s.businessLine}>Tel: {invoice.customer_phone}</Text> : null}
            {invoice.customer_email ? <Text style={s.businessLine}>{invoice.customer_email}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.sectionLabel}>Amount Due</Text>
            <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: BRAND }}>{formatRand(balanceDue({ status: invoice.status, total }))}</Text>
          </View>
        </View>

        <View>
        <View style={s.tableHead} fixed>
          <Text style={s.colQty}>Qty</Text>
          <Text style={s.colDesc}>Description</Text>
          <Text style={s.colPrice}>Unit Price</Text>
          <Text style={s.colTotal}>Total</Text>
        </View>
        {(invoice.line_items || []).map((item, i) => (
          <View key={i} style={i % 2 ? [s.row, s.rowAlt] : s.row} wrap={false}>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={s.colDesc}>{item.description}</Text>
            <Text style={s.colPrice}>{formatRand(item.unit_price)}</Text>
            <Text style={s.colTotal}>{formatRand(lineTotal(item))}</Text>
          </View>
        ))}
        </View>

        <View style={s.totalsWrap} wrap={false}>
          <View style={s.totals}>
            <View style={s.totalsRow}><Text style={{ color: MUTED }}>Subtotal</Text><Text>{formatRand(totals.subtotal)}</Text></View>
            {totals.discount > 0 ? <View style={s.totalsRow}><Text style={{ color: MUTED }}>Discount</Text><Text>-{formatRand(totals.discount)}</Text></View> : null}
            {invoice.include_vat ? <View style={s.totalsRow}><Text style={{ color: MUTED }}>VAT (15%)</Text><Text>{formatRand(totals.vat)}</Text></View> : null}
            <View style={s.totalsGrand}><Text>Total</Text><Text>{formatRand(total)}</Text></View>
            <View style={s.balance}><Text>Balance Due</Text><Text>{formatRand(balanceDue({ status: invoice.status, total }))}</Text></View>
          </View>
        </View>

        {invoice.notes ? (
          <View style={s.notes} wrap={false}>
            <Text style={s.sectionLabel}>Notes</Text>
            <Text style={s.noteText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {invoice.footer_note ? (
          <View style={s.notes} wrap={false}>
            <Text style={s.sectionLabel}>Payment Details</Text>
            <Text style={s.noteText}>{invoice.footer_note}</Text>
          </View>
        ) : null}

        <Text style={s.thanks}>Thank you for your business.</Text>

        {status === "Paid" && <Text style={s.paidStamp}>PAID</Text>}
        <Text
          style={s.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${business.trading_name}  ·  Invoice ${invoice.invoice_number}  ·  Page ${pageNumber} of ${totalPages}  ·  kznplumbers.co.za`}
        />
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(invoice: Invoice, business: BusinessInfo, logo: PdfLogo): Promise<Buffer> {
  return renderToBuffer(<InvoicePdfDocument invoice={invoice} business={business} logo={logo} />);
}

/** react-pdf only embeds PNG and JPEG. Anything else (WebP, broken URL, slow host) falls back to initials. */
export async function loadLogo(url: string | null): Promise<PdfLogo> {
  if (!url || !/^https:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) return null;
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { data: bytes, format: "png" };
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { data: bytes, format: "jpg" };
    return null;
  } catch {
    return null;
  }
}
