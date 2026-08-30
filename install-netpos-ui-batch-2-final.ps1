$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "NETPOS HOSPITALITY - FINAL UI BATCH 2" -ForegroundColor Cyan
Write-Host "Housekeeping + Reports + Users + X Report/EOD + Setup" -ForegroundColor Cyan
Write-Host ""

$root = Get-Location

$existingFiles = @(
  "app\housekeeping\page.tsx",
  "app\reports\page.tsx",
  "app\users\page.tsx",
  "app\cash-up\page.tsx"
)

foreach ($relative in $existingFiles) {
  $path = Join-Path $root $relative
  if (!(Test-Path -LiteralPath $path)) {
    throw "Missing file: $relative. Run this installer from the Netpos project root."
  }
  Copy-Item -LiteralPath $path -Destination ($path + ".batch2-backup") -Force
  Write-Host "Backup: $relative.batch2-backup" -ForegroundColor DarkGray
}

function Replace-All([string]$text, [hashtable]$map) {
  foreach ($key in $map.Keys) {
    $text = $text.Replace($key, $map[$key])
  }
  return $text
}

# ============================================================
# HOUSEKEEPING
# ============================================================
$path = Join-Path $root "app\housekeeping\page.tsx"
$t = Get-Content -LiteralPath $path -Raw

$t = Replace-All $t @{
  'const pageStyle: React.CSSProperties = {' = 'const pageStyle: React.CSSProperties = {'
  'maxWidth: 1280,' = 'maxWidth: 1450,'
  'padding: "14px 20px 18px",' = 'padding: "14px 22px 18px",'
  'fontFamily: "Arial, sans-serif",' = 'fontFamily: "Arial, sans-serif",`r`n  background: "#F4F8FC",`r`n  color: "#17324D",`r`n  minHeight: "100vh",'
  'color: "#111",' = 'color: "#0D5FA8",'
  'color: "#6c7a89",' = 'color: "#16885A",'
  'fontSize: 25,' = 'fontSize: 25,`r`n  color: "#0D3F7A",'
  'borderColor: "#ccc",' = 'borderColor: "#C7D6E3",'
  'borderColor: "#ddd",' = 'borderColor: "#D5E2ED",'
  'background: "#111",' = 'background: "#0D5FA8",'
  'background: "#176332",' = 'background: "#16885A",'
}
Set-Content -LiteralPath $path -Value $t -Encoding UTF8
Write-Host "Updated Housekeeping" -ForegroundColor Green

# ============================================================
# REPORTS
# ============================================================
$path = Join-Path $root "app\reports\page.tsx"
$t = Get-Content -LiteralPath $path -Raw
$t = Replace-All $t @{
  'const BLUE = "#1557A6";' = 'const BLUE = "#0D5FA8";'
  'const DARK_BLUE = "#0D3F7A";' = 'const DARK_BLUE = "#0B477F";'
  'const GREEN = "#178A57";' = 'const GREEN = "#16885A";'
  'const PAGE_BG = "#F4F7FB";' = 'const PAGE_BG = "#F4F8FC";'
  'linear-gradient(135deg, #0D3F7A 0%, #1557A6 100%)' = 'linear-gradient(135deg, #0B4E8A 0%, #0D668F 100%)'
}
Set-Content -LiteralPath $path -Value $t -Encoding UTF8
Write-Host "Updated Reports" -ForegroundColor Green

# ============================================================
# USERS
# ============================================================
$path = Join-Path $root "app\users\page.tsx"
$t = Get-Content -LiteralPath $path -Raw
$t = Replace-All $t @{
  'const BLUE = "#1557A6";' = 'const BLUE = "#0D5FA8";'
  'const DARK_BLUE = "#0D3F7A";' = 'const DARK_BLUE = "#0B477F";'
  'const GREEN = "#178A57";' = 'const GREEN = "#16885A";'
  'const PAGE_BG = "#F4F7FB";' = 'const PAGE_BG = "#F4F8FC";'
  'linear-gradient(135deg, #0D3F7A 0%, #1557A6 100%)' = 'linear-gradient(135deg, #0B4E8A 0%, #0D668F 100%)'
}
Set-Content -LiteralPath $path -Value $t -Encoding UTF8
Write-Host "Updated Users" -ForegroundColor Green

# ============================================================
# X REPORT / EOD
# ============================================================
$path = Join-Path $root "app\cash-up\page.tsx"
$t = Get-Content -LiteralPath $path -Raw
$t = Replace-All $t @{
  'const BLUE =' + "`r`n" + '  "#1557A6";' = 'const BLUE =' + "`r`n" + '  "#0D5FA8";'
  'const DARK_BLUE =' + "`r`n" + '  "#0D3F7A";' = 'const DARK_BLUE =' + "`r`n" + '  "#0B477F";'
  'const GREEN =' + "`r`n" + '  "#178A57";' = 'const GREEN =' + "`r`n" + '  "#16885A";'
  'const PAGE_BG =' + "`r`n" + '  "#F4F7FB";' = 'const PAGE_BG =' + "`r`n" + '  "#F4F8FC";'
  'linear-gradient(135deg, #0D3F7A 0%, #1557A6 100%)' = 'linear-gradient(135deg, #0B4E8A 0%, #0D668F 100%)'
}
Set-Content -LiteralPath $path -Value $t -Encoding UTF8
Write-Host "Updated X Report / EOD" -ForegroundColor Green

# ============================================================
# CREATE SETUP PAGE
# ============================================================
$setupDir = Join-Path $root "app\setup"
[System.IO.Directory]::CreateDirectory($setupDir) | Out-Null
$setupPath = Join-Path $setupDir "page.tsx"

if (Test-Path -LiteralPath $setupPath) {
  Copy-Item -LiteralPath $setupPath -Destination ($setupPath + ".batch2-backup") -Force
}

$setup = @'
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
    () => properties.find((p) => p.id === propertyId) ?? null,
    [properties, propertyId]
  );

  useEffect(() => {
    initialise();
  }, []);

  useEffect(() => {
    if (!propertyId) return;
    loadPropertyWorkspace(propertyId);
    const property = properties.find((p) => p.id === propertyId);
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

    const [typesResult, roomsResult, plansResult, ratesResult] = await Promise.all([
      supabase.from("room_types").select("id,property_id,name,base_rate").eq("property_id", id).order("name"),
      supabase.from("rooms").select("id,property_id,room_type_id,room_number,room_name,operational_status").eq("property_id", id).order("room_number"),
      supabase.from("rate_plans").select("id,property_id,name,is_active").eq("property_id", id).eq("is_active", true).order("name"),
      supabase.from("room_rates").select("id,property_id,room_type_id,rate_plan_id,nightly_rate,single_occupancy_rate,double_occupancy_rate,extra_adult_rate,extra_child_rate,minimum_nights,is_active").eq("property_id", id).order("room_type_id"),
    ]);

    if (typesResult.error) return setErrorMessage(typesResult.error.message);
    if (roomsResult.error) return setErrorMessage(roomsResult.error.message);
    if (plansResult.error) return setErrorMessage(plansResult.error.message);
    if (ratesResult.error) return setErrorMessage(ratesResult.error.message);

    const typeRows = (typesResult.data as RoomType[]) ?? [];
    setRoomTypes(typeRows);
    setRooms((roomsResult.data as Room[]) ?? []);
    setRatePlans((plansResult.data as RatePlan[]) ?? []);
    setRoomRates((ratesResult.data as RoomRate[]) ?? []);

    if (typeRows[0]) {
      setNewRoomTypeId(typeRows[0].id);
      setRateRoomTypeId(typeRows[0].id);
    }
  }

  async function ensureStandardRatePlan() {
    const existing = ratePlans[0];
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("rate_plans")
      .insert({
        property_id: propertyId,
        name: "Standard Rate",
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

  async function saveProperty(event: FormEvent) {
    event.preventDefault();
    if (!propertyId || !propertyName.trim()) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("properties")
      .update({
        name: propertyName.trim(),
        code: propertyCode.trim() || null,
        town: town.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        vat_number: vatNumber.trim() || null,
        vat_rate: vatRate,
      })
      .eq("id", propertyId);

    setSaving(false);

    if (error) return setErrorMessage(error.message);

    setMessage("Property details saved.");
    await initialise();
  }

  async function addRoomType(event: FormEvent) {
    event.preventDefault();
    if (!newRoomTypeName.trim()) return;

    setSaving(true);

    const { error } = await supabase.from("room_types").insert({
      property_id: propertyId,
      name: newRoomTypeName.trim(),
      base_rate: newRoomTypeRate,
    });

    setSaving(false);
    if (error) return setErrorMessage(error.message);

    setNewRoomTypeName("");
    setNewRoomTypeRate(0);
    setMessage("Room type added.");
    await loadPropertyWorkspace(propertyId);
  }

  async function addRoom(event: FormEvent) {
    event.preventDefault();
    if (!newRoomNumber.trim() || !newRoomTypeId) return;

    setSaving(true);

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
    if (!rateRoomTypeId) return;

    setSaving(true);

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
      setErrorMessage(error instanceof Error ? error.message : "Could not save rate.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main style={page}><div style={loadingCard}>Loading Setup...</div></main>;
  }

  return (
    <main style={page}>
      <section style={headingRow}>
        <div>
          <div style={eyebrow}>SYSTEM CONFIGURATION</div>
          <h1 style={title}>Setup</h1>
          <p style={subtitle}>Property, room types, physical rooms and accommodation rates.</p>
        </div>

        <div style={headingActions}>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} style={propertySelect}>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </select>

          <button type="button" onClick={() => router.push("/users")} style={secondaryButton}>
            Users & Permissions
          </button>
        </div>
      </section>

      <div style={tabs}>
        <TabButton active={tab === "property"} onClick={() => setTab("property")}>Property</TabButton>
        <TabButton active={tab === "types"} onClick={() => setTab("types")}>Room Types</TabButton>
        <TabButton active={tab === "rooms"} onClick={() => setTab("rooms")}>Physical Rooms</TabButton>
        <TabButton active={tab === "rates"} onClick={() => setTab("rates")}>Rates</TabButton>
      </div>

      {message && <div style={successBox}>✓ {message}</div>}
      {errorMessage && <div style={errorBox}>{errorMessage}</div>}

      {tab === "property" && (
        <section style={card}>
          <SectionTitle title="Property Details" subtitle={selectedProperty?.name ?? ""} />
          <form onSubmit={saveProperty} style={formGrid}>
            <Field label="Property Name"><input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} style={input} /></Field>
            <Field label="Code"><input value={propertyCode} onChange={(e) => setPropertyCode(e.target.value)} style={input} /></Field>
            <Field label="Town"><input value={town} onChange={(e) => setTown(e.target.value)} style={input} /></Field>
            <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={input} /></Field>
            <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} style={input} /></Field>
            <Field label="VAT Number"><input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} style={input} /></Field>
            <Field label="VAT Rate %"><input type="number" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} style={input} /></Field>
            <div style={formActions}><button disabled={saving} style={primaryButton}>Save Property</button></div>
          </form>
        </section>
      )}

      {tab === "types" && (
        <section style={twoColumn}>
          <div style={card}>
            <SectionTitle title="Room Types" subtitle="Configured accommodation categories" />
            {roomTypes.map((type) => (
              <div key={type.id} style={listRow}>
                <strong>{type.name}</strong>
                <span>N${Number(type.base_rate ?? 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <form onSubmit={addRoomType} style={card}>
            <SectionTitle title="Add Room Type" subtitle="Create a new sellable room category" />
            <Field label="Room Type Name"><input value={newRoomTypeName} onChange={(e) => setNewRoomTypeName(e.target.value)} style={input} /></Field>
            <Field label="Base Rate"><input type="number" step="0.01" value={newRoomTypeRate} onChange={(e) => setNewRoomTypeRate(Number(e.target.value))} style={input} /></Field>
            <button disabled={saving} style={primaryButton}>+ Add Room Type</button>
          </form>
        </section>
      )}

      {tab === "rooms" && (
        <section style={twoColumn}>
          <div style={card}>
            <SectionTitle title="Physical Rooms" subtitle="Actual rooms available to allocate" />
            {rooms.map((room) => (
              <div key={room.id} style={listRow}>
                <div><strong>Room {room.room_number}</strong><div style={smallText}>{room.room_name || "No room name"}</div></div>
                <span>{roomTypes.find((x) => x.id === room.room_type_id)?.name ?? "-"}</span>
              </div>
            ))}
          </div>

          <form onSubmit={addRoom} style={card}>
            <SectionTitle title="Add Physical Room" subtitle="Add a room to the selected property" />
            <Field label="Room Number"><input value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} style={input} /></Field>
            <Field label="Room Name"><input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} style={input} /></Field>
            <Field label="Room Type">
              <select value={newRoomTypeId} onChange={(e) => setNewRoomTypeId(e.target.value)} style={input}>
                {roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </Field>
            <button disabled={saving} style={primaryButton}>+ Add Room</button>
          </form>
        </section>
      )}

      {tab === "rates" && (
        <section style={twoColumn}>
          <div style={card}>
            <SectionTitle title="Current Rates" subtitle="VAT-inclusive accommodation rates" />
            {roomRates.map((rate) => (
              <div key={rate.id} style={rateRow}>
                <strong>{roomTypes.find((x) => x.id === rate.room_type_id)?.name ?? "Room Type"}</strong>
                <span>Single N${Number(rate.single_occupancy_rate ?? rate.nightly_rate).toFixed(2)}</span>
                <span>Double N${Number(rate.double_occupancy_rate ?? rate.nightly_rate).toFixed(2)}</span>
                <span>{rate.is_active ? "Active" : "Inactive"}</span>
              </div>
            ))}
          </div>

          <form onSubmit={addRate} style={card}>
            <SectionTitle title="Add Rate" subtitle="Standard occupancy pricing" />
            <Field label="Room Type">
              <select value={rateRoomTypeId} onChange={(e) => setRateRoomTypeId(e.target.value)} style={input}>
                {roomTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </Field>
            <div style={formGrid}>
              <Field label="Nightly Rate"><input type="number" step="0.01" value={nightlyRate} onChange={(e) => setNightlyRate(Number(e.target.value))} style={input} /></Field>
              <Field label="Single Occupancy"><input type="number" step="0.01" value={singleRate} onChange={(e) => setSingleRate(Number(e.target.value))} style={input} /></Field>
              <Field label="Double Occupancy"><input type="number" step="0.01" value={doubleRate} onChange={(e) => setDoubleRate(Number(e.target.value))} style={input} /></Field>
              <Field label="Extra Adult"><input type="number" step="0.01" value={extraAdultRate} onChange={(e) => setExtraAdultRate(Number(e.target.value))} style={input} /></Field>
              <Field label="Extra Child"><input type="number" step="0.01" value={extraChildRate} onChange={(e) => setExtraChildRate(Number(e.target.value))} style={input} /></Field>
              <Field label="Minimum Nights"><input type="number" min={1} value={minimumNights} onChange={(e) => setMinimumNights(Number(e.target.value))} style={input} /></Field>
            </div>
            <button disabled={saving} style={primaryButton}>+ Add Rate</button>
          </form>
        </section>
      )}

      <footer style={footer}>
        <span>Setup changes apply to the selected property.</span>
        <button type="button" onClick={() => router.push("/reservations")} style={finishButton}>Finish</button>
      </footer>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={field}><span style={fieldLabel}>{label}</span>{children}</label>;
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div style={sectionTitle}><div><h2 style={sectionHeading}>{title}</h2><div style={sectionSubtitle}>{subtitle}</div></div></div>;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} style={{ ...tabButton, ...(active ? activeTabButton : {}) }}>{children}</button>;
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

const loadingCard: CSSProperties = { padding: 30, border: `1px solid ${BORDER}`, borderRadius: 10, background: "#fff", textAlign: "center", color: MUTED };
const headingRow: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginBottom: 10 };
const eyebrow: CSSProperties = { color: BLUE, fontSize: 8, fontWeight: 900, letterSpacing: .7, marginBottom: 3 };
const title: CSSProperties = { margin: 0, color: DARK_BLUE, fontSize: 26 };
const subtitle: CSSProperties = { margin: "4px 0 0", color: MUTED, fontSize: 10 };
const headingActions: CSSProperties = { display: "flex", gap: 7, alignItems: "center" };
const propertySelect: CSSProperties = { minWidth: 240, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 7, background: "#fff", color: TEXT, fontSize: 9 };
const secondaryButton: CSSProperties = { border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 11px", background: "#fff", color: BLUE, fontSize: 8, fontWeight: 900, cursor: "pointer" };
const tabs: CSSProperties = { display: "flex", gap: 4, padding: 4, border: `1px solid ${BORDER}`, borderRadius: 9, background: "#EAF1F7", marginBottom: 9 };
const tabButton: CSSProperties = { border: 0, borderRadius: 6, padding: "8px 13px", background: "transparent", color: "#5E7183", fontSize: 8, fontWeight: 900, cursor: "pointer" };
const activeTabButton: CSSProperties = { background: "#fff", color: BLUE, boxShadow: "0 1px 4px rgba(13,79,145,.10)" };
const card: CSSProperties = { border: `1px solid ${BORDER}`, borderRadius: 10, background: "#fff", padding: 13, boxShadow: "0 3px 12px rgba(15,72,122,.04)" };
const twoColumn: CSSProperties = { display: "grid", gridTemplateColumns: "1.25fr .9fr", gap: 9 };
const sectionTitle: CSSProperties = { paddingBottom: 8, marginBottom: 9, borderBottom: "1px solid #E4EBF1" };
const sectionHeading: CSSProperties = { margin: 0, color: DARK_BLUE, fontSize: 14 };
const sectionSubtitle: CSSProperties = { marginTop: 2, color: MUTED, fontSize: 8 };
const formGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const fieldLabel: CSSProperties = { color: "#52677A", fontSize: 8, fontWeight: 900 };
const input: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #C4D3E0", borderRadius: 7, background: "#fff", color: TEXT, fontSize: 9 };
const formActions: CSSProperties = { display: "flex", alignItems: "end", justifyContent: "flex-end" };
const primaryButton: CSSProperties = { border: 0, borderRadius: 7, padding: "9px 12px", background: BLUE, color: "#fff", fontSize: 8, fontWeight: 900, cursor: "pointer", alignSelf: "end" };
const listRow: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 2px", borderBottom: "1px solid #EDF1F5", fontSize: 9 };
const rateRow: CSSProperties = { display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr .6fr", gap: 8, padding: "8px 2px", borderBottom: "1px solid #EDF1F5", fontSize: 8 };
const smallText: CSSProperties = { marginTop: 2, color: MUTED, fontSize: 7 };
const successBox: CSSProperties = { marginBottom: 8, padding: "8px 10px", border: "1px solid #ACDCC4", borderRadius: 7, background: "#ECF9F2", color: GREEN, fontSize: 8, fontWeight: 800 };
const errorBox: CSSProperties = { marginBottom: 8, padding: "8px 10px", border: "1px solid #E3B1B1", borderRadius: 7, background: "#FFF3F3", color: "#A33B3B", fontSize: 8 };
const footer: CSSProperties = { marginTop: 9, padding: "8px 10px", border: `1px solid ${BORDER}`, borderRadius: 8, background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", color: MUTED, fontSize: 8 };
const finishButton: CSSProperties = { border: 0, borderRadius: 6, padding: "8px 12px", background: GREEN, color: "#fff", fontSize: 8, fontWeight: 900, cursor: "pointer" };
'@

Set-Content -LiteralPath $setupPath -Value $setup -Encoding UTF8
Write-Host "Created Setup page" -ForegroundColor Green

Write-Host ""
Write-Host "FINAL UI BATCH 2 COMPLETE" -ForegroundColor Cyan
Write-Host "Housekeeping, Reports, Users, X Report/EOD themed." -ForegroundColor Green
Write-Host "Setup page created at app\setup\page.tsx." -ForegroundColor Green
Write-Host ""
Write-Host "Restart with: npm run dev" -ForegroundColor Yellow
