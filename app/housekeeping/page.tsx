"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type Property = {
  id: string;
  name: string;
};

type Room = {
  id: string;
  property_id: string;
  room_number: string;
  room_name: string | null;
  housekeeping_status: string | null;
  operational_status: string;
};

export default function HousekeepingPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRoomId, setUpdatingRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    initialise();
  }, []);

  async function initialise() {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id,name")
        .order("name");

      if (error) throw new Error(error.message);

      const rows = (data as Property[]) ?? [];

      setProperties(rows);

      if (rows.length > 0) {
        setPropertyId(rows[0].id);
        await loadRooms(rows[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load housekeeping."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRooms(selectedPropertyId: string) {
    if (!selectedPropertyId) {
      setRooms([]);
      return;
    }

    const { data, error } = await supabase
      .from("rooms")
      .select(`
        id,
        property_id,
        room_number,
        room_name,
        housekeeping_status,
        operational_status
      `)
      .eq("property_id", selectedPropertyId)
      .order("room_number");

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRooms((data as Room[]) ?? []);
  }

  async function changeProperty(value: string) {
    setPropertyId(value);
    setMessage("");
    setErrorMessage("");
    await loadRooms(value);
  }

  async function setHousekeepingStatus(
    room: Room,
    status: "clean" | "dirty" | "cleaning"
  ) {
    if (room.operational_status !== "active") return;

    setUpdatingRoomId(room.id);
    setMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("rooms")
        .update({ housekeeping_status: status })
        .eq("id", room.id);

      if (error) throw new Error(error.message);

      setRooms((current) =>
        current.map((item) =>
          item.id === room.id
            ? { ...item, housekeeping_status: status }
            : item
        )
      );

      setMessage(
        `Room ${room.room_number} marked ${status}.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update room."
      );
    } finally {
      setUpdatingRoomId("");
    }
  }

  async function toggleOutOfService(room: Room) {
    const newStatus =
      room.operational_status === "active"
        ? "out_of_service"
        : "active";

    const confirmed = window.confirm(
      newStatus === "out_of_service"
        ? `Take Room ${room.room_number} out of service?`
        : `Return Room ${room.room_number} to service?`
    );

    if (!confirmed) return;

    setUpdatingRoomId(room.id);
    setMessage("");
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from("rooms")
        .update({ operational_status: newStatus })
        .eq("id", room.id);

      if (error) throw new Error(error.message);

      setRooms((current) =>
        current.map((item) =>
          item.id === room.id
            ? { ...item, operational_status: newStatus }
            : item
        )
      );

      setMessage(
        newStatus === "out_of_service"
          ? `Room ${room.room_number} taken out of service.`
          : `Room ${room.room_number} returned to service.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not update room."
      );
    } finally {
      setUpdatingRoomId("");
    }
  }

  function hkStatus(room: Room) {
    if (room.operational_status !== "active") {
      return "out";
    }

    const value = String(room.housekeeping_status ?? "")
      .toLowerCase()
      .trim();

    if (value === "dirty") return "dirty";
    if (value === "cleaning") return "cleaning";

    return "clean";
  }

  const cleanCount = useMemo(
    () => rooms.filter((r) => hkStatus(r) === "clean").length,
    [rooms]
  );

  const dirtyCount = useMemo(
    () => rooms.filter((r) => hkStatus(r) === "dirty").length,
    [rooms]
  );

  const cleaningCount = useMemo(
    () => rooms.filter((r) => hkStatus(r) === "cleaning").length,
    [rooms]
  );

  const outCount = useMemo(
    () => rooms.filter((r) => hkStatus(r) === "out").length,
    [rooms]
  );

  if (loading) {
    return (
      <main style={page}>
        <div style={emptyBox}>Loading housekeeping...</div>
      </main>
    );
  }

  return (
    <main style={page}>
      <section style={heading}>
        <div>
          <h1 style={title}>Housekeeping</h1>
          <div style={subtitle}>
            Room cleaning and operational status.
          </div>
        </div>

        <select
          value={propertyId}
          onChange={(event) =>
            changeProperty(event.target.value)
          }
          style={select}
        >
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </section>

      <section style={summaryGrid}>
        <Summary label="Clean" value={cleanCount} />
        <Summary label="Dirty" value={dirtyCount} />
        <Summary label="Cleaning" value={cleaningCount} />
        <Summary label="Out of Service" value={outCount} />
      </section>

      {message && <div style={successBox}>{message}</div>}
      {errorMessage && <div style={errorBox}>{errorMessage}</div>}

      {rooms.length === 0 ? (
        <div style={emptyBox}>
          No rooms found for this property.
        </div>
      ) : (
        <section style={roomGrid}>
          {rooms.map((room) => {
            const status = hkStatus(room);
            const updating = updatingRoomId === room.id;
            const out = status === "out";

            return (
              <article
                key={room.id}
                style={{
                  ...roomCard,
                  opacity: updating ? 0.6 : 1,
                }}
              >
                <div style={roomHeader}>
                  <div>
                    <div style={roomLabel}>ROOM</div>
                    <div style={roomNumber}>
                      {room.room_number}
                    </div>

                    {room.room_name && (
                      <div style={roomName}>
                        {room.room_name}
                      </div>
                    )}
                  </div>

                  <StatusBadge status={status} />
                </div>

                {!out && (
                  <div style={buttonGrid}>
                    <button
                      type="button"
                      disabled={updating}
                      onClick={() =>
                        setHousekeepingStatus(room, "dirty")
                      }
                      style={button}
                    >
                      Dirty
                    </button>

                    <button
                      type="button"
                      disabled={updating}
                      onClick={() =>
                        setHousekeepingStatus(room, "cleaning")
                      }
                      style={button}
                    >
                      Cleaning
                    </button>

                    <button
                      type="button"
                      disabled={updating}
                      onClick={() =>
                        setHousekeepingStatus(room, "clean")
                      }
                      style={primaryButton}
                    >
                      Clean
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={updating}
                  onClick={() => toggleOutOfService(room)}
                  style={outButton}
                >
                  {out ? "Return to Service" : "Out of Service"}
                </button>
              </article>
            );
          })}
        </section>
      )}

      <footer style={footer}>
        <span>Normal workflow: Dirty → Cleaning → Clean</span>

        <button
          type="button"
          onClick={() => router.push("/reservations")}
          style={finishButton}
        >
          Finish
        </button>
      </footer>
    </main>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={summaryCard}>
      <span style={summaryLabel}>{label}</span>
      <strong style={summaryValue}>{value}</strong>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "clean" | "dirty" | "cleaning" | "out";
}) {
  const text =
    status === "out"
      ? "OUT OF SERVICE"
      : status.toUpperCase();

  return (
    <span
      style={{
        ...badge,
        ...(status === "clean"
          ? cleanBadge
          : status === "dirty"
          ? dirtyBadge
          : status === "cleaning"
          ? cleaningBadge
          : outBadge),
      }}
    >
      {text}
    </span>
  );
}

const page: CSSProperties = {
  minHeight: "100vh",
  maxWidth: 1450,
  margin: "0 auto",
  padding: "18px 24px",
  background: "#F4F8FC",
  color: "#17324D",
  fontFamily: "Arial, sans-serif",
};

const heading: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16,
};

const title: CSSProperties = {
  margin: 0,
  color: "#0D4F91",
  fontSize: 28,
};

const subtitle: CSSProperties = {
  marginTop: 4,
  color: "#6F7D8C",
  fontSize: 12,
};

const select: CSSProperties = {
  width: 260,
  padding: "10px 12px",
  border: "1px solid #C7D6E3",
  borderRadius: 8,
  background: "#fff",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 10,
  marginBottom: 14,
};

const summaryCard: CSSProperties = {
  background: "#fff",
  border: "1px solid #D5E2ED",
  borderRadius: 10,
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const summaryLabel: CSSProperties = {
  color: "#557089",
  fontSize: 11,
  fontWeight: 800,
};

const summaryValue: CSSProperties = {
  color: "#0D5FA8",
  fontSize: 22,
};

const roomGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(245px,1fr))",
  gap: 12,
};

const roomCard: CSSProperties = {
  background: "#fff",
  border: "1px solid #D5E2ED",
  borderRadius: 10,
  padding: 14,
};

const roomHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const roomLabel: CSSProperties = {
  fontSize: 8,
  fontWeight: 800,
  color: "#7A8794",
};

const roomNumber: CSSProperties = {
  fontSize: 25,
  fontWeight: 900,
  color: "#0D4F91",
};

const roomName: CSSProperties = {
  marginTop: 3,
  fontSize: 10,
  color: "#6F7D8C",
};

const buttonGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: 6,
  marginTop: 14,
};

const button: CSSProperties = {
  padding: "9px 6px",
  background: "#fff",
  border: "1px solid #C7D6E3",
  borderRadius: 7,
  cursor: "pointer",
};

const primaryButton: CSSProperties = {
  ...button,
  background: "#168257",
  borderColor: "#168257",
  color: "#fff",
  fontWeight: 800,
};

const outButton: CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: "8px",
  border: "1px solid #D5E2ED",
  borderRadius: 7,
  background: "#F5F7F9",
  color: "#566573",
  cursor: "pointer",
};

const badge: CSSProperties = {
  display: "inline-block",
  padding: "5px 8px",
  borderRadius: 999,
  fontSize: 8,
  fontWeight: 900,
};

const cleanBadge: CSSProperties = {
  background: "#EAF7F0",
  color: "#168257",
};

const dirtyBadge: CSSProperties = {
  background: "#FFF0F0",
  color: "#A32626",
};

const cleaningBadge: CSSProperties = {
  background: "#FFF8DD",
  color: "#866D00",
};

const outBadge: CSSProperties = {
  background: "#EEF2F6",
  color: "#5F6D79",
};

const successBox: CSSProperties = {
  marginBottom: 10,
  padding: "9px 11px",
  borderRadius: 7,
  background: "#EAF7F0",
  color: "#168257",
};

const errorBox: CSSProperties = {
  marginBottom: 10,
  padding: "9px 11px",
  borderRadius: 7,
  background: "#FFF0F0",
  color: "#A32626",
};

const emptyBox: CSSProperties = {
  padding: 30,
  background: "#fff",
  border: "1px solid #D5E2ED",
  borderRadius: 10,
  textAlign: "center",
  color: "#6F7D8C",
};

const footer: CSSProperties = {
  marginTop: 16,
  paddingTop: 12,
  borderTop: "1px solid #D5E2ED",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#6F7D8C",
  fontSize: 10,
};

const finishButton: CSSProperties = {
  padding: "10px 18px",
  border: 0,
  borderRadius: 7,
  background: "#168257",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};