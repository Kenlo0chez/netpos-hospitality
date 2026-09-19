"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/src/lib/supabase";

type Tab = "cashbook" | "reconciliation" | "vat" | "payouts";
type Property = { id: string; name: string; vat_rate: number };
type FinanceEntry = {
  id: string;
  property_id: string;
  entry_date: string;
  entry_type: "income" | "expense" | "payout";
  category: string;
  description: string;
  payment_method: string;
  reference: string | null;
  amount: number;
  vat_amount: number;
  bank_status: "unmatched" | "matched" | "excluded";
  bank_reference: string | null;
};

const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: "cashbook", label: "Cashbook", hint: "Income and expenses" },
  { id: "reconciliation", label: "Bank Reconciliation", hint: "Match bank activity" },
  { id: "vat", label: "VAT Report", hint: "VAT collected and paid" },
  { id: "payouts", label: "Payouts", hint: "Cash paid out" },
];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("cashbook");
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showEntry, setShowEntry] = useState(false);
  const [form, setForm] = useState({
    entry_date: today(), entry_type: "expense" as FinanceEntry["entry_type"],
    category: "Operating Expense", description: "", payment_method: "cash",
    reference: "", amount: "", vat_amount: "",
  });

  const loadEntries = useCallback(async (selectedProperty: string) => {
    if (!selectedProperty) return;
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("finance_entries")
      .select("id,property_id,entry_date,entry_type,category,description,payment_method,reference,amount,vat_amount,bank_status,bank_reference")
      .eq("property_id", selectedProperty)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    setEntries((data as FinanceEntry[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function initialise() {
      const savedProperty = sessionStorage.getItem("netpos_property_id") ?? "";
      const savedStaff = sessionStorage.getItem("netpos_staff");
      const staff = savedStaff
        ? (JSON.parse(savedStaff) as { role?: string; property_id?: string | null })
        : null;
      const { data, error: propertyError } = await supabase
        .from("properties").select("id,name,vat_rate").eq("is_active", true).order("name");
      if (propertyError) { setError(propertyError.message); setLoading(false); return; }
      const allRows = (data as Property[]) ?? [];
      const rows = staff?.role === "manager" && staff.property_id
        ? allRows.filter((property) => property.id === staff.property_id)
        : allRows;
      setProperties(rows);
      const initial = rows.some((item) => item.id === savedProperty) ? savedProperty : rows[0]?.id ?? "";
      setPropertyId(initial);
      await loadEntries(initial);
    }
    initialise();
  }, [loadEntries]);

  const filtered = useMemo(() => activeTab === "payouts"
    ? entries.filter((entry) => entry.entry_type === "payout") : entries, [activeTab, entries]);
  const totals = useMemo(() => {
    const income = entries.filter((e) => e.entry_type === "income").reduce((s, e) => s + Number(e.amount), 0);
    const expenses = entries.filter((e) => e.entry_type !== "income").reduce((s, e) => s + Number(e.amount), 0);
    const outputVat = entries.filter((e) => e.entry_type === "income").reduce((s, e) => s + Number(e.vat_amount), 0);
    const inputVat = entries.filter((e) => e.entry_type !== "income").reduce((s, e) => s + Number(e.vat_amount), 0);
    return { income, expenses, balance: income - expenses, outputVat, inputVat, vatDue: outputVat - inputVat };
  }, [entries]);

  async function changeProperty(next: string) { setPropertyId(next); await loadEntries(next); }

  async function saveEntry(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    const vatAmount = Number(form.vat_amount || 0);
    if (!propertyId || !form.description.trim() || amount <= 0 || vatAmount < 0 || vatAmount > amount) {
      setError("Enter a description and a valid amount. VAT cannot exceed the total."); return;
    }
    setSaving(true); setError("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("finance_entries").insert({
      property_id: propertyId, entry_date: form.entry_date, entry_type: form.entry_type,
      category: form.category.trim(), description: form.description.trim(),
      payment_method: form.payment_method, reference: form.reference.trim() || null,
      amount, vat_amount: vatAmount, created_by: auth.user?.id ?? null,
    });
    if (insertError) setError(insertError.message);
    else {
      setShowEntry(false);
      setForm({ ...form, description: "", reference: "", amount: "", vat_amount: "" });
      await loadEntries(propertyId);
    }
    setSaving(false);
  }

  async function setBankStatus(entry: FinanceEntry, status: FinanceEntry["bank_status"]) {
    const bankReference = status === "matched"
      ? window.prompt("Bank statement reference", entry.bank_reference ?? entry.reference ?? "") : null;
    if (status === "matched" && bankReference === null) return;
    const { error: updateError } = await supabase.from("finance_entries")
      .update({ bank_status: status, bank_reference: bankReference || null }).eq("id", entry.id);
    if (updateError) setError(updateError.message); else await loadEntries(propertyId);
  }

  return (
    <main style={page}>
      <section style={shell}>
        <header style={header}>
          <div><div style={eyebrow}>FINANCE CONTROL</div><h1 style={title}>Cashbook & Reconciliation</h1>
            <p style={subtitle}>One financial workspace for each guesthouse.</p></div>
          <div style={headerActions}>
            <select value={propertyId} onChange={(e) => changeProperty(e.target.value)} style={select} aria-label="Property">
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <button style={primaryButton} onClick={() => setShowEntry(true)}>+ New Entry</button>
          </div>
        </header>

        <div style={summaryGrid}>
          <Metric label="Income" value={money(totals.income)} tone="green" />
          <Metric label="Expenses & Payouts" value={money(totals.expenses)} tone="red" />
          <Metric label="Net Cashbook" value={money(totals.balance)} tone={totals.balance >= 0 ? "blue" : "red"} />
          <Metric label="VAT Payable" value={money(totals.vatDue)} tone="silver" />
        </div>

        <nav style={tabBar} aria-label="Finance sections">
          {tabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{...tabButton, ...(activeTab === tab.id ? activeTabButton : {})}}>
            <strong>{tab.label}</strong><span>{tab.hint}</span>
          </button>)}
        </nav>

        {error && <div style={errorBox}>{error}</div>}

        {activeTab === "vat" ? (
          <section style={panel}>
            <div style={panelHeading}><div><h2 style={panelTitle}>VAT Summary</h2><p style={panelText}>Based on VAT values captured in the cashbook.</p></div></div>
            <div style={vatGrid}><Metric label="Output VAT collected" value={money(totals.outputVat)} tone="blue" />
              <Metric label="Input VAT paid" value={money(totals.inputVat)} tone="green" />
              <Metric label="VAT payable / (credit)" value={money(totals.vatDue)} tone={totals.vatDue >= 0 ? "red" : "green"} /></div>
            <p style={note}>This is a management summary. Confirm tax periods and supporting invoices before filing a VAT return.</p>
          </section>
        ) : (
          <section style={panel}>
            <div style={panelHeading}><div><h2 style={panelTitle}>{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
              <p style={panelText}>{activeTab === "reconciliation" ? "Review unmatched entries and link them to the bank statement." : activeTab === "payouts" ? "Record and control money paid out from the property." : "All manually captured income, expenses and payouts."}</p></div>
              <span style={countBadge}>{filtered.length} entries</span></div>
            <div style={tableWrap}><table style={table}><thead><tr>
              <th style={th}>Date</th><th style={th}>Type</th><th style={th}>Description</th><th style={th}>Method</th><th style={th}>Reference</th><th style={th}>VAT</th><th style={{...th,textAlign:"right"}}>Amount</th>
              {activeTab === "reconciliation" && <th style={th}>Bank status</th>}
            </tr></thead><tbody>
              {loading ? <tr><td colSpan={8} style={emptyCell}>Loading finance entries...</td></tr> : filtered.length === 0 ? <tr><td colSpan={8} style={emptyCell}>No entries recorded for this property.</td></tr> : filtered.map((entry) => <tr key={entry.id}>
                <td style={td}>{displayDate(entry.entry_date)}</td><td style={td}><span style={typeBadge(entry.entry_type)}>{entry.entry_type}</span></td>
                <td style={td}><strong>{entry.description}</strong><div style={muted}>{entry.category}</div></td><td style={td}>{entry.payment_method.toUpperCase()}</td>
                <td style={td}>{entry.reference || "—"}</td><td style={td}>{money(entry.vat_amount)}</td>
                <td style={{...td,textAlign:"right",fontWeight:800,color:entry.entry_type === "income" ? "#087A55" : "#B4233C"}}>{entry.entry_type === "income" ? "+" : "−"}{money(entry.amount)}</td>
                {activeTab === "reconciliation" && <td style={td}><select value={entry.bank_status} onChange={(e) => setBankStatus(entry, e.target.value as FinanceEntry["bank_status"])} style={miniSelect}>
                  <option value="unmatched">Unmatched</option><option value="matched">Matched</option><option value="excluded">Excluded</option></select>
                  {entry.bank_reference && <div style={muted}>{entry.bank_reference}</div>}</td>}
              </tr>)}</tbody></table></div>
          </section>
        )}
      </section>

      {showEntry && <div style={overlay} onMouseDown={() => setShowEntry(false)}><form style={modal} onSubmit={saveEntry} onMouseDown={(e) => e.stopPropagation()}>
        <div style={modalHeader}><div><div style={eyebrow}>FINANCE ENTRY</div><h2 style={panelTitle}>Record transaction</h2></div><button type="button" style={closeButton} onClick={() => setShowEntry(false)}>×</button></div>
        <div style={formGrid}>
          <Field label="Date"><input type="date" value={form.entry_date} onChange={(e) => setForm({...form,entry_date:e.target.value})} style={input} required /></Field>
          <Field label="Entry type"><select value={form.entry_type} onChange={(e) => setForm({...form,entry_type:e.target.value as FinanceEntry["entry_type"]})} style={input}><option value="income">Income</option><option value="expense">Expense</option><option value="payout">Payout</option></select></Field>
          <Field label="Category"><input value={form.category} onChange={(e) => setForm({...form,category:e.target.value})} style={input} required /></Field>
          <Field label="Payment method"><select value={form.payment_method} onChange={(e) => setForm({...form,payment_method:e.target.value})} style={input}><option value="cash">Cash</option><option value="card">Card</option><option value="eft">EFT</option><option value="account">Account</option></select></Field>
          <div style={{gridColumn:"1 / -1"}}><Field label="Description"><input value={form.description} onChange={(e) => setForm({...form,description:e.target.value})} style={input} placeholder="What was this transaction for?" required /></Field></div>
          <Field label="Reference"><input value={form.reference} onChange={(e) => setForm({...form,reference:e.target.value})} style={input} placeholder="Receipt or EFT reference" /></Field>
          <Field label="Amount (N$)"><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({...form,amount:e.target.value})} style={input} required /></Field>
          <Field label="VAT included (N$)"><input type="number" min="0" step="0.01" value={form.vat_amount} onChange={(e) => setForm({...form,vat_amount:e.target.value})} style={input} /></Field>
        </div>
        <div style={modalActions}><button type="button" style={secondaryButton} onClick={() => setShowEntry(false)}>Cancel</button><button disabled={saving} style={primaryButton}>{saving ? "Saving..." : "Save Entry"}</button></div>
      </form></div>}
    </main>
  );
}

function Metric({label,value,tone}:{label:string;value:string;tone:"green"|"red"|"blue"|"silver"}) {
  const colors = {green:["#EAF8F2","#087A55"],red:["#FFF0F2","#B4233C"],blue:["#EAF3FF","#175CD3"],silver:["#F1F4F7","#344054"]};
  return <div style={{...metricCard,background:colors[tone][0]}}><span style={metricLabel}>{label}</span><strong style={{...metricValue,color:colors[tone][1]}}>{value}</strong></div>;
}
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label style={field}><span>{label}</span>{children}</label>; }
function money(value:number) { return new Intl.NumberFormat("en-NA",{style:"currency",currency:"NAD",minimumFractionDigits:2}).format(Number(value)||0).replace("NAD","N$"); }
function today() { return new Date().toISOString().slice(0,10); }
function displayDate(value:string) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-NA",{day:"2-digit",month:"short",year:"numeric"}); }
function typeBadge(type:FinanceEntry["entry_type"]):CSSProperties { return {...badge,background:type === "income" ? "#EAF8F2" : type === "payout" ? "#FFF4E5" : "#FFF0F2",color:type === "income" ? "#087A55" : type === "payout" ? "#B54708" : "#B4233C"}; }

const page:CSSProperties={minHeight:"calc(100vh - 116px)",background:"linear-gradient(135deg,#EEF5FB 0%,#F8FAFC 45%,#EDF5F2 100%)",padding:"22px",fontFamily:"Arial,sans-serif",color:"#15263A"};
const shell:CSSProperties={maxWidth:1480,margin:"0 auto"}; const header:CSSProperties={display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-end",marginBottom:18,flexWrap:"wrap"};
const eyebrow:CSSProperties={fontSize:11,fontWeight:900,letterSpacing:1.5,color:"#276C91",marginBottom:5}; const title:CSSProperties={fontSize:28,margin:0,color:"#132B42"}; const subtitle:CSSProperties={margin:"5px 0 0",color:"#667085",fontSize:14};
const headerActions:CSSProperties={display:"flex",gap:10,alignItems:"center"}; const select:CSSProperties={height:42,minWidth:220,border:"1px solid #B8C7D5",borderRadius:10,padding:"0 12px",background:"white",fontWeight:700,color:"#21384D"};
const primaryButton:CSSProperties={height:42,border:0,borderRadius:10,padding:"0 18px",background:"linear-gradient(135deg,#173E5C,#2479A3)",color:"white",fontWeight:800,cursor:"pointer"};
const secondaryButton:CSSProperties={...primaryButton,background:"#EEF2F6",color:"#344054"}; const summaryGrid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(4,minmax(170px,1fr))",gap:12,marginBottom:14};
const metricCard:CSSProperties={padding:"14px 16px",border:"1px solid rgba(70,94,117,.13)",borderRadius:13,display:"flex",flexDirection:"column",gap:6}; const metricLabel:CSSProperties={fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:.6,color:"#667085"}; const metricValue:CSSProperties={fontSize:21};
const tabBar:CSSProperties={display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,background:"rgba(255,255,255,.7)",padding:7,borderRadius:14,border:"1px solid #DCE5ED",marginBottom:14};
const tabButton:CSSProperties={border:0,borderRadius:10,padding:"10px 12px",background:"transparent",color:"#56697B",cursor:"pointer",display:"flex",flexDirection:"column",gap:2,textAlign:"left"}; const activeTabButton:CSSProperties={background:"#173E5C",color:"white",boxShadow:"0 5px 15px rgba(23,62,92,.18)"};
const panel:CSSProperties={background:"rgba(255,255,255,.94)",border:"1px solid #DCE5ED",borderRadius:15,boxShadow:"0 10px 30px rgba(24,54,78,.08)",overflow:"hidden"}; const panelHeading:CSSProperties={padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #E6ECF2"};
const panelTitle:CSSProperties={margin:0,fontSize:18,color:"#173E5C"}; const panelText:CSSProperties={margin:"4px 0 0",fontSize:13,color:"#667085"}; const countBadge:CSSProperties={fontSize:12,fontWeight:800,background:"#EDF4FA",color:"#276C91",padding:"6px 9px",borderRadius:99};
const tableWrap:CSSProperties={overflow:"auto",maxHeight:"calc(100vh - 410px)",minHeight:220}; const table:CSSProperties={width:"100%",borderCollapse:"collapse",fontSize:13}; const th:CSSProperties={position:"sticky",top:0,zIndex:1,textAlign:"left",padding:"11px 13px",background:"#F6F8FA",color:"#667085",fontSize:10,fontWeight:900,textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid #DDE5EC"}; const td:CSSProperties={padding:"11px 13px",borderBottom:"1px solid #EDF1F4",verticalAlign:"middle"}; const muted:CSSProperties={fontSize:11,color:"#8492A0",marginTop:3}; const badge:CSSProperties={display:"inline-block",borderRadius:99,padding:"4px 7px",fontSize:10,fontWeight:900,textTransform:"uppercase"};
const miniSelect:CSSProperties={border:"1px solid #C9D5DF",borderRadius:7,padding:"6px",background:"white",fontSize:12}; const emptyCell:CSSProperties={...td,textAlign:"center",padding:50,color:"#7D8D9B"}; const vatGrid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,padding:18}; const note:CSSProperties={margin:"0 18px 18px",padding:12,borderRadius:9,background:"#FFF8E7",color:"#7A5B13",fontSize:12}; const errorBox:CSSProperties={padding:"10px 13px",marginBottom:12,borderRadius:9,background:"#FFF0F2",color:"#B4233C",fontSize:13,fontWeight:700};
const overlay:CSSProperties={position:"fixed",inset:0,zIndex:100,background:"rgba(15,30,44,.58)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}; const modal:CSSProperties={width:"min(680px,100%)",background:"white",borderRadius:16,boxShadow:"0 25px 70px rgba(0,0,0,.3)",padding:20}; const modalHeader:CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}; const closeButton:CSSProperties={border:0,background:"#EEF2F6",borderRadius:9,width:34,height:34,fontSize:24,cursor:"pointer",color:"#344054"}; const formGrid:CSSProperties={display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}; const field:CSSProperties={display:"flex",flexDirection:"column",gap:6,fontSize:12,fontWeight:800,color:"#475467"}; const input:CSSProperties={height:40,border:"1px solid #C9D5DF",borderRadius:9,padding:"0 11px",fontSize:13,color:"#1D3347",background:"white"}; const modalActions:CSSProperties={display:"flex",justifyContent:"flex-end",gap:9,marginTop:20};
