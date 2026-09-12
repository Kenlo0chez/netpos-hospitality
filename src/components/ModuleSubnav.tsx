"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";

type Item = { label: string; href: string };
const groups: Array<{ matches: string[]; items: Item[] }> = [
  { matches: ["/front-desk", "/operations", "/reservations", "/quotations", "/guests"], items: [
    { label: "Daily Control", href: "/operations" }, { label: "Room Board", href: "/front-desk" }, { label: "Reservation Calendar", href: "/reservations" }, { label: "+ New Reservation", href: "/reservations/new" }, { label: "Quotations", href: "/quotations" }, { label: "Guests", href: "/guests" },
  ] },
  { matches: ["/billing", "/finance", "/cash-up"], items: [
    { label: "Billing", href: "/billing" }, { label: "Outstanding Accounts", href: "/billing/accounts?filter=outstanding" }, { label: "Finance", href: "/finance" }, { label: "X Report / EOD", href: "/cash-up" },
  ] },
  { matches: ["/housekeeping"], items: [
    { label: "Housekeeping Board", href: "/housekeeping" },
  ] },
  { matches: ["/setup", "/properties", "/rooms", "/room-types", "/rates", "/users"], items: [
    { label: "Property Setup", href: "/setup" }, { label: "Properties", href: "/properties" }, { label: "Rooms · Batch", href: "/rooms" }, { label: "Room Types", href: "/room-types" }, { label: "Rates", href: "/rates" }, { label: "Users", href: "/users" },
  ] },
  { matches: ["/reports"], items: [
    { label: "Operational Reports", href: "/reports" }, { label: "VAT Report", href: "/finance/vat-report" }, { label: "Bank Statement", href: "/finance/bank-statement" }, { label: "X Report / EOD", href: "/cash-up" },
  ] },
];

export default function ModuleSubnav() {
  const pathname = usePathname();
  if (pathname === "/finance" || pathname.startsWith("/finance/")) return null;
  const group = groups.find((candidate) => candidate.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)));
  if (!group) return null;
  return <nav aria-label="Module navigation" style={bar}><div style={inner}>{group.items.map((item) => { const path = item.href.split("?")[0]; const active = pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)); return <Link key={item.href} href={item.href} style={{...link,...(active?activeLink:{})}}>{item.label}</Link>; })}</div></nav>;
}
const bar:CSSProperties={borderBottom:"1px solid #D4E2EB",background:"#F7FAFC",fontFamily:"Arial,sans-serif"};const inner:CSSProperties={display:"flex",gap:6,padding:"7px 18px",overflowX:"auto"};const link:CSSProperties={flex:"0 0 auto",padding:"8px 12px",borderRadius:7,color:"#526B7D",fontSize:12,fontWeight:800,textDecoration:"none",whiteSpace:"nowrap"};const activeLink:CSSProperties={background:"#E4F0F8",color:"#0D5FA8",boxShadow:"inset 0 0 0 1px #BFD5E4"};
