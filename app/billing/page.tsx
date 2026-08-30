"use client";

import Link from "next/link";
import { type CSSProperties } from "react";

export default function BillingPage() {
  return (
    <main style={page}>
      <section style={pageHeader}>
        <div>
          <div style={eyebrow}>FINANCE & GUEST ACCOUNTS</div>
          <h1 style={heading}>Billing</h1>
          <p style={muted}>
            Quotations, reservation accounts, outstanding balances and daily financial activity.
          </p>
        </div>
        <Link href="/reservations" style={primaryButton}>Open Reservations</Link>
      </section>

      <section style={content}>
        <div style={sectionHeader}>
          <div>
            <h2 style={sectionTitle}>Billing Workspace</h2>
            <p style={sectionText}>Select the financial task you want to work with.</p>
          </div>
          <div style={liveBadge}>â— LIVE ACCOUNTING</div>
        </div>

        <div style={grid}>
          <BillingCard href="/quotations" number="01" title="Quotations"
            text="Create accommodation quotations, print PDF documents, track acceptance and convert accepted quotes into reservations."
            action="Open Quotations" />
          <BillingCard href="/billing/accounts" number="02" title="Reservation Accounts"
            text="Open a reservation folio to review charges, record payments, generate invoices, receipts and guest statements."
            action="Open Accounts" />
          <BillingCard href="/billing/accounts?filter=outstanding" number="03" title="Outstanding Accounts"
            text="Review current guest balances and quickly open the reservation that requires payment or account follow-up."
            action="View Outstanding" />
          <BillingCard href="/cash-up" number="04" title="X Report / End of Day"
            text="Review Cash, Card, EFT and refunds for the current trading period before closing the business day."
            action="Open X Report" eod />
        </div>

        <div style={workflowBar}>
          <strong style={workflowTitle}>Financial workflow</strong>
          <span style={workflowText}>
            Quotation â†’ Reservation â†’ Guest Folio â†’ Payment â†’ Invoice / Receipt â†’ X Report / EOD
          </span>
        </div>
      </section>
    </main>
  );
}

function BillingCard({ href, number, title, text, action, eod = false }: {
  href: string; number: string; title: string; text: string; action: string; eod?: boolean;
}) {
  return (
    <Link href={href} style={card}>
      <div style={cardTop}>
        <div style={{ ...cardIcon, ...(eod ? eodIcon : {}) }}>{number}</div>
        <span style={{ ...cardTag, ...(eod ? eodTag : {}) }}>{eod ? "END OF DAY" : "BILLING"}</span>
      </div>
      <h3 style={cardTitle}>{title}</h3>
      <p style={cardText}>{text}</p>
      <div style={{ ...cardAction, ...(eod ? eodAction : {}) }}>{action} â†’</div>
    </Link>
  );
}

const page: CSSProperties = { minHeight:"100vh", background:"#F4F8FC", color:"#17324D", fontFamily:"Arial, sans-serif" };
const pageHeader: CSSProperties = { margin:"14px 22px 0", padding:"14px 16px", border:"1px solid #D4E1EC", borderRadius:12, background:"#FFFFFF", display:"flex", justifyContent:"space-between", alignItems:"center", gap:20, boxShadow:"0 4px 14px rgba(15,72,122,.05)" };
const eyebrow: CSSProperties = { color:"#0D5FA8", fontSize:8, fontWeight:900, letterSpacing:.7, marginBottom:3 };
const heading: CSSProperties = { margin:0, color:"#0D3F7A", fontSize:26 };
const muted: CSSProperties = { margin:"4px 0 0", color:"#6A7C90", fontSize:10 };
const primaryButton: CSSProperties = { textDecoration:"none", padding:"9px 13px", borderRadius:8, background:"#0D5FA8", color:"#FFFFFF", fontSize:9, fontWeight:900 };
const content: CSSProperties = { padding:"15px 22px 28px" };
const sectionHeader: CSSProperties = { display:"flex", justifyContent:"space-between", alignItems:"center", gap:16, marginBottom:10 };
const sectionTitle: CSSProperties = { margin:0, color:"#0D3F7A", fontSize:16 };
const sectionText: CSSProperties = { margin:"3px 0 0", color:"#718196", fontSize:9 };
const liveBadge: CSSProperties = { padding:"6px 9px", borderRadius:20, background:"#ECF9F2", color:"#16885A", fontSize:7, fontWeight:900 };
const grid: CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:11 };
const card: CSSProperties = { minHeight:185, padding:15, border:"1px solid #D5E2ED", borderRadius:11, background:"#FFFFFF", color:"#17324D", textDecoration:"none", boxShadow:"0 4px 13px rgba(15,60,105,.05)", display:"flex", flexDirection:"column" };
const cardTop: CSSProperties = { display:"flex", justifyContent:"space-between", alignItems:"center" };
const cardIcon: CSSProperties = { width:34, height:34, borderRadius:9, display:"flex", justifyContent:"center", alignItems:"center", background:"#EAF4FF", color:"#0D5FA8", fontSize:10, fontWeight:900 };
const eodIcon: CSSProperties = { background:"#ECF9F2", color:"#16885A" };
const cardTag: CSSProperties = { color:"#7A8998", fontSize:7, fontWeight:900, letterSpacing:.5 };
const eodTag: CSSProperties = { color:"#16885A" };
const cardTitle: CSSProperties = { margin:"14px 0 7px", color:"#0D3F7A", fontSize:16 };
const cardText: CSSProperties = { flex:1, margin:0, color:"#66788C", fontSize:9, lineHeight:1.55 };
const cardAction: CSSProperties = { marginTop:14, color:"#0D5FA8", fontSize:9, fontWeight:900 };
const eodAction: CSSProperties = { color:"#16885A" };
const workflowBar: CSSProperties = { marginTop:11, padding:"10px 12px", border:"1px solid #D6E3ED", borderRadius:9, background:"#FFFFFF", display:"flex", alignItems:"center", gap:14 };
const workflowTitle: CSSProperties = { color:"#0D3F7A", fontSize:9 };
const workflowText: CSSProperties = { color:"#6B7C8D", fontSize:8 };
