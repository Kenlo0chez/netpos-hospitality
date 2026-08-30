# ============================================================
# NETPOS HOSPITALITY - MAIN NAVIGATION + BILLING HUB
#
# Run from:
#   C:\Users\Administrator\netpos-hospitality
#
# Command:
#   powershell -ExecutionPolicy Bypass -File .\install-netpos-main-menu.ps1
#
# Creates/replaces:
#   src\components\NetposAccessGuard.tsx
#   app\billing\page.tsx
#
# This keeps the existing login/role guard and adds a role-aware
# system menu so Owner/Manager can see all major modules.
# ============================================================

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\app")) {
    Write-Host "ERROR: Run this from the netpos-hospitality project folder." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path ".\src\components" | Out-Null
New-Item -ItemType Directory -Force -Path ".\app\billing" | Out-Null

$guardCode = @'
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";

type Role =
  | "owner"
  | "manager"
  | "reception"
  | "housekeeping";

type StaffSession = {
  id: string;
  full_name: string;
  login_id: string | null;
  role: Role;
  property_id: string | null;
  is_active: boolean;
};

type MenuItem = {
  label: string;
  href: string;
  roles: Role[];
};

const PUBLIC_ROUTES = ["/login"];

const RECEPTION_ROUTES = [
  "/front-desk",
  "/reservations",
  "/guests",
  "/billing",
  "/cash-up",
];

const HOUSEKEEPING_ROUTES = [
  "/housekeeping",
];

const MENU_ITEMS: MenuItem[] = [
  {
    label: "Front Desk",
    href: "/front-desk",
    roles: ["owner", "manager", "reception"],
  },
  {
    label: "Reservations",
    href: "/reservations",
    roles: ["owner", "manager", "reception"],
  },
  {
    label: "Guests",
    href: "/guests",
    roles: ["owner", "manager", "reception"],
  },
  {
    label: "Billing",
    href: "/billing",
    roles: ["owner", "manager", "reception"],
  },
  {
    label: "X Report / EOD",
    href: "/cash-up",
    roles: ["owner", "manager", "reception"],
  },
  {
    label: "Reports",
    href: "/reports",
    roles: ["owner", "manager"],
  },
  {
    label: "Housekeeping",
    href: "/housekeeping",
    roles: ["owner", "manager", "housekeeping"],
  },
  {
    label: "Setup",
    href: "/setup",
    roles: ["owner", "manager"],
  },
  {
    label: "Users",
    href: "/users",
    roles: ["owner", "manager"],
  },
];

export default function NetposAccessGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] = useState(true);
  const [staff, setStaff] = useState<StaffSession | null>(null);
  const [accessError, setAccessError] = useState("");

  const isPublic = useMemo(
    () =>
      PUBLIC_ROUTES.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(`${route}/`)
      ),
    [pathname]
  );

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      setChecking(true);
      setAccessError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        setStaff(null);
        sessionStorage.removeItem("netpos_staff");
        sessionStorage.removeItem("netpos_property_id");

        if (!isPublic) {
          router.replace("/login");
        }

        setChecking(false);
        return;
      }

      const { data, error } = await supabase
        .from("staff_users")
        .select(`
          id,
          full_name,
          login_id,
          role,
          property_id,
          is_active
        `)
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setAccessError(error.message);
        setChecking(false);
        return;
      }

      if (!data || !data.is_active) {
        await supabase.auth.signOut();

        sessionStorage.removeItem("netpos_staff");
        sessionStorage.removeItem("netpos_property_id");

        setStaff(null);
        router.replace("/login");
        setChecking(false);
        return;
      }

      const current = data as StaffSession;

      setStaff(current);

      sessionStorage.setItem(
        "netpos_staff",
        JSON.stringify(current)
      );

      if (current.property_id) {
        sessionStorage.setItem(
          "netpos_property_id",
          current.property_id
        );
      } else {
        sessionStorage.removeItem("netpos_property_id");
      }

      if (pathname === "/login") {
        router.replace(homeForRole(current.role));
        setChecking(false);
        return;
      }

      if (!routeAllowed(current.role, pathname)) {
        router.replace(homeForRole(current.role));
        setChecking(false);
        return;
      }

      setChecking(false);
    }

    checkAccess();

    const { data: listener } =
      supabase.auth.onAuthStateChange(() => {
        checkAccess();
      });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router, isPublic]);

  async function logout() {
    await supabase.auth.signOut();

    sessionStorage.removeItem("netpos_staff");
    sessionStorage.removeItem("netpos_property_id");

    router.replace("/login");
  }

  if (checking && !isPublic) {
    return (
      <div style={loadingPage}>
        <div style={loadingCard}>
          <div style={loadingMark}>N</div>
          <strong>NETPOS HOSPITALITY</strong>
          <span>Checking access...</span>
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div style={loadingPage}>
        <div style={errorCard}>
          <strong>Access Control Error</strong>
          <span>{accessError}</span>
          <button
            type="button"
            onClick={logout}
            style={logoutButton}
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!staff && !isPublic) {
    return null;
  }

  return (
    <>
      {staff && !isPublic && (
        <>
          <div style={staffBar}>
            <div style={staffIdentity}>
              <span style={staffDot} />
              <strong>{staff.full_name}</strong>

              <span style={roleBadge}>
                {roleLabel(staff.role)}
              </span>

              {staff.role !== "owner" &&
                staff.property_id && (
                  <span style={scopeBadge}>
                    Assigned Property
                  </span>
                )}
            </div>

            <div style={staffActions}>
              {staff.role === "owner" && (
                <span style={ownerScope}>
                  All Properties
                </span>
              )}

              <button
                type="button"
                onClick={logout}
                style={logoutButton}
              >
                Log Out
              </button>
            </div>
          </div>

          <nav style={mainNav}>
            <div style={menuInner}>
              {MENU_ITEMS
                .filter((item) =>
                  item.roles.includes(staff.role)
                )
                .map((item) => {
                  const active =
                    pathname === item.href ||
                    pathname.startsWith(
                      `${item.href}/`
                    );

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        ...menuLink,
                        ...(active
                          ? activeMenuLink
                          : {}),
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          </nav>
        </>
      )}

      {children}
    </>
  );
}

function routeAllowed(
  role: Role,
  pathname: string
) {
  if (
    PUBLIC_ROUTES.some(
      (route) =>
        pathname === route ||
        pathname.startsWith(`${route}/`)
    )
  ) {
    return true;
  }

  if (role === "owner") {
    return true;
  }

  if (role === "manager") {
    return true;
  }

  if (role === "reception") {
    return RECEPTION_ROUTES.some(
      (route) =>
        pathname === route ||
        pathname.startsWith(`${route}/`)
    );
  }

  if (role === "housekeeping") {
    return HOUSEKEEPING_ROUTES.some(
      (route) =>
        pathname === route ||
        pathname.startsWith(`${route}/`)
    );
  }

  return false;
}

function homeForRole(role: Role) {
  if (role === "housekeeping") {
    return "/housekeeping";
  }

  return "/front-desk";
}

function roleLabel(role: Role) {
  if (role === "owner") return "OWNER / ADMIN";
  if (role === "manager") return "MANAGER";
  if (role === "reception") return "RECEPTION";
  return "HOUSEKEEPING";
}

const loadingPage: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  boxSizing: "border-box",
  fontFamily: "Arial, sans-serif",
  background: "#F4F7FB",
};

const loadingCard: CSSProperties = {
  width: 280,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  border: "1px solid #C8D6E5",
  borderRadius: 12,
  background: "#fff",
  color: "#0D3F7A",
  boxShadow: "0 12px 36px rgba(13,63,122,.10)",
};

const loadingMark: CSSProperties = {
  width: 42,
  height: 42,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  borderRadius: 10,
  background: "#0D3F7A",
  color: "#fff",
  fontSize: 23,
  fontWeight: 900,
};

const errorCard: CSSProperties = {
  ...loadingCard,
  color: "#9A2D2D",
  textAlign: "center",
};

const staffBar: CSSProperties = {
  minHeight: 34,
  padding: "5px 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  boxSizing: "border-box",
  borderBottom: "1px solid #D9E3ED",
  background: "#FFFFFF",
  fontFamily: "Arial, sans-serif",
};

const staffIdentity: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "#27384A",
  fontSize: 10,
};

const staffDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#178A57",
};

const roleBadge: CSSProperties = {
  padding: "3px 7px",
  borderRadius: 20,
  background: "#EAF3FF",
  color: "#1557A6",
  fontSize: 8,
  fontWeight: 900,
};

const scopeBadge: CSSProperties = {
  color: "#718095",
  fontSize: 8,
};

const ownerScope: CSSProperties = {
  color: "#178A57",
  fontSize: 8,
  fontWeight: 900,
};

const staffActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const logoutButton: CSSProperties = {
  border: "1px solid #B7C6D6",
  borderRadius: 6,
  padding: "5px 9px",
  background: "#fff",
  color: "#1557A6",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const mainNav: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 998,
  background: "#0D4E94",
  borderBottom: "1px solid #0A3C73",
  boxShadow: "0 3px 10px rgba(13,63,122,.13)",
  fontFamily: "Arial, sans-serif",
};

const menuInner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 3,
  padding: "6px 18px",
  overflowX: "auto",
};

const menuLink: CSSProperties = {
  flex: "0 0 auto",
  textDecoration: "none",
  color: "#EAF4FF",
  padding: "8px 11px",
  borderRadius: 7,
  fontSize: 10,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const activeMenuLink: CSSProperties = {
  background: "#FFFFFF",
  color: "#0D4E94",
  boxShadow: "0 2px 6px rgba(0,0,0,.10)",
};
'@

$billingCode = @'
"use client";

import Link from "next/link";
import {
  type CSSProperties,
} from "react";

export default function BillingPage() {
  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <div style={brandRow}>
            <div style={mark}>N</div>

            <div>
              <h1 style={brand}>
                NETPOS HOSPITALITY
              </h1>

              <div style={subtitle}>
                Billing & Accounts
              </div>
            </div>
          </div>
        </div>

        <Link
          href="/reservations"
          style={primaryButton}
        >
          Open Reservations
        </Link>
      </section>

      <section style={content}>
        <div style={headingRow}>
          <div>
            <h2 style={heading}>
              Billing
            </h2>

            <p style={muted}>
              Central access to guest accounts,
              invoices, payments and daily financial activity.
            </p>
          </div>
        </div>

        <div style={grid}>
          <Link
            href="/reservations"
            style={card}
          >
            <div style={cardIcon}>
              01
            </div>

            <h3 style={cardTitle}>
              Reservation Accounts
            </h3>

            <p style={cardText}>
              Open a reservation to view its
              invoice, record payments, check
              balances or print guest documents.
            </p>

            <span style={cardAction}>
              Open Reservations →
            </span>
          </Link>

          <Link
            href="/front-desk"
            style={card}
          >
            <div style={cardIcon}>
              02
            </div>

            <h3 style={cardTitle}>
              Outstanding Accounts
            </h3>

            <p style={cardText}>
              View guests and reservations that
              still have money outstanding.
            </p>

            <span style={cardAction}>
              View Outstanding →
            </span>
          </Link>

          <Link
            href="/cash-up"
            style={card}
          >
            <div style={cardIcon}>
              03
            </div>

            <h3 style={cardTitle}>
              X Report / End of Day
            </h3>

            <p style={cardText}>
              Review Cash, Card, EFT and refunds
              for the current trading period and
              perform End of Day.
            </p>

            <span style={cardAction}>
              Open X Report →
            </span>
          </Link>

          <Link
            href="/reports"
            style={card}
          >
            <div style={cardIcon}>
              04
            </div>

            <h3 style={cardTitle}>
              Management Reports
            </h3>

            <p style={cardText}>
              Review revenue, occupancy,
              room performance and selected
              date-range management figures.
            </p>

            <span style={cardAction}>
              Open Reports →
            </span>
          </Link>
        </div>

        <div style={notice}>
          <strong>
            Quotations:
          </strong>{" "}
          The navigation is now corrected first.
          The quotation register and quotation
          creation workflow should be built as
          its own proper module rather than
          pretending a reservation is a quotation.
        </div>
      </section>
    </main>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#F3F7FB",
  color: "#17324D",
  fontFamily: "Arial, sans-serif",
};

const hero: CSSProperties = {
  margin: "14px 22px 0",
  padding: "17px 20px",
  borderRadius: 14,
  background:
    "linear-gradient(135deg,#0C3D78,#1764B0)",
  color: "#fff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  boxShadow:
    "0 10px 24px rgba(12,61,120,.16)",
};

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const mark: CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  background: "#FFFFFF",
  color: "#0D4E94",
  fontSize: 24,
  fontWeight: 900,
};

const brand: CSSProperties = {
  margin: 0,
  fontSize: 22,
  letterSpacing: 1.2,
};

const subtitle: CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  opacity: 0.9,
};

const primaryButton: CSSProperties = {
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 8,
  background: "#FFFFFF",
  color: "#0D4E94",
  fontSize: 10,
  fontWeight: 900,
};

const content: CSSProperties = {
  padding: "18px 22px 28px",
};

const headingRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: 14,
};

const heading: CSSProperties = {
  margin: 0,
  color: "#0D3F7A",
  fontSize: 26,
};

const muted: CSSProperties = {
  margin: "5px 0 0",
  color: "#6A7C90",
  fontSize: 11,
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit,minmax(230px,1fr))",
  gap: 13,
};

const card: CSSProperties = {
  minHeight: 180,
  padding: 17,
  border: "1px solid #D7E2EC",
  borderRadius: 12,
  background: "#FFFFFF",
  color: "#17324D",
  textDecoration: "none",
  boxShadow:
    "0 5px 15px rgba(15,60,105,.06)",
};

const cardIcon: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "#EAF4FF",
  color: "#0D4E94",
  fontSize: 10,
  fontWeight: 900,
};

const cardTitle: CSSProperties = {
  margin: "13px 0 7px",
  color: "#0D3F7A",
  fontSize: 16,
};

const cardText: CSSProperties = {
  minHeight: 48,
  margin: 0,
  color: "#66788C",
  fontSize: 10,
  lineHeight: 1.55,
};

const cardAction: CSSProperties = {
  display: "inline-block",
  marginTop: 13,
  color: "#178A57",
  fontSize: 10,
  fontWeight: 900,
};

const notice: CSSProperties = {
  marginTop: 15,
  padding: "12px 14px",
  border: "1px solid #CFE2F4",
  borderRadius: 9,
  background: "#F7FBFF",
  color: "#4D6276",
  fontSize: 10,
  lineHeight: 1.5,
};
'@

Set-Content `
  -Path ".\src\components\NetposAccessGuard.tsx" `
  -Value $guardCode `
  -Encoding UTF8

Set-Content `
  -Path ".\app\billing\page.tsx" `
  -Value $billingCode `
  -Encoding UTF8

Write-Host ""
Write-Host "NETPOS HOSPITALITY MAIN MENU INSTALLED" -ForegroundColor Green
Write-Host ""
Write-Host "Owner / Manager menu:"
Write-Host "  Front Desk"
Write-Host "  Reservations"
Write-Host "  Guests"
Write-Host "  Billing"
Write-Host "  X Report / EOD"
Write-Host "  Reports"
Write-Host "  Housekeeping"
Write-Host "  Setup"
Write-Host "  Users"
Write-Host ""
Write-Host "Reception menu:"
Write-Host "  Front Desk"
Write-Host "  Reservations"
Write-Host "  Guests"
Write-Host "  Billing"
Write-Host "  X Report / EOD"
Write-Host ""
Write-Host "Housekeeping menu:"
Write-Host "  Housekeeping"
Write-Host ""
Write-Host "Now restart Next.js:"
Write-Host "  Ctrl + C"
Write-Host "  npm run dev"
Write-Host ""
