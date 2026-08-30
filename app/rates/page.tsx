"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Property = {
  id: string;
  name: string;
};

type RoomType = {
  id: string;
  name: string;
};

type RatePlan = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  is_active: boolean;
};

export default function RatesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);

  const [propertyId, setPropertyId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");

  const [planName, setPlanName] = useState("Normal Rate");

  const [singleRate, setSingleRate] = useState(700);
  const [doubleRate, setDoubleRate] = useState(800);
  const [extraAdultRate, setExtraAdultRate] = useState(0);
  const [extraChildRate, setExtraChildRate] = useState(0);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [minimumNights, setMinimumNights] = useState(1);
  const [priority, setPriority] = useState(10);

  const [monday, setMonday] = useState(true);
  const [tuesday, setTuesday] = useState(true);
  const [wednesday, setWednesday] = useState(true);
  const [thursday, setThursday] = useState(true);
  const [friday, setFriday] = useState(true);
  const [saturday, setSaturday] = useState(true);
  const [sunday, setSunday] = useState(true);

  const [showMore, setShowMore] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // =========================================================
  // INITIAL DATA
  // =========================================================

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    setRoomTypeId("");

    if (!propertyId) {
      setRoomTypes([]);
      setRatePlans([]);
      return;
    }

    loadRoomTypes();
    loadRatePlans();
  }, [propertyId]);

  async function loadProperties() {
    const { data, error } = await supabase
      .from("properties")
      .select("id,name")
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setProperties(data ?? []);

    if (data && data.length === 1) {
      setPropertyId(data[0].id);
    }
  }

  async function loadRoomTypes() {
    const { data, error } = await supabase
      .from("room_types")
      .select("id,name")
      .eq("property_id", propertyId)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setRoomTypes(data ?? []);
  }

  async function loadRatePlans() {
    const { data, error } = await supabase
      .from("rate_plans")
      .select(`
        id,
        name,
        start_date,
        end_date,
        priority,
        is_active
      `)
      .eq("property_id", propertyId)
      .order("priority", {
        ascending: false,
      });

    if (error) {
      alert(error.message);
      return;
    }

    setRatePlans(data ?? []);
  }

  // =========================================================
  // SAVE
  // =========================================================

  async function saveRate(event: React.FormEvent) {
    event.preventDefault();

    setMessage("");

    if (!propertyId) {
      alert("Please select a property.");
      return;
    }

    if (!roomTypeId) {
      alert("Please select a room type.");
      return;
    }

    if (!planName.trim()) {
      alert("Please select a rate plan.");
      return;
    }

    if (singleRate <= 0) {
      alert("Please enter a single occupancy rate.");
      return;
    }

    if (doubleRate <= 0) {
      alert("Please enter a double occupancy rate.");
      return;
    }

    if (
      startDate &&
      endDate &&
      endDate < startDate
    ) {
      alert(
        "End date cannot be before start date."
      );
      return;
    }

    if (
      !monday &&
      !tuesday &&
      !wednesday &&
      !thursday &&
      !friday &&
      !saturday &&
      !sunday
    ) {
      alert(
        "Please select at least one day."
      );
      return;
    }

    setSaving(true);

    const planCode = `${planName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")}_${Date.now()
      .toString()
      .slice(-6)}`;

    const { data: ratePlan, error: ratePlanError } =
      await supabase
        .from("rate_plans")
        .insert({
          property_id: propertyId,

          name: planName.trim(),
          code: planCode,

          start_date: startDate || null,
          end_date: endDate || null,

          applies_monday: monday,
          applies_tuesday: tuesday,
          applies_wednesday: wednesday,
          applies_thursday: thursday,
          applies_friday: friday,
          applies_saturday: saturday,
          applies_sunday: sunday,

          priority: Number(priority || 10),

          is_active: true,
        })
        .select("id")
        .single();

    if (ratePlanError || !ratePlan) {
      setSaving(false);

      alert(
        ratePlanError?.message ??
          "Could not create rate plan."
      );

      return;
    }

    const { error: roomRateError } = await supabase
      .from("room_rates")
      .insert({
        property_id: propertyId,

        rate_plan_id: ratePlan.id,
        room_type_id: roomTypeId,

        // Original database fallback
        nightly_rate: Number(singleRate),

        // New occupancy pricing
        single_occupancy_rate:
          Number(singleRate),

        double_occupancy_rate:
          Number(doubleRate),

        extra_adult_rate:
          Number(extraAdultRate || 0),

        extra_child_rate:
          Number(extraChildRate || 0),

        minimum_nights:
          Number(minimumNights || 1),

        is_active: true,
      });

    if (roomRateError) {
      await supabase
        .from("rate_plans")
        .delete()
        .eq("id", ratePlan.id);

      setSaving(false);

      alert(roomRateError.message);

      return;
    }

    setSaving(false);

    setMessage(
      `${planName} saved successfully.`
    );

    resetForm();

    await loadRatePlans();
  }

  function resetForm() {
    setPlanName("Normal Rate");

    setSingleRate(700);
    setDoubleRate(800);

    setExtraAdultRate(0);
    setExtraChildRate(0);

    setStartDate("");
    setEndDate("");

    setMinimumNights(1);
    setPriority(10);

    setMonday(true);
    setTuesday(true);
    setWednesday(true);
    setThursday(true);
    setFriday(true);
    setSaturday(true);
    setSunday(true);

    setShowMore(false);
  }

  // =========================================================
  // SCREEN
  // =========================================================

  return (
    <main
      style={{
        maxWidth: 900,
        margin: "0 auto",
        padding: 32,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 6 }}>
        Rate Setup
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: 24,
          color: "#666",
        }}
      >
        Configure occupancy pricing, seasonal rates
        and special offers.
      </p>

      {message && (
        <div style={successStyle}>
          ✓ {message}
        </div>
      )}

      <form
        onSubmit={saveRate}
        style={{
          border: "1px solid #ddd",
          borderRadius: 14,
          padding: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <div style={twoColumns}>
          <Field label="Property">
            <select
              value={propertyId}
              onChange={(event) =>
                setPropertyId(event.target.value)
              }
              style={inputStyle}
            >
              <option value="">
                Select Property
              </option>

              {properties.map((property) => (
                <option
                  key={property.id}
                  value={property.id}
                >
                  {property.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Room Type">
            <select
              value={roomTypeId}
              onChange={(event) =>
                setRoomTypeId(event.target.value)
              }
              disabled={!propertyId}
              style={inputStyle}
            >
              <option value="">
                Select Room Type
              </option>

              {roomTypes.map((roomType) => (
                <option
                  key={roomType.id}
                  value={roomType.id}
                >
                  {roomType.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Rate Plan">
          <select
            value={planName}
            onChange={(event) =>
              setPlanName(event.target.value)
            }
            style={inputStyle}
          >
            <option value="Normal Rate">
              Normal Rate
            </option>

            <option value="Weekend Special">
              Weekend Special
            </option>

            <option value="Corporate Rate">
              Corporate Rate
            </option>

            <option value="High Season">
              High Season
            </option>

            <option value="Low Season">
              Low Season
            </option>

            <option value="Festive Season">
              Festive Season
            </option>

            <option value="Special Promotion">
              Special Promotion
            </option>
          </select>
        </Field>

        <div
          style={{
            borderTop: "1px solid #eee",
            paddingTop: 18,
          }}
        >
          <h2
            style={{
              fontSize: 17,
              marginTop: 0,
              marginBottom: 16,
            }}
          >
            Occupancy Pricing
          </h2>

          <div style={twoColumns}>
            <Field label="1 Adult">
              <MoneyInput
                value={singleRate}
                setValue={setSingleRate}
              />
            </Field>

            <Field label="2 Adults">
              <MoneyInput
                value={doubleRate}
                setValue={setDoubleRate}
              />
            </Field>
          </div>

          <div
            style={{
              ...twoColumns,
              marginTop: 16,
            }}
          >
            <Field label="Extra Adult">
              <MoneyInput
                value={extraAdultRate}
                setValue={setExtraAdultRate}
              />
            </Field>

            <Field label="Extra Child">
              <MoneyInput
                value={extraChildRate}
                setValue={setExtraChildRate}
              />
            </Field>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowMore((current) => !current)
          }
          style={{
            padding: 11,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          {showMore
            ? "Hide More Options ▲"
            : "More Options ▼"}
        </button>

        {showMore && (
          <div
            style={{
              padding: 18,
              borderRadius: 10,
              background: "#f7f7f7",
              display: "grid",
              gap: 18,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 15,
                  marginTop: 0,
                  marginBottom: 12,
                }}
              >
                Effective Dates
              </h3>

              <div style={twoColumns}>
                <Field label="Start Date">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) =>
                      setStartDate(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="End Date">
                  <input
                    type="date"
                    min={startDate || undefined}
                    value={endDate}
                    onChange={(event) =>
                      setEndDate(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>

              <p
                style={{
                  fontSize: 12,
                  color: "#666",
                  marginBottom: 0,
                }}
              >
                Leave dates blank for a permanent
                rate.
              </p>
            </div>

            <div>
              <h3
                style={{
                  fontSize: 15,
                  marginBottom: 12,
                }}
              >
                Days This Rate Applies
              </h3>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 14,
                }}
              >
                <DayCheckbox
                  label="Mon"
                  checked={monday}
                  setChecked={setMonday}
                />

                <DayCheckbox
                  label="Tue"
                  checked={tuesday}
                  setChecked={setTuesday}
                />

                <DayCheckbox
                  label="Wed"
                  checked={wednesday}
                  setChecked={setWednesday}
                />

                <DayCheckbox
                  label="Thu"
                  checked={thursday}
                  setChecked={setThursday}
                />

                <DayCheckbox
                  label="Fri"
                  checked={friday}
                  setChecked={setFriday}
                />

                <DayCheckbox
                  label="Sat"
                  checked={saturday}
                  setChecked={setSaturday}
                />

                <DayCheckbox
                  label="Sun"
                  checked={sunday}
                  setChecked={setSunday}
                />
              </div>
            </div>

            <div style={twoColumns}>
              <Field label="Minimum Nights">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={minimumNights}
                  onChange={(event) =>
                    setMinimumNights(
                      Number(event.target.value)
                    )
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Priority">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      Number(event.target.value)
                    )
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#666",
              }}
            >
              Higher priority pricing wins when more
              than one rate applies to the same night.
            </div>
          </div>
        )}

        <div
          style={{
            background: "#f5f5f5",
            padding: 18,
            borderRadius: 10,
          }}
        >
          <strong>Pricing Preview</strong>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginTop: 12,
            }}
          >
            <div>
              <span style={previewLabel}>
                1 Adult
              </span>

              <strong style={previewPrice}>
                N${singleRate.toFixed(2)}
              </strong>
            </div>

            <div>
              <span style={previewLabel}>
                2 Adults
              </span>

              <strong style={previewPrice}>
                N${doubleRate.toFixed(2)}
              </strong>
            </div>
          </div>

          {(extraAdultRate > 0 ||
            extraChildRate > 0) && (
            <div
              style={{
                borderTop: "1px solid #ddd",
                marginTop: 14,
                paddingTop: 12,
                fontSize: 13,
              }}
            >
              {extraAdultRate > 0 && (
                <div>
                  Extra Adult:{" "}
                  <strong>
                    N${extraAdultRate.toFixed(2)}
                  </strong>
                </div>
              )}

              {extraChildRate > 0 && (
                <div style={{ marginTop: 4 }}>
                  Extra Child:{" "}
                  <strong>
                    N${extraChildRate.toFixed(2)}
                  </strong>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: 14,
            border: 0,
            borderRadius: 9,
            background: saving ? "#ccc" : "#111",
            color: saving ? "#666" : "white",
            fontSize: 15,
            fontWeight: 800,
            cursor: saving
              ? "not-allowed"
              : "pointer",
          }}
        >
          {saving
            ? "Saving Rate..."
            : "Save Rate"}
        </button>
      </form>

      <section style={{ marginTop: 34 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 20,
              }}
            >
              Configured Rate Plans
            </h2>

            <p
              style={{
                marginTop: 4,
                marginBottom: 0,
                color: "#666",
                fontSize: 14,
              }}
            >
              Pricing rules configured for this
              property.
            </p>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 20,
              padding: "6px 11px",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {ratePlans.length}{" "}
            {ratePlans.length === 1
              ? "Plan"
              : "Plans"}
          </div>
        </div>

        {ratePlans.length === 0 ? (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 18,
              color: "#666",
            }}
          >
            No rate plans configured yet.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {ratePlans.map((rate) => (
              <div
                key={rate.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  padding: 15,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{rate.name}</strong>

                  <div
                    style={{
                      color: "#666",
                      fontSize: 13,
                      marginTop: 5,
                    }}
                  >
                    {rate.start_date ||
                    rate.end_date
                      ? `${
                          rate.start_date ??
                          "Any date"
                        } → ${
                          rate.end_date ??
                          "Any date"
                        }`
                      : "Permanent / no date restriction"}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                    textAlign: "right",
                  }}
                >
                  Priority {rate.priority}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <label
        style={{
          display: "block",
          fontSize: 14,
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function MoneyInput({
  value,
  setValue,
}: {
  value: number;
  setValue: (value: number) => void;
}) {
  const [textValue, setTextValue] = useState(
    value === 0 ? "" : String(value)
  );

  useEffect(() => {
    setTextValue(
      value === 0 ? "" : String(value)
    );
  }, [value]);

  return (
    <div
      style={{
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 12,
          top: 12,
          color: "#666",
          fontSize: 14,
          pointerEvents: "none",
        }}
      >
        N$
      </span>

      <input
        type="number"
        min="0"
        step="0.01"
        value={textValue}
        placeholder="0.00"
        onChange={(event) => {
          const text = event.target.value;

          setTextValue(text);

          if (text === "") {
            setValue(0);
          } else {
            setValue(Number(text));
          }
        }}
        onFocus={(event) =>
          event.currentTarget.select()
        }
        style={{
          ...inputStyle,
          paddingLeft: 37,
        }}
      />
    </div>
  );
}

function DayCheckbox({
  label,
  checked,
  setChecked,
}: {
  label: string;
  checked: boolean;
  setChecked: (value: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          setChecked(event.target.checked)
        }
      />

      {label}
    </label>
  );
}

// =========================================================
// STYLES
// =========================================================

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 15,
  background: "white",
};

const twoColumns: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const successStyle: React.CSSProperties = {
  background: "#eaf7ee",
  border: "1px solid #9ad5a8",
  color: "#176b2c",
  padding: 14,
  borderRadius: 10,
  marginBottom: 20,
  fontWeight: 700,
};

const previewLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#666",
  marginBottom: 4,
};

const previewPrice: React.CSSProperties = {
  fontSize: 20,
};