"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/supabaseClient";
import { useAuthGate } from "@/lib/useAuthGate";
import { DashboardLoading } from "@/components/DashboardLoading";
import { DashboardNav } from "@/components/DashboardNav";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

export default function NewInvoicePage() {
  const router = useRouter();
  const { user, authChecking } = useAuthGate();
  const [plumberId, setPlumberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [includeVat, setIncludeVat] = useState(true);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unit_price: 0 },
  ]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: plumber } = await supabase
        .from("plumbers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();
      setPlumberId(plumber?.id ?? null);
      setLoading(false);
    })();
  }, [user]);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    if (field === "description") {
      updated[index].description = value as string;
    } else {
      updated[index][field] = Number(value) || 0;
    }
    setLineItems(updated);
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const vatAmount = includeVat ? subtotal * 0.15 : 0;
  const total = subtotal + vatAmount;

  const formatRand = (amount: number) =>
    new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 2 }).format(amount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plumberId) return;
    if (!customerName.trim()) return setError("Customer name is required");
    if (lineItems.some((item) => !item.description.trim())) return setError("All line items need a description");
    if (lineItems.some((item) => item.quantity <= 0 || item.unit_price <= 0)) return setError("Quantity and price must be greater than 0");

    setError(null);
    setSaving(true);

    // Get next invoice number for this plumber
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("plumber_id", plumberId);
    const nextNum = (count ?? 0) + 1;
    const invoiceNumber = `INV-${String(nextNum).padStart(4, "0")}`;

    const { error: insertError } = await supabase.from("invoices").insert({
      plumber_id: plumberId,
      invoice_number: invoiceNumber,
      customer_name: customerName.trim(),
      customer_address: customerAddress.trim() || null,
      customer_phone: customerPhone.trim() || null,
      customer_email: customerEmail.trim() || null,
      line_items: lineItems,
      subtotal,
      vat_amount: vatAmount,
      total,
      include_vat: includeVat,
      notes: notes.trim() || null,
      status: "draft",
    });

    setSaving(false);

    if (insertError) {
      setError("Failed to create invoice: " + insertError.message);
      return;
    }

    router.push("/dashboard/invoices");
    router.refresh();
  }

  if (authChecking || loading) return <DashboardLoading />;
  if (!user || !plumberId) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid lg:grid-cols-[240px_1fr] gap-6">
      <DashboardNav />
      <div>
        <h1 className="font-display text-3xl mb-1">Create Invoice</h1>
        <p className="text-gray-500 text-sm mb-6">Fill in the details below to generate a new invoice.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer details */}
          <div className="panel">
            <h2 className="font-display text-lg font-bold mb-4">Customer Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1 block">Customer name *</label>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="input"
                  placeholder="e.g. John Smith"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Phone</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="input"
                  placeholder="082 123 4567"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="input"
                  placeholder="customer@email.com"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Address</label>
                <input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="input"
                  placeholder="123 Main Street, Durban"
                />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="panel">
            <h2 className="font-display text-lg font-bold mb-4">Line Items</h2>
            <div className="space-y-3">
              {lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 sm:col-span-5">
                    {i === 0 && <label className="text-xs font-semibold mb-1 block">Description</label>}
                    <input
                      required
                      value={item.description}
                      onChange={(e) => updateLineItem(i, "description", e.target.value)}
                      className="input"
                      placeholder="e.g. Geyser replacement"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    {i === 0 && <label className="text-xs font-semibold mb-1 block">Qty</label>}
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(i, "quantity", e.target.value)}
                      className="input text-center"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    {i === 0 && <label className="text-xs font-semibold mb-1 block">Unit price (R)</label>}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price || ""}
                      onChange={(e) => updateLineItem(i, "unit_price", e.target.value)}
                      className="input"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-700 flex-1 text-right">
                      {formatRand(item.quantity * item.unit_price)}
                    </span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(i)}
                        className="text-red-400 hover:text-red-600 text-lg"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addLineItem}
              className="mt-3 text-sm text-brand font-semibold hover:underline"
            >
              + Add line item
            </button>

            {/* Totals */}
            <div className="mt-6 pt-4 border-t border-gray-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-semibold">{formatRand(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeVat}
                    onChange={(e) => setIncludeVat(e.target.checked)}
                  />
                  VAT (15%)
                </label>
                <span className="font-semibold">{formatRand(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span>Total</span>
                <span className="text-brand">{formatRand(total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="panel">
            <h2 className="font-display text-lg font-bold mb-4">Notes</h2>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input resize-none"
              placeholder="Payment terms, special instructions, warranty details..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Creating..." : "Create Invoice"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard/invoices")}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
