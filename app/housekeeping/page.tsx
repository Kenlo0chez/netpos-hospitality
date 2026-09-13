"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { selectInitialProperty } from "@/src/lib/propertyScope";

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
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadRooms = useCallback(async (selectedPropertyId: string) => {
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
  }, []);

  const initialise = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id,name")
        .order("name");

      if (error) throw new Error(error.message);

      const { scoped, selected } = selectInitialProperty((data as Property[]) ?? []);

      setProperties(scoped);

      if (selected) {
        setPropertyId(selected);
        await loadRooms(selected);
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
  }, [loadRooms]);

  useEffect(() => {
    // Data loading starts after the authenticated client session is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void initialise();
  }, [initialise]);

  async function changeProperty(value: string) {
    setPropertyId(value);
    setSelectedRoomIds([]);
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
      const previousStatus = hkStatus(room);
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
      await writeHousekeepingAudit([room], "housekeeping_status_changed", status, `Room marked ${status}`, previousStatus);
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

    if (newStatus === "out_of_service") {
      const { data: assignments, error: assignmentError } = await supabase
        .from("reservation_rooms")
        .select("reservation_id,reservations(status)")
        .eq("room_id", room.id);
      if (assignmentError) {
        setErrorMessage(`Could not verify room occupancy: ${assignmentError.message}`);
        return;
      }
      const occupied = ((assignments as unknown as Array<{ reservations: { status: string } | null }>) ?? [])
        .some((assignment) => assignment.reservations?.status === "checked_in");
      if (occupied) {
        setErrorMessage(`Room ${room.room_number} has a checked-in guest. Move or check out the guest before taking the room out of service.`);
        return;
      }
    }

    const reason = window.prompt(
      newStatus === "out_of_service"
        ? `Why is Room ${room.room_number} being taken out of service?`
        : `Why is Room ${room.room_number} being returned to service?`
    );
    if (!reason?.trim()) return;
    const confirmed = window.confirm(newStatus === "out_of_service" ? `Take Room ${room.room_number} out of service?` : `Return Room ${room.room_number} to service?`);
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
      await writeHousekeepingAudit([room], "room_service_status_changed", newStatus, reason.trim(), room.operational_status);
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

  async function writeHousekeepingAudit(
    changedRooms: Room[],
    action: string,
    newStatus: string,
    reason: string,
    sharedOldStatus?: string,
  ) {
    const records = changedRooms.map((room) => ({
      property_id: room.property_id,
      user_id: null,
      action,
      entity_type: "room",
      entity_id: room.id,
      old_values: { status: sharedOldStatus ?? hkStatus(room) },
      new_values: { status: newStatus },
      reason,
    }));
    const { error } = await supabase.from("audit_logs").insert(records);
    if (error) console.error("Housekeeping audit:", error.message);
  }

  async function applyBatchStatus(status: "clean" | "dirty" | "cleaning") {
    const selectedRooms = rooms.filter((room) => selectedRoomIds.includes(room.id) && room.operational_status === "active");
    if (!selectedRooms.length || batchUpdating) return;
    if (status === "clean" && !window.confirm(`Mark ${selectedRooms.length} selected room${selectedRooms.length === 1 ? "" : "s"} Clean?`)) return;

    setBatchUpdating(true);
    setMessage("");
    setErrorMessage("");
    const { error } = await supabase.from("rooms").update({ housekeeping_status: status }).in("id", selectedRooms.map((room) => room.id)).eq("property_id", propertyId).eq("operational_status", "active");
    if (error) {
      setErrorMessage(error.message);
    } else {
      setRooms((current) => current.map((room) => selectedRoomIds.includes(room.id) && room.operational_status === "active" ? { ...room, housekeeping_status: status } : room));
      await writeHousekeepingAudit(selectedRooms, "housekeeping_batch_status_changed", status, `${selectedRooms.length} rooms marked ${status} in housekeeping batch`);
      setMessage(`${selectedRooms.length} room${selectedRooms.length === 1 ? "" : "s"} marked ${status}.`);
      setSelectedRoomIds([]);
    }
    setBatchUpdating(false);
  }

  function toggleRoomSelection(roomId: string) {
    setSelectedRoomIds((current) => current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId]);
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

      <section style={batchBar}>
        <label style={selectAllLabel}><input type="checkbox" checked={rooms.some((room) => room.operational_status === "active") && selectedRoomIds.length === rooms.filter((room) => room.operational_status === "active").length} onChange={(event) => setSelectedRoomIds(event.target.checked ? rooms.filter((room) => room.operational_status === "active").map((room) => room.id) : [])} /> Select all active rooms</label>
        <strong>{selectedRoomIds.length} selected</strong>
        <button type="button" disabled={!selectedRoomIds.length || batchUpdating} onClick={() => void applyBatchStatus("dirty")} style={batchButton}>Mark Dirty</button>
        <button type="button" disabled={!selectedRoomIds.length || batchUpdating} onClick={() => void applyBatchStatus("cleaning")} style={batchButton}>Start Cleaning</button>
        <button type="button" disabled={!selectedRoomIds.length || batchUpdating} onClick={() => void applyBatchStatus("clean")} style={batchCleanButton}>Mark Clean</button>
      </section>

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
                    <label style={roomSelectLabel}><input type="checkbox" disabled={out} checked={selectedRoomIds.includes(room.id)} onChange={() => toggleRoomSelection(room.id)} /> Select</label>
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
        <span>Normal workflow: Dirty to Cleaning to Clean</span>

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
  maxWidth: 1600,
  margin: "0 auto",
  padding: "10px 16px 12px",
  background: "#F4F8FC",
  color: "#17324D",
  fontFamily: "Arial, sans-serif",
  boxSizing: "border-box",
};

const heading: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 9,
};

const title: CSSProperties = {
  margin: 0,
  color: "#0D4F91",
  fontSize: 23,
  lineHeight: 1.05,
};

const subtitle: CSSProperties = {
  marginTop: 2,
  color: "#6F7D8C",
  fontSize: 10,
};

const select: CSSProperties = {
  width: 245,
  padding: "8px 10px",
  border: "1px solid #C7D6E3",
  borderRadius: 7,
  background: "#fff",
  fontSize: 10,
  fontWeight: 700,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 7,
  marginBottom: 8,
};

const batchBar: CSSProperties = { display: "flex", alignItems: "center", gap: 8, minHeight: 38, marginBottom: 8, padding: "5px 8px", border: "1px solid #C9D9E5", borderRadius: 8, background: "#FFFFFF", color: "#456176", fontSize: 9, overflowX: "auto" };
const selectAllLabel: CSSProperties = { display: "flex", alignItems: "center", gap: 5, marginRight: "auto", whiteSpace: "nowrap", fontWeight: 800 };
const batchButton: CSSProperties = { minHeight: 27, padding: "4px 9px", border: "1px solid #B9CBD8", borderRadius: 5, background: "#F7FAFC", color: "#36546B", fontSize: 8, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" };
const batchCleanButton: CSSProperties = { ...batchButton, borderColor: "#168257", background: "#168257", color: "#FFFFFF" };

const summaryCard: CSSProperties = {
  minHeight: 42,
  background: "#fff",
  border: "1px solid #D5E2ED",
  borderRadius: 8,
  padding: "7px 10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  boxSizing: "border-box",
};

const summaryLabel: CSSProperties = {
  color: "#557089",
  fontSize: 9,
  fontWeight: 800,
};

const summaryValue: CSSProperties = {
  color: "#0D5FA8",
  fontSize: 18,
  lineHeight: 1,
};

const roomGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
  gap: 7,
  alignContent: "start",
};

const roomCard: CSSProperties = {
  minWidth: 0,
  background: "#fff",
  border: "1px solid #D5E2ED",
  borderRadius: 8,
  padding: "8px 9px",
};

const roomHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 6,
};

const roomLabel: CSSProperties = {
  fontSize: 7,
  fontWeight: 800,
  color: "#7A8794",
};

const roomSelectLabel: CSSProperties = { display: "flex", alignItems: "center", gap: 3, marginBottom: 4, color: "#6F7D8C", fontSize: 7, fontWeight: 800 };

const roomNumber: CSSProperties = {
  fontSize: 19,
  lineHeight: 1,
  fontWeight: 900,
  color: "#0D4F91",
};

const roomName: CSSProperties = {
  marginTop: 2,
  fontSize: 8,
  color: "#6F7D8C",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 120,
};

const buttonGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3,1fr)",
  gap: 4,
  marginTop: 7,
};

const button: CSSProperties = {
  minHeight: 26,
  padding: "4px 3px",
  background: "#fff",
  border: "1px solid #C7D6E3",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 8,
  lineHeight: 1,
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
  minHeight: 24,
  marginTop: 4,
  padding: "4px",
  border: "1px solid #D5E2ED",
  borderRadius: 5,
  background: "#F5F7F9",
  color: "#566573",
  cursor: "pointer",
  fontSize: 8,
  lineHeight: 1,
};

const badge: CSSProperties = {
  display: "inline-block",
  padding: "3px 6px",
  borderRadius: 999,
  fontSize: 7,
  fontWeight: 900,
  whiteSpace: "nowrap",
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
  marginBottom: 7,
  padding: "6px 9px",
  borderRadius: 6,
  background: "#EAF7F0",
  color: "#168257",
  fontSize: 9,
};

const errorBox: CSSProperties = {
  marginBottom: 7,
  padding: "6px 9px",
  borderRadius: 6,
  background: "#FFF0F0",
  color: "#A32626",
  fontSize: 9,
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
  marginTop: 7,
  paddingTop: 6,
  borderTop: "1px solid #D5E2ED",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#6F7D8C",
  fontSize: 8,
};

const finishButton: CSSProperties = {
  padding: "7px 13px",
  border: 0,
  borderRadius: 6,
  background: "#168257",
  color: "#fff",
  fontSize: 8,
  fontWeight: 800,
  cursor: "pointer",
};
