"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "@/src/lib/supabase";
import { scopeProperties } from "@/src/lib/propertyAccess";
import { openPrintPreview } from "@/src/lib/printPreview";

type Tab = "cashbook" | "reconciliation" | "vat" | "payouts";
type EntryType = "income" | "expense" | "payout";
type Property = { id: string; name: string; vat_rate: number };
type FinanceEntry = {
  id: string; property_id: string; entry_date: string; entry_type: EntryType;
  category: string; description: string; payment_method: string; reference: string | null;
  amount: number; vat_amount: number; bank_status: "unmatched" | "matched" | "excluded";
  bank_reference: string | null;
};
type BatchRow = {
  id: string; entry_date: string; entry_type: EntryType; reference: string;
  description: string; category: string; payment_method: string; amount: string; vat_amount: string;
};

const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: "cashbook", label: "Cashbook", hint: "Batch processing" },
  { id: "reconciliation", label: "Bank Reconciliation", hint: "Match bank activity" },
  { id: "vat", label: "VAT Report", hint: "VAT collected and paid" },
  { id: "payouts", label: "Payouts", hint: "Cash paid out" },
];

function createRow(): BatchRow {
  return { id: crypto.randomUUID(), entry_date: today(), entry_type: "expense", reference: "",
    description: "", category: "Operating Expense", payment_method: "cash", amount: "", vat_amount: "" };
}
function createRows(count = 5) { return Array.from({ length: count }, createRow); }

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("cashbook");
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [batchRows, setBatchRows] = useState<BatchRow[]>(createRows);
  const [batchNumber] = useState(() => `CB-${today().replaceAll("-", "")}-${String(Date.now()).slice(-4)}`);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    function openRequestedSection() {
      const requested = window.location.hash.replace("#", "") as Tab;

      if (tabs.some((tab) => tab.id === requested)) {
        setActiveTab(requested);
      }
    }

    openRequestedSection();
    window.addEventListener("hashchange", openRequestedSection);

    return () => window.removeEventListener("hashchange", openRequestedSection);
  }, []);

  function selectFinanceSection(section: Tab) {
    setActiveTab(section);
    window.history.replaceState(null, "", `#${section}`);
  }

  const loadEntries = useCallback(async (selectedProperty: string) => {
    if (!selectedProperty) return;
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("finance_entries")
      .select("id,property_id,entry_date,entry_type,category,description,payment_method,reference,amount,vat_amount,bank_status,bank_reference")
      .eq("property_id", selectedProperty).order("entry_date", { ascending: false }).order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    setEntries((data as FinanceEntry[]) ?? []); setLoading(false);
  }, []);

  useEffect(() => {
    async function initialise() {
      const savedProperty = sessionStorage.getItem("netpos_property_id") ?? "";
      const { data, error: propertyError } = await supabase.from("properties")
        .select("id,name,vat_rate").eq("is_active", true).order("name");
      if (propertyError) { setError(propertyError.message); setLoading(false); return; }
      const rows = scopeProperties((data as Property[]) ?? []);
      setProperties(rows);
      const initial = rows.some((item) => item.id === savedProperty) ? savedProperty : rows[0]?.id ?? "";
      setPropertyId(initial); restoreDraft(initial); await loadEntries(initial);
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
  const batchTotals = useMemo(() => batchRows.reduce((total, row) => {
    const amount = Number(row.amount) || 0;
    return { debit: total.debit + (row.entry_type === "income" ? 0 : amount),
      credit: total.credit + (row.entry_type === "income" ? amount : 0),
      vat: total.vat + (Number(row.vat_amount) || 0) };
  }, { debit: 0, credit: 0, vat: 0 }), [batchRows]);

  function restoreDraft(selectedProperty: string) {
    if (!selectedProperty) { setBatchRows(createRows()); return; }
    const saved = sessionStorage.getItem(`netpos_finance_batch_${selectedProperty}`);
    try { setBatchRows(saved ? JSON.parse(saved) as BatchRow[] : createRows()); }
    catch { setBatchRows(createRows()); }
  }
  async function changeProperty(next: string) {
    setPropertyId(next); sessionStorage.setItem("netpos_property_id", next);
    restoreDraft(next); await loadEntries(next);
  }
  function updateRow(id: string, field: keyof BatchRow, value: string) {
    setBatchRows((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
    setMessage(""); setError("");
  }
  function removeRow(id: string) {
    setBatchRows((rows) => rows.length === 1 ? createRows() : rows.filter((row) => row.id !== id));
  }
  function saveBatchDraft() {
    if (!propertyId) { setError("Select a property before saving the batch."); return; }
    sessionStorage.setItem(`netpos_finance_batch_${propertyId}`, JSON.stringify(batchRows));
    setError(""); setMessage("Batch saved as a draft on this workstation. It has not been posted yet.");
  }
  function clearBatch() {
    if (!window.confirm("Clear all unprocessed rows in this batch?")) return;
    sessionStorage.removeItem(`netpos_finance_batch_${propertyId}`);
    setBatchRows(createRows()); setError(""); setMessage("Batch cleared.");
  }
  async function processBatch() {
    const activeRows = batchRows.filter((row) => row.description.trim() || row.reference.trim() || Number(row.amount) > 0);
    if (!propertyId || activeRows.length === 0) { setError("Enter at least one transaction before processing."); return; }
    const invalid = activeRows.find((row) => !row.entry_date || !row.category.trim() || !row.description.trim()
      || Number(row.amount) <= 0 || Number(row.vat_amount || 0) < 0 || Number(row.vat_amount || 0) > Number(row.amount));
    if (invalid) { setError("Complete every used row. Amount must be above zero and VAT cannot exceed the amount."); return; }
    if (!window.confirm(`Process ${activeRows.length} cashbook transaction${activeRows.length === 1 ? "" : "s"}? Posted transactions become part of the live cashbook.`)) return;
    setProcessing(true); setError(""); setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("finance_entries").insert(activeRows.map((row) => ({
      property_id: propertyId, entry_date: row.entry_date, entry_type: row.entry_type,
      category: row.category.trim(), description: row.description.trim(), payment_method: row.payment_method,
      reference: row.reference.trim() || null, amount: Number(row.amount), vat_amount: Number(row.vat_amount || 0),
      created_by: auth.user?.id ?? null,
    })));
    if (insertError) setError(insertError.message);
    else {
      sessionStorage.removeItem(`netpos_finance_batch_${propertyId}`); setBatchRows(createRows());
      setMessage(`${activeRows.length} transaction${activeRows.length === 1 ? "" : "s"} processed successfully.`);
      await loadEntries(propertyId);
    }
    setProcessing(false);
  }
  async function setBankStatus(entry: FinanceEntry, status: FinanceEntry["bank_status"]) {
    const bankReference = status === "matched" ? window.prompt("Bank statement reference", entry.bank_reference ?? entry.reference ?? "") : null;
    if (status === "matched" && bankReference === null) return;
    const { error: updateError } = await supabase.from("finance_entries")
      .update({ bank_status: status, bank_reference: bankReference || null }).eq("id", entry.id);
    if (updateError) setError(updateError.message); else await loadEntries(propertyId);
  }

  function previewFinanceReport() {
    const propertyName = properties.find((property) => property.id === propertyId)?.name ?? "Property";
    const reportTitle = activeTab === "vat" ? "VAT REPORT" : activeTab === "payouts" ? "PAYOUTS REPORT"
      : activeTab === "reconciliation" ? "BANK RECONCILIATION" : "CASHBOOK REPORT";
    const reportEntries = activeTab === "payouts" ? filtered : entries;
    const rows = reportEntries.map((entry) => `<tr><td>${displayDate(entry.entry_date)}</td><td>${entry.entry_type.toUpperCase()}</td><td>${escapeHtml(entry.description)}<br/><small>${escapeHtml(entry.category)}</small></td><td>${escapeHtml(entry.reference ?? "-")}</td><td>${entry.payment_method.toUpperCase()}</td><td class="right">${money(entry.vat_amount)}</td><td class="right">${entry.entry_type === "income" ? "+" : "-"}${money(entry.amount)}</td></tr>`).join("");
    const body = `<div class="document-header"><div><div class="property-name">${escapeHtml(propertyName)}</div><div>NETPOS HOSPITALITY</div></div><div class="document-title"><h1>${reportTitle}</h1><div>Printed ${new Date().toLocaleString("en-NA")}</div></div></div>
      <div class="section"><div class="section-title">Summary</div>${documentRow("Income", money(totals.income))}${documentRow("Expenses & Payouts", money(totals.expenses))}${documentRow("Net Cashbook", money(totals.balance), true)}${documentRow("VAT Payable / (Credit)", money(totals.vatDue), true)}</div>
      <div class="section"><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Reference</th><th>Method</th><th class="right">VAT</th><th class="right">Amount</th></tr></thead><tbody>${rows || `<tr><td colspan="7">No processed entries.</td></tr>`}</tbody></table></div>
      <div class="footer">Generated by Netpos Hospitality · ${escapeHtml(propertyName)}</div>`;
    openPrintPreview({ title: `${propertyName} - ${reportTitle}`, body, orientation: "landscape" });
  }

  return <main style={page}><section style={shell}>
    <header style={header}><div><div style={eyebrow}>FINANCE CONTROL</div><h1 style={title}>Cashbook & Reconciliation</h1>
      <p style={subtitle}>Pastel-style batch capture with controlled processing.</p></div>
      <div style={headerControls}><select value={propertyId} onChange={(e) => changeProperty(e.target.value)} style={propertySelect} aria-label="Property">
        {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select>
        <button style={previewButton} onClick={previewFinanceReport}>PDF Preview</button></div>
    </header>

    <div style={summaryGrid}><Metric label="Income" value={money(totals.income)} tone="green" />
      <Metric label="Expenses & Payouts" value={money(totals.expenses)} tone="red" />
      <Metric label="Net Cashbook" value={money(totals.balance)} tone={totals.balance >= 0 ? "blue" : "red"} />
      <Metric label="VAT Payable" value={money(totals.vatDue)} tone="silver" /></div>
    <nav style={tabBar} aria-label="Finance sections">{tabs.map((tab) => <button key={tab.id} onClick={() => selectFinanceSection(tab.id)}
      style={{ ...tabButton, ...(activeTab === tab.id ? activeTabButton : {}) }}><strong>{tab.label}</strong><span>{tab.hint}</span></button>)}</nav>
    {error && <div style={errorBox}>{error}</div>}{message && <div style={successBox}>{message}</div>}

    {activeTab === "cashbook" && <>
      <section style={panel}><div style={batchHeader}><div><div style={batchNumberStyle}>BATCH {batchNumber}</div>
        <h2 style={panelTitle}>Cashbook Batch Entry</h2><p style={panelText}>Capture several transactions, save the draft, then process the completed batch.</p></div>
        <div style={batchActions}><button style={secondaryButton} onClick={() => setBatchRows((rows) => [...rows, createRow()])}>+ Add Row</button>
          <button style={secondaryButton} onClick={saveBatchDraft}>Save Batch</button>
          <button style={clearButton} onClick={clearBatch}>Clear</button>
          <button style={processButton} onClick={processBatch} disabled={processing}>{processing ? "Processing..." : "Process Batch"}</button></div></div>
        <div style={batchTableWrap}><table style={{ ...table, minWidth: 1120 }}><thead><tr>
          <th style={rowNumberHead}>#</th><th style={th}>Date</th><th style={th}>Type</th><th style={th}>Reference</th><th style={wideTh}>Description</th>
          <th style={th}>Account / Category</th><th style={th}>Method</th><th style={amountTh}>Amount</th><th style={amountTh}>VAT</th><th style={actionTh}> </th>
        </tr></thead><tbody>{batchRows.map((row, index) => <tr key={row.id}>
          <td style={rowNumberCell}>{index + 1}</td>
          <td style={batchTd}><input type="date" value={row.entry_date} onChange={(e) => updateRow(row.id, "entry_date", e.target.value)} style={gridInput} /></td>
          <td style={batchTd}><select value={row.entry_type} onChange={(e) => updateRow(row.id, "entry_type", e.target.value)} style={gridInput}><option value="income">Income</option><option value="expense">Expense</option><option value="payout">Payout</option></select></td>
          <td style={batchTd}><input value={row.reference} onChange={(e) => updateRow(row.id, "reference", e.target.value)} placeholder="Reference" style={gridInput} /></td>
          <td style={batchTd}><input value={row.description} onChange={(e) => updateRow(row.id, "description", e.target.value)} placeholder="Transaction description" style={gridInput} /></td>
          <td style={batchTd}><input value={row.category} onChange={(e) => updateRow(row.id, "category", e.target.value)} placeholder="Account" style={gridInput} /></td>
          <td style={batchTd}><select value={row.payment_method} onChange={(e) => updateRow(row.id, "payment_method", e.target.value)} style={gridInput}><option value="cash">Cash</option><option value="card">Card</option><option value="eft">EFT</option><option value="account">Account</option></select></td>
          <td style={batchTd}><input type="number" min="0.01" step="0.01" value={row.amount} onChange={(e) => updateRow(row.id, "amount", e.target.value)} placeholder="0.00" style={moneyInput} /></td>
          <td style={batchTd}><input type="number" min="0" step="0.01" value={row.vat_amount} onChange={(e) => updateRow(row.id, "vat_amount", e.target.value)} placeholder="0.00" style={moneyInput} /></td>
          <td style={batchTd}><button aria-label={`Remove row ${index + 1}`} onClick={() => removeRow(row.id)} style={removeButton}>×</button></td>
        </tr>)}</tbody></table></div>
        <div style={batchFooter}><span>{batchRows.length} capture rows</span><div style={batchTotalsStyle}><span>Debits <strong>{money(batchTotals.debit)}</strong></span>
          <span>Credits <strong>{money(batchTotals.credit)}</strong></span><span>VAT <strong>{money(batchTotals.vat)}</strong></span></div></div>
      </section>
      <HistoryPanel title="Posted Cashbook Entries" description="Processed transactions for this property." entries={entries} loading={loading} />
    </>}

    {activeTab === "vat" && <section style={panel}><div style={panelHeading}><div><h2 style={panelTitle}>VAT Summary</h2><p style={panelText}>Based on processed cashbook entries.</p></div></div>
      <div style={vatGrid}><Metric label="Output VAT collected" value={money(totals.outputVat)} tone="blue" /><Metric label="Input VAT paid" value={money(totals.inputVat)} tone="green" />
        <Metric label="VAT payable / (credit)" value={money(totals.vatDue)} tone={totals.vatDue >= 0 ? "red" : "green"} /></div>
      <p style={note}>Management summary only. Confirm tax periods and supporting invoices before filing a VAT return.</p></section>}

    {(activeTab === "reconciliation" || activeTab === "payouts") && <HistoryPanel title={activeTab === "reconciliation" ? "Bank Reconciliation" : "Payouts"}
      description={activeTab === "reconciliation" ? "Review entries and link them to the bank statement." : "Processed cash payouts for this property."}
      entries={filtered} loading={loading} reconciliation={activeTab === "reconciliation"} onBankStatus={setBankStatus} />}
  </section></main>;
}

function HistoryPanel({ title, description, entries, loading, reconciliation = false, onBankStatus }:{ title:string; description:string; entries:FinanceEntry[]; loading:boolean; reconciliation?:boolean; onBankStatus?:(entry:FinanceEntry,status:FinanceEntry["bank_status"])=>void }) {
  return <section style={{ ...panel, marginTop: 12 }}><div style={panelHeading}><div><h2 style={panelTitle}>{title}</h2><p style={panelText}>{description}</p></div><span style={countBadge}>{entries.length} entries</span></div>
    <div style={historyWrap}><table style={table}><thead><tr><th style={th}>Date</th><th style={th}>Type</th><th style={th}>Description</th><th style={th}>Method</th><th style={th}>Reference</th><th style={th}>VAT</th><th style={amountTh}>Amount</th>{reconciliation && <th style={th}>Bank status</th>}</tr></thead>
      <tbody>{loading ? <tr><td colSpan={8} style={emptyCell}>Loading finance entries...</td></tr> : entries.length === 0 ? <tr><td colSpan={8} style={emptyCell}>No processed entries for this property.</td></tr> : entries.map((entry) => <tr key={entry.id}>
        <td style={td}>{displayDate(entry.entry_date)}</td><td style={td}><span style={typeBadge(entry.entry_type)}>{entry.entry_type}</span></td>
        <td style={td}><strong>{entry.description}</strong><div style={muted}>{entry.category}</div></td><td style={td}>{entry.payment_method.toUpperCase()}</td>
        <td style={td}>{entry.reference || "—"}</td><td style={td}>{money(entry.vat_amount)}</td><td style={{ ...td, textAlign:"right", fontWeight:800, color:entry.entry_type === "income" ? "#0D5598" : "#0D5598" }}>{entry.entry_type === "income" ? "+" : "−"}{money(entry.amount)}</td>
        {reconciliation && <td style={td}><select value={entry.bank_status} onChange={(e) => onBankStatus?.(entry, e.target.value as FinanceEntry["bank_status"])} style={miniSelect}><option value="unmatched">Unmatched</option><option value="matched">Matched</option><option value="excluded">Excluded</option></select>{entry.bank_reference && <div style={muted}>{entry.bank_reference}</div>}</td>}
      </tr>)}</tbody></table></div></section>;
}
function Metric({label,value,tone}:{label:string;value:string;tone:"green"|"red"|"blue"|"silver"}) { const colors={green:["#EAF4FF","#0D5598"],red:["#EAF4FF","#0D5598"],blue:["#EAF3FF","#175CD3"],silver:["#F1F4F7","#344054"]}; return <div style={{...metricCard,background:colors[tone][0]}}><span style={metricLabel}>{label}</span><strong style={{...metricValue,color:colors[tone][1]}}>{value}</strong></div>; }
function money(value:number) { return new Intl.NumberFormat("en-NA",{style:"currency",currency:"NAD",minimumFractionDigits:2}).format(Number(value)||0).replace("NAD","N$"); }
function today() { return new Date().toISOString().slice(0,10); }
function displayDate(value:string) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-NA",{day:"2-digit",month:"short",year:"numeric"}); }
function typeBadge(type:EntryType):CSSProperties { return {...badge,background:type === "income" ? "#EAF4FF" : type === "payout" ? "#EEF6FF" : "#EAF4FF",color:type === "income" ? "#0D5598" : type === "payout" ? "#0D5598" : "#0D5598"}; }
function documentRow(label:string,value:string,large=false) { return `<div class="row${large ? " large" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function escapeHtml(value:string) { return value.replace(/[&<>"']/g,(character)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[character] ?? character); }

const page:CSSProperties={minHeight:"calc(100vh - 116px)",background:"linear-gradient(135deg,#EEF5FB 0%,#FFFFFF 45%,#EDF6FF 100%)",padding:"18px",fontFamily:'Inter, "Segoe UI", Arial, sans-serif',color:"#15263A"};
const shell:CSSProperties={maxWidth:1580,margin:"0 auto"}; const header:CSSProperties={display:"flex",justifyContent:"space-between",gap:20,alignItems:"flex-end",marginBottom:14,flexWrap:"wrap"};
const eyebrow:CSSProperties={fontSize:10,fontWeight:900,letterSpacing:1.5,color:"#276C91",marginBottom:4}; const title:CSSProperties={fontSize:26,margin:0,color:"#132B42"}; const subtitle:CSSProperties={margin:"4px 0 0",color:"#667085",fontSize:13};
const propertySelect:CSSProperties={height:40,minWidth:250,border:"1px solid #B8C7D5",borderRadius:9,padding:"0 12px",background:"white",fontWeight:800,color:"#21384D"};
const headerControls:CSSProperties={display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}; const previewButton:CSSProperties={height:40,border:"1px solid #16729B",borderRadius:9,padding:"0 14px",background:"#EAF5FA",color:"#155B7A",fontWeight:850,cursor:"pointer"};
const summaryGrid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:12}; const metricCard:CSSProperties={padding:"11px 14px",border:"1px solid rgba(70,94,117,.13)",borderRadius:11,display:"flex",flexDirection:"column",gap:4}; const metricLabel:CSSProperties={fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:.6,color:"#667085"}; const metricValue:CSSProperties={fontSize:19};
const tabBar:CSSProperties={display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,background:"rgba(255,255,255,.7)",padding:6,borderRadius:12,border:"1px solid #DCE5ED",marginBottom:12}; const tabButton:CSSProperties={border:0,borderRadius:8,padding:"8px 11px",background:"transparent",color:"#56697B",cursor:"pointer",display:"flex",flexDirection:"column",gap:2,textAlign:"left"}; const activeTabButton:CSSProperties={background:"#173E5C",color:"white",boxShadow:"0 5px 15px rgba(23,62,92,.18)"};
const panel:CSSProperties={background:"rgba(255,255,255,.96)",border:"1px solid #DCE5ED",borderRadius:12,boxShadow:"0 8px 24px rgba(24,54,78,.07)",overflow:"hidden"}; const panelHeading:CSSProperties={padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #E6ECF2"}; const panelTitle:CSSProperties={margin:0,fontSize:17,color:"#173E5C"}; const panelText:CSSProperties={margin:"3px 0 0",fontSize:12,color:"#667085"}; const countBadge:CSSProperties={fontSize:11,fontWeight:800,background:"#EDF4FA",color:"#276C91",padding:"5px 8px",borderRadius:99};
const batchHeader:CSSProperties={...panelHeading,alignItems:"flex-end",gap:15,flexWrap:"wrap"}; const batchNumberStyle:CSSProperties={fontSize:9,fontWeight:900,color:"#28759B",letterSpacing:1}; const batchActions:CSSProperties={display:"flex",gap:7,flexWrap:"wrap"};
const buttonBase:CSSProperties={height:35,borderRadius:7,padding:"0 12px",fontSize:11,fontWeight:850,cursor:"pointer"}; const secondaryButton:CSSProperties={...buttonBase,border:"1px solid #B8C7D5",background:"#F5F8FA",color:"#28465F"}; const clearButton:CSSProperties={...buttonBase,border:"1px solid #B8D3EA",background:"#F5F9FE",color:"#0D4F91"}; const processButton:CSSProperties={...buttonBase,border:0,background:"linear-gradient(135deg,#0B4E8A,#1268B3)",color:"white",padding:"0 17px"};
const batchTableWrap:CSSProperties={overflow:"auto",maxHeight:"34vh"}; const historyWrap:CSSProperties={overflow:"auto",maxHeight:"27vh"}; const table:CSSProperties={width:"100%",borderCollapse:"collapse",fontSize:12}; const th:CSSProperties={position:"sticky",top:0,zIndex:1,textAlign:"left",padding:"9px 8px",background:"#EAF0F5",color:"#526679",fontSize:9,fontWeight:900,textTransform:"uppercase",letterSpacing:.4,borderBottom:"1px solid #C9D5DF",whiteSpace:"nowrap"}; const wideTh:CSSProperties={...th,minWidth:190}; const amountTh:CSSProperties={...th,textAlign:"right"}; const actionTh:CSSProperties={...th,width:34}; const rowNumberHead:CSSProperties={...th,width:34,textAlign:"center"};
const td:CSSProperties={padding:"9px 10px",borderBottom:"1px solid #EDF1F4",verticalAlign:"middle"}; const batchTd:CSSProperties={padding:3,borderBottom:"1px solid #DDE5EC",borderRight:"1px solid #EDF1F4"}; const rowNumberCell:CSSProperties={...batchTd,textAlign:"center",background:"#F4F7F9",fontWeight:800,color:"#647789"}; const gridInput:CSSProperties={width:"100%",height:33,border:"1px solid transparent",borderRadius:4,padding:"0 7px",fontSize:11,color:"#1D3347",background:"#FFF"}; const moneyInput:CSSProperties={...gridInput,textAlign:"right",minWidth:88}; const removeButton:CSSProperties={width:26,height:26,border:0,borderRadius:5,background:"#EAF4FF",color:"#0D5598",fontSize:17,cursor:"pointer"};
const batchFooter:CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"center",gap:15,padding:"10px 14px",background:"#F5F8FA",borderTop:"1px solid #DCE5ED",fontSize:10,color:"#647789"}; const batchTotalsStyle:CSSProperties={display:"flex",gap:20,color:"#40566B",flexWrap:"wrap"};
const muted:CSSProperties={fontSize:10,color:"#8492A0",marginTop:2}; const badge:CSSProperties={display:"inline-block",borderRadius:99,padding:"3px 6px",fontSize:9,fontWeight:900,textTransform:"uppercase"}; const miniSelect:CSSProperties={border:"1px solid #C9D5DF",borderRadius:6,padding:"5px",background:"white",fontSize:11}; const emptyCell:CSSProperties={...td,textAlign:"center",padding:35,color:"#7D8D9B"};
const vatGrid:CSSProperties={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12,padding:16}; const note:CSSProperties={margin:"0 16px 16px",padding:11,borderRadius:8,background:"#F5F9FE",color:"#0D4F91",fontSize:11}; const errorBox:CSSProperties={padding:"9px 12px",marginBottom:10,borderRadius:8,background:"#EAF4FF",color:"#0D5598",fontSize:12,fontWeight:700}; const successBox:CSSProperties={padding:"9px 12px",marginBottom:10,borderRadius:8,background:"#EAF4FF",color:"#0D5598",fontSize:12,fontWeight:700};
