# ============================================================
# NETPOS HOSPITALITY - GLOBAL LOGIN + ROLE ACCESS GUARD
#
# RUN THIS FROM THE ROOT OF netpos-hospitality:
#   powershell -ExecutionPolicy Bypass -File .\install-netpos-access-control.ps1
#
# It creates/replaces:
#   src\components\NetposAccessGuard.tsx
#   app\layout.tsx
#   app\page.tsx
#
# It does NOT expose or store passwords.
# Supabase Auth remains responsible for passwords.
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "NETPOS HOSPITALITY - Installing access control..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path ".\app")) {
    Write-Host "ERROR: Run this script from the netpos-hospitality project folder." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path ".\src\components" | Out-Null

$guard = @'
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

const PUBLIC_ROUTES = [
  "/login",
];

const RECEPTION_ROUTES = [
  "/front-desk",
  "/reservations",
  "/guests",
  "/cash-up",
];

const HOUSEKEEPING_ROUTES = [
  "/housekeeping",
];

export default function NetposAccessGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [checking, setChecking] =
    useState(true);

  const [staff, setStaff] =
    useState<StaffSession | null>(null);

  const [accessError, setAccessError] =
    useState("");

  const isPublic = useMemo(
    () =>
      PUBLIC_ROUTES.some(
        (route) =>
          pathname === route ||
          pathname.startsWith(
            `${route}/`
          )
      ),
    [pathname]
  );

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      setChecking(true);
      setAccessError("");

      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user) {
        setStaff(null);
        sessionStorage.removeItem(
          "netpos_staff"
        );
        sessionStorage.removeItem(
          "netpos_property_id"
        );

        if (!isPublic) {
          router.replace("/login");
        }

        setChecking(false);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from("staff_users")
        .select(`
          id,
          full_name,
          login_id,
          role,
          property_id,
          is_active
        `)
        .eq(
          "auth_user_id",
          session.user.id
        )
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setAccessError(
          error.message
        );
        setChecking(false);
        return;
      }

      if (
        !data ||
        !data.is_active
      ) {
        await supabase.auth.signOut();

        sessionStorage.removeItem(
          "netpos_staff"
        );
        sessionStorage.removeItem(
          "netpos_property_id"
        );

        setStaff(null);
        router.replace("/login");
        setChecking(false);
        return;
      }

      const current =
        data as StaffSession;

      setStaff(current);

      sessionStorage.setItem(
        "netpos_staff",
        JSON.stringify(current)
      );

      if (
        current.property_id
      ) {
        sessionStorage.setItem(
          "netpos_property_id",
          current.property_id
        );
      } else {
        sessionStorage.removeItem(
          "netpos_property_id"
        );
      }

      if (
        pathname === "/login"
      ) {
        router.replace(
          homeForRole(current.role)
        );
        setChecking(false);
        return;
      }

      if (
        !routeAllowed(
          current.role,
          pathname
        )
      ) {
        router.replace(
          homeForRole(current.role)
        );
        setChecking(false);
        return;
      }

      setChecking(false);
    }

    checkAccess();

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        () => {
          checkAccess();
        }
      );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [
    pathname,
    router,
    isPublic,
  ]);

  async function logout() {
    await supabase.auth.signOut();

    sessionStorage.removeItem(
      "netpos_staff"
    );
    sessionStorage.removeItem(
      "netpos_property_id"
    );

    router.replace("/login");
  }

  if (
    checking &&
    !isPublic
  ) {
    return (
      <div style={loadingPage}>
        <div style={loadingCard}>
          <div style={loadingMark}>
            N
          </div>

          <strong>
            NETPOS HOSPITALITY
          </strong>

          <span>
            Checking access...
          </span>
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div style={loadingPage}>
        <div style={errorCard}>
          <strong>
            Access Control Error
          </strong>

          <span>
            {accessError}
          </span>

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

  if (
    !staff &&
    !isPublic
  ) {
    return null;
  }

  return (
    <>
      {staff &&
        !isPublic && (
          <div style={staffBar}>
            <div style={staffIdentity}>
              <span style={staffDot} />

              <strong>
                {staff.full_name}
              </strong>

              <span style={roleBadge}>
                {roleLabel(
                  staff.role
                )}
              </span>

              {staff.role !==
                "owner" &&
                staff.property_id && (
                  <span style={scopeBadge}>
                    Assigned Property
                  </span>
                )}
            </div>

            <div style={staffActions}>
              {staff.role ===
                "owner" && (
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
        pathname.startsWith(
          `${route}/`
        )
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
        pathname.startsWith(
          `${route}/`
        )
    );
  }

  if (
    role === "housekeeping"
  ) {
    return HOUSEKEEPING_ROUTES.some(
      (route) =>
        pathname === route ||
        pathname.startsWith(
          `${route}/`
        )
    );
  }

  return false;
}

function homeForRole(
  role: Role
) {
  if (
    role === "housekeeping"
  ) {
    return "/housekeeping";
  }

  return "/front-desk";
}

function roleLabel(
  role: Role
) {
  if (role === "owner") {
    return "OWNER / ADMIN";
  }

  if (role === "manager") {
    return "MANAGER";
  }

  if (role === "reception") {
    return "RECEPTION";
  }

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
  boxShadow:
    "0 12px 36px rgba(13,63,122,.10)",
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
  position: "sticky",
  top: 0,
  zIndex: 999,
  minHeight: 34,
  padding: "5px 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  boxSizing: "border-box",
  borderBottom:
    "1px solid #D9E3ED",
  background:
    "rgba(255,255,255,.97)",
  fontFamily: "Arial, sans-serif",
  boxShadow:
    "0 2px 8px rgba(0,0,0,.05)",
};

const staffIdentity: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: "#27384A",
  fontSize: 9,
};

const staffDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#178A57",
};

const roleBadge: CSSProperties = {
  padding: "3px 6px",
  borderRadius: 20,
  background: "#EAF3FF",
  color: "#1557A6",
  fontSize: 7,
  fontWeight: 900,
};

const scopeBadge: CSSProperties = {
  color: "#718095",
  fontSize: 7,
};

const ownerScope: CSSProperties = {
  color: "#178A57",
  fontSize: 7,
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
  padding: "5px 8px",
  background: "#fff",
  color: "#1557A6",
  fontSize: 7,
  fontWeight: 900,
  cursor: "pointer",
};
'@

$layout = @'
import type {
  Metadata,
} from "next";
import "./globals.css";
import NetposAccessGuard from "@/src/components/NetposAccessGuard";

export const metadata: Metadata = {
  title: "Netpos Hospitality",
  description:
    "Netpos Hospitality Property Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <NetposAccessGuard>
          {children}
        </NetposAccessGuard>
      </body>
    </html>
  );
}
'@

$homePage = @'
"use client";

import {
  useEffect,
} from "react";
import {
  useRouter,
} from "next/navigation";
import { supabase } from "@/src/lib/supabase";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function go() {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const {
        data,
      } = await supabase
        .from("staff_users")
        .select("role,is_active")
        .eq(
          "auth_user_id",
          session.user.id
        )
        .maybeSingle();

      if (
        !data ||
        !data.is_active
      ) {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }

      router.replace(
        data.role ===
          "housekeeping"
          ? "/housekeeping"
          : "/front-desk"
      );
    }

    go();
  }, [router]);

  return null;
}
'@

Set-Content -Path ".\src\components\NetposAccessGuard.tsx" -Value $guard -Encoding UTF8
Set-Content -Path ".\app\layout.tsx" -Value $layout -Encoding UTF8
Set-Content -Path ".\app\page.tsx" -Value $homePage -Encoding UTF8

Write-Host "Created src\components\NetposAccessGuard.tsx" -ForegroundColor Green
Write-Host "Replaced app\layout.tsx" -ForegroundColor Green
Write-Host "Replaced app\page.tsx" -ForegroundColor Green
Write-Host ""
Write-Host "Access rules installed:" -ForegroundColor Cyan
Write-Host "  Owner        -> all routes / all-property UI"
Write-Host "  Manager      -> all routes / assigned-property session"
Write-Host "  Reception    -> Front Desk, Reservations, Guests, End of Day"
Write-Host "  Housekeeping -> Housekeeping only"
Write-Host ""
Write-Host "Restart Next.js:" -ForegroundColor Yellow
Write-Host "  Ctrl + C"
Write-Host "  npm run dev"
Write-Host ""
