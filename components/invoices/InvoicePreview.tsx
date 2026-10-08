import {
  STATUS_STYLES,
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

type PreviewInvoice = Omit<Invoice, "id" | "plumber_id" | "created_at" | "subtotal" | "vat_amount" | "total"> & {
  created_at?: string;
  total?: number;
};

function Lines({ value, className }: { value?: string | null; className?: string }) {
  const lines = (value || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return <>{lines.map((l, i) => <p key={i} className={className}>{l}</p>)}</>;
}

/** On-screen version of the PDF — same layout so plumbers know exactly what the customer gets. */
export function InvoicePreview({ invoice, business }: { invoice: PreviewInvoice; business: BusinessInfo }) {
  const totals = computeTotals(invoice.line_items || [], invoice.include_vat, Number(invoice.discount_amount) || 0);
  const status = displayStatus({ status: invoice.status, due_date: invoice.due_date ?? null });
  const balance = balanceDue({ status: invoice.status, total: totals.total });
  const date = formatInvoiceDate(invoiceDateOf({ invoice_date: invoice.invoice_date, created_at: invoice.created_at ?? "" }));
  const initials = business.trading_name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="relative bg-white text-gray-900 text-sm border-t-4 border-brand">
      <div className="p-5 sm:p-8">
        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-6 mb-8">
          <div className="flex items-start gap-4 min-w-0">
            {business.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from Supabase storage
              <img src={business.logo_url} alt="" className="w-16 h-16 rounded-md object-contain shrink-0 border border-gray-100" />
            ) : (
              <div className="w-16 h-16 rounded-md bg-brand text-white flex items-center justify-center font-bold text-xl shrink-0">{initials}</div>
            )}
            <div className="min-w-0 text-xs text-gray-500 leading-relaxed">
              <p className="text-base font-bold text-gray-900 mb-0.5">{business.trading_name}</p>
              {invoice.business_address ? <Lines value={invoice.business_address} /> : <p>{business.area}</p>}
              {business.whatsapp_number && <p>Tel: {business.whatsapp_number}</p>}
              {invoice.business_email && <p>{invoice.business_email}</p>}
              {business.pirb_number && <p>PIRB reg: {business.pirb_number}</p>}
              {invoice.vat_number && <p>VAT no: {invoice.vat_number}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-3xl font-bold tracking-wide text-brand mb-2">INVOICE</p>
            <dl className="grid grid-cols-[auto_auto] sm:justify-end gap-x-4 gap-y-0.5 text-xs">
              <dt className="text-gray-500">Invoice No.</dt><dd className="font-semibold">{invoice.invoice_number || "—"}</dd>
              <dt className="text-gray-500">Date</dt><dd className="font-semibold">{date || "—"}</dd>
              {invoice.due_date && (<><dt className="text-gray-500">Due Date</dt><dd className="font-semibold">{formatInvoiceDate(invoice.due_date)}</dd></>)}
              {invoice.reference && (<><dt className="text-gray-500">Reference</dt><dd className="font-semibold">{invoice.reference}</dd></>)}
            </dl>
            <span className={`badge mt-2 ${STATUS_STYLES[status]}`}>{status}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6">
          <div className="text-xs text-gray-500 leading-relaxed">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1">Bill To</p>
            <p className="text-sm font-bold text-gray-900">{invoice.customer_name || "Customer name"}</p>
            <Lines value={invoice.customer_address} />
            {invoice.customer_phone && <p>Tel: {invoice.customer_phone}</p>}
            {invoice.customer_email && <p>{invoice.customer_email}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Amount Due</p>
            <p className="text-2xl font-bold text-brand">{formatRand(balance)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[460px]">
            <thead>
              <tr className="bg-gray-600 text-white text-xs">
                <th className="text-left font-semibold px-3 py-2 w-14">Qty</th>
                <th className="text-left font-semibold px-3 py-2">Description</th>
                <th className="text-right font-semibold px-3 py-2 w-28">Unit Price</th>
                <th className="text-right font-semibold px-3 py-2 w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.line_items || []).map((item, i) => (
                <tr key={i} className={`border-b border-gray-200 ${i % 2 ? "bg-gray-50" : ""}`}>
                  <td className="px-3 py-2.5">{item.quantity}</td>
                  <td className="px-3 py-2.5">{item.description || <span className="text-gray-400">Description</span>}</td>
                  <td className="px-3 py-2.5 text-right">{formatRand(item.unit_price)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatRand(lineTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <div className="w-full sm:w-64 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatRand(totals.subtotal)}</span></div>
            {totals.discount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{formatRand(totals.discount)}</span></div>}
            {invoice.include_vat && <div className="flex justify-between"><span className="text-gray-500">VAT (15%)</span><span>{formatRand(totals.vat)}</span></div>}
            <div className="flex justify-between font-bold text-base border-t-2 border-gray-900 pt-2 mt-1"><span>Total</span><span>{formatRand(totals.total)}</span></div>
            <div className="flex justify-between font-bold bg-brand-light text-brand px-2 py-1.5 rounded mt-2"><span>Balance Due</span><span>{formatRand(balance)}</span></div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
        {invoice.footer_note && (
          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Payment Details</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.footer_note}</p>
          </div>
        )}
        <p className="mt-6 text-sm italic text-gray-700">Thank you for your business.</p>
      </div>
      {status === "Paid" && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="text-7xl font-bold text-teal/10 -rotate-12">PAID</span>
        </div>
      )}
    </div>
  );
}
