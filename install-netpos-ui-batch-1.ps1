$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "NETPOS HOSPITALITY - UI BATCH 1" -ForegroundColor Cyan
Write-Host "Reservation Wizard + Quotations + Guests + Billing" -ForegroundColor Cyan
Write-Host ""

$root = Get-Location
$files = @(
  "app\reservations\new\page.tsx",
  "app\quotations\page.tsx",
  "app\guests\page.tsx",
  "app\billing\page.tsx"
)

foreach ($relative in $files) {
  $path = Join-Path $root $relative
  if (!(Test-Path -LiteralPath $path)) {
    throw "Missing file: $relative. Run this installer from C:\Users\Administrator\netpos-hospitality"
  }
  Copy-Item -LiteralPath $path -Destination ($path + ".batch1-backup") -Force
}

function Replace-All([string]$text, [hashtable]$map) {
  foreach ($key in $map.Keys) { $text = $text.Replace($key, $map[$key]) }
  return $text
}

# RESERVATION WIZARD - preserve logic, modernise body
$path = Join-Path $root "app\reservations\new\page.tsx"
$t = Get-Content -LiteralPath $path -Raw
$t = Replace-All $t @{
  'maxWidth: 1000,' = 'maxWidth: 1180,'
  'padding: 32,' = 'padding: "18px 24px 30px",'
  'fontFamily: "Arial, sans-serif",' = 'fontFamily: "Arial, sans-serif", color: "#17324D", background: "#F4F8FC", minHeight: "100vh",'
  'marginBottom: 25,' = 'marginBottom: 16,'
  'border: "1px solid #ddd",' = 'border: "1px solid #D5E2ED",'
  'borderRadius: 14,' = 'borderRadius: 12,'
  'padding: 22,' = 'padding: 18,'
  'marginBottom: 20,' = 'marginBottom: 12,'
  'border: "1px solid #ccc",' = 'border: "1px solid #C7D6E3",'
  'fontSize: 15,' = 'fontSize: 11,'
  'background: "#f5f5f5",' = 'background: "#F2F7FB",'
  'background: "#eaf7ee",' = 'background: "#ECF9F2",'
  'color: "#176b2c",' = 'color: "#167A4B",'
  'background: "#fff0f0",' = 'background: "#FFF3F3",'
  'color: "#a11a1a",' = 'color: "#A33B3B",'
  'background: "#fff8e7",' = 'background: "#FFF9EA",'
  'background: "#f6f6f6",' = 'background: "#F4F8FC",'
}
$t = $t.Replace('? "#111"', '? "#0D5FA8"')
$t = $t.Replace(': "#d4d4d4"', ': "#D5DEE7"')
Set-Content -LiteralPath $path -Value $t -Encoding UTF8
Write-Host "Updated Reservation Wizard" -ForegroundColor Green

# QUOTATIONS - keep all workflow logic, remove duplicate local brand banner
$path = Join-Path $root "app\quotations\page.tsx"
$t = Get-Content -LiteralPath $path -Raw
$t = $t.Replace('Ã—','×')
$t = Replace-All $t @{
  'background: "#F3F7FB",' = 'background: "#F4F8FC",'
  'background: "linear-gradient(135deg,#0C3D78,#1764B0)",' = 'background: "linear-gradient(135deg,#0B4E8A,#0D668F)",'
  'background: "#0D5DAA",' = 'background: "#0D5FA8",'
  'borderRadius: 14,' = 'borderRadius: 12,'
}
Set-Content -LiteralPath $path -Value $t -Encoding UTF8
Write-Host "Updated Quotations" -ForegroundColor Green

# GUESTS - crystal blue/green palette, preserve quick-create and directory logic
$path = Join-Path $root "app\guests\page.tsx"
$t = Get-Content -LiteralPath $path -Raw
$t = Replace-All $t @{
  'const BLUE = "#1557A6";' = 'const BLUE = "#0D5FA8";'
  'const DARK_BLUE = "#0D3F7A";' = 'const DARK_BLUE = "#0B477F";'
  'const GREEN = "#178A57";' = 'const GREEN = "#16885A";'
  'const PAGE_BG = "#F4F7FB";' = 'const PAGE_BG = "#F4F8FC";'
  'linear-gradient(135deg, #0D3F7A 0%, #1557A6 100%)' = 'linear-gradient(135deg, #0B4E8A 0%, #0D668F 100%)'
}
Set-Content -LiteralPath $path -Value $t -Encoding UTF8
Write-Host "Updated Guests" -ForegroundColor Green

# BILLING - complete clean replacement
$path = Join-Path $root "app\billing\page.tsx"
$billing = @'
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
          <div style={liveBadge}>● LIVE ACCOUNTING</div>
        </div>

        <div style={grid}>
          <BillingCard href="/quotations" number="01" title="Quotations"
            text="Create accommodation quotations, print PDF documents, track acceptance and convert accepted quotes into reservations."
            action="Open Quotations" />
          <BillingCard href="/reservations" number="02" title="Reservation Accounts"
            text="Open a reservation folio to review charges, record payments, generate invoices, receipts and guest statements."
            action="Open Accounts" />
          <BillingCard href="/front-desk" number="03" title="Outstanding Accounts"
            text="Review current guest balances and quickly open the reservation that requires payment or account follow-up."
            action="View Outstanding" />
          <BillingCard href="/cash-up" number="04" title="X Report / End of Day"
            text="Review Cash, Card, EFT and refunds for the current trading period before closing the business day."
            action="Open X Report" eod />
        </div>

        <div style={workflowBar}>
          <strong style={workflowTitle}>Financial workflow</strong>
          <span style={workflowText}>
            Quotation → Reservation → Guest Folio → Payment → Invoice / Receipt → X Report / EOD
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
      <div style={{ ...cardAction, ...(eod ? eodAction : {}) }}>{action} →</div>
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
'@
Set-Content -LiteralPath $path -Value $billing -Encoding UTF8
Write-Host "Updated Billing" -ForegroundColor Green

Write-Host ""
Write-Host "BATCH 1 COMPLETE" -ForegroundColor Cyan
Write-Host "Backups created with .batch1-backup extension." -ForegroundColor DarkGray
Write-Host "Restart with: npm run dev" -ForegroundColor Yellow
