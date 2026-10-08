import { describe, expect, it } from "vitest";
import {
  addDays,
  asciiFilename,
  balanceDue,
  computeTotals,
  displayStatus,
  formatInvoiceDate,
  formatRand,
  invoiceFilename,
  nextInvoiceNumber,
} from "../lib/invoice";

describe("invoice totals", () => {
  it("matches the sample invoice: R5,000 + 15% VAT = R5,750", () => {
    const t = computeTotals([{ description: "Drain Cleaning", quantity: 1, unit_price: 5000 }], true);
    expect(t).toEqual({ subtotal: 5000, discount: 0, taxable: 5000, vat: 750, total: 5750 });
  });

  it("charges VAT after the discount and never discounts below zero", () => {
    const items = [{ description: "Geyser", quantity: 2, unit_price: 1000 }];
    expect(computeTotals(items, true, 200).total).toBe(2070);
    expect(computeTotals(items, false, 99999).total).toBe(0);
  });

  it("avoids floating-point cents drift", () => {
    expect(computeTotals([{ description: "x", quantity: 3, unit_price: 0.1 }], false).total).toBe(0.3);
  });
});

describe("invoice formatting", () => {
  it("formats rand like the existing PDFs", () => {
    expect(formatRand(5750)).toBe("R5,750.00");
    expect(formatRand(1234567.5)).toBe("R1,234,567.50");
    expect(formatRand(0)).toBe("R0.00");
  });

  it("formats dates as yyyy/mm/dd and adds payment-term days across months", () => {
    expect(formatInvoiceDate("2026-10-08")).toBe("2026/10/08");
    expect(formatInvoiceDate("2026-10-08T14:00:00Z")).toBe("2026/10/08");
    expect(addDays("2026-10-08", 30)).toBe("2026-11-07");
  });

  it("builds safe download filenames", () => {
    expect(invoiceFilename({ invoice_number: "INV-0004", customer_name: "Thabiso Ndlovu" })).toBe("Invoice INV-0004 - Thabiso Ndlovu.pdf");
    expect(invoiceFilename({ invoice_number: "INV/5", customer_name: 'A "B" C' })).toBe("Invoice INV 5 - A B C.pdf");
    expect(asciiFilename("Invoice 1 - Zoë.pdf")).toBe("Invoice 1 - Zoe.pdf");
  });
});

describe("invoice numbering", () => {
  it("continues from the highest number, not the row count", () => {
    expect(nextInvoiceNumber([])).toBe("INV-0001");
    expect(nextInvoiceNumber(["INV-0001", "INV-0003"])).toBe("INV-0004");
    expect(nextInvoiceNumber(["10000"])).toBe("10001");
    expect(nextInvoiceNumber(["INV-0999"])).toBe("INV-1000");
  });
});

describe("invoice status", () => {
  it("shows unpaid, overdue, paid and draft clearly", () => {
    expect(displayStatus({ status: "sent", due_date: "2026-10-01" }, "2026-10-08")).toBe("Overdue");
    expect(displayStatus({ status: "sent", due_date: "2026-10-30" }, "2026-10-08")).toBe("Unpaid");
    expect(displayStatus({ status: "paid", due_date: "2026-10-01" }, "2026-10-08")).toBe("Paid");
    expect(displayStatus({ status: "draft", due_date: null }, "2026-10-08")).toBe("Draft");
    expect(balanceDue({ status: "paid", total: 5750 })).toBe(0);
  });
});
