"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Property = {
  id: string;
  name: string;
};

type RoomType = {
  id: string;
  property_id: string;
  name: string;
  code: string;
  base_rate: number;
  maximum_adults: number;
  maximum_children: number;
  maximum_occupancy: number;
};

const ROOM_TYPE_PRESETS = [
  "Single",
  "Standard",
  "Standard Double",
  "Double",
  "Twin",
  "Family",
  "Executive",
  "Deluxe",
  "Suite",
  "Self-Catering",
  "Dormitory",
  "Custom",
];

export default function RoomTypesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  const [propertyId, setPropertyId] = useState("");
  const [roomTypePreset, setRoomTypePreset] = useState("Standard");
  const [customName, setCustomName] = useState("");
  const [code, setCode] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [maxAdults, setMaxAdults] = useState("2");
  const [maxChildren, setMaxChildren] = useState("0");
  const [showMore, setShowMore] = useState(false);
  const [description, setDescription] = useState("");
  const [extraAdultRate, setExtraAdultRate] = useState("0");
  const [extraChildRate, setExtraChildRate] = useState("0");
  const [saving, setSaving] = useState(false);

  async function loadProperties() {
    const { data } = await supabase
      .from("properties")
      .select("id,name")
      .eq("is_active", true)
      .order("name");

    setProperties(data ?? []);

    if (data && data.length > 0 && !propertyId) {
      setPropertyId(data[0].id);
    }
  }

  async function loadRoomTypes(selectedPropertyId?: string) {
    const id = selectedPropertyId ?? propertyId;

    if (!id) return;

    const { data } = await supabase
      .from("room_types")
      .select(
        "id,property_id,name,code,base_rate,maximum_adults,maximum_children,maximum_occupancy"
      )
      .eq("property_id", id)
      .order("name");

    setRoomTypes(data ?? []);
  }

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    if (propertyId) {
      loadRoomTypes(propertyId);
    }
  }, [propertyId]);

  async function saveRoomType(e: React.FormEvent) {
    e.preventDefault();

    const finalName =
      roomTypePreset === "Custom" ? customName.trim() : roomTypePreset;

    if (!propertyId || !finalName || !code.trim() || !baseRate) {
      alert("Please complete the required fields.");
      return;
    }

    const adults = Number(maxAdults);
    const children = Number(maxChildren);

    setSaving(true);

    const { error } = await supabase.from("room_types").insert({
      property_id: propertyId,
      name: finalName,
      code: code.trim().toUpperCase(),
      description: description.trim() || null,
      base_rate: Number(baseRate),
      standard_occupancy: adults,
      maximum_adults: adults,
      maximum_children: children,
      maximum_occupancy: adults + children,
      extra_adult_rate: Number(extraAdultRate || 0),
      extra_child_rate: Number(extraChildRate || 0),
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setRoomTypePreset("Standard");
    setCustomName("");
    setCode("");
    setBaseRate("");
    setMaxAdults("2");
    setMaxChildren("0");
    setDescription("");
    setExtraAdultRate("0");
    setExtraChildRate("0");
    setShowMore(false);

    await loadRoomTypes();
  }

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 32,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Room Type Setup</h1>
      <p>Configure room categories and standard pricing.</p>

      <form
        onSubmit={saveRoomType}
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
            value={roomTypePreset}
            onChange={(e) => setRoomTypePreset(e.target.value)}
            style={{ width: "100%", padding: 11, marginTop: 6 }}
          >
            {ROOM_TYPE_PRESETS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {roomTypePreset === "Custom" && (
          <div>
            <label>Custom Room Type</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Example: Honeymoon Suite"
              style={{ width: "100%", padding: 11, marginTop: 6 }}
            />
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <label>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="STD"
              style={{ width: "100%", padding: 11, marginTop: 6 }}
            />
          </div>

          <div>
            <label>Base Rate / Night</label>
            <input
              type="number"
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              placeholder="850"
              style={{ width: "100%", padding: 11, marginTop: 6 }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div>
            <label>Max Adults</label>
            <select
              value={maxAdults}
              onChange={(e) => setMaxAdults(e.target.value)}
              style={{ width: "100%", padding: 11, marginTop: 6 }}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Max Children</label>
            <select
              value={maxChildren}
              onChange={(e) => setMaxChildren(e.target.value)}
              style={{ width: "100%", padding: 11, marginTop: 6 }}
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

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
              <label>Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                style={{ width: "100%", padding: 11, marginTop: 6 }}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label>Extra Adult Rate</label>
                <input
                  type="number"
                  value={extraAdultRate}
                  onChange={(e) => setExtraAdultRate(e.target.value)}
                  style={{ width: "100%", padding: 11, marginTop: 6 }}
                />
              </div>

              <div>
                <label>Extra Child Rate</label>
                <input
                  type="number"
                  value={extraChildRate}
                  onChange={(e) => setExtraChildRate(e.target.value)}
                  style={{ width: "100%", padding: 11, marginTop: 6 }}
                />
              </div>
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
          {saving ? "Saving..." : "Save Room Type"}
        </button>
      </form>

      <h2 style={{ marginTop: 32 }}>Configured Room Types</h2>

      {roomTypes.length === 0 ? (
        <p>No room types configured yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {roomTypes.map((roomType) => (
            <div
              key={roomType.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <strong>{roomType.name}</strong>
                <div style={{ color: "#666", marginTop: 4 }}>
                  {roomType.maximum_adults} Adults ·{" "}
                  {roomType.maximum_children} Children
                </div>
              </div>

              <strong>
                N$ {Number(roomType.base_rate).toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}