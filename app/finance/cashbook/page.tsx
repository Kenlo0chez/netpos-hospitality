"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import FinanceSubnav from "@/src/components/FinanceSubnav";
import { supabase } from "@/src/lib/supabase";
import { selectInitialProperty } from "@/src/lib/propertyScope";

type Property = { id: string; name: string };
type Payment = { id: string; payment_method: string; transaction_type: string; payment_reference: string | null; amount: number; received_at: string; notes: string | null };
type Expense = { id: string; expense_date: string; supplier_name: string; reference: string | null; description: string; payment_method: string; total_amount: number; status: string };
type Payout = { id: string; payout_date: string; payee_name: string; reference: string; reason: string; payment_method: string; amount: number; status: string };
type CashbookRow = { id: string; date: string; description: string; reference: string; method: string; moneyIn: number; moneyOut: number; kind: "receipt" | "expense" | "payout" };

const money = new Intl.NumberFormat("en-NA", { style: "currency", currency: "NAD", minimumFractionDigits: 2 });

export default function CashbookPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");

  const loadCashbook = useCallback(async (selectedPropertyId: string) => {
    setLoading(true); setErrorMessage(""); setSetupRequired(false);
    const [paymentResult, expenseResult, payoutResult] = await Promise.all([
      supabase.from("payments").select("id,payment_method,transaction_type,payment_reference,amount,received_at,notes").eq("property_id", selectedPropertyId).order("received_at", { ascending: false }).limit(500),
      supabase.from("expenses").select("id,expense_date,supplier_name,reference,description,payment_method,total_amount,status").eq("property_id", selectedPropertyId).neq("status", "reversed").order("expense_date", { ascending: false }).limit(500),
      supabase.from("payouts").select("id,payout_date,payee_name,reference,reason,payment_method,amount,status").eq("property_id", selectedPropertyId).eq("status", "posted").order("payout_date", { ascending: false }).limit(500),
    ]);
    if (expenseResult.error || payoutResult.error) { setSetupRequired(true); setErrorMessage(expenseResult.error?.message ?? payoutResult.error?.message ?? "Finance setup required."); }
    else if (paymentResult.error) setErrorMessage(paymentResult.error.message);
    else { setPayments((paymentResult.data as Payment[]) ?? []); setExpenses((expenseResult.data as Expense[]) ?? []); setPayouts((payoutResult.data as Payout[]) ?? []); }
    setLoading(false);
  }, []);

  const initialise = useCallback(async () => {
    const { data, error } = await supabase.from("properties").select("id,name").eq("is_active", true).order("name");
    if (error) { setErrorMessage(error.message); setLoading(false); return; }
    const { scoped, selected } = selectInitialProperty((data as Property[]) ?? []);
    setProperties(scoped); setPropertyId(selected);
    if (selected) await loadCashbook(selected); else setLoading(false);
  }, [loadCashbook]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialise();
  }, [initialise]);

  const rows = useMemo<CashbookRow[]>(() => {
    const receipts = payments.map((p) => ({ id: `p-${p.id}`, date: p.received_at, description: p.transaction_type === "refund" ? "Guest refund" : p.notes || "Guest payment", reference: p.payment_reference || "—", method: p.payment_method, moneyIn: p.transaction_type === "refund" ? 0 : Number(p.amount), moneyOut: p.transaction_type === "refund" ? Number(p.amount) : 0, kind: "receipt" as const }));
    const costs = expenses.map((e) => ({ id: `e-${e.id}`, date: `${e.expense_date}T12:00:00`, description: `${e.supplier_name} · ${e.description}`, reference: e.reference || "—", method: e.payment_method, moneyIn: 0, moneyOut: Number(e.total_amount), kind: "expense" as const }));
    const disbursements = payouts.map((p) => ({ id: `o-${p.id}`, date: `${p.payout_date}T12:00:00`, description: `Payout · ${p.payee_name} · ${p.reason}`, reference: p.reference, method: p.payment_method, moneyIn: 0, moneyOut: Number(p.amount), kind: "payout" as const }));
    return [...receipts, ...costs, ...disbursements].sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, expenses, payouts]);

  const filtered = rows.filter((row) => !search.trim() || `${row.description} ${row.reference} ${row.method}`.toLowerCase().includes(search.trim().toLowerCase()));
  const received = filtered.reduce((sum, row) => sum + row.moneyIn, 0);
  const paidOut = filtered.reduce((sum, row) => sum + row.moneyOut, 0);

  return <main style={page}>
    <header style={header}><div><div style={eyebrow}>FINANCE · CASHBOOK</div><h1 style={title}>Money in and money out</h1><p style={muted}>One chronological record of guest receipts, refunds, expenses and authorised payouts.</p></div><div style={actions}><Link href="/finance/expenses" style={primaryLink}>+ Expense</Link><Link href="/finance/payouts" style={payoutLink}>+ Payout</Link><select value={propertyId} onChange={(e) => { setPropertyId(e.target.value); void loadCashbook(e.target.value); }} style={select}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></header><FinanceSubnav />
    {setupRequired && <div style={warning}><strong>Finance database setup required.</strong><span>Migration 002 must be applied before expenses can appear.</span></div>}
    {errorMessage && !setupRequired && <div style={errorBox}>{errorMessage}</div>}
    <section style={summary}><Metric label="Money In" value={money.format(received)} color="#168257" /><Metric label="Money Out" value={money.format(paidOut)} color="#A33A3A" /><Metric label="Net Movement" value={money.format(received - paidOut)} color="#0D5FA8" /><Metric label="Transactions" value={String(filtered.length)} color="#6654A8" /></section>
    <section style={panel}><div style={toolbar}><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description, reference or method..." style={input} /><button type="button" onClick={() => void loadCashbook(propertyId)} style={secondaryButton}>Refresh</button></div><div style={tableWrap}><table style={table}><thead><tr><th style={th}>Date</th><th style={th}>Description</th><th style={th}>Reference</th><th style={th}>Method</th><th style={thRight}>Money In</th><th style={thRight}>Money Out</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td style={td}>{new Date(row.date).toLocaleDateString("en-NA")}</td><td style={tdStrong}><span style={{...dot, background: row.kind === "receipt" ? "#168257" : "#A33A3A"}} />{row.description}</td><td style={td}>{row.reference}</td><td style={td}><span style={badge}>{row.method.toUpperCase()}</span></td><td style={{...tdRight, color: "#168257"}}>{row.moneyIn ? money.format(row.moneyIn) : "—"}</td><td style={{...tdRight, color: "#A33A3A"}}>{row.moneyOut ? money.format(row.moneyOut) : "—"}</td></tr>)}{!loading && filtered.length === 0 && <tr><td colSpan={6} style={empty}>No cashbook transactions match this view.</td></tr>}</tbody></table></div></section>
  </main>;
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) { return <article style={metric}><span style={metricLabel}>{label}</span><strong style={{...metricValue, color}}>{value}</strong></article>; }
const page: CSSProperties = { minHeight: "calc(100vh - 112px)", padding: 24, background: "#F4F8FB", color: "#173F5F", fontFamily: "Arial,Helvetica,sans-serif" };
const header: CSSProperties = { maxWidth: 1440, margin: "0 auto 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 };
const eyebrow: CSSProperties = { color: "#168257", fontSize: 12, fontWeight: 900, letterSpacing: 1.2 }; const title: CSSProperties = { margin: "6px 0", fontSize: 28, color: "#123F69" }; const muted: CSSProperties = { margin: 0, color: "#6C8293", fontSize: 14 };
const actions: CSSProperties = { display: "flex", alignItems: "center", gap: 9 }; const secondary: CSSProperties = { padding: "12px 13px", border: "1px solid #BDD0DE", borderRadius: 8, background: "#FFF", color: "#0D5FA8", textDecoration: "none", fontSize: 13, fontWeight: 800 }; const primaryLink: CSSProperties = { ...secondary, borderColor: "#168257", background: "#168257", color: "#FFF" }; const select: CSSProperties = { height: 42, minWidth: 210, padding: "0 11px", border: "1px solid #BDD0DE", borderRadius: 8, background: "#FFF", color: "#173F5F", fontWeight: 700 };
const payoutLink: CSSProperties = { ...secondary, borderColor: "#0D5FA8", background: "#0D5FA8", color: "#FFF" };
const warning: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", padding: 13, display: "flex", flexDirection: "column", gap: 4, border: "1px solid #E7C47C", borderRadius: 9, background: "#FFF8E8", color: "#77500D", fontSize: 13 }; const errorBox: CSSProperties = { ...warning, borderColor: "#E5B0B0", background: "#FFF2F2", color: "#982F2F" };
const summary: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }; const metric: CSSProperties = { padding: "15px 17px", border: "1px solid #D7E4ED", borderRadius: 10, background: "#FFF" }; const metricLabel: CSSProperties = { display: "block", color: "#718697", fontSize: 12, fontWeight: 800 }; const metricValue: CSSProperties = { display: "block", marginTop: 8, fontSize: 22 };
const panel: CSSProperties = { maxWidth: 1440, margin: "0 auto", border: "1px solid #D7E4ED", borderRadius: 11, background: "#FFF", overflow: "hidden" }; const toolbar: CSSProperties = { padding: 12, display: "flex", gap: 10, borderBottom: "1px solid #E5EDF3" }; const input: CSSProperties = { flex: 1, height: 40, padding: "0 12px", border: "1px solid #C4D5E1", borderRadius: 8, fontSize: 13 }; const secondaryButton: CSSProperties = { padding: "0 14px", border: "1px solid #BDD0DE", borderRadius: 8, background: "#FFF", color: "#0D5FA8", fontWeight: 800, cursor: "pointer" };
const tableWrap: CSSProperties = { maxHeight: "calc(100vh - 380px)", minHeight: 260, overflow: "auto" }; const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 }; const th: CSSProperties = { position: "sticky", top: 0, padding: "10px 13px", background: "#F7FAFC", color: "#62798B", textAlign: "left", fontSize: 11 }; const thRight: CSSProperties = { ...th, textAlign: "right" }; const td: CSSProperties = { padding: "12px 13px", borderTop: "1px solid #E7EEF3", color: "#5B7284", whiteSpace: "nowrap" }; const tdStrong: CSSProperties = { ...td, color: "#164D79", fontWeight: 800 }; const tdRight: CSSProperties = { ...td, textAlign: "right", fontWeight: 800 }; const dot: CSSProperties = { display: "inline-block", width: 7, height: 7, marginRight: 8, borderRadius: "50%" }; const badge: CSSProperties = { padding: "4px 7px", borderRadius: 6, background: "#EAF3FA", color: "#0D5FA8", fontSize: 10, fontWeight: 900 }; const empty: CSSProperties = { padding: 30, color: "#7B8F9E", textAlign: "center" };
