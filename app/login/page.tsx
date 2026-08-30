"use client";

import {
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: FormEvent) {
    event.preventDefault();

    const cleanUserId = normaliseUserId(userId);

    if (!cleanUserId) {
      setErrorMessage("Enter your User ID.");
      return;
    }

    if (!password) {
      setErrorMessage("Enter your password.");
      return;
    }

    setSigningIn(true);
    setErrorMessage("");

    try {
      const authEmail = buildAuthEmail(cleanUserId);

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });

      if (error) {
        throw new Error("Invalid User ID or password.");
      }

      if (!data.user) {
        throw new Error("Could not sign in.");
      }

      const { data: staff, error: staffError } =
        await supabase
          .from("staff_users")
          .select(`
            id,
            full_name,
            login_id,
            role,
            property_id,
            is_active,
            auth_user_id
          `)
          .eq("auth_user_id", data.user.id)
          .maybeSingle();

      if (staffError) {
        await supabase.auth.signOut();
        throw new Error(staffError.message);
      }

      if (!staff) {
        await supabase.auth.signOut();
        throw new Error(
          "This login is not linked to a Netpos staff user."
        );
      }

      if (!staff.is_active) {
        await supabase.auth.signOut();
        throw new Error(
          "This user account has been disabled."
        );
      }

      sessionStorage.setItem(
        "netpos_staff",
        JSON.stringify({
          id: staff.id,
          full_name: staff.full_name,
          login_id: staff.login_id,
          role: staff.role,
          property_id: staff.property_id,
        })
      );

      if (staff.role === "housekeeping") {
        router.replace("/housekeeping");
        return;
      }

      router.replace("/front-desk");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not sign in."
      );
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main style={page}>
      <section style={loginCard}>
        <div style={brandArea}>
          <div style={brandMark}>N</div>

          <div>
            <div style={brandName}>
              NETPOS HOSPITALITY
            </div>

            <div style={brandSub}>
              Property Management System
            </div>
          </div>
        </div>

        <div style={divider} />

        <div style={welcomeArea}>
          <div style={eyebrow}>
            SECURE STAFF ACCESS
          </div>

          <h1 style={title}>
            Sign In
          </h1>

          <p style={subtitle}>
            Enter your assigned User ID and password.
          </p>
        </div>

        {errorMessage && (
          <div style={errorBox}>
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleLogin}
          style={form}
        >
          <label style={label}>
            User ID
          </label>

          <input
            value={userId}
            onChange={(event) =>
              setUserId(event.target.value)
            }
            autoComplete="username"
            placeholder="e.g. JAKE"
            style={input}
            autoFocus
          />

          <label style={label}>
            Password
          </label>

          <div style={passwordWrap}>
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              autoComplete="current-password"
              placeholder="Enter password"
              style={passwordInput}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }
              style={showButton}
            >
              {showPassword
                ? "Hide"
                : "Show"}
            </button>
          </div>

          <button
            type="submit"
            disabled={signingIn}
            style={{
              ...loginButton,
              opacity:
                signingIn
                  ? 0.65
                  : 1,
            }}
          >
            {signingIn
              ? "Signing in..."
              : "Sign In"}
          </button>
        </form>

        <div style={securityBox}>
          Passwords are securely managed by Supabase Authentication.
          Netpos Hospitality does not store readable passwords.
        </div>

        <div style={footer}>
          NETPOS HOSPITALITY
        </div>
      </section>
    </main>
  );
}

function normaliseUserId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

function buildAuthEmail(userId: string) {
  return `${userId}@netpos.local`;
}

const page: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
  fontFamily: "Arial, sans-serif",
  background:
    "linear-gradient(135deg,#082F5F 0%,#0D4D91 48%,#176F68 100%)",
};

const loginCard: CSSProperties = {
  width: "min(430px,100%)",
  padding: 28,
  borderRadius: 16,
  background: "#fff",
  boxShadow:
    "0 24px 70px rgba(0,0,0,.28)",
};

const brandArea: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const brandMark: CSSProperties = {
  width: 50,
  height: 50,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  background: "#0D3F7A",
  color: "#fff",
  fontSize: 27,
  fontWeight: 900,
};

const brandName: CSSProperties = {
  color: "#0D3F7A",
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: 1.1,
};

const brandSub: CSSProperties = {
  marginTop: 2,
  color: "#718095",
  fontSize: 9,
};

const divider: CSSProperties = {
  height: 1,
  margin: "20px 0",
  background: "#E1E8EF",
};

const welcomeArea: CSSProperties = {
  marginBottom: 16,
};

const eyebrow: CSSProperties = {
  color: "#178A57",
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: 0.8,
};

const title: CSSProperties = {
  margin: "4px 0 2px",
  color: "#0D3F7A",
  fontSize: 28,
};

const subtitle: CSSProperties = {
  margin: 0,
  color: "#6F7D8C",
  fontSize: 10,
};

const form: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const label: CSSProperties = {
  marginTop: 10,
  marginBottom: 5,
  color: "#40546A",
  fontSize: 8,
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #AFC0D2",
  borderRadius: 8,
  outline: "none",
  color: "#17212B",
  fontSize: 11,
  background: "#fff",
};

const passwordWrap: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  border: "1px solid #AFC0D2",
  borderRadius: 8,
  overflow: "hidden",
  background: "#fff",
};

const passwordInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "11px 12px",
  border: 0,
  outline: "none",
  color: "#17212B",
  fontSize: 11,
};

const showButton: CSSProperties = {
  minWidth: 62,
  border: 0,
  borderLeft: "1px solid #D5DEE7",
  background: "#F7F9FC",
  color: "#1557A6",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const loginButton: CSSProperties = {
  marginTop: 18,
  width: "100%",
  padding: "11px 14px",
  border: 0,
  borderRadius: 8,
  background: "#178A57",
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  cursor: "pointer",
};

const errorBox: CSSProperties = {
  marginBottom: 8,
  padding: "9px 10px",
  border: "1px solid #E0AAAA",
  borderRadius: 7,
  background: "#FFF1F1",
  color: "#A11A1A",
  fontSize: 9,
};

const securityBox: CSSProperties = {
  marginTop: 16,
  padding: "9px 10px",
  border: "1px solid #C6D9EB",
  borderRadius: 8,
  background: "#F2F7FC",
  color: "#607187",
  fontSize: 8,
  lineHeight: 1.45,
};

const footer: CSSProperties = {
  marginTop: 18,
  textAlign: "center",
  color: "#8B99A8",
  fontSize: 7,
  fontWeight: 900,
  letterSpacing: 0.8,
};
