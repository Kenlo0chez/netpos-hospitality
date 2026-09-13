"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import FinanceSubnav from "@/src/components/FinanceSubnav";
import { supabase } from "@/src/lib/supabase";
import { selectInitialProperty } from "@/src/lib/propertyScope";

type Property = { id: string; name: string };
type BankAccount = { id: string; account_name: string; bank_name: string };
type Payout = { id: string; payout_date: string; payee_name: string; payout_type: string; payment_method: string; reference: string; reason: string; amount: number; status: string };
type Row = { key: number; date: string; payee: string; type: string; method: string; bankAccountId: string; reference: string; reason: string; amount: string };

const today = () => new Date().toISOString().slice(0, 10);
const emptyRow = (key: number): Row => ({ key, date: today(), payee: "", type: "petty_cash", method: "cash", bankAccountId: "", reference: "", reason: "", amount: "" });
const money = new Intl.NumberFormat("en-NA", { style: "currency", currency: "NAD", minimumFractionDigits: 2 });
const typeLabel: Record<string, string> = { petty_cash: "Petty Cash", owner_drawing: "Owner Drawing", staff_advance: "Staff Advance", cash_transfer: "Cash Transfer", bank_charge: "Bank Charge", other: "Other" };

export default function PayoutsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [rows, setRows] = useState<Row[]>(Array.from({ length: 6 }, (_, index) => emptyRow(index + 1)));
  const [nextKey, setNextKey] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (selected: string) => {
    setLoading(true); setError(""); setSetupRequired(false);
    const [accountResult, payoutResult] = await Promise.all([
      supabase.from("bank_accounts").select("id,account_name,bank_name").eq("property_id", selected).eq("is_active", true).order("account_name"),
      supabase.from("payouts").select("id,payout_date,payee_name,payout_type,payment_method,reference,reason,amount,status").eq("property_id", selected).order("created_at", { ascending: false }).limit(100),
    ]);
    const loadError = accountResult.error ?? payoutResult.error;
    if (loadError) { setSetupRequired(true); setError(loadError.message); }
    else { setAccounts((accountResult.data as BankAccount[]) ?? []); setPayouts((payoutResult.data as Payout[]) ?? []); }
    setLoading(false);
  }, []);

  const initialise = useCallback(async () => {
    const result = await supabase.from("properties").select("id,name").eq("is_active", true).order("name");
    if (result.error) { setError(result.error.message); setLoading(false); return; }
    const { scoped, selected } = selectInitialProperty((result.data as Property[]) ?? []);
    setProperties(scoped); setPropertyId(selected);
    if (selected) await load(selected); else setLoading(false);
  }, [load]);

  useEffect(() => { void initialise(); }, [initialise]);

  const usedRows = useMemo(() => rows.filter((row) => row.payee.trim() || row.reference.trim() || row.reason.trim() || row.amount), [rows]);
  const batchTotal = usedRows.reduce((total, row) => total + (Number(row.amount) || 0), 0);
  const update = (key: number, change: Partial<Row>) => setRows((current) => current.map((row) => row.key === key ? { ...row, ...change } : row));
  const addRow = () => { setRows((current) => [...current, emptyRow(nextKey)]); setNextKey((value) => value + 1); };

  async function getTradingDay() {
    const existing = await supabase.from("trading_days").select("id").eq("property_id", propertyId).eq("status", "open").order("business_date", { ascending: false }).limit(1).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return existing.data.id;
    const created = await supabase.from("trading_days").insert({ property_id: propertyId, business_date: today(), status: "open" }).select("id").single();
    if (created.error) throw new Error(created.error.message);
    return created.data.id;
  }

  async function saveBatch() {
    if (!propertyId || !usedRows.length || saving) return;
    for (const [index, row] of usedRows.entries()) {
      if (!row.date || !row.payee.trim() || !row.reference.trim() || !row.reason.trim() || !(Number(row.amount) > 0)) {
        setError(`Complete date, payee, reference, reason and amount on payout line ${index + 1}.`); return;
      }
      if (["eft", "card"].includes(row.method) && !row.bankAccountId) {
        setError(`Select the bank account on payout line ${index + 1}.`); return;
      }
    }
    setSaving(true); setError(""); setMessage("");
    try {
      const tradingDayId = await getTradingDay();
      const staff = JSON.parse(sessionStorage.getItem("netpos_staff") ?? "null") as { id?: string } | null;
      const records = usedRows.map((row) => ({ property_id: propertyId, trading_day_id: tradingDayId, bank_account_id: row.method === "cash" ? null : row.bankAccountId, payout_date: row.date, payee_name: row.payee.trim(), payout_type: row.type, payment_method: row.method, reference: row.reference.trim(), reason: row.reason.trim(), amount: Number(row.amount), created_by: staff?.id ?? null, approved_by: staff?.id ?? null }));
      const result = await supabase.from("payouts").insert(records);
      if (result.error) throw new Error(result.error.message);
      setMessage(`${records.length} payout${records.length === 1 ? "" : "s"} recorded. Total ${money.format(batchTotal)}.`);
      setRows(Array.from({ length: 6 }, (_, index) => emptyRow(nextKey + index)));
      setNextKey((value) => value + 6);
      await load(propertyId);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Payouts could not be recorded."); }
    finally { setSaving(false); }
  }

  async function reversePayout(payout: Payout) {
    const reason = window.prompt(`Reason for reversing ${money.format(Number(payout.amount))} paid to ${payout.payee_name}:`);
    if (!reason?.trim()) return;
    if (!window.confirm("Reverse this payout? The original record will remain visible in history.")) return;
    const result = await supabase.from("payouts").update({ status: "reversed", reversal_reason: reason.trim(), reversed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", payout.id).eq("status", "posted");
    if (result.error) setError(result.error.message); else { setMessage("Payout reversed. The audit record has been retained."); await load(propertyId); }
  }

  return <main style={page}>
    <header style={header}><div><div style={eyebrow}>FINANCE · CONTROLLED PAYOUTS</div><h1 style={title}>Record authorised money out</h1><p style={muted}>For non-expense disbursements only. Purchases belong under Expenses and guest refunds on the guest folio.</p></div><select value={propertyId} onChange={(event) => { setPropertyId(event.target.value); void load(event.target.value); }} style={propertySelect}>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></header>
    <FinanceSubnav />
    {setupRequired && <div style={warning}><strong>Payout database setup required.</strong><span>Migration 003 must be applied before payouts can be recorded.</span></div>}
    {error && !setupRequired && <div style={errorBox}>{error}</div>}{message && <div style={success}>{message}</div>}
    <section style={summary}><Metric label="Batch lines" value={String(usedRows.length)} /><Metric label="Batch total" value={money.format(batchTotal)} /><Metric label="Posted payouts" value={String(payouts.filter((payout) => payout.status === "posted").length)} /></section>
    <section style={panel}><div style={panelHead}><div><h2 style={panelTitle}>Payout batch</h2><span style={hint}>Every line needs an accountable payee, reference and reason.</span></div><button type="button" onClick={addRow} style={secondary}>+ Add row</button></div><div style={tableWrap}><table style={table}><thead><tr>{["Date","Payee","Type","Method","Bank Account","Reference","Reason","Amount",""].map((heading) => <th key={heading} style={th}>{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.key}><td style={td}><input aria-label={`Date row ${index + 1}`} type="date" value={row.date} onChange={(e) => update(row.key,{date:e.target.value})} style={control}/></td><td style={td}><input aria-label={`Payee row ${index + 1}`} value={row.payee} onChange={(e) => update(row.key,{payee:e.target.value})} placeholder="Person / destination" style={control}/></td><td style={td}><select aria-label={`Type row ${index + 1}`} value={row.type} onChange={(e) => update(row.key,{type:e.target.value})} style={control}>{Object.entries(typeLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></td><td style={td}><select aria-label={`Method row ${index + 1}`} value={row.method} onChange={(e) => update(row.key,{method:e.target.value,bankAccountId:e.target.value==="cash"?"":row.bankAccountId})} style={control}><option value="cash">Cash</option><option value="eft">EFT</option><option value="card">Card</option></select></td><td style={td}><select aria-label={`Bank row ${index + 1}`} value={row.bankAccountId} onChange={(e)=>update(row.key,{bankAccountId:e.target.value})} disabled={row.method==="cash"} style={control}><option value="">{row.method==="cash"?"Not applicable":"Select account"}</option>{accounts.map((account)=><option key={account.id} value={account.id}>{account.bank_name} · {account.account_name}</option>)}</select></td><td style={td}><input aria-label={`Reference row ${index + 1}`} value={row.reference} onChange={(e)=>update(row.key,{reference:e.target.value})} placeholder="Voucher / EFT ref" style={control}/></td><td style={td}><input aria-label={`Reason row ${index + 1}`} value={row.reason} onChange={(e)=>update(row.key,{reason:e.target.value})} placeholder="Why money left" style={wideControl}/></td><td style={td}><input aria-label={`Amount row ${index + 1}`} type="number" min="0.01" step="0.01" value={row.amount} onChange={(e)=>update(row.key,{amount:e.target.value})} placeholder="0.00" style={amountControl}/></td><td style={td}><button type="button" aria-label={`Remove row ${index + 1}`} onClick={()=>setRows((current)=>current.length>1?current.filter((item)=>item.key!==row.key):current)} style={remove}>×</button></td></tr>)}</tbody></table></div><div style={footer}><span>Total: <strong>{money.format(batchTotal)}</strong></span><button type="button" disabled={saving||setupRequired||!usedRows.length} onClick={()=>void saveBatch()} style={primary}>{saving?"Saving...":`Save batch (${usedRows.length})`}</button></div></section>
    <section style={{...panel,marginTop:12}}><div style={panelHead}><h2 style={panelTitle}>Payout history</h2></div><div style={historyWrap}><table style={table}><thead><tr>{["Date","Payee","Type","Method","Reference","Reason","Amount","Status",""].map((heading)=><th key={heading} style={th}>{heading}</th>)}</tr></thead><tbody>{payouts.map((payout)=><tr key={payout.id}><td style={readTd}>{payout.payout_date}</td><td style={readTd}><strong>{payout.payee_name}</strong></td><td style={readTd}>{typeLabel[payout.payout_type]??payout.payout_type}</td><td style={readTd}>{payout.payment_method.toUpperCase()}</td><td style={readTd}>{payout.reference}</td><td style={readTd}>{payout.reason}</td><td style={readRight}>{money.format(Number(payout.amount))}</td><td style={readTd}>{payout.status.toUpperCase()}</td><td style={readTd}>{payout.status==="posted"&&<button type="button" onClick={()=>void reversePayout(payout)} style={reverse}>Reverse</button>}</td></tr>)}{!loading&&!payouts.length&&<tr><td colSpan={9} style={empty}>No payouts recorded.</td></tr>}</tbody></table></div></section>
  </main>;
}

function Metric({label,value}:{label:string;value:string}) { return <div style={metric}><span>{label}</span><strong>{value}</strong></div>; }
const page:CSSProperties={height:"calc(100vh - 112px)",overflow:"auto",padding:"16px 22px",boxSizing:"border-box",background:"#F3F6F8",color:"#173F5F"};
const header:CSSProperties={maxWidth:1500,margin:"0 auto 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:18};const eyebrow:CSSProperties={color:"#168257",fontSize:10,fontWeight:900,letterSpacing:1};const title:CSSProperties={margin:"4px 0",fontSize:25,color:"#123F69"};const muted:CSSProperties={margin:0,color:"#6C8293",fontSize:12};const propertySelect:CSSProperties={height:40,minWidth:230,padding:"0 10px",border:"1px solid #BDD0DE",borderRadius:7,background:"#FFF",fontWeight:800};
const warning:CSSProperties={maxWidth:1500,margin:"0 auto 10px",padding:10,display:"flex",flexDirection:"column",gap:3,border:"1px solid #E4BE70",borderRadius:8,background:"#FFF8E8",color:"#77500D",fontSize:11};const errorBox:CSSProperties={...warning,borderColor:"#E1AAAA",background:"#FFF1F1",color:"#9B2D2D"};const success:CSSProperties={...warning,borderColor:"#9FCFB5",background:"#EDF8F2",color:"#176C46"};
const summary:CSSProperties={maxWidth:1500,margin:"0 auto 10px",display:"grid",gridTemplateColumns:"repeat(3,minmax(160px,1fr))",gap:8};const metric:CSSProperties={display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",border:"1px solid #D6E2EA",borderRadius:8,background:"#FFF",fontSize:10};
const panel:CSSProperties={maxWidth:1500,margin:"0 auto",border:"1px solid #D5E2EB",borderRadius:9,background:"#FFF",overflow:"hidden"};const panelHead:CSSProperties={padding:"9px 11px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid #E4ECF2"};const panelTitle:CSSProperties={margin:0,fontSize:13,color:"#123F69"};const hint:CSSProperties={display:"block",marginTop:2,color:"#718697",fontSize:8};const tableWrap:CSSProperties={overflow:"auto"};const historyWrap:CSSProperties={maxHeight:230,overflow:"auto"};const table:CSSProperties={width:"100%",minWidth:1250,borderCollapse:"collapse",fontSize:10};const th:CSSProperties={position:"sticky",top:0,zIndex:1,padding:"7px 8px",background:"#EEF2F5",color:"#5E7384",textAlign:"left",fontSize:8,whiteSpace:"nowrap"};const td:CSSProperties={padding:3,borderTop:"1px solid #E7EEF3"};const control:CSSProperties={width:"100%",minWidth:110,height:31,boxSizing:"border-box",padding:"0 6px",border:"1px solid #C6D6E1",borderRadius:5,background:"#FFF",fontSize:9};const wideControl:CSSProperties={...control,minWidth:180};const amountControl:CSSProperties={...control,minWidth:85,textAlign:"right"};const readTd:CSSProperties={padding:"8px",borderTop:"1px solid #E7EEF3",whiteSpace:"nowrap"};const readRight:CSSProperties={...readTd,textAlign:"right",fontWeight:900,color:"#A33A3A"};
const footer:CSSProperties={padding:"8px 11px",display:"flex",justifyContent:"flex-end",alignItems:"center",gap:16,borderTop:"1px solid #E4ECF2"};const primary:CSSProperties={padding:"8px 13px",border:0,borderRadius:6,background:"#0D5FA8",color:"#FFF",fontWeight:900,cursor:"pointer"};const secondary:CSSProperties={padding:"7px 10px",border:"1px solid #BDD0DE",borderRadius:6,background:"#FFF",color:"#0D5FA8",fontWeight:800,cursor:"pointer"};const remove:CSSProperties={border:0,background:"transparent",color:"#A33A3A",fontSize:17,cursor:"pointer"};const reverse:CSSProperties={padding:"4px 7px",border:"1px solid #D7A5A5",borderRadius:5,background:"#FFF2F2",color:"#982F2F",fontSize:8,fontWeight:900,cursor:"pointer"};const empty:CSSProperties={padding:22,textAlign:"center",color:"#7A8D9B"};
