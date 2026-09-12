"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from "react";
import { supabase } from "@/src/lib/supabase";
import { selectInitialProperty } from "@/src/lib/propertyScope";

type Property = { id: string; name: string };
type BankAccount = {
  id: string;
  property_id: string;
  account_name: string;
  bank_name: string;
  account_number_masked: string | null;
  opening_balance: number;
};
type StatementLine = {
  id: string;
  transaction_date: string;
  description: string;
  bank_reference: string | null;
  amount: number;
  balance: number | null;
  match_status: "unmatched" | "suggested" | "matched" | "ignored";
  matched_payment_id: string | null;
  matched_expense_id: string | null;
};
type Payment = {
  id: string;
  received_at: string;
  payment_reference: string | null;
  amount: number;
  transaction_type: "payment" | "deposit" | "refund";
  cleared_status: string;
  bank_account_id: string | null;
};
type Expense = {
  id: string;
  expense_date: string;
  supplier_name: string;
  reference: string | null;
  description: string;
  total_amount: number;
  bank_account_id: string | null;
};
type ParsedLine = {
  date: string;
  description: string;
  reference: string;
  amount: number;
  balance: number | null;
};

const money = new Intl.NumberFormat("en-NA", {
  style: "currency",
  currency: "NAD",
  minimumFractionDigits: 2,
});

export default function BankReconciliationPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [preview, setPreview] = useState<ParsedLine[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const today = new Date().toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(`${today.slice(0, 8)}01`);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [statementClosingBalance, setStatementClosingBalance] = useState("");

  const loadAccountData = useCallback(async (selectedProperty: string, selectedAccount?: string) => {
    setLoading(true);
    setErrorMessage("");
    const accountResult = await supabase
      .from("bank_accounts")
      .select("id,property_id,account_name,bank_name,account_number_masked,opening_balance")
      .eq("property_id", selectedProperty)
      .eq("is_active", true)
      .order("account_name");

    if (accountResult.error) {
      setSetupRequired(true);
      setErrorMessage(accountResult.error.message);
      setLoading(false);
      return;
    }

    const accountRows = (accountResult.data as BankAccount[]) ?? [];
    const nextAccount = accountRows.some((account) => account.id === selectedAccount)
      ? selectedAccount!
      : accountRows[0]?.id ?? "";
    setAccounts(accountRows);
    setAccountId(nextAccount);

    if (!nextAccount) {
      setLines([]);
      setPayments([]);
      setExpenses([]);
      setLoading(false);
      return;
    }

    const [lineResult, paymentResult, expenseResult] = await Promise.all([
      supabase
        .from("bank_statement_lines")
        .select("id,transaction_date,description,bank_reference,amount,balance,match_status,matched_payment_id,matched_expense_id")
        .eq("bank_account_id", nextAccount)
        .order("transaction_date", { ascending: false })
        .limit(500),
      supabase
        .from("payments")
        .select("id,received_at,payment_reference,amount,transaction_type,cleared_status,bank_account_id")
        .eq("property_id", selectedProperty)
        .in("payment_method", ["eft", "card"])
        .order("received_at", { ascending: false })
        .limit(500),
      supabase
        .from("expenses")
        .select("id,expense_date,supplier_name,reference,description,total_amount,bank_account_id")
        .eq("property_id", selectedProperty)
        .neq("status", "reversed")
        .order("expense_date", { ascending: false })
        .limit(500),
    ]);

    const error = lineResult.error ?? paymentResult.error ?? expenseResult.error;
    if (error) setErrorMessage(error.message);
    else {
      setLines((lineResult.data as StatementLine[]) ?? []);
      setPayments((paymentResult.data as Payment[]) ?? []);
      setExpenses((expenseResult.data as Expense[]) ?? []);
    }
    setLoading(false);
  }, []);

  const initialise = useCallback(async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("id,name")
      .eq("is_active", true)
      .order("name");
    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }
    const { scoped, selected } = selectInitialProperty((data as Property[]) ?? []);
    setProperties(scoped);
    setPropertyId(selected);
    if (selected) await loadAccountData(selected);
    else setLoading(false);
  }, [loadAccountData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialise();
  }, [initialise]);

  const summary = useMemo(() => {
    const matched = lines.filter((line) => line.match_status === "matched");
    return {
      imported: lines.length,
      matched: matched.length,
      unmatched: lines.filter((line) => line.match_status === "unmatched" || line.match_status === "suggested").length,
      matchedValue: matched.reduce((sum, line) => sum + Number(line.amount), 0),
    };
  }, [lines]);

  const reconciliation = useMemo(() => {
    const account = accounts.find((item) => item.id === accountId);
    const paymentMovement = payments
      .filter((payment) => payment.bank_account_id === accountId && payment.received_at.slice(0, 10) <= periodEnd)
      .reduce((sum, payment) => sum + (payment.transaction_type === "refund" ? -Number(payment.amount) : Number(payment.amount)), 0);
    const expenseMovement = expenses
      .filter((expense) => expense.bank_account_id === accountId && expense.expense_date <= periodEnd)
      .reduce((sum, expense) => sum + Number(expense.total_amount), 0);
    const systemBalance = Number(account?.opening_balance ?? 0) + paymentMovement - expenseMovement;
    const closing = Number(statementClosingBalance) || 0;
    const unresolved = lines.filter((line) => line.transaction_date >= periodStart && line.transaction_date <= periodEnd && line.match_status !== "matched" && line.match_status !== "ignored").length;
    return { systemBalance, closing, difference: closing - systemBalance, unresolved };
  }, [accountId, accounts, expenses, lines, payments, periodEnd, periodStart, statementClosingBalance]);

  async function createAccount() {
    if (!propertyId || !bankName.trim() || !accountName.trim()) {
      setErrorMessage("Enter the bank name and account name.");
      return;
    }
    setBusy(true);
    setErrorMessage("");
    const { error } = await supabase.from("bank_accounts").insert({
      property_id: propertyId,
      bank_name: bankName.trim(),
      account_name: accountName.trim(),
      account_number_masked: accountNumber.trim() || null,
      opening_balance: Number(openingBalance) || 0,
    });
    if (error) setErrorMessage(error.message);
    else {
      setMessage("Bank account created.");
      setShowAccountForm(false);
      setBankName("");
      setAccountName("");
      setAccountNumber("");
      await loadAccountData(propertyId);
    }
    setBusy(false);
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setErrorMessage("");
    setMessage("");
    try {
      const parsed = parseStatement(await file.text());
      if (!parsed.length) throw new Error("No valid statement transactions were found.");
      setFileName(file.name);
      setPreview(parsed);
    } catch (error) {
      setPreview([]);
      setErrorMessage(error instanceof Error ? error.message : "Could not read this statement.");
    }
  }

  async function importStatement() {
    if (!accountId || !preview.length) return;
    setBusy(true);
    setErrorMessage("");
    const staff = JSON.parse(sessionStorage.getItem("netpos_staff") ?? "null") as { id?: string } | null;
    const dates = preview.map((line) => line.date).sort();
    const { data: statementImport, error: importError } = await supabase
      .from("bank_statement_imports")
      .insert({
        property_id: propertyId,
        bank_account_id: accountId,
        file_name: fileName,
        statement_from: dates[0],
        statement_to: dates.at(-1),
        row_count: preview.length,
        imported_by: staff?.id ?? null,
      })
      .select("id")
      .single();

    if (importError || !statementImport) {
      setErrorMessage(importError?.message ?? "Statement import could not be created.");
      setBusy(false);
      return;
    }

    const records = await Promise.all(preview.map(async (line) => ({
      property_id: propertyId,
      bank_account_id: accountId,
      import_id: statementImport.id,
      transaction_date: line.date,
      description: line.description,
      bank_reference: line.reference || null,
      amount: line.amount,
      balance: line.balance,
      fingerprint: await fingerprint(accountId, line),
    })));
    const { error } = await supabase.from("bank_statement_lines").upsert(records, {
      onConflict: "bank_account_id,fingerprint",
      ignoreDuplicates: true,
    });
    if (error) setErrorMessage(error.message);
    else {
      setMessage(`${preview.length} statement row${preview.length === 1 ? "" : "s"} processed. Existing duplicates were skipped.`);
      setPreview([]);
      setFileName("");
      await loadAccountData(propertyId, accountId);
    }
    setBusy(false);
  }

  function candidatesFor(line: StatementLine) {
    const date = new Date(`${line.transaction_date}T12:00:00`).getTime();
    const paymentCandidates = payments
      .filter((payment) => {
        const value = payment.transaction_type === "refund" ? -Number(payment.amount) : Number(payment.amount);
        const days = Math.abs(new Date(payment.received_at).getTime() - date) / 86400000;
        return Math.abs(value - Number(line.amount)) < 0.01 && days <= 5 && payment.cleared_status !== "reconciled";
      })
      .map((payment) => ({
        id: payment.id,
        kind: "payment" as const,
        label: `${payment.payment_reference || (payment.transaction_type === "refund" ? "Guest refund" : "Guest payment")} · ${money.format(Number(line.amount))}`,
      }));
    const expenseCandidates = Number(line.amount) >= 0 ? [] : expenses
      .filter((expense) => {
        const days = Math.abs(new Date(`${expense.expense_date}T12:00:00`).getTime() - date) / 86400000;
        return Math.abs(Number(expense.total_amount) - Math.abs(Number(line.amount))) < 0.01 && days <= 5;
      })
      .map((expense) => ({
        id: expense.id,
        kind: "expense" as const,
        label: `${expense.supplier_name} · ${money.format(Number(expense.total_amount))}`,
      }));
    return [...paymentCandidates, ...expenseCandidates];
  }

  async function matchLine(line: StatementLine, selection: string) {
    if (!selection) return;
    const [kind, id] = selection.split(":");
    const staff = JSON.parse(sessionStorage.getItem("netpos_staff") ?? "null") as { id?: string } | null;
    setBusy(true);
    setErrorMessage("");
    const { error } = await supabase
      .from("bank_statement_lines")
      .update({
        match_status: "matched",
        matched_payment_id: kind === "payment" ? id : null,
        matched_expense_id: kind === "expense" ? id : null,
        matched_at: new Date().toISOString(),
        matched_by: staff?.id ?? null,
      })
      .eq("id", line.id);

    let relatedError = null;
    if (!error && kind === "payment") {
      const result = await supabase.from("payments").update({
        bank_account_id: accountId,
        cleared_status: "matched",
        cleared_at: new Date().toISOString(),
      }).eq("id", id);
      relatedError = result.error;
    }
    if (!error && kind === "expense") {
      const result = await supabase.from("expenses").update({ bank_account_id: accountId }).eq("id", id);
      relatedError = result.error;
    }
    if (relatedError) {
      await supabase.from("bank_statement_lines").update({
        match_status: "unmatched",
        matched_payment_id: null,
        matched_expense_id: null,
        matched_at: null,
        matched_by: null,
      }).eq("id", line.id);
    }
    if (error || relatedError) setErrorMessage(error?.message ?? relatedError?.message ?? "The match could not be saved.");
    else {
      setMessage("Bank entry matched successfully.");
      await loadAccountData(propertyId, accountId);
    }
    setBusy(false);
  }

  async function completeReconciliation() {
    if (!accountId || !statementClosingBalance) {
      setErrorMessage("Enter the statement closing balance.");
      return;
    }
    if (reconciliation.unresolved > 0) {
      setErrorMessage(`Resolve or ignore the ${reconciliation.unresolved} remaining statement entries in this period first.`);
      return;
    }
    if (Math.abs(reconciliation.difference) >= 0.01) {
      setErrorMessage(`The reconciliation is out by ${money.format(reconciliation.difference)}. It cannot be completed yet.`);
      return;
    }
    setBusy(true);
    setErrorMessage("");
    const staff = JSON.parse(sessionStorage.getItem("netpos_staff") ?? "null") as { id?: string } | null;
    const { error } = await supabase.from("bank_reconciliations").upsert({
      property_id: propertyId,
      bank_account_id: accountId,
      period_start: periodStart,
      period_end: periodEnd,
      statement_closing_balance: reconciliation.closing,
      system_closing_balance: reconciliation.systemBalance,
      difference: reconciliation.difference,
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: staff?.id ?? null,
    }, { onConflict: "bank_account_id,period_start,period_end" });
    if (!error) {
      await supabase.from("payments").update({ cleared_status: "reconciled" }).eq("bank_account_id", accountId).gte("received_at", `${periodStart}T00:00:00`).lte("received_at", `${periodEnd}T23:59:59`);
      setMessage(`Bank reconciliation completed for ${periodStart} to ${periodEnd}.`);
      await loadAccountData(propertyId, accountId);
    } else setErrorMessage(error.message);
    setBusy(false);
  }

  async function ignoreLine(lineId: string) {
    setBusy(true);
    const { error } = await supabase
      .from("bank_statement_lines")
      .update({ match_status: "ignored" })
      .eq("id", lineId);
    if (error) setErrorMessage(error.message);
    else await loadAccountData(propertyId, accountId);
    setBusy(false);
  }

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <div style={eyebrow}>FINANCE · BANK RECONCILIATION</div>
          <h1 style={title}>Match the bank to Netpos</h1>
          <p style={muted}>Import a CSV statement, then confirm each bank entry against a payment or expense.</p>
        </div>
        <div style={actions}>
          <Link href="/finance" style={secondary}>← Finance</Link>
          <select value={propertyId} onChange={(event) => { setPropertyId(event.target.value); void loadAccountData(event.target.value); }} style={select}>
            {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </div>
      </header>

      {setupRequired && <Notice tone="warning" title="Finance database setup required." text="Migration 002 must be applied before bank reconciliation can be used." />}
      {errorMessage && !setupRequired && <Notice tone="error" title="Could not complete that action." text={errorMessage} />}
      {message && <Notice tone="success" title="Done" text={message} />}

      <section style={accountBar}>
        <label style={field}>Bank account
          <select value={accountId} onChange={(event) => { setAccountId(event.target.value); void loadAccountData(propertyId, event.target.value); }} style={control}>
            <option value="">Select an account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.bank_name} · {account.account_name}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => setShowAccountForm((value) => !value)} style={secondaryButton}>+ Add Bank Account</button>
        <label style={{...primaryButton, opacity: accountId ? 1 : .5}}>
          Import CSV Statement
          <input type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event)} disabled={!accountId || busy} hidden />
        </label>
      </section>

      {showAccountForm && (
        <section style={accountForm}>
          <label style={field}>Bank name<input value={bankName} onChange={(event) => setBankName(event.target.value)} style={control} placeholder="e.g. FNB Namibia" /></label>
          <label style={field}>Account name<input value={accountName} onChange={(event) => setAccountName(event.target.value)} style={control} placeholder="Operating account" /></label>
          <label style={field}>Masked account number<input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} style={control} placeholder="****1234" /></label>
          <label style={field}>Opening balance<input type="number" step="0.01" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} style={control} /></label>
          <button type="button" disabled={busy} onClick={() => void createAccount()} style={primaryButton}>Save Account</button>
        </section>
      )}

      {preview.length > 0 && (
        <section style={previewPanel}>
          <div><strong>{fileName}</strong><span style={mutedSmall}>{preview.length} valid transactions ready to import</span></div>
          <div style={actions}><button type="button" onClick={() => setPreview([])} style={secondaryButton}>Cancel</button><button type="button" disabled={busy} onClick={() => void importStatement()} style={primaryButton}>{busy ? "Importing..." : "Confirm Import"}</button></div>
        </section>
      )}

      <section style={summaryGrid}>
        <Metric label="Imported lines" value={String(summary.imported)} color="#0D5FA8" />
        <Metric label="Matched" value={String(summary.matched)} color="#168257" />
        <Metric label="Still to match" value={String(summary.unmatched)} color="#A96812" />
        <Metric label="Matched movement" value={money.format(summary.matchedValue)} color="#6654A8" />
      </section>

      <section style={closePanel}>
        <div><h2 style={panelTitle}>Close reconciliation period</h2><p style={mutedSmall}>Netpos will only close when every entry is handled and the difference is zero.</p></div>
        <label style={field}>From<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} style={control} /></label>
        <label style={field}>To<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} style={control} /></label>
        <label style={field}>Statement closing balance<input type="number" step="0.01" value={statementClosingBalance} onChange={(event) => setStatementClosingBalance(event.target.value)} style={control} /></label>
        <div style={balanceCheck}><span>Netpos balance <strong>{money.format(reconciliation.systemBalance)}</strong></span><span>Difference <strong style={{color: Math.abs(reconciliation.difference) < .01 ? "#168257" : "#A33A3A"}}>{money.format(reconciliation.difference)}</strong></span></div>
        <button type="button" disabled={busy || !accountId} onClick={() => void completeReconciliation()} style={primaryButton}>Complete Reconciliation</button>
      </section>

      <section style={panel}>
        <div style={panelHeader}><div><h2 style={panelTitle}>Statement transactions</h2><p style={mutedSmall}>Netpos suggests only exact-amount transactions within five days. A manager must confirm every match.</p></div></div>
        <div style={tableWrap}>
          <table style={table}>
            <thead><tr><th style={th}>Date</th><th style={th}>Bank description</th><th style={thRight}>Amount</th><th style={th}>Status / match</th></tr></thead>
            <tbody>
              {lines.map((line) => {
                const candidates = candidatesFor(line);
                return <tr key={line.id}>
                  <td style={td}>{new Date(`${line.transaction_date}T12:00:00`).toLocaleDateString("en-NA")}</td>
                  <td style={tdStrong}>{line.description}<span style={rowMeta}>{line.bank_reference || "No bank reference"}</span></td>
                  <td style={{...tdRight, color: Number(line.amount) < 0 ? "#A33A3A" : "#168257"}}>{money.format(Number(line.amount))}</td>
                  <td style={td}>
                    {line.match_status === "matched" || line.match_status === "ignored" ? <span style={{...badge, background: line.match_status === "matched" ? "#E4F5EC" : "#EEF2F5", color: line.match_status === "matched" ? "#176B49" : "#657C8E"}}>{line.match_status.toUpperCase()}</span> : <div style={matchControls}>
                      <select defaultValue="" disabled={busy} onChange={(event) => void matchLine(line, event.target.value)} style={matchSelect}>
                        <option value="">{candidates.length ? `${candidates.length} exact match${candidates.length === 1 ? "" : "es"}` : "No exact match"}</option>
                        {candidates.map((candidate) => <option key={`${candidate.kind}-${candidate.id}`} value={`${candidate.kind}:${candidate.id}`}>{candidate.label}</option>)}
                      </select>
                      <button type="button" disabled={busy} onClick={() => void ignoreLine(line.id)} style={ignoreButton}>Ignore</button>
                    </div>}
                  </td>
                </tr>;
              })}
              {!loading && lines.length === 0 && <tr><td colSpan={4} style={empty}>{accountId ? "No statement imported yet." : "Add or select a bank account to begin."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function parseStatement(text: string): ParsedLine[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((row) => row.trim()).map(parseCsvRow);
  if (rows.length < 2) return [];
  const headers = rows[0].map(normaliseHeader);
  const index = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const dateIndex = index("date", "transactiondate", "valuedate", "postingdate");
  const descriptionIndex = index("description", "details", "transactiondescription", "narrative");
  const referenceIndex = index("reference", "bankreference", "ref");
  const amountIndex = index("amount", "transactionamount");
  const debitIndex = index("debit", "withdrawal", "moneyout");
  const creditIndex = index("credit", "deposit", "moneyin");
  const balanceIndex = index("balance", "runningbalance");
  if (dateIndex < 0 || descriptionIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    throw new Error("CSV needs Date and Description columns, plus Amount or Debit/Credit columns.");
  }
  return rows.slice(1).flatMap((row) => {
    const date = normaliseDate(row[dateIndex]);
    const amount = amountIndex >= 0
      ? parseAmount(row[amountIndex])
      : parseAmount(row[creditIndex]) - parseAmount(row[debitIndex]);
    if (!date || !Number.isFinite(amount) || amount === 0) return [];
    return [{
      date,
      description: row[descriptionIndex]?.trim() || "Bank transaction",
      reference: referenceIndex >= 0 ? row[referenceIndex]?.trim() || "" : "",
      amount,
      balance: balanceIndex >= 0 && row[balanceIndex]?.trim() ? parseAmount(row[balanceIndex]) : null,
    }];
  });
}

function parseCsvRow(row: string) {
  const result: string[] = [];
  let value = "";
  let quoted = false;
  for (let position = 0; position < row.length; position += 1) {
    const character = row[position];
    if (character === '"' && row[position + 1] === '"' && quoted) { value += '"'; position += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { result.push(value); value = ""; }
    else value += character;
  }
  result.push(value);
  return result;
}

function normaliseHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseAmount(value = "") {
  const negative = /^\s*\(.*\)\s*$/.test(value) || /^\s*-/.test(value);
  const number = Number(value.replace(/[()\s,"'N$]/g, "").replace(/^-/, "")) || 0;
  return negative ? -number : number;
}

function normaliseDate(value = "") {
  const clean = value.trim();
  const iso = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return "";
}

async function fingerprint(accountId: string, line: ParsedLine) {
  const input = `${accountId}|${line.date}|${line.description}|${line.reference}|${line.amount}|${line.balance ?? ""}`;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return <article style={metric}><span style={metricLabel}>{label}</span><strong style={{...metricValue, color}}>{value}</strong></article>;
}

function Notice({ title: noticeTitle, text, tone }: { title: string; text: string; tone: "warning" | "error" | "success" }) {
  const colors = {
    warning: { border: "#E7C47C", background: "#FFF8E8", color: "#77500D" },
    error: { border: "#E5B0B0", background: "#FFF2F2", color: "#982F2F" },
    success: { border: "#A9D7BF", background: "#ECF8F1", color: "#176B49" },
  };
  return <div style={{...notice, borderColor: colors[tone].border, background: colors[tone].background, color: colors[tone].color}}><strong>{noticeTitle}</strong><span>{text}</span></div>;
}

const page: CSSProperties = { minHeight: "calc(100vh - 112px)", padding: 24, background: "#F4F8FB", color: "#173F5F", fontFamily: "Arial,Helvetica,sans-serif" };
const header: CSSProperties = { maxWidth: 1440, margin: "0 auto 18px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20 };
const eyebrow: CSSProperties = { color: "#168257", fontSize: 12, fontWeight: 900, letterSpacing: 1.2 };
const title: CSSProperties = { margin: "6px 0", fontSize: 28, color: "#123F69" };
const muted: CSSProperties = { margin: 0, color: "#6C8293", fontSize: 14 };
const mutedSmall: CSSProperties = { display: "block", marginTop: 4, color: "#718697", fontSize: 11 };
const actions: CSSProperties = { display: "flex", alignItems: "center", gap: 9 };
const secondary: CSSProperties = { padding: "12px 13px", border: "1px solid #BDD0DE", borderRadius: 8, background: "#FFF", color: "#0D5FA8", textDecoration: "none", fontSize: 13, fontWeight: 800 };
const select: CSSProperties = { height: 42, minWidth: 210, padding: "0 11px", border: "1px solid #BDD0DE", borderRadius: 8, background: "#FFF", color: "#173F5F", fontWeight: 700 };
const notice: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", padding: 13, display: "flex", flexDirection: "column", gap: 4, border: "1px solid", borderRadius: 9, fontSize: 13 };
const accountBar: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", padding: 14, display: "flex", alignItems: "flex-end", gap: 10, border: "1px solid #D7E4ED", borderRadius: 11, background: "#FFF" };
const accountForm: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", padding: 14, display: "grid", gridTemplateColumns: "repeat(4,minmax(140px,1fr)) auto", alignItems: "end", gap: 10, border: "1px solid #BBD7C8", borderRadius: 11, background: "#F5FBF8" };
const field: CSSProperties = { flex: 1, display: "flex", flexDirection: "column", gap: 5, color: "#526B7D", fontSize: 11, fontWeight: 800 };
const control: CSSProperties = { width: "100%", height: 40, padding: "0 10px", border: "1px solid #BFD1DF", borderRadius: 8, background: "#FFF", color: "#173F5F", boxSizing: "border-box" };
const primaryButton: CSSProperties = { minHeight: 40, padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: 8, background: "#168257", color: "#FFF", fontSize: 12, fontWeight: 900, cursor: "pointer" };
const secondaryButton: CSSProperties = { ...primaryButton, border: "1px solid #BDD0DE", background: "#FFF", color: "#0D5FA8" };
const previewPanel: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 15, border: "1px solid #A9D7BF", borderRadius: 11, background: "#ECF8F1" };
const closePanel: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", padding: 14, display: "grid", gridTemplateColumns: "minmax(220px,1.3fr) repeat(3,minmax(135px,.65fr)) minmax(150px,.7fr) auto", alignItems: "end", gap: 10, border: "1px solid #D7E4ED", borderRadius: 11, background: "#FFF" };
const balanceCheck: CSSProperties = { minHeight: 40, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, color: "#687F90", fontSize: 11 };
const summaryGrid: CSSProperties = { maxWidth: 1440, margin: "0 auto 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 };
const metric: CSSProperties = { padding: "15px 17px", border: "1px solid #D7E4ED", borderRadius: 10, background: "#FFF" };
const metricLabel: CSSProperties = { display: "block", color: "#718697", fontSize: 12, fontWeight: 800 };
const metricValue: CSSProperties = { display: "block", marginTop: 8, fontSize: 22 };
const panel: CSSProperties = { maxWidth: 1440, margin: "0 auto", border: "1px solid #D7E4ED", borderRadius: 11, background: "#FFF", overflow: "hidden" };
const panelHeader: CSSProperties = { padding: "14px 16px", borderBottom: "1px solid #E5EDF3" };
const panelTitle: CSSProperties = { margin: 0, color: "#173F5F", fontSize: 17 };
const tableWrap: CSSProperties = { maxHeight: "calc(100vh - 510px)", minHeight: 260, overflow: "auto" };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: CSSProperties = { position: "sticky", top: 0, padding: "10px 13px", background: "#F7FAFC", color: "#62798B", textAlign: "left", fontSize: 11 };
const thRight: CSSProperties = { ...th, textAlign: "right" };
const td: CSSProperties = { padding: "11px 13px", borderTop: "1px solid #E7EEF3", color: "#5B7284", whiteSpace: "nowrap" };
const tdStrong: CSSProperties = { ...td, color: "#164D79", fontWeight: 800, whiteSpace: "normal" };
const tdRight: CSSProperties = { ...td, textAlign: "right", fontWeight: 800 };
const rowMeta: CSSProperties = { display: "block", marginTop: 4, color: "#7A8E9D", fontSize: 10, fontWeight: 500 };
const badge: CSSProperties = { display: "inline-block", padding: "5px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900 };
const matchControls: CSSProperties = { display: "flex", gap: 6 };
const matchSelect: CSSProperties = { minWidth: 230, height: 34, padding: "0 8px", border: "1px solid #BFD1DF", borderRadius: 7, color: "#173F5F", fontSize: 11 };
const ignoreButton: CSSProperties = { padding: "0 9px", border: "1px solid #D4DEE5", borderRadius: 7, background: "#FFF", color: "#687F90", fontSize: 10, fontWeight: 800, cursor: "pointer" };
const empty: CSSProperties = { padding: 30, color: "#7B8F9E", textAlign: "center" };
