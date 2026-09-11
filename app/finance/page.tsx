"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";

type Property = { id: string; name: string };
type Payment = {
  id: string;
  reservation_id: string | null;
  guest_id: string | null;
  company_id: string | null;
  payment_reference: string | null;
  payment_method: "cash" | "card" | "eft" | "account";
  transaction_type: "payment" | "deposit" | "refund";
  amount: number;
  received_at: string;
};
type Invoice = {
  id: string;
  invoice_number: string;
  status: "draft" | "issued" | "part_paid" | "paid" | "void";
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
};

const money = new Intl.NumberFormat("en-NA", {
  style: "currency",
  currency: "NAD",
  minimumFractionDigits: 2,
});

export default function FinancePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadFinance = useCallback(async (selectedPropertyId: string) => {
    setLoading(true);
    setErrorMessage("");
    const [paymentResult, invoiceResult] = await Promise.all([
      supabase.from("payments").select("id,reservation_id,guest_id,company_id,payment_reference,payment_method,transaction_type,amount,received_at").eq("property_id", selectedPropertyId).order("received_at", { ascending: false }).limit(100),
      supabase.from("invoices").select("id,invoice_number,status,invoice_date,due_date,total_amount").eq("property_id", selectedPropertyId).order("invoice_date", { ascending: false }).limit(100),
    ]);

    if (paymentResult.error || invoiceResult.error) {
      setErrorMessage(paymentResult.error?.message ?? invoiceResult.error?.message ?? "Could not load finance data.");
    } else {
      setPayments((paymentResult.data as Payment[]) ?? []);
      setInvoices((invoiceResult.data as Invoice[]) ?? []);
    }
    setLoading(false);
  }, []);

  const initialise = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("properties").select("id,name").eq("is_active", true).order("name");
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data as Property[]) ?? [];
    const assigned = sessionStorage.getItem("netpos_property_id");
    const selected = rows.some((property) => property.id === assigned) ? assigned! : rows[0]?.id ?? "";
    setProperties(rows);
    setPropertyId(selected);
    if (selected) await loadFinance(selected);
    setLoading(false);
  }, [loadFinance]);

  useEffect(() => {
    // Initial client-side Supabase load; subsequent updates are user-driven.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialise();
  }, [initialise]);

  const totals = useMemo(() => {
    const net = (method: Payment["payment_method"]) => payments
      .filter((payment) => payment.payment_method === method)
      .reduce((sum, payment) => sum + (payment.transaction_type === "refund" ? -Number(payment.amount) : Number(payment.amount)), 0);
    return {
      eft: net("eft"),
      cash: net("cash"),
      card: net("card"),
      openInvoices: invoices.filter((invoice) => invoice.status === "issued" || invoice.status === "part_paid").reduce((sum, invoice) => sum + Number(invoice.total_amount), 0),
      unmatchedEft: payments.filter((payment) => payment.payment_method === "eft" && !payment.reservation_id && !payment.guest_id && !payment.company_id).length,
    };
  }, [payments, invoices]);

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <p style={eyebrow}>FINANCE CONTROL</p>
          <h1 style={title}>Money, accounts and reconciliation</h1>
          <p style={subtitle}>See what was received, find EFTs needing attention and move into the correct daily control task.</p>
        </div>
        <label style={propertyLabel}>Property
          <select value={propertyId} onChange={(event) => { setPropertyId(event.target.value); void loadFinance(event.target.value); }} style={select}>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </label>
      </section>

      {errorMessage && <div style={errorBox}>{errorMessage}</div>}

      <section style={metricGrid} aria-label="Finance summary">
        <Metric label="EFT received" value={money.format(totals.eft)} hint={`${totals.unmatchedEft} EFT${totals.unmatchedEft === 1 ? "" : "s"} need allocation`} tone="blue" />
        <Metric label="Cash received" value={money.format(totals.cash)} hint="Verify during cash-up" tone="green" />
        <Metric label="Card received" value={money.format(totals.card)} hint="Compare with terminal" tone="violet" />
        <Metric label="Open invoices" value={money.format(totals.openInvoices)} hint="Issued and part-paid" tone="amber" />
      </section>

      <section style={workGrid}>
        <div style={panel}>
          <div style={panelHeading}><div><h2 style={panelTitle}>Today’s finance work</h2><p style={panelText}>Complete these controls in order.</p></div></div>
          <div style={taskList}>
            <Task number="1" title="Allocate EFT payments" detail="Match every bank payment to the correct invoice." href="/finance/eft" status={totals.unmatchedEft ? `${totals.unmatchedEft} waiting` : "Open allocations"} />
            <Task number="2" title="Review guest and company accounts" detail="Follow up outstanding reservation accounts before they become overdue." href="/billing/accounts?filter=outstanding" status={`${invoices.filter((x) => x.status === "issued" || x.status === "part_paid").length} open invoices`} />
            <Task number="3" title="Complete X Report and EOD" detail="Compare expected cash, card and EFT totals, then close the business day." href="/cash-up" status="Open control" />
            <Task number="4" title="Review cashbook and expenses" detail="See all money in and money out, then capture operating expenses." href="/finance/cashbook" status="Open cashbook" />
          </div>
        </div>

        <div style={panel}>
          <div style={panelHeading}><div><h2 style={panelTitle}>Recent payments</h2><p style={panelText}>Latest 100 transactions for this property.</p></div><Link href="/billing" style={textLink}>Open billing</Link></div>
          <div style={tableWrap}>
            <table style={table}>
              <thead><tr><th style={th}>Received</th><th style={th}>Method</th><th style={th}>Reference</th><th style={{...th, textAlign: "right"}}>Amount</th></tr></thead>
              <tbody>
                {payments.slice(0, 10).map((payment) => <tr key={payment.id}><td style={td}>{new Date(payment.received_at).toLocaleDateString("en-NA")}</td><td style={td}><span style={badge}>{payment.payment_method.toUpperCase()}</span></td><td style={td}>{payment.payment_reference || "No reference"}</td><td style={{...td, textAlign: "right", fontWeight: 800, color: payment.transaction_type === "refund" ? "#A33A3A" : "#173F5F"}}>{payment.transaction_type === "refund" ? "−" : ""}{money.format(Number(payment.amount))}</td></tr>)}
                {!loading && payments.length === 0 && <tr><td colSpan={4} style={empty}>No payments recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: "blue" | "green" | "violet" | "amber" }) {
  const colors = { blue: "#0D5FA8", green: "#168257", violet: "#6654A8", amber: "#A96812" };
  return <article style={metricCard}><div style={{...metricBar, background: colors[tone]}} /><span style={metricLabel}>{label}</span><strong style={metricValue}>{value}</strong><span style={metricHint}>{hint}</span></article>;
}

function Task({ number, title, detail, status, href }: { number: string; title: string; detail: string; status: string; href?: string }) {
  const content = <><span style={taskNumber}>{number}</span><span style={taskCopy}><strong style={taskTitle}>{title}</strong><span style={taskDetail}>{detail}</span></span><span style={taskStatus}>{status}</span></>;
  return href ? <Link href={href} style={task}>{content}</Link> : <div style={task}>{content}</div>;
}

const page: CSSProperties = { minHeight: "calc(100vh - 112px)", padding: "24px", background: "#F4F8FB", color: "#173F5F", fontFamily: "Arial, Helvetica, sans-serif" };
const header: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, margin: "0 auto 20px", maxWidth: 1440 };
const eyebrow: CSSProperties = { margin: "0 0 7px", color: "#168257", fontSize: 12, fontWeight: 900, letterSpacing: 1.4 };
const title: CSSProperties = { margin: 0, color: "#123F69", fontSize: 28, lineHeight: 1.15, letterSpacing: -0.5 };
const subtitle: CSSProperties = { margin: "7px 0 0", maxWidth: 680, color: "#667D8F", fontSize: 15, lineHeight: 1.45 };
const propertyLabel: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, minWidth: 230, color: "#526B7D", fontSize: 12, fontWeight: 800 };
const select: CSSProperties = { height: 42, padding: "0 12px", border: "1px solid #BED2E1", borderRadius: 9, background: "#FFFFFF", color: "#173F5F", fontSize: 14, fontWeight: 700 };
const errorBox: CSSProperties = { maxWidth: 1440, margin: "0 auto 16px", padding: 12, border: "1px solid #E7B8B8", borderRadius: 9, background: "#FFF4F4", color: "#9A2D2D" };
const metricGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, maxWidth: 1440, margin: "0 auto 16px" };
const metricCard: CSSProperties = { position: "relative", overflow: "hidden", minHeight: 112, padding: "16px 18px", border: "1px solid #D8E5EE", borderRadius: 12, background: "#FFFFFF", boxShadow: "0 5px 18px rgba(18,63,105,.05)" };
const metricBar: CSSProperties = { position: "absolute", inset: "0 auto 0 0", width: 4 };
const metricLabel: CSSProperties = { display: "block", color: "#657C8E", fontSize: 13, fontWeight: 800 };
const metricValue: CSSProperties = { display: "block", marginTop: 10, color: "#123F69", fontSize: 24, letterSpacing: -0.4 };
const metricHint: CSSProperties = { display: "block", marginTop: 7, color: "#7D909F", fontSize: 12 };
const workGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(320px, .8fr) minmax(480px, 1.2fr)", gap: 16, maxWidth: 1440, margin: "0 auto" };
const panel: CSSProperties = { minWidth: 0, border: "1px solid #D8E5EE", borderRadius: 12, background: "#FFFFFF", boxShadow: "0 5px 18px rgba(18,63,105,.05)" };
const panelHeading: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, padding: "17px 18px", borderBottom: "1px solid #E4EDF3" };
const panelTitle: CSSProperties = { margin: 0, color: "#173F5F", fontSize: 17 };
const panelText: CSSProperties = { margin: "4px 0 0", color: "#788C9B", fontSize: 12 };
const textLink: CSSProperties = { color: "#0D5FA8", fontSize: 13, fontWeight: 800, textDecoration: "none" };
const taskList: CSSProperties = { display: "flex", flexDirection: "column", padding: 8 };
const task: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "13px 10px", borderBottom: "1px solid #EDF2F6", color: "inherit", textDecoration: "none" };
const taskNumber: CSSProperties = { display: "grid", placeItems: "center", width: 29, height: 29, flex: "0 0 29px", borderRadius: 8, background: "#EAF3FA", color: "#0D5FA8", fontSize: 13, fontWeight: 900 };
const taskCopy: CSSProperties = { display: "flex", flex: 1, minWidth: 0, flexDirection: "column", gap: 4 };
const taskTitle: CSSProperties = { color: "#234A67", fontSize: 14 };
const taskDetail: CSSProperties = { color: "#748A9A", fontSize: 12, lineHeight: 1.4 };
const taskStatus: CSSProperties = { flex: "0 0 auto", padding: "5px 8px", borderRadius: 999, background: "#F0F5F8", color: "#516B7E", fontSize: 11, fontWeight: 800 };
const tableWrap: CSSProperties = { maxHeight: 410, overflow: "auto" };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: CSSProperties = { position: "sticky", top: 0, padding: "10px 14px", background: "#F7FAFC", color: "#62798B", textAlign: "left", fontSize: 11, letterSpacing: .3 };
const td: CSSProperties = { padding: "12px 14px", borderTop: "1px solid #E8EFF4", color: "#526B7D", whiteSpace: "nowrap" };
const badge: CSSProperties = { display: "inline-block", minWidth: 40, padding: "4px 7px", borderRadius: 6, background: "#EAF3FA", color: "#0D5FA8", textAlign: "center", fontSize: 10, fontWeight: 900 };
const empty: CSSProperties = { padding: 30, color: "#7D909F", textAlign: "center" };
