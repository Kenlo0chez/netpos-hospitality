"use client";

import {
  useEffect,
  useMemo,
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
    label: "Reports",
    href: "/reports",
    roles: ["owner", "manager"],
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
                      ? " � All Properties"
                      : staff.property_id
                      ? " � Assigned Property"
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
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  const isEod =
                    item.href === "/cash-up";

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

      {children}
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
  fontFamily: "Arial, sans-serif",
  background:
    "linear-gradient(135deg,#F4F9FD 0%,#FFFFFF 55%,#F1FAF6 100%)",
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
    "linear-gradient(145deg,#0D5FA8,#168257)",
  color: "#FFFFFF",
  fontSize: 23,
  fontWeight: 900,
  boxShadow: "0 5px 14px rgba(13,95,168,.20)",
};

const errorCard: CSSProperties = {
  ...loadingCard,
  color: "#9A2D2D",
  textAlign: "center",
};

const brandBar: CSSProperties = {
  minHeight: 54,
  padding: "7px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  boxSizing: "border-box",
  borderBottom: "1px solid #D9E7F0",
  background:
    "linear-gradient(100deg,#FFFFFF 0%,#F7FBFE 70%,#F2FAF6 100%)",
  fontFamily: "Arial, sans-serif",
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
    "linear-gradient(145deg,#0D5FA8 0%,#0E6EA6 55%,#168257 100%)",
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
  background: "#168257",
  boxShadow: "0 0 0 3px #E7F6EF",
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
    "linear-gradient(90deg,#0B4E8A 0%,#0D5FA8 68%,#0D668F 100%)",
  borderBottom: "1px solid #083F73",
  boxShadow: "0 4px 13px rgba(13,79,145,.14)",
  fontFamily: "Arial, sans-serif",
};

const menuInner: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 18px",
  overflowX: "auto",
  boxSizing: "border-box",
};

const menuLink: CSSProperties = {
  flex: "0 0 auto",
  textDecoration: "none",
  color: "#EAF5FD",
  padding: "11px 16px",
  border: "1px solid transparent",
  borderRadius: 7,
  fontSize: 15,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const activeMenuLink: CSSProperties = {
  background: "#FFFFFF",
  color: "#0D4F91",
  borderColor: "#FFFFFF",
  boxShadow: "0 2px 7px rgba(0,0,0,.10)",
};

const eodMenuLink: CSSProperties = {
  marginLeft: "auto",
  background: "rgba(22,130,87,.16)",
  borderColor: "rgba(198,240,219,.30)",
  color: "#F0FFF8",
};

const activeEodMenuLink: CSSProperties = {
  background: "#EAF8F1",
  color: "#126C49",
  borderColor: "#B8DFC9",
  boxShadow: "0 2px 7px rgba(0,0,0,.10)",
};
