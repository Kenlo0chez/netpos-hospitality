"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";
import { selectInitialProperty } from "@/src/lib/propertyScope";

type Property = { id: string; name: string };
type Payment = { id: string; reservation_id: string | null; payment_reference: string | null; amount: number; received_at: string };
type Invoice = { id: string; reservation_id: string | null; invoice_number: string; status: string; invoice_date: string; total_amount: number };
type Allocation = { id: string; payment_id: string; invoice_id: string; amount: number; allocated_at: string };

const currency = new Intl.NumberFormat("en-NA", { style: "currency", currency: "NAD", minimumFractionDigits: 2 });

export default function EftAllocationPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [paymentId, setPaymentId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);

  const loadData = useCallback(async (selectedPropertyId: string) => {
    setLoading(true);
    setErrorMessage("");
    setSetupRequired(false);
    const [paymentResult, invoiceResult, allocationResult] = await Promise.all([
      supabase.from("payments").select("id,reservation_id,payment_reference,amount,received_at").eq("property_id", selectedPropertyId).eq("payment_method", "eft").in("transaction_type", ["payment", "deposit"]).order("received_at", { ascending: false }),
      supabase.from("invoices").select("id,reservation_id,invoice_number,status,invoice_date,total_amount").eq("property_id", selectedPropertyId).neq("status", "void").order("invoice_date", { ascending: false }),
      supabase.from("payment_allocations").select("id,payment_id,invoice_id,amount,allocated_at").eq("property_id", selectedPropertyId).order("allocated_at", { ascending: false }),
    ]);

    if (allocationResult.error) {
      if (allocationResult.error.message.toLowerCase().includes("payment_allocations")) setSetupRequired(true);
      setErrorMessage(allocationResult.error.message);
    } else if (paymentResult.error || invoiceResult.error) {
      setErrorMessage(paymentResult.error?.message ?? invoiceResult.error?.message ?? "Could not load EFT allocations.");
    } else {
      setPayments((paymentResult.data as Payment[]) ?? []);
      setInvoices((invoiceResult.data as Invoice[]) ?? []);
      setAllocations((allocationResult.data as Allocation[]) ?? []);
    }
    setLoading(false);
  }, []);

  const initialise = useCallback(async () => {
    const { data, error } = await supabase.from("properties").select("id,name").eq("is_active", true).order("name");
    if (error) { setErrorMessage(error.message); setLoading(false); return; }
    const { scoped, selected } = selectInitialProperty((data as Property[]) ?? []);
    setProperties(scoped);
    setPropertyId(selected);
    if (selected) await loadData(selected); else setLoading(false);
  }, [loadData]);

  useEffect(() => {
    // Data is loaded after the authenticated client session is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialise();
  }, [initialise]);

  const allocatedByPayment = useMemo(() => sumBy(allocations, "payment_id"), [allocations]);
  const allocatedByInvoice = useMemo(() => sumBy(allocations, "invoice_id"), [allocations]);
  const openPayments = payments.filter((payment) => Number(payment.amount) - (allocatedByPayment.get(payment.id) ?? 0) > 0.005);
  const openInvoices = invoices.filter((invoice) => Number(invoice.total_amount) - (allocatedByInvoice.get(invoice.id) ?? 0) > 0.005);
  const selectedPayment = openPayments.find((payment) => payment.id === paymentId);
  const selectedInvoice = openInvoices.find((invoice) => invoice.id === invoiceId);
  const paymentAvailable = selectedPayment ? Number(selectedPayment.amount) - (allocatedByPayment.get(selectedPayment.id) ?? 0) : 0;
  const invoiceOutstanding = selectedInvoice ? Number(selectedInvoice.total_amount) - (allocatedByInvoice.get(selectedInvoice.id) ?? 0) : 0;

  function choosePayment(value: string) {
    setPaymentId(value);
    const payment = openPayments.find((item) => item.id === value);
    if (!payment) return;
    const matchingInvoice = openInvoices.find((invoice) => invoice.reservation_id && invoice.reservation_id === payment.reservation_id);
    if (matchingInvoice) setInvoiceId(matchingInvoice.id);
    const available = Number(payment.amount) - (allocatedByPayment.get(payment.id) ?? 0);
    const owing = matchingInvoice ? Number(matchingInvoice.total_amount) - (allocatedByInvoice.get(matchingInvoice.id) ?? 0) : available;
    setAmount(Math.min(available, owing).toFixed(2));
  }

  async function allocate() {
    const allocationAmount = Number(amount);
    if (!paymentId || !invoiceId || !Number.isFinite(allocationAmount) || allocationAmount <= 0) { setErrorMessage("Select an EFT, select an invoice and enter a valid amount."); return; }
    if (allocationAmount > paymentAvailable + 0.005) { setErrorMessage("The amount is more than the EFT balance available."); return; }
    if (allocationAmount > invoiceOutstanding + 0.005) { setErrorMessage("The amount is more than the invoice outstanding balance."); return; }

    setSaving(true); setMessage(""); setErrorMessage("");
    const staff = JSON.parse(sessionStorage.getItem("netpos_staff") ?? "null") as { id?: string } | null;
    const { error } = await supabase.from("payment_allocations").insert({ property_id: propertyId, payment_id: paymentId, invoice_id: invoiceId, amount: allocationAmount, allocated_by: staff?.id ?? null });
    if (error) setErrorMessage(error.message);
    else { setMessage("EFT allocated successfully."); setPaymentId(""); setInvoiceId(""); setAmount(""); await loadData(propertyId); }
    setSaving(false);
  }

  return <main style={page}>
    <header style={header}><div><div style={eyebrow}>FINANCE · EFT CONTROL</div><h1 style={title}>Allocate EFT payments</h1><p style={muted}>Match money received in the bank to the correct Netpos invoice.</p></div><div style={actions}><Link href="/finance" style={secondary}>← Finance</Link><label style={label}>Property<select value={propertyId} onChange={(event) => { setPropertyId(event.target.value); void loadData(event.target.value); }} style={select}>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label></div></header>
    {setupRequired && <div style={warning}><strong>Finance database setup required.</strong><span>Apply migration 002 before using EFT allocation. No existing financial data will be removed.</span></div>}
    {errorMessage && !setupRequired && <div style={errorBox}>{errorMessage}</div>}
    {message && <div style={successBox}>{message}</div>}
    <section style={summary}><Summary label="Unallocated EFTs" value={String(openPayments.length)} /><Summary label="EFT value available" value={currency.format(openPayments.reduce((sum, p) => sum + Number(p.amount) - (allocatedByPayment.get(p.id) ?? 0), 0))} /><Summary label="Open invoices" value={String(openInvoices.length)} /><Summary label="Allocated records" value={String(allocations.length)} /></section>
    <section style={workspace}>
      <div style={formPanel}><h2 style={panelTitle}>New allocation</h2><p style={panelText}>Netpos suggests the invoice when the EFT already belongs to a reservation.</p>
        <label style={field}>EFT payment<select value={paymentId} onChange={(event) => choosePayment(event.target.value)} style={control}><option value="">Select an EFT</option>{openPayments.map((payment) => <option key={payment.id} value={payment.id}>{new Date(payment.received_at).toLocaleDateString("en-NA")} · {payment.payment_reference || "No reference"} · {currency.format(Number(payment.amount) - (allocatedByPayment.get(payment.id) ?? 0))}</option>)}</select></label>
        <label style={field}>Invoice<select value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); const invoice = openInvoices.find((x) => x.id === event.target.value); const owing = invoice ? Number(invoice.total_amount) - (allocatedByInvoice.get(invoice.id) ?? 0) : 0; setAmount(Math.min(paymentAvailable, owing).toFixed(2)); }} style={control}><option value="">Select an invoice</option>{openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · {currency.format(Number(invoice.total_amount) - (allocatedByInvoice.get(invoice.id) ?? 0))} outstanding</option>)}</select></label>
        <label style={field}>Amount to allocate<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} style={control} /></label>
        <div style={balanceRow}><span>EFT available <strong>{currency.format(paymentAvailable)}</strong></span><span>Invoice outstanding <strong>{currency.format(invoiceOutstanding)}</strong></span></div>
        <button type="button" onClick={allocate} disabled={saving || setupRequired || loading} style={primary}>{saving ? "Allocating..." : "Allocate EFT"}</button>
      </div>
      <div style={tablePanel}><div style={panelHead}><div><h2 style={panelTitle}>Recent allocations</h2><p style={panelText}>Every allocation remains traceable.</p></div></div><div style={tableWrap}><table style={table}><thead><tr><th style={th}>Date</th><th style={th}>EFT reference</th><th style={th}>Invoice</th><th style={thRight}>Amount</th></tr></thead><tbody>{allocations.slice(0, 20).map((allocation) => <tr key={allocation.id}><td style={td}>{new Date(allocation.allocated_at).toLocaleDateString("en-NA")}</td><td style={td}>{payments.find((x) => x.id === allocation.payment_id)?.payment_reference || "No reference"}</td><td style={tdStrong}>{invoices.find((x) => x.id === allocation.invoice_id)?.invoice_number || "Invoice"}</td><td style={tdRight}>{currency.format(Number(allocation.amount))}</td></tr>)}{!loading && allocations.length === 0 && <tr><td colSpan={4} style={empty}>No EFT allocations recorded yet.</td></tr>}</tbody></table></div></div>
    </section>
  </main>;
}

function sumBy(rows: Allocation[], key: "payment_id" | "invoice_id") { const result = new Map<string, number>(); for (const row of rows) result.set(row[key], (result.get(row[key]) ?? 0) + Number(row.amount)); return result; }
function Summary({ label, value }: { label: string; value: string }) { return <article style={summaryCard}><span style={summaryLabel}>{label}</span><strong style={summaryValue}>{value}</strong></article>; }

const page: CSSProperties = { minHeight: "calc(100vh - 112px)", padding: 24, background: "#F4F8FB", color: "#173F5F", fontFamily: "Arial, Helvetica, sans-serif" };
const header: CSSProperties = { maxWidth: 1440, margin: "0 auto 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 };
const eyebrow: CSSProperties = { color: "#168257", fontSize: 12, fontWeight: 900, letterSpacing: 1.2 };
const title: CSSProperties = { margin: "6px 0", fontSize: 28, color: "#123F69" };
const muted: CSSProperties = { margin: 0, color: "#6C8293", fontSize: 14 };
const actions: CSSProperties = { display: "flex", alignItems: "flex-end", gap: 12 };
const secondary: CSSProperties = { height: 42, display: "flex", alignItems: "center", padding: "0 13px", border: "1px solid #BDD0DE", borderRadius: 9, background: "#FFF", color: "#0D5FA8", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const label: CSSProperties = { display: "flex", flexDirection: "column", gap: 5, color: "#587083", fontSize: 11, fontWeight: 900 };
const select: CSSProperties = { minWidth: 220, height: 42, padding: "0 12px", border: "1px solid #BDD0DE", borderRadius: 9, background: "#FFF", color: "#173F5F", fontSize: 14, fontWeight: 700 };
const warning: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", padding: 14, display: "flex", flexDirection: "column", gap: 4, border: "1px solid #E7C47C", borderRadius: 10, background: "#FFF8E8", color: "#77500D", fontSize: 13 };
const errorBox: CSSProperties = { ...warning, borderColor: "#E5B0B0", background: "#FFF2F2", color: "#982F2F" };
const successBox: CSSProperties = { ...warning, borderColor: "#A9D7BF", background: "#ECF8F1", color: "#126D" };
const summary: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 };
const summaryCard: CSSProperties = { padding: "14px 16px", border: "1px solid #D7E4ED", borderRadius: 10, background: "#FFF" };
const summaryLabel: CSSProperties = { display: "block", color: "#718697", fontSize: 12, fontWeight: 800 };
const summaryValue: CSSProperties = { display: "block", marginTop: 7, color: "#123F69", fontSize: 21 };
const workspace: CSSProperties = { maxWidth: 1440, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(350px,.72fr) minmax(520px,1.28fr)", gap: 14 };
const formPanel: CSSProperties = { padding: 18, border: "1px solid #D7E4ED", borderRadius: 11, background: "#FFF" };
const tablePanel: CSSProperties = { minWidth: 0, border: "1px solid #D7E4ED", borderRadius: 11, background: "#FFF", overflow: "hidden" };
const panelHead: CSSProperties = { padding: 18, borderBottom: "1px solid #E5EDF3" };
const panelTitle: CSSProperties = { margin: 0, color: "#173F5F", fontSize: 17 };
const panelText: CSSProperties = { margin: "5px 0 16px", color: "#788D9C", fontSize: 12, lineHeight: 1.4 };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, marginTop: 14, color: "#4E687B", fontSize: 12, fontWeight: 800 };
const control: CSSProperties = { width: "100%", height: 43, padding: "0 11px", border: "1px solid #BFD1DF", borderRadius: 8, background: "#FFF", color: "#173F5F", fontSize: 13, boxSizing: "border-box" };
const balanceRow: CSSProperties = { margin: "16px 0", padding: 11, display: "flex", justifyContent: "space-between", gap: 10, borderRadius: 8, background: "#F2F7FA", color: "#607789", fontSize: 11 };
const primary: CSSProperties = { width: "100%", height: 44, border: 0, borderRadius: 8, background: "#168257", color: "#FFF", fontSize: 14, fontWeight: 900, cursor: "pointer" };
const tableWrap: CSSProperties = { maxHeight: 480, overflow: "auto" };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: CSSProperties = { position: "sticky", top: 0, padding: "10px 13px", background: "#F7FAFC", color: "#62798B", textAlign: "left", fontSize: 11 };
const thRight: CSSProperties = { ...th, textAlign: "right" };
const td: CSSProperties = { padding: "12px 13px", borderTop: "1px solid #E7EEF3", color: "#5B7284" };
const tdStrong: CSSProperties = { ...td, color: "#164D79", fontWeight: 800 };
const tdRight: CSSProperties = { ...tdStrong, textAlign: "right" };
const empty: CSSProperties = { padding: 30, color: "#7B8F9E", textAlign: "center" };
