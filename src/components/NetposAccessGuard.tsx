"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
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
  "/quotations",
  "/guests",
  "/billing",
  "/cash-up",
];

const HOUSEKEEPING_ROUTES = ["/housekeeping"];

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
    label: "Quotations",
    href: "/quotations",
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
    label: "Housekeeping",
    href: "/housekeeping",
    roles: ["owner", "manager", "housekeeping"],
  },
  {
    label: "Finance",
    href: "/finance",
    roles: ["owner", "manager"],
  },
  {
    label: "Setup",
    href: "/setup",
    roles: ["owner", "manager"],
  },
  {
    label: "X Report / EOD",
    href: "/cash-up",
    roles: ["owner", "manager", "reception"],
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
  const [financeMenuOpen, setFinanceMenuOpen] = useState(false);
  const [setupMenuOpen, setSetupMenuOpen] = useState(false);
  const menuCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function keepMenuOpen(openMenu: () => void) {
    if (menuCloseTimer.current) {
      clearTimeout(menuCloseTimer.current);
      menuCloseTimer.current = null;
    }

    openMenu();
  }

  function closeMenuShortly(closeMenu: () => void) {
    if (menuCloseTimer.current) {
      clearTimeout(menuCloseTimer.current);
    }

    menuCloseTimer.current = setTimeout(() => {
      closeMenu();
      menuCloseTimer.current = null;
    }, 220);
  }

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
          <div style={brandBar}>
            <Link
              href={homeForRole(staff.role)}
              style={brandLink}
            >
              <div style={brandMark}>N</div>

              <div>
                <div style={brandName}>
                  NETPOS HOSPITALITY
                </div>

                <div style={brandTagline}>
                  Property Management System
                </div>
              </div>
            </Link>

            <div style={staffActions}>
              <div style={staffIdentity}>
                <span style={staffDot} />

                <div style={staffNameBlock}>
                  <strong>{staff.full_name}</strong>

                  <span style={staffMeta}>
                    {roleLabel(staff.role)}
                    {staff.role === "owner"
                      ? "  All Properties"
                      : staff.property_id
                      ? "  Assigned Property"
                      : ""}
                  </span>
                </div>
              </div>

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
                    item.href === "/finance"
                      ? pathname === "/finance" ||
                        pathname.startsWith("/finance/") ||
                        pathname === "/reports" ||
                        pathname.startsWith("/reports/")
                      : item.href === "/setup"
                      ? pathname === "/setup" ||
                        pathname.startsWith("/setup/") ||
                        pathname === "/users" ||
                        pathname.startsWith("/users/")
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);

                  const isEod =
                    item.href === "/cash-up";

                  if (item.href === "/finance") {
                    return (
                      <div
                        key={item.href}
                        style={financeMenu}
                        onMouseEnter={() =>
                          keepMenuOpen(() => {
                            setSetupMenuOpen(false);
                            setFinanceMenuOpen(true);
                          })
                        }
                        onMouseLeave={() =>
                          closeMenuShortly(() => setFinanceMenuOpen(false))
                        }
                      >
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={financeMenuOpen}
                          onClick={() =>
                            setFinanceMenuOpen((open) => !open)
                          }
                          style={{
                            ...menuLink,
                            ...financeMenuButton,
                            ...(active ? activeMenuLink : {}),
                          }}
                        >
                          Finance <span aria-hidden="true">▾</span>
                        </button>

                        {financeMenuOpen && (
                          <div role="menu" style={financeDropdown}>
                            <Link
                              href="/finance"
                              role="menuitem"
                              onClick={() => setFinanceMenuOpen(false)}
                              style={financeShortcutLink}
                            >
                              <span style={financeShortcutIcon}>FI</span>
                              <span style={financeShortcutCopy}>
                                <strong>Finance Overview</strong>
                                <span>Cashbook, bank, VAT and payouts</span>
                              </span>
                            </Link>

                            <Link
                              href="/reports"
                              role="menuitem"
                              onClick={() => setFinanceMenuOpen(false)}
                              style={{
                                ...financeShortcutLink,
                                ...(pathname === "/reports" ||
                                pathname.startsWith("/reports/")
                                  ? financeDropdownLinkActive
                                  : {}),
                              }}
                            >
                              <span style={financeShortcutIcon}>RP</span>
                              <span style={financeShortcutCopy}>
                                <strong>Management Reports</strong>
                                <span>Operational and performance reporting</span>
                              </span>
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (item.href === "/setup") {
                    return (
                      <div
                        key={item.href}
                        style={financeMenu}
                        onMouseEnter={() =>
                          keepMenuOpen(() => {
                            setFinanceMenuOpen(false);
                            setSetupMenuOpen(true);
                          })
                        }
                        onMouseLeave={() =>
                          closeMenuShortly(() => setSetupMenuOpen(false))
                        }
                      >
                        <button
                          type="button"
                          aria-haspopup="menu"
                          aria-expanded={setupMenuOpen}
                          onClick={() =>
                            setSetupMenuOpen((open) => !open)
                          }
                          style={{
                            ...menuLink,
                            ...financeMenuButton,
                            ...(active ? activeMenuLink : {}),
                          }}
                        >
                          Setup <span aria-hidden="true">▾</span>
                        </button>

                        {setupMenuOpen && (
                          <div role="menu" style={financeDropdown}>
                            <Link
                              href="/setup"
                              role="menuitem"
                              onClick={() => setSetupMenuOpen(false)}
                              style={{
                                ...financeDropdownLink,
                                ...(pathname === "/setup" ||
                                pathname.startsWith("/setup/")
                                  ? financeDropdownLinkActive
                                  : {}),
                              }}
                            >
                              <strong>Setup Overview</strong>
                              <span>Properties, rooms and system settings</span>
                            </Link>

                            <Link
                              href="/users"
                              role="menuitem"
                              onClick={() => setSetupMenuOpen(false)}
                              style={{
                                ...financeDropdownLink,
                                ...(pathname === "/users" ||
                                pathname.startsWith("/users/")
                                  ? financeDropdownLinkActive
                                  : {}),
                              }}
                            >
                              <strong>Users</strong>
                              <span>Staff accounts and property access</span>
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        ...menuLink,
                        ...(active
                          ? activeMenuLink
                          : {}),
                        ...(isEod
                          ? eodMenuLink
                          : {}),
                        ...(isEod && active
                          ? activeEodMenuLink
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

      {staff && !isPublic ? (
        <div style={applicationShell}>
          {children}
        </div>
      ) : (
        children
      )}
    </>
  );
}

function routeAllowed(role: Role, pathname: string) {
  if (
    PUBLIC_ROUTES.some(
      (route) =>
        pathname === route ||
        pathname.startsWith(`${route}/`)
    )
  ) {
    return true;
  }

  if (role === "owner" || role === "manager") {
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
  return role === "housekeeping"
    ? "/housekeeping"
    : "/front-desk";
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
  fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
  background:
    "linear-gradient(135deg,#F2F8FE 0%,#FFFFFF 58%,#EAF4FF 100%)",
};

const loadingCard: CSSProperties = {
  width: 300,
  padding: 26,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  border: "1px solid #CFE0ED",
  borderRadius: 14,
  background: "#FFFFFF",
  color: "#123F69",
  boxShadow: "0 16px 42px rgba(13,79,145,.10)",
};

const loadingMark: CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  borderRadius: 11,
  background:
    "linear-gradient(145deg,#0B4E8A,#1680CF)",
  color: "#FFFFFF",
  fontSize: 23,
  fontWeight: 900,
  boxShadow: "0 5px 14px rgba(13,95,168,.20)",
};

const errorCard: CSSProperties = {
  ...loadingCard,
  color: "#0D4F91",
  textAlign: "center",
};

const brandBar: CSSProperties = {
  width: "100%",
  maxWidth: 1360,
  margin: "0 auto",
  minHeight: 58,
  padding: "8px 24px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  boxSizing: "border-box",
  borderBottom: "1px solid #D9E7F0",
  background:
    "linear-gradient(100deg,#FFFFFF 0%,#F7FBFF 72%,#EDF6FF 100%)",
  fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
};

const brandLink: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 225,
  textDecoration: "none",
};

const brandMark: CSSProperties = {
  width: 34,
  height: 34,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flex: "0 0 34px",
  borderRadius: 9,
  background:
    "linear-gradient(145deg,#0B4E8A 0%,#0D5FA8 56%,#1680CF 100%)",
  color: "#FFFFFF",
  fontSize: 18,
  fontWeight: 900,
  boxShadow: "0 4px 12px rgba(13,95,168,.18)",
};

const brandName: CSSProperties = {
  color: "#0D4F91",
  fontSize: 15,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0.25,
  whiteSpace: "nowrap",
};

const brandTagline: CSSProperties = {
  marginTop: 4,
  color: "#7A8EA0",
  fontSize: 7.5,
  fontWeight: 700,
  letterSpacing: 0.15,
};

const staffIdentity: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#294760",
  fontSize: 15,
};

const staffDot: CSSProperties = {
  width: 8,
  height: 8,
  flex: "0 0 8px",
  borderRadius: "50%",
  background: "#1680CF",
  boxShadow: "0 0 0 3px #E5F2FD",
};

const staffNameBlock: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  textAlign: "right",
};

const staffMeta: CSSProperties = {
  color: "#6F8496",
  fontSize: 7,
  fontWeight: 800,
};

const staffActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
};

const logoutButton: CSSProperties = {
  border: "1px solid #BDD0DE",
  borderRadius: 7,
  padding: "6px 10px",
  background: "#FFFFFF",
  color: "#0D5FA8",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const mainNav: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 998,
  background:
    "linear-gradient(90deg,#083A6B 0%,#0B4E8A 48%,#1268B3 100%)",
  borderBottom: "1px solid #083F73",
  boxShadow: "0 4px 13px rgba(13,79,145,.14)",
  fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
};

const menuInner: CSSProperties = {
  width: "100%",
  maxWidth: 1360,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "7px 24px",
  overflow: "visible",
  boxSizing: "border-box",
};

const applicationShell: CSSProperties = {
  width: "100%",
  maxWidth: 1360,
  margin: "0 auto",
  boxSizing: "border-box",
};

const menuLink: CSSProperties = {
  flex: "0 0 auto",
  textDecoration: "none",
  color: "#EAF5FD",
  padding: "10px 15px",
  border: "1px solid transparent",
  borderRadius: 7,
  fontSize: 14,
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const activeMenuLink: CSSProperties = {
  background: "#FFFFFF",
  color: "#0D4F91",
  borderColor: "#FFFFFF",
  boxShadow: "0 2px 7px rgba(0,0,0,.10)",
};

const financeMenu: CSSProperties = {
  position: "relative",
  flex: "0 0 auto",
};

const financeMenuButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  fontFamily: "inherit",
  cursor: "pointer",
  background: "transparent",
};

const financeDropdown: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  zIndex: 1005,
  width: 320,
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  border: "1px solid #C7DCEB",
  borderRadius: 10,
  background: "#FFFFFF",
  boxShadow: "0 14px 34px rgba(8,58,107,.20)",
};

const financeDropdownLink: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "10px 12px",
  borderRadius: 7,
  color: "#123F69",
  textDecoration: "none",
  fontSize: 12,
};

const financeDropdownLinkActive: CSSProperties = {
  background: "#EAF4FF",
  color: "#0D4F91",
};

const financeShortcutLink: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  minHeight: 54,
  padding: "8px 10px",
  border: "1px solid #E1ECF4",
  borderRadius: 8,
  background: "#FFFFFF",
  color: "#123F69",
  textDecoration: "none",
  boxSizing: "border-box",
};

const financeShortcutIcon: CSSProperties = {
  width: 36,
  height: 36,
  flex: "0 0 36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  background: "#EAF4FF",
  color: "#0D5FA8",
  fontSize: 10,
  fontWeight: 900,
};

const financeShortcutCopy: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  fontSize: 12,
  lineHeight: 1.2,
};

const eodMenuLink: CSSProperties = {
  marginLeft: "auto",
  background: "rgba(255,255,255,.10)",
  borderColor: "rgba(255,255,255,.28)",
  color: "#FFFFFF",
};

const activeEodMenuLink: CSSProperties = {
  background: "#FFFFFF",
  color: "#0D4F91",
  borderColor: "#FFFFFF",
  boxShadow: "0 2px 7px rgba(0,0,0,.10)",
};
