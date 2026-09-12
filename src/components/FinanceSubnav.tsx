"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

const items = [
  { label: "1 · EFT Allocation", href: "/finance/eft" },
  { label: "2 · Accounts", href: "/billing/accounts?filter=outstanding" },
  { label: "3 · X Report / EOD", href: "/cash-up" },
  { label: "4 · Cashbook & Expenses", href: "/finance/cashbook" },
  { label: "5 · Bank Reconciliation", href: "/finance/bank-reconciliation" },
  { label: "Bank Statement", href: "/finance/bank-statement" },
  { label: "VAT Report", href: "/finance/vat-report" },
];

export default function FinanceSubnav() {
  const pathname = usePathname();
  return <nav aria-label="Finance tasks" style={wrap}>{items.map((item) => {
    const active = item.href.startsWith("/finance/") && pathname.startsWith(item.href);
    return <Link key={item.href} href={item.href} style={{ ...link, ...(active ? activeLink : {}) }}>{item.label}</Link>;
  })}</nav>;
}

const wrap: CSSProperties = { display: "flex", gap: 7, maxWidth: 1440, margin: "0 auto 16px", padding: 7, overflowX: "auto", border: "1px solid #D5E3EC", borderRadius: 11, background: "#FFFFFF", boxShadow: "0 4px 14px rgba(18,63,105,.04)" };
const link: CSSProperties = { flex: "0 0 auto", padding: "9px 12px", borderRadius: 7, color: "#42627A", fontSize: 12, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" };
const activeLink: CSSProperties = { background: "#0D5FA8", color: "#FFFFFF" };
