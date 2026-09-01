"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type ReservationRow = {
  id: string;
  property_id: string;
  guest_id: string;
  reservation_number: string;
  status: string;
  arrival_date: string;
  departure_date: string;
  total_amount: number;
};

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
};

type Payment = {
  reservation_id: string;
  transaction_type: string;
  amount: number;
};

type ReservationRoom = {
  reservation_id: string;
  room_id: string | null;
};

type Room = {
  id: string;
  room_number: string;
};

type Account = {
  reservation: ReservationRow;
  guestName: string;
  roomNumber: string;
  paid: number;
  balance: number;
};

export default function ReservationAccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const outstandingOnly = searchParams.get("filter") === "outstanding";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data: reservations, error: reservationError } = await supabase
        .from("reservations")
        .select(`
          id,
          property_id,
          guest_id,
          reservation_number,
          status,
          arrival_date,
          departure_date,
          total_amount
        `)
        .order("arrival_date", { ascending: false });

      if (reservationError) throw new Error(reservationError.message);

      const reservationRows = (reservations as ReservationRow[]) ?? [];
      if (reservationRows.length === 0) {
        setAccounts([]);
        return;
      }

      const reservationIds = reservationRows.map((item) => item.id);
      const guestIds = [...new Set(reservationRows.map((item) => item.guest_id))];

      const [
        { data: guests, error: guestError },
        { data: payments, error: paymentError },
        { data: reservationRooms, error: reservationRoomError },
      ] = await Promise.all([
        supabase
          .from("guests")
          .select("id,first_name,last_name")
          .in("id", guestIds),
        supabase
          .from("payments")
          .select("reservation_id,transaction_type,amount")
          .in("reservation_id", reservationIds),
        supabase
          .from("reservation_rooms")
          .select("reservation_id,room_id")
          .in("reservation_id", reservationIds),
      ]);

      if (guestError) throw new Error(guestError.message);
      if (paymentError) throw new Error(paymentError.message);
      if (reservationRoomError) throw new Error(reservationRoomError.message);

      const guestMap = new Map(
        ((guests as Guest[]) ?? []).map((item) => [
          item.id,
          `${item.first_name} ${item.last_name}`.trim(),
        ])
      );

      const paymentMap = new Map<string, number>();
      for (const payment of ((payments as Payment[]) ?? [])) {
        const current = paymentMap.get(payment.reservation_id) ?? 0;
        const amount = Number(payment.amount ?? 0);
        paymentMap.set(
          payment.reservation_id,
          current + (payment.transaction_type === "refund" ? -amount : amount)
        );
      }

      const roomByReservation = new Map<string, string>();
      const rr = (reservationRooms as ReservationRoom[]) ?? [];
      const roomIds = [...new Set(rr.map((item) => item.room_id).filter(Boolean))] as string[];

      if (roomIds.length > 0) {
        const { data: rooms, error: roomError } = await supabase
          .from("rooms")
          .select("id,room_number")
          .in("id", roomIds);

        if (roomError) throw new Error(roomError.message);

        const roomMap = new Map(
          ((rooms as Room[]) ?? []).map((item) => [item.id, item.room_number])
        );

        for (const item of rr) {
          if (item.room_id && !roomByReservation.has(item.reservation_id)) {
            roomByReservation.set(
              item.reservation_id,
              roomMap.get(item.room_id) ?? "-"
            );
          }
        }
      }

      setAccounts(
        reservationRows.map((reservation) => {
          const paid = paymentMap.get(reservation.id) ?? 0;
          return {
            reservation,
            guestName: guestMap.get(reservation.guest_id) ?? "Guest",
            roomNumber: roomByReservation.get(reservation.id) ?? "-",
            paid,
            balance: Number(reservation.total_amount ?? 0) - paid,
          };
        })
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not load reservation accounts."
      );
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return accounts.filter((account) => {
      if (outstandingOnly && account.balance <= 0.005) return false;
      if (
        statusFilter !== "all" &&
        account.reservation.status !== statusFilter
      ) return false;

      if (!term) return true;

      return [
        account.reservation.reservation_number,
        account.guestName,
        account.roomNumber,
        account.reservation.status,
      ].some((value) => String(value).toLowerCase().includes(term));
    });
  }, [accounts, outstandingOnly, search, statusFilter]);

  const totalCharges = filtered.reduce(
    (sum, item) => sum + Number(item.reservation.total_amount ?? 0),
    0
  );
  const totalPaid = filtered.reduce((sum, item) => sum + item.paid, 0);
  const totalOutstanding = filtered.reduce(
    (sum, item) => sum + Math.max(0, item.balance),
    0
  );

  return (
    <main style={page}>
      <section style={header}>
        <div>
          <div style={eyebrow}>BILLING · RESERVATION ACCOUNTS</div>
          <h1 style={title}>
            {outstandingOnly ? "Outstanding Accounts" : "Reservation Accounts"}
          </h1>
          <p style={muted}>
            Search guest folios, review balances and open the reservation account.
          </p>
        </div>

        <div style={headerActions}>
          <button onClick={() => router.push("/billing")} style={secondaryButton}>
            ← Billing
          </button>
          <button onClick={loadAccounts} style={primaryButton}>
            Refresh
          </button>
        </div>
      </section>

      <section style={summaryGrid}>
        <Summary label="Accounts" value={String(filtered.length)} />
        <Summary label="Total Charges" value={money(totalCharges)} />
        <Summary label="Total Payments" value={money(totalPaid)} positive />
        <Summary label="Outstanding" value={money(totalOutstanding)} emphasis />
      </section>

      <section style={workspace}>
        <div style={toolbar}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reservation, guest or room..."
            style={input}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={select}
          >
            <option value="all">All statuses</option>
            <option value="provisional">Provisional</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Checked In</option>
            <option value="checked_out">Checked Out</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No Show</option>
          </select>

          <button
            onClick={() =>
              router.push(
                outstandingOnly
                  ? "/billing/accounts"
                  : "/billing/accounts?filter=outstanding"
              )
            }
            style={filterButton}
          >
            {outstandingOnly ? "Show All Accounts" : "Outstanding Only"}
          </button>
        </div>

        {loading ? (
          <div style={stateBox}>Loading reservation accounts...</div>
        ) : errorMessage ? (
          <div style={errorBox}>{errorMessage}</div>
        ) : filtered.length === 0 ? (
          <div style={stateBox}>No accounts match the current filter.</div>
        ) : (
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Reservation</th>
                  <th style={th}>Guest</th>
                  <th style={th}>Room</th>
                  <th style={th}>Stay</th>
                  <th style={th}>Status</th>
                  <th style={thRight}>Charges</th>
                  <th style={thRight}>Paid</th>
                  <th style={thRight}>Outstanding</th>
                  <th style={thRight}>Account</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => (
                  <tr key={account.reservation.id}>
                    <td style={tdStrong}>{account.reservation.reservation_number}</td>
                    <td style={td}>{account.guestName}</td>
                    <td style={td}>
                      {account.roomNumber === "-" ? "-" : `Room ${account.roomNumber}`}
                    </td>
                    <td style={td}>
                      {friendlyDate(account.reservation.arrival_date)} →{" "}
                      {friendlyDate(account.reservation.departure_date)}
                    </td>
                    <td style={td}>
                      <span style={statusBadge}>
                        {formatStatus(account.reservation.status)}
                      </span>
                    </td>
                    <td style={tdRight}>
                      {money(account.reservation.total_amount)}
                    </td>
                    <td style={{ ...tdRight, color: "#168257", fontWeight: 800 }}>
                      {money(account.paid)}
                    </td>
                    <td
                      style={{
                        ...tdRight,
                        color: account.balance > 0.005 ? "#0D4F91" : "#168257",
                        fontWeight: 900,
                      }}
                    >
                      {money(Math.max(0, account.balance))}
                    </td>
                    <td style={tdRight}>
                      <button
                        onClick={() =>
                          router.push(`/reservations/${account.reservation.id}`)
                        }
                        style={openButton}
                      >
                        Open Folio →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Summary({
  label,
  value,
  positive = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        ...summaryCard,
        background: positive ? "#F0FAF5" : emphasis ? "#EEF6FF" : "#FFFFFF",
        borderColor: positive ? "#BCE1CE" : emphasis ? "#B8D6F1" : "#D4E1EC",
      }}
    >
      <span style={summaryLabel}>{label}</span>
      <strong
        style={{
          ...summaryValue,
          color: positive ? "#168257" : emphasis ? "#0D4F91" : "#173F67",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function money(value: number) {
  return `N$${Number(value ?? 0).toFixed(2)}`;
}

function friendlyDate(value: string) {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-NA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatStatus(value: string) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#F4F8FC",
  color: "#17324D",
  fontFamily: "Arial, sans-serif",
  padding: "14px 22px 28px",
};
const header: CSSProperties = {
  padding: "14px 16px",
  border: "1px solid #D4E1EC",
  borderRadius: 12,
  background: "#FFFFFF",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  boxShadow: "0 4px 14px rgba(15,72,122,.05)",
};
const eyebrow: CSSProperties = {
  color: "#0D5FA8",
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: 0.7,
};
const title: CSSProperties = { margin: "3px 0 0", color: "#0D3F7A", fontSize: 25 };
const muted: CSSProperties = { margin: "4px 0 0", color: "#6A7C90", fontSize: 9 };
const headerActions: CSSProperties = { display: "flex", gap: 7 };
const primaryButton: CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "9px 13px",
  background: "#0D5FA8",
  color: "#FFFFFF",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};
const secondaryButton: CSSProperties = {
  border: "1px solid #C8D8E5",
  borderRadius: 8,
  padding: "9px 13px",
  background: "#FFFFFF",
  color: "#0D4F91",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};
const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 9,
  marginTop: 10,
};
const summaryCard: CSSProperties = {
  border: "1px solid #D4E1EC",
  borderRadius: 10,
  padding: "10px 12px",
};
const summaryLabel: CSSProperties = {
  display: "block",
  color: "#72869A",
  fontSize: 7,
  fontWeight: 900,
  textTransform: "uppercase",
};
const summaryValue: CSSProperties = {
  display: "block",
  marginTop: 4,
  fontSize: 18,
};
const workspace: CSSProperties = {
  marginTop: 10,
  border: "1px solid #D4E1EC",
  borderRadius: 12,
  background: "#FFFFFF",
  overflow: "hidden",
};
const toolbar: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(240px,1fr) 180px auto",
  gap: 8,
  padding: 10,
  borderBottom: "1px solid #E1EAF1",
};
const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #C9D9E6",
  borderRadius: 7,
  padding: "8px 9px",
  fontSize: 9,
};
const select: CSSProperties = { ...input, background: "#FFFFFF" };
const filterButton: CSSProperties = {
  border: "1px solid #BBD2E4",
  borderRadius: 7,
  padding: "8px 11px",
  background: "#EEF6FD",
  color: "#0D4F91",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};
const tableWrap: CSSProperties = { overflowX: "auto" };
const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 8.5,
};
const th: CSSProperties = {
  padding: "8px 9px",
  textAlign: "left",
  color: "#6A7D90",
  fontSize: 7,
  letterSpacing: 0.35,
  borderBottom: "1px solid #DDE7EF",
  background: "#F8FBFD",
};
const thRight: CSSProperties = { ...th, textAlign: "right" };
const td: CSSProperties = {
  padding: "9px",
  borderBottom: "1px solid #EDF2F6",
  color: "#40586D",
  whiteSpace: "nowrap",
};
const tdStrong: CSSProperties = { ...td, color: "#0D4F91", fontWeight: 900 };
const tdRight: CSSProperties = { ...td, textAlign: "right" };
const statusBadge: CSSProperties = {
  display: "inline-block",
  padding: "3px 6px",
  borderRadius: 20,
  background: "#EEF5FB",
  color: "#355E82",
  fontSize: 7,
  fontWeight: 900,
};
const openButton: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#0D5FA8",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};
const stateBox: CSSProperties = {
  padding: 28,
  textAlign: "center",
  color: "#728397",
  fontSize: 9,
};
const errorBox: CSSProperties = {
  ...stateBox,
  color: "#A11A1A",
  background: "#FFF5F5",
};
