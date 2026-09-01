"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type Property = {
  id: string;
  name: string;
  code: string | null;
  town: string | null;
  phone: string | null;
  email: string | null;
  vat_number: string | null;
  vat_rate: number | null;
};

type RoomType = {
  id: string;
  property_id: string;
  name: string;
  base_rate: number | null;
};

type Room = {
  id: string;
  property_id: string;
  room_type_id: string;
  room_number: string;
  room_name: string | null;
  operational_status: string;
};

type RatePlan = {
  id: string;
  property_id: string;
  name: string;
  is_active: boolean;
};

type RoomRate = {
  id: string;
  property_id: string;
  room_type_id: string;
  rate_plan_id: string;
  nightly_rate: number;
  single_occupancy_rate: number | null;
  double_occupancy_rate: number | null;
  extra_adult_rate: number | null;
  extra_child_rate: number | null;
  minimum_nights: number | null;
  is_active: boolean;
};

type Tab = "property" | "types" | "rooms" | "rates";

export default function SetupPage() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("property");
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomRates, setRoomRates] = useState<RoomRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [propertyName, setPropertyName] = useState("");
  const [propertyCode, setPropertyCode] = useState("");
  const [town, setTown] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [vatRate, setVatRate] = useState(15);

  const [newRoomTypeName, setNewRoomTypeName] = useState("");
  const [newRoomTypeRate, setNewRoomTypeRate] = useState(0);

  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomTypeId, setNewRoomTypeId] = useState("");

  const [rateRoomTypeId, setRateRoomTypeId] = useState("");
  const [nightlyRate, setNightlyRate] = useState(0);
  const [singleRate, setSingleRate] = useState(0);
  const [doubleRate, setDoubleRate] = useState(0);
  const [extraAdultRate, setExtraAdultRate] = useState(0);
  const [extraChildRate, setExtraChildRate] = useState(0);
  const [minimumNights, setMinimumNights] = useState(1);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === propertyId) ?? null,
    [properties, propertyId]
  );

  useEffect(() => {
    initialise();
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    loadPropertyWorkspace(propertyId);

    const property = properties.find((item) => item.id === propertyId);
    if (property) populatePropertyForm(property);
  }, [propertyId]);

  async function initialise() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("properties")
      .select("id,name,code,town,phone,email,vat_number,vat_rate")
      .order("name");

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data as Property[]) ?? [];
    setProperties(rows);

    if (rows[0]) {
      setPropertyId(rows[0].id);
      populatePropertyForm(rows[0]);
      await loadPropertyWorkspace(rows[0].id);
    }

    setLoading(false);
  }

  function populatePropertyForm(property: Property) {
    setPropertyName(property.name ?? "");
    setPropertyCode(property.code ?? "");
    setTown(property.town ?? "");
    setPhone(property.phone ?? "");
    setEmail(property.email ?? "");
    setVatNumber(property.vat_number ?? "");
    setVatRate(Number(property.vat_rate ?? 15));
  }

  async function loadPropertyWorkspace(id: string) {
    setErrorMessage("");

    const [typeResult, roomResult, planResult, rateResult] = await Promise.all([
      supabase
        .from("room_types")
        .select("id,property_id,name,base_rate")
        .eq("property_id", id)
        .order("name"),
      supabase
        .from("rooms")
        .select("id,property_id,room_type_id,room_number,room_name,operational_status")
        .eq("property_id", id)
        .order("room_number"),
      supabase
        .from("rate_plans")
        .select("id,property_id,name,is_active")
        .eq("property_id", id)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("room_rates")
        .select("id,property_id,room_type_id,rate_plan_id,nightly_rate,single_occupancy_rate,double_occupancy_rate,extra_adult_rate,extra_child_rate,minimum_nights,is_active")
        .eq("property_id", id)
        .order("room_type_id"),
    ]);

    if (typeResult.error) return setErrorMessage(typeResult.error.message);
    if (roomResult.error) return setErrorMessage(roomResult.error.message);
    if (planResult.error) return setErrorMessage(planResult.error.message);
    if (rateResult.error) return setErrorMessage(rateResult.error.message);

    const typeRows = (typeResult.data as RoomType[]) ?? [];
    setRoomTypes(typeRows);
    setRooms((roomResult.data as Room[]) ?? []);
    setRatePlans((planResult.data as RatePlan[]) ?? []);
    setRoomRates((rateResult.data as RoomRate[]) ?? []);

    if (typeRows[0]) {
      setNewRoomTypeId(typeRows[0].id);
      setRateRoomTypeId(typeRows[0].id);
    }
  }

  async function ensureStandardRatePlan() {
    if (!propertyId) throw new Error("Select a property first.");
    if (ratePlans[0]) return ratePlans[0].id;

    const { data, error } = await supabase
      .from("rate_plans")
      .insert({
        property_id: propertyId,
        name: "Standard Rate",
        code: "STANDARD",
        applies_monday: true,
        applies_tuesday: true,
        applies_wednesday: true,
        applies_thursday: true,
        applies_friday: true,
        applies_saturday: true,
        applies_sunday: true,
        priority: 1,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data.id as string;
  }

  function clearPropertyForm() {
    setPropertyName("");
    setPropertyCode("");
    setTown("");
    setPhone("");
    setEmail("");
    setVatNumber("");
    setVatRate(15);
  }

  function startNewProperty() {
    setMessage("");
    setErrorMessage("");
    setIsCreatingProperty(true);
    setPropertyId("");
    setTab("property");
    setRoomTypes([]);
    setRooms([]);
    setRatePlans([]);
    setRoomRates([]);
    clearPropertyForm();
  }

  async function cancelNewProperty() {
    setIsCreatingProperty(false);
    setMessage("");
    setErrorMessage("");

    if (properties[0]) {
      setPropertyId(properties[0].id);
      populatePropertyForm(properties[0]);
      await loadPropertyWorkspace(properties[0].id);
    } else {
      clearPropertyForm();
    }
  }

  async function saveProperty(event: FormEvent) {
    event.preventDefault();

    if (!propertyName.trim()) {
      setErrorMessage("Property name is required.");
      return;
    }

    if (!propertyCode.trim()) {
      setErrorMessage("Property code is required.");
      return;
    }

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    const payload = {
      name: propertyName.trim(),
      code: propertyCode.trim().toUpperCase(),
      town: town.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      vat_number: vatNumber.trim() || null,
      vat_rate: vatRate,
    };

    if (isCreatingProperty) {
      const { data, error } = await supabase
        .from("properties")
        .insert(payload)
        .select("id")
        .single();

      setSaving(false);

      if (error) {
        if (error.code === "23505") {
          setErrorMessage("That property code is already in use. Choose another code.");
          return;
        }

        setErrorMessage(error.message);
        return;
      }

      setIsCreatingProperty(false);
      setMessage("Property / guest house created successfully.");
      await initialise();
      setPropertyId(data.id as string);
      return;
    }

    if (!propertyId) {
      setSaving(false);
      setErrorMessage("Select a property first.");
      return;
    }

    const { error } = await supabase
      .from("properties")
      .update(payload)
      .eq("id", propertyId);

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        setErrorMessage("That property code is already in use. Choose another code.");
        return;
      }

      setErrorMessage(error.message);
      return;
    }

    setMessage("Property details saved.");
    await initialise();
    setPropertyId(propertyId);
  }

  async function addRoomType(event: FormEvent) {
    event.preventDefault();

    if (!propertyId || !newRoomTypeName.trim()) return;

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    const baseCode =
      newRoomTypeName
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "ROOM";

    try {
      let roomTypeCode = baseCode;
      let suffix = 2;

      while (true) {
        const { data: existing, error: lookupError } = await supabase
          .from("room_types")
          .select("id")
          .eq("property_id", propertyId)
          .eq("code", roomTypeCode)
          .maybeSingle();

        if (lookupError) throw new Error(lookupError.message);
        if (!existing) break;

        roomTypeCode = `${baseCode}-${suffix}`;
        suffix += 1;
      }

      const { error } = await supabase.from("room_types").insert({
        property_id: propertyId,
        name: newRoomTypeName.trim(),
        code: roomTypeCode,
        base_rate: newRoomTypeRate,
      });

      if (error) throw new Error(error.message);

      setNewRoomTypeName("");
      setNewRoomTypeRate(0);
      setMessage("Room type added.");
      await loadPropertyWorkspace(propertyId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not add room type."
      );
    } finally {
      setSaving(false);
    }
  }

  async function addRoom(event: FormEvent) {
    event.preventDefault();

    if (!propertyId || !newRoomNumber.trim() || !newRoomTypeId) return;

    setSaving(true);
    setErrorMessage("");

    const { error } = await supabase.from("rooms").insert({
      property_id: propertyId,
      room_type_id: newRoomTypeId,
      room_number: newRoomNumber.trim(),
      room_name: newRoomName.trim() || null,
      operational_status: "active",
      housekeeping_status: "clean",
    });

    setSaving(false);

    if (error) return setErrorMessage(error.message);

    setNewRoomNumber("");
    setNewRoomName("");
    setMessage("Physical room added.");
    await loadPropertyWorkspace(propertyId);
  }

  async function addRate(event: FormEvent) {
    event.preventDefault();

    if (!propertyId || !rateRoomTypeId) return;

    setSaving(true);
    setErrorMessage("");

    try {
      const ratePlanId = await ensureStandardRatePlan();

      const { error } = await supabase.from("room_rates").insert({
        property_id: propertyId,
        room_type_id: rateRoomTypeId,
        rate_plan_id: ratePlanId,
        nightly_rate: nightlyRate,
        single_occupancy_rate: singleRate,
        double_occupancy_rate: doubleRate,
        extra_adult_rate: extraAdultRate,
        extra_child_rate: extraChildRate,
        minimum_nights: minimumNights,
        is_active: true,
      });

      if (error) throw new Error(error.message);

      setMessage("Rate added.");
      await loadPropertyWorkspace(propertyId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not save rate."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={page}>
        <div style={loadingCard}>Loading Setup...</div>
      </main>
    );
  }

  return (
    <main style={page}>
      <section style={headingRow}>
        <div>
          <div style={eyebrow}>SYSTEM CONFIGURATION</div>
          <h1 style={title}>Setup</h1>
          <p style={subtitle}>
            Property, room types, physical rooms and accommodation rates.
          </p>
        </div>

        <div style={headingActions}>
          <select
            value={propertyId}
            onChange={(event) => {
              setIsCreatingProperty(false);
              setPropertyId(event.target.value);
            }}
            style={propertySelect}
            disabled={isCreatingProperty || properties.length === 0}
          >
            {properties.length === 0 && <option value="">No properties configured</option>}
            {isCreatingProperty && <option value="">New property / guest house</option>}
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={startNewProperty}
            style={addPropertyButton}
            disabled={saving}
          >
            + Add Property
          </button>

          <button
            type="button"
            onClick={() => router.push("/users")}
            style={secondaryButton}
          >
            Users & Permissions
          </button>
        </div>
      </section>

      <div style={tabs}>
        <TabButton active={tab === "property"} onClick={() => setTab("property")}>
          Property
        </TabButton>
        <TabButton
          active={tab === "types"}
          onClick={() => setTab("types")}
          disabled={!propertyId || isCreatingProperty}
        >
          Room Types
        </TabButton>
        <TabButton
          active={tab === "rooms"}
          onClick={() => setTab("rooms")}
          disabled={!propertyId || isCreatingProperty}
        >
          Physical Rooms
        </TabButton>
        <TabButton
          active={tab === "rates"}
          onClick={() => setTab("rates")}
          disabled={!propertyId || isCreatingProperty}
        >
          Rates
        </TabButton>
      </div>

      {message && <div style={successBox}>✓ {message}</div>}
      {errorMessage && <div style={errorBox}>{errorMessage}</div>}

      {tab === "property" && (
        <section style={card}>
          <SectionTitle
            title={isCreatingProperty ? "Add Property / Guest House" : "Property Details"}
            subtitle={
              isCreatingProperty
                ? "Create another property under central Netpos Hospitality control"
                : selectedProperty?.name ?? ""
            }
          />

          <form onSubmit={saveProperty} style={formGrid}>
            <Field label="Property Name *">
              <input
                value={propertyName}
                onChange={(event) => setPropertyName(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Property Code *">
              <input
                value={propertyCode}
                onChange={(event) => setPropertyCode(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Town">
              <input
                value={town}
                onChange={(event) => setTown(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Phone">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Email">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="VAT Number">
              <input
                value={vatNumber}
                onChange={(event) => setVatNumber(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="VAT Rate %">
              <input
                type="number"
                value={vatRate}
                onChange={(event) => setVatRate(Number(event.target.value))}
                style={input}
              />
            </Field>

            <div style={formActions}>
              {isCreatingProperty && (
                <button
                  type="button"
                  onClick={cancelNewProperty}
                  disabled={saving}
                  style={cancelButton}
                >
                  Cancel
                </button>
              )}
              <button disabled={saving} style={primaryButton}>
                {saving
                  ? "Saving..."
                  : isCreatingProperty
                    ? "Create Property"
                    : "Save Property"}
              </button>
            </div>
          </form>
        </section>
      )}

      {tab === "types" && (
        <section style={twoColumn}>
          <div style={card}>
            <SectionTitle
              title="Room Types"
              subtitle="Configured accommodation categories"
            />

            {roomTypes.length === 0 ? (
              <div style={emptyState}>No room types configured.</div>
            ) : (
              roomTypes.map((type) => (
                <div key={type.id} style={listRow}>
                  <strong>{type.name}</strong>
                  <span>N${Number(type.base_rate ?? 0).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addRoomType} style={card}>
            <SectionTitle
              title="Add Room Type"
              subtitle="Create a new sellable room category"
            />

            <Field label="Room Type Name">
              <input
                value={newRoomTypeName}
                onChange={(event) => setNewRoomTypeName(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Base Rate">
              <input
                type="number"
                step="0.01"
                value={newRoomTypeRate}
                onChange={(event) => setNewRoomTypeRate(Number(event.target.value))}
                style={input}
              />
            </Field>

            <button disabled={saving} style={primaryButton}>
              + Add Room Type
            </button>
          </form>
        </section>
      )}

      {tab === "rooms" && (
        <section style={twoColumn}>
          <div style={card}>
            <SectionTitle
              title="Physical Rooms"
              subtitle="Actual rooms available to allocate"
            />

            {rooms.length === 0 ? (
              <div style={emptyState}>No physical rooms configured.</div>
            ) : (
              rooms.map((room) => (
                <div key={room.id} style={listRow}>
                  <div>
                    <strong>Room {room.room_number}</strong>
                    <div style={smallText}>{room.room_name || "No room name"}</div>
                  </div>

                  <span>
                    {roomTypes.find((item) => item.id === room.room_type_id)?.name ??
                      "-"}
                  </span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addRoom} style={card}>
            <SectionTitle
              title="Add Physical Room"
              subtitle="Add a room to the selected property"
            />

            <Field label="Room Number">
              <input
                value={newRoomNumber}
                onChange={(event) => setNewRoomNumber(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Room Name">
              <input
                value={newRoomName}
                onChange={(event) => setNewRoomName(event.target.value)}
                style={input}
              />
            </Field>

            <Field label="Room Type">
              <select
                value={newRoomTypeId}
                onChange={(event) => setNewRoomTypeId(event.target.value)}
                style={input}
              >
                {roomTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </Field>

            <button disabled={saving} style={primaryButton}>
              + Add Room
            </button>
          </form>
        </section>
      )}

      {tab === "rates" && (
        <section style={twoColumn}>
          <div style={card}>
            <SectionTitle
              title="Current Rates"
              subtitle="VAT-inclusive accommodation rates"
            />

            {roomRates.length === 0 ? (
              <div style={emptyState}>No rates configured.</div>
            ) : (
              roomRates.map((rate) => (
                <div key={rate.id} style={rateRow}>
                  <strong>
                    {roomTypes.find((item) => item.id === rate.room_type_id)?.name ??
                      "Room Type"}
                  </strong>
                  <span>
                    Single N$
                    {Number(
                      rate.single_occupancy_rate ?? rate.nightly_rate
                    ).toFixed(2)}
                  </span>
                  <span>
                    Double N$
                    {Number(
                      rate.double_occupancy_rate ?? rate.nightly_rate
                    ).toFixed(2)}
                  </span>
                  <span>{rate.is_active ? "Active" : "Inactive"}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={addRate} style={card}>
            <SectionTitle
              title="Add Rate"
              subtitle="Standard occupancy pricing"
            />

            <Field label="Room Type">
              <select
                value={rateRoomTypeId}
                onChange={(event) => setRateRoomTypeId(event.target.value)}
                style={input}
              >
                {roomTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </Field>

            <div style={formGrid}>
              <Field label="Nightly Rate">
                <input
                  type="number"
                  step="0.01"
                  value={nightlyRate}
                  onChange={(event) => setNightlyRate(Number(event.target.value))}
                  style={input}
                />
              </Field>

              <Field label="Single Occupancy">
                <input
                  type="number"
                  step="0.01"
                  value={singleRate}
                  onChange={(event) => setSingleRate(Number(event.target.value))}
                  style={input}
                />
              </Field>

              <Field label="Double Occupancy">
                <input
                  type="number"
                  step="0.01"
                  value={doubleRate}
                  onChange={(event) => setDoubleRate(Number(event.target.value))}
                  style={input}
                />
              </Field>

              <Field label="Extra Adult">
                <input
                  type="number"
                  step="0.01"
                  value={extraAdultRate}
                  onChange={(event) =>
                    setExtraAdultRate(Number(event.target.value))
                  }
                  style={input}
                />
              </Field>

              <Field label="Extra Child">
                <input
                  type="number"
                  step="0.01"
                  value={extraChildRate}
                  onChange={(event) =>
                    setExtraChildRate(Number(event.target.value))
                  }
                  style={input}
                />
              </Field>

              <Field label="Minimum Nights">
                <input
                  type="number"
                  min={1}
                  value={minimumNights}
                  onChange={(event) =>
                    setMinimumNights(Number(event.target.value))
                  }
                  style={input}
                />
              </Field>
            </div>

            <button disabled={saving} style={primaryButton}>
              + Add Rate
            </button>
          </form>
        </section>
      )}

      <footer style={footer}>
        <span>Setup changes apply to the selected property.</span>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div style={sectionTitle}>
      <div>
        <h2 style={sectionHeading}>{title}</h2>
        <div style={sectionSubtitle}>{subtitle}</div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...tabButton,
        ...(active ? activeTabButton : {}),
        ...(disabled ? disabledTabButton : {}),
      }}
    >
      {children}
    </button>
  );
}

const BLUE = "#0D5FA8";
const DARK_BLUE = "#0B477F";
const GREEN = "#16885A";
const TEXT = "#17324D";
const MUTED = "#718196";
const BORDER = "#D4E1EC";

const page: CSSProperties = {
  minHeight: "100vh",
  maxWidth: 1450,
  margin: "0 auto",
  padding: "14px 22px 20px",
  boxSizing: "border-box",
  background: "#F4F8FC",
  color: TEXT,
  fontFamily: "Arial, sans-serif",
};

const loadingCard: CSSProperties = {
  padding: 30,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  background: "#fff",
  textAlign: "center",
  color: MUTED,
};

const headingRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  marginBottom: 10,
};

const eyebrow: CSSProperties = {
  color: BLUE,
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: 0.7,
  marginBottom: 3,
};

const title: CSSProperties = {
  margin: 0,
  color: DARK_BLUE,
  fontSize: 26,
};

const subtitle: CSSProperties = {
  margin: "4px 0 0",
  color: MUTED,
  fontSize: 10,
};

const headingActions: CSSProperties = {
  display: "flex",
  gap: 7,
  alignItems: "center",
};

const propertySelect: CSSProperties = {
  minWidth: 240,
  padding: "8px 10px",
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  background: "#fff",
  color: TEXT,
  fontSize: 9,
};

const secondaryButton: CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  padding: "8px 11px",
  background: "#fff",
  color: BLUE,
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const addPropertyButton: CSSProperties = {
  border: `1px solid ${BLUE}`,
  borderRadius: 7,
  padding: "8px 12px",
  background: BLUE,
  color: "#fff",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const cancelButton: CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 7,
  padding: "9px 12px",
  background: "#fff",
  color: MUTED,
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const tabs: CSSProperties = {
  display: "flex",
  gap: 4,
  padding: 4,
  border: `1px solid ${BORDER}`,
  borderRadius: 9,
  background: "#EAF1F7",
  marginBottom: 9,
};

const tabButton: CSSProperties = {
  border: 0,
  borderRadius: 6,
  padding: "8px 13px",
  background: "transparent",
  color: "#5E7183",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const activeTabButton: CSSProperties = {
  background: "#fff",
  color: BLUE,
  boxShadow: "0 1px 4px rgba(13,79,145,.10)",
};

const disabledTabButton: CSSProperties = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const card: CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  background: "#fff",
  padding: 13,
  boxShadow: "0 3px 12px rgba(15,72,122,.04)",
};

const twoColumn: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.25fr .9fr",
  gap: 9,
};

const sectionTitle: CSSProperties = {
  paddingBottom: 8,
  marginBottom: 9,
  borderBottom: "1px solid #E4EBF1",
};

const sectionHeading: CSSProperties = {
  margin: 0,
  color: DARK_BLUE,
  fontSize: 14,
};

const sectionSubtitle: CSSProperties = {
  marginTop: 2,
  color: MUTED,
  fontSize: 8,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 9,
};

const field: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const fieldLabel: CSSProperties = {
  color: "#52677A",
  fontSize: 8,
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  border: "1px solid #C4D3E0",
  borderRadius: 7,
  background: "#fff",
  color: TEXT,
  fontSize: 9,
};

const formActions: CSSProperties = {
  display: "flex",
  alignItems: "end",
  justifyContent: "flex-end",
  gap: 7,
};

const primaryButton: CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: "9px 12px",
  background: BLUE,
  color: "#fff",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
  alignSelf: "end",
};

const listRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 2px",
  borderBottom: "1px solid #EDF1F5",
  fontSize: 9,
};

const rateRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1fr .6fr",
  gap: 8,
  padding: "8px 2px",
  borderBottom: "1px solid #EDF1F5",
  fontSize: 8,
};

const smallText: CSSProperties = {
  marginTop: 2,
  color: MUTED,
  fontSize: 7,
};

const emptyState: CSSProperties = {
  padding: 18,
  color: MUTED,
  fontSize: 8,
  textAlign: "center",
};

const successBox: CSSProperties = {
  marginBottom: 8,
  padding: "8px 10px",
  border: "1px solid #ACDCC4",
  borderRadius: 7,
  background: "#ECF9F2",
  color: GREEN,
  fontSize: 8,
  fontWeight: 800,
};

const errorBox: CSSProperties = {
  marginBottom: 8,
  padding: "8px 10px",
  border: "1px solid #E3B1B1",
  borderRadius: 7,
  background: "#FFF3F3",
  color: "#A33B3B",
  fontSize: 8,
};

const footer: CSSProperties = {
  marginTop: 9,
  padding: "8px 10px",
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  background: "#fff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: MUTED,
  fontSize: 8,
};

const finishButton: CSSProperties = {
  border: 0,
  borderRadius: 6,
  padding: "8px 12px",
  background: GREEN,
  color: "#fff",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};