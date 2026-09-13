"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { selectInitialProperty } from "@/src/lib/propertyScope";

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
  applies_monday: boolean;
  applies_tuesday: boolean;
  applies_wednesday: boolean;
  applies_thursday: boolean;
  applies_friday: boolean;
  applies_saturday: boolean;
  applies_sunday: boolean;
  room_rates: Array<{ room_type_id: string }>;
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

  const loadRoomTypes = useCallback(async (selectedPropertyId: string) => {
    const { data, error } = await supabase
      .from("room_types")
      .select("id,name")
      .eq("property_id", selectedPropertyId)
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    setRoomTypes(data ?? []);
  }, []);

  const loadRatePlans = useCallback(async (selectedPropertyId: string) => {
    const { data, error } = await supabase
      .from("rate_plans")
      .select(`
        id,
        name,
        start_date,
        end_date,
        priority,
        is_active,
        applies_monday,
        applies_tuesday,
        applies_wednesday,
        applies_thursday,
        applies_friday,
        applies_saturday,
        applies_sunday,
        room_rates (room_type_id)
      `)
      .eq("property_id", selectedPropertyId)
      .order("priority", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setRatePlans((data as RatePlan[]) ?? []);
  }, []);

  const loadProperties = useCallback(async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("id,name")
      .order("name");

    if (error) {
      alert(error.message);
      return;
    }

    const { scoped, selected } = selectInitialProperty((data as Property[]) ?? []);
    setProperties(scoped);
    setPropertyId(selected);
    if (selected) await Promise.all([loadRoomTypes(selected), loadRatePlans(selected)]);
  }, [loadRatePlans, loadRoomTypes]);

  useEffect(() => {
    // Load after the authenticated property scope is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProperties();
  }, [loadProperties]);

  async function changeProperty(selectedPropertyId: string) {
    setPropertyId(selectedPropertyId);
    setRoomTypeId("");
    setMessage("");
    if (!selectedPropertyId) { setRoomTypes([]); setRatePlans([]); return; }
    await Promise.all([loadRoomTypes(selectedPropertyId), loadRatePlans(selectedPropertyId)]);
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

    if (!Number.isInteger(minimumNights) || minimumNights < 1) {
      alert("Minimum nights must be a whole number of at least 1.");
      return;
    }

    if (!Number.isInteger(priority) || priority < 1) {
      alert("Priority must be a whole number of at least 1.");
      return;
    }

    const selectedDays = [monday, tuesday, wednesday, thursday, friday, saturday, sunday];
    const conflict = ratePlans.find((plan) => {
      const planDays = [plan.applies_monday, plan.applies_tuesday, plan.applies_wednesday, plan.applies_thursday, plan.applies_friday, plan.applies_saturday, plan.applies_sunday];
      return plan.is_active && plan.priority === priority && plan.room_rates.some((rate) => rate.room_type_id === roomTypeId) && dateRangesOverlap(startDate || null, endDate || null, plan.start_date, plan.end_date) && selectedDays.some((selected, index) => selected && planDays[index]);
    });
    if (conflict) {
      alert(`Rate conflict: ${conflict.name} already applies to this room type on overlapping dates/days at priority ${priority}. Change the priority, dates or weekdays so Netpos always has one winning rate.`);
      return;
    }

    setSaving(true);

    const dayCode = selectedDays.map((applies) => applies ? "1" : "0").join("");
    const planCode = `${planName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")}_${startDate || "ANY"}_${endDate || "ANY"}_${priority}_${dayCode}_${roomTypeId.slice(0, 8)}`;

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

    await loadRatePlans(propertyId);
  }

  async function toggleRatePlan(rate: RatePlan) {
    const nextActive = !rate.is_active;
    const reason = window.prompt(`${nextActive ? "Reason for reactivating" : "Reason for deactivating"} ${rate.name}:`);
    if (!reason?.trim()) return;
    if (!window.confirm(`${nextActive ? "Reactivate" : "Deactivate"} ${rate.name}? Existing reservations and historical prices will not be changed.`)) return;
    const { error } = await supabase.from("rate_plans").update({ is_active: nextActive }).eq("id", rate.id).eq("property_id", propertyId);
    if (error) { alert(error.message); return; }
    await supabase.from("audit_logs").insert({ property_id: propertyId, user_id: null, action: nextActive ? "rate_plan_reactivated" : "rate_plan_deactivated", entity_type: "rate_plan", entity_id: rate.id, old_values: { is_active: rate.is_active }, new_values: { is_active: nextActive }, reason: reason.trim() });
    setMessage(`${rate.name} ${nextActive ? "reactivated" : "deactivated"}. Existing reservations were not changed.`);
    await loadRatePlans(propertyId);
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
              onChange={(event) => void changeProperty(event.target.value)}
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
                  <div>Priority {rate.priority}</div>
                  <div style={{ marginTop: 4, color: rate.is_active ? "#168257" : "#8A4B32", fontWeight: 800 }}>{rate.is_active ? "ACTIVE" : "INACTIVE"}</div>
                  <button type="button" onClick={() => void toggleRatePlan(rate)} style={rateToggleButton}>{rate.is_active ? "Deactivate" : "Reactivate"}</button>
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
        value={value === 0 ? "" : String(value)}
        placeholder="0.00"
        onChange={(event) => {
          const text = event.target.value;

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

const rateToggleButton: React.CSSProperties = { marginTop: 7, padding: "5px 8px", border: "1px solid #B9C9D6", borderRadius: 6, background: "#FFFFFF", color: "#0D5FA8", fontSize: 9, fontWeight: 800, cursor: "pointer" };

function dateRangesOverlap(startA: string | null, endA: string | null, startB: string | null, endB: string | null) {
  const aStart = startA || "0001-01-01";
  const aEnd = endA || "9999-12-31";
  const bStart = startB || "0001-01-01";
  const bEnd = endB || "9999-12-31";
  return aStart <= bEnd && bStart <= aEnd;
}

const previewLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#666",
  marginBottom: 4,
};

const previewPrice: React.CSSProperties = {
  fontSize: 20,
};
