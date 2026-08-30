"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Property = {
  id: string;
  name: string;
};

type RoomType = {
  id: string;
  property_id: string;
  name: string;
};

type Room = {
  id: string;
  room_number: string;
  room_name: string | null;
  floor: string | null;
  operational_status: string;
  housekeeping_status: string;
  room_types: {
    name: string;
  } | null;
};

export default function RoomsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [propertyId, setPropertyId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomNumbers, setRoomNumbers] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [floor, setFloor] = useState("");
  const [roomName, setRoomName] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedRoomType = useMemo(
    () => roomTypes.find((x) => x.id === roomTypeId),
    [roomTypes, roomTypeId]
  );

  async function loadProperties() {
    const { data, error } = await supabase
      .from("properties")
      .select("id,name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setProperties(data ?? []);

    if (data && data.length > 0 && !propertyId) {
      setPropertyId(data[0].id);
    }
  }

  async function loadRoomTypes(id: string) {
    const { data, error } = await supabase
      .from("room_types")
      .select("id,property_id,name")
      .eq("property_id", id)
      .eq("is_active", true)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setRoomTypes(data ?? []);

    if (data && data.length > 0) {
      setRoomTypeId(data[0].id);
    } else {
      setRoomTypeId("");
    }
  }

  async function loadRooms(id: string) {
    const { data, error } = await supabase
      .from("rooms")
      .select(`
        id,
        room_number,
        room_name,
        floor,
        operational_status,
        housekeeping_status,
        room_types (
          name
        )
      `)
      .eq("property_id", id)
      .order("room_number");

    if (error) {
      alert(error.message);
      return;
    }

    setRooms((data as Room[]) ?? []);
  }

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (propertyId) {
      loadRoomTypes(propertyId);
      loadRooms(propertyId);
    }
  }, [propertyId]);

  async function saveRooms(e: React.FormEvent) {
    e.preventDefault();

    if (!propertyId || !roomTypeId || !roomNumbers.trim()) {
      alert("Please select a property, room type and enter room numbers.");
      return;
    }

    const parsedRooms = roomNumbers
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (parsedRooms.length === 0) {
      alert("Please enter at least one room number.");
      return;
    }

    const uniqueRooms = [...new Set(parsedRooms)];

    setSaving(true);

    const rows = uniqueRooms.map((roomNumber) => ({
      property_id: propertyId,
      room_type_id: roomTypeId,
      room_number: roomNumber,
      room_name: roomName.trim() || null,
      floor: floor.trim() || null,
      operational_status: "active",
      housekeeping_status: "clean",
    }));

    const { error } = await supabase.from("rooms").insert(rows);

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setRoomNumbers("");
    setRoomName("");
    setFloor("");
    setShowMore(false);

    await loadRooms(propertyId);
  }

  return (
    <main
      style={{
        maxWidth: 950,
        margin: "0 auto",
        padding: 32,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Room Setup</h1>
      <p>Add the physical rooms and assign them to a room type.</p>

      <form
        onSubmit={saveRooms}
        style={{
          border: "1px solid #ddd",
          borderRadius: 14,
          padding: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <div>
          <label>Property</label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            style={{ width: "100%", padding: 11, marginTop: 6 }}
          >
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Room Type</label>
          <select
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            style={{ width: "100%", padding: 11, marginTop: 6 }}
          >
            {roomTypes.map((roomType) => (
              <option key={roomType.id} value={roomType.id}>
                {roomType.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Room Numbers</label>
          <input
            value={roomNumbers}
            onChange={(e) => setRoomNumbers(e.target.value)}
            placeholder="Example: 01, 02, 03, 04, 05"
            style={{ width: "100%", padding: 11, marginTop: 6 }}
          />
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: "#666",
            }}
          >
            Separate multiple room numbers with commas.
          </div>
        </div>

        {selectedRoomType && (
          <div
            style={{
              background: "#f7f7f7",
              padding: 12,
              borderRadius: 8,
            }}
          >
            These rooms will be assigned as{" "}
            <strong>{selectedRoomType.name}</strong>.
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          style={{
            padding: 10,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {showMore ? "Hide More Options ▲" : "More Options ▼"}
        </button>

        {showMore && (
          <div
            style={{
              background: "#f7f7f7",
              padding: 16,
              borderRadius: 10,
              display: "grid",
              gap: 14,
            }}
          >
            <div>
              <label>Floor / Wing</label>
              <input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="Example: Ground Floor"
                style={{ width: "100%", padding: 11, marginTop: 6 }}
              />
            </div>

            <div>
              <label>Room Name</label>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Optional"
                style={{ width: "100%", padding: 11, marginTop: 6 }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {saving ? "Saving..." : "Add Rooms"}
        </button>
      </form>

      <h2 style={{ marginTop: 32 }}>Rooms</h2>

      <div
        style={{
          marginTop: 36,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ marginBottom: 4 }}>Configured Rooms</h2>
          <div style={{ color: "#666", fontSize: 14 }}>
            Physical room numbers and their assigned room types.
          </div>
        </div>

        <div
          style={{
            fontWeight: 700,
            background: "#f3f4f6",
            padding: "8px 12px",
            borderRadius: 8,
          }}
        >
          {rooms.length} Room{rooms.length === 1 ? "" : "s"}
        </div>
      </div>

      {rooms.length === 0 ? (
        <div
          style={{
            marginTop: 18,
            border: "1px dashed #ccc",
            borderRadius: 12,
            padding: 30,
            textAlign: "center",
            color: "#666",
          }}
        >
          No physical rooms have been configured for this property yet.
        </div>
      ) : (
        <div
          style={{
            marginTop: 18,
            border: "1px solid #ddd",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr 160px 160px",
              gap: 16,
              padding: "12px 16px",
              background: "#f5f5f5",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              color: "#666",
            }}
          >
            <div>Room Number</div>
            <div>Room Type</div>
            <div>Room Status</div>
            <div>Housekeeping</div>
          </div>

          {rooms.map((room) => (
            <div
              key={room.id}
              style={{
                display: "grid",
                gridTemplateColumns: "150px 1fr 160px 160px",
                gap: 16,
                alignItems: "center",
                padding: "16px",
                borderTop: "1px solid #eee",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                  }}
                >
                  Room {room.room_number}
                </div>

                {room.room_name && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginTop: 3,
                    }}
                  >
                    {room.room_name}
                  </div>
                )}
              </div>

              <div>
                <strong>{room.room_types?.[0]?.name ?? "Not assigned"}</strong>

                {room.floor && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginTop: 4,
                    }}
                  >
                    {room.floor}
                  </div>
                )}
              </div>

              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    borderRadius: 999,
                    background:
                      room.operational_status === "active"
                        ? "#dcfce7"
                        : "#fee2e2",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "capitalize",
                  }}
                >
                  {room.operational_status}
                </span>
              </div>

              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "6px 10px",
                    borderRadius: 999,
                    background:
                      room.housekeeping_status === "clean"
                        ? "#dcfce7"
                        : room.housekeeping_status === "dirty"
                        ? "#fee2e2"
                        : "#fef3c7",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "capitalize",
                  }}
                >
                  {room.housekeeping_status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}