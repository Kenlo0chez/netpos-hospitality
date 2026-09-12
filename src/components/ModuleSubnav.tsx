"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type CSSProperties } from "react";

type PermissionKey = "view_reports" | "record_payments" | "run_end_of_day" | "manage_housekeeping" | "edit_setup" | "manage_users";
type Item = { label: string; href: string; permission?: PermissionKey };
const groups: Array<{ matches: string[]; items: Item[] }> = [
  { matches: ["/front-desk", "/operations", "/reservations", "/quotations", "/guests"], items: [
    { label: "Daily Control", href: "/operations" }, { label: "Room Board", href: "/front-desk" }, { label: "Reservation Calendar", href: "/reservations" }, { label: "+ New Reservation", href: "/reservations/new" }, { label: "Quotations", href: "/quotations" }, { label: "Guests", href: "/guests" },
  ] },
  { matches: ["/billing", "/finance", "/cash-up"], items: [
    { label: "Billing", href: "/billing", permission: "record_payments" }, { label: "Outstanding Accounts", href: "/billing/accounts?filter=outstanding", permission: "record_payments" }, { label: "Finance", href: "/finance", permission: "view_reports" }, { label: "X Report / EOD", href: "/cash-up", permission: "run_end_of_day" },
  ] },
  { matches: ["/housekeeping"], items: [
    { label: "Housekeeping Board", href: "/housekeeping", permission: "manage_housekeeping" },
  ] },
  { matches: ["/setup", "/properties", "/rooms", "/room-types", "/rates", "/users"], items: [
    { label: "Property Setup", href: "/setup", permission: "edit_setup" }, { label: "Properties", href: "/properties", permission: "edit_setup" }, { label: "Rooms · Batch", href: "/rooms", permission: "edit_setup" }, { label: "Room Types", href: "/room-types", permission: "edit_setup" }, { label: "Rates", href: "/rates", permission: "edit_setup" }, { label: "Users", href: "/users", permission: "manage_users" },
  ] },
  { matches: ["/reports"], items: [
    { label: "Operational Reports", href: "/reports", permission: "view_reports" }, { label: "VAT Report", href: "/finance/vat-report", permission: "view_reports" }, { label: "Bank Statement", href: "/finance/bank-statement", permission: "view_reports" }, { label: "X Report / EOD", href: "/cash-up", permission: "run_end_of_day" },
  ] },
];

export default function ModuleSubnav() {
  const pathname = usePathname();
  const access = useMemo(() => {
    try {
      const staff = JSON.parse(sessionStorage.getItem("netpos_staff") ?? "null") as { role?: string } | null;
      const permissions = JSON.parse(sessionStorage.getItem("netpos_permissions") ?? "null") as Record<string, boolean> | null;
      return { role: staff?.role, permissions };
    } catch {
      return { role: undefined, permissions: null };
    }
  }, []);
  if (pathname === "/finance" || pathname.startsWith("/finance/")) return null;
  const group = groups.find((candidate) => candidate.matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)));
  if (!group) return null;
  const items = group.items.filter((item) => access.role === "owner" || !item.permission || !access.permissions || access.permissions[item.permission]);
  return <nav aria-label="Module navigation" style={bar}><div style={inner}>{items.map((item) => { const path = item.href.split("?")[0]; const active = pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)); return <Link key={item.href} href={item.href} style={{...link,...(active?activeLink:{})}}>{item.label}</Link>; })}</div></nav>;
}
const bar:CSSProperties={position:"sticky",top:53,zIndex:997,borderBottom:"1px solid #C8D0D8",background:"linear-gradient(90deg,#F8FAFC 0%,#E8EDF2 100%)",fontFamily:"Inter,Segoe UI,Arial,sans-serif",boxShadow:"0 2px 7px rgba(8,28,45,.05)"};const inner:CSSProperties={display:"flex",gap:5,padding:"6px 18px",overflowX:"auto"};const link:CSSProperties={flex:"0 0 auto",padding:"7px 11px",borderRadius:6,color:"#44596A",fontSize:11,fontWeight:800,textDecoration:"none",whiteSpace:"nowrap"};const activeLink:CSSProperties={background:"#FFFFFF",color:"#0D5FA8",boxShadow:"inset 0 0 0 1px #AFC1CF,0 2px 6px rgba(8,28,45,.08)"};
