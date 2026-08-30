# ============================================================
# NETPOS HOSPITALITY - QUOTATION -> RESERVATION CONVERSION
#
# Run from:
#   C:\Users\Administrator\netpos-hospitality
#
# Command:
#   powershell -ExecutionPolicy Bypass -File .\install-netpos-quote-conversion.ps1
#
# Creates:
#   app\quotations\[id]\convert\page.tsx
#
# Updates:
#   app\quotations\page.tsx
#
# The conversion keeps all quotation details and only asks the
# user to confirm/select the physical room before reservation.
# ============================================================

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\app\quotations\page.tsx")) {
    Write-Host "ERROR: app\quotations\page.tsx was not found." -ForegroundColor Red
    Write-Host "Run this from the netpos-hospitality project folder." -ForegroundColor Yellow
    exit 1
}

[System.IO.Directory]::CreateDirectory((Join-Path (Get-Location) "app\quotations\[id]\convert")) | Out-Null

$convertCode = @'
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type Quotation = {
  id: string;
  quotation_number: string;
  property_id: string;
  guest_id: string;
  company_id: string | null;
  room_type_id: string;
  room_id: string | null;
  arrival_date: string;
  departure_date: string;
  adults: number;
  children: number;
  nightly_rate: number;
  discount_amount: number;
  vat_rate: number;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  valid_until: string;
  status: string;
  notes: string | null;
  converted_reservation_id: string | null;
};

type Property = {
  id: string;
  name: string;
};

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
};

type Company = {
  id: string;
  name: string;
};

type RoomType = {
  id: string;
  name: string;
};

type Room = {
  id: string;
  room_number: string;
  room_name: string | null;
  room_type_id: string;
  operational_status: string;
  housekeeping_status: string | null;
};

export default function ConvertQuotationPage() {
  const router = useRouter();
  const params = useParams();

  const quotationId =
    typeof params?.id === "string"
      ? params.id
      : "";

  const [quotation, setQuotation] =
    useState<Quotation | null>(null);

  const [property, setProperty] =
    useState<Property | null>(null);

  const [guest, setGuest] =
    useState<Guest | null>(null);

  const [company, setCompany] =
    useState<Company | null>(null);

  const [roomType, setRoomType] =
    useState<RoomType | null>(null);

  const [rooms, setRooms] =
    useState<Room[]>([]);

  const [roomId, setRoomId] =
    useState("");

  const [unavailableRoomIds, setUnavailableRoomIds] =
    useState<string[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    if (quotationId) {
      loadQuotation();
    }
  }, [quotationId]);

  const availableRooms = useMemo(
    () =>
      rooms.filter(
        (room) =>
          !unavailableRoomIds.includes(room.id)
      ),
    [rooms, unavailableRoomIds]
  );

  const selectedRoom =
    rooms.find(
      (room) => room.id === roomId
    ) ?? null;

  const nights = quotation
    ? calculateNights(
        quotation.arrival_date,
        quotation.departure_date
      )
    : 0;

  async function loadQuotation() {
    setLoading(true);
    setErrorMessage("");
    setMessage("");

    try {
      const {
        data: quoteData,
        error: quoteError,
      } = await supabase
        .from("quotations")
        .select(`
          id,
          quotation_number,
          property_id,
          guest_id,
          company_id,
          room_type_id,
          room_id,
          arrival_date,
          departure_date,
          adults,
          children,
          nightly_rate,
          discount_amount,
          vat_rate,
          subtotal,
          vat_amount,
          total_amount,
          valid_until,
          status,
          notes,
          converted_reservation_id
        `)
        .eq("id", quotationId)
        .maybeSingle();

      if (quoteError) {
        throw new Error(
          quoteError.message
        );
      }

      if (!quoteData) {
        throw new Error(
          "Quotation could not be found."
        );
      }

      const loadedQuote =
        quoteData as Quotation;

      setQuotation(loadedQuote);

      if (
        loadedQuote.status === "converted" &&
        loadedQuote.converted_reservation_id
      ) {
        router.replace(
          `/reservations/${loadedQuote.converted_reservation_id}`
        );
        return;
      }

      if (
        loadedQuote.status !== "accepted"
      ) {
        throw new Error(
          `Quotation ${loadedQuote.quotation_number} must be Accepted before it can be converted.`
        );
      }

      const [
        propertyResult,
        guestResult,
        roomTypeResult,
        roomResult,
      ] = await Promise.all([
        supabase
          .from("properties")
          .select("id,name")
          .eq(
            "id",
            loadedQuote.property_id
          )
          .maybeSingle(),

        supabase
          .from("guests")
          .select(`
            id,
            first_name,
            last_name,
            phone,
            email
          `)
          .eq(
            "id",
            loadedQuote.guest_id
          )
          .maybeSingle(),

        supabase
          .from("room_types")
          .select("id,name")
          .eq(
            "id",
            loadedQuote.room_type_id
          )
          .maybeSingle(),

        supabase
          .from("rooms")
          .select(`
            id,
            room_number,
            room_name,
            room_type_id,
            operational_status,
            housekeeping_status
          `)
          .eq(
            "property_id",
            loadedQuote.property_id
          )
          .eq(
            "room_type_id",
            loadedQuote.room_type_id
          )
          .eq(
            "operational_status",
            "active"
          )
          .order(
            "room_number"
          ),
      ]);

      if (propertyResult.error) {
        throw new Error(
          `Property: ${propertyResult.error.message}`
        );
      }

      if (guestResult.error) {
        throw new Error(
          `Guest: ${guestResult.error.message}`
        );
      }

      if (roomTypeResult.error) {
        throw new Error(
          `Room Type: ${roomTypeResult.error.message}`
        );
      }

      if (roomResult.error) {
        throw new Error(
          `Rooms: ${roomResult.error.message}`
        );
      }

      setProperty(
        propertyResult.data as Property | null
      );

      setGuest(
        guestResult.data as Guest | null
      );

      setRoomType(
        roomTypeResult.data as RoomType | null
      );

      const loadedRooms =
        (roomResult.data ?? []) as Room[];

      setRooms(loadedRooms);

      if (loadedQuote.company_id) {
        const {
          data: companyData,
          error: companyError,
        } = await supabase
          .from("companies")
          .select("id,name")
          .eq(
            "id",
            loadedQuote.company_id
          )
          .maybeSingle();

        if (companyError) {
          throw new Error(
            `Company: ${companyError.message}`
          );
        }

        setCompany(
          companyData as Company | null
        );
      } else {
        setCompany(null);
      }

      const unavailable =
        await findUnavailableRooms(
          loadedRooms.map(
            (room) => room.id
          ),
          loadedQuote.arrival_date,
          loadedQuote.departure_date
        );

      setUnavailableRoomIds(
        unavailable
      );

      const preferredRoom =
        loadedQuote.room_id &&
        loadedRooms.some(
          (room) =>
            room.id === loadedQuote.room_id
        ) &&
        !unavailable.includes(
          loadedQuote.room_id
        )
          ? loadedQuote.room_id
          : loadedRooms.find(
              (room) =>
                !unavailable.includes(
                  room.id
                )
            )?.id ?? "";

      setRoomId(preferredRoom);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load quotation conversion."
      );
    } finally {
      setLoading(false);
    }
  }

  async function findUnavailableRooms(
    roomIds: string[],
    arrivalDate: string,
    departureDate: string
  ) {
    if (roomIds.length === 0) {
      return [];
    }

    const {
      data,
      error,
    } = await supabase
      .from("reservation_rooms")
      .select(`
        room_id,
        arrival_date,
        departure_date,
        reservations!inner (
          id,
          status
        )
      `)
      .in(
        "room_id",
        roomIds
      )
      .lt(
        "arrival_date",
        departureDate
      )
      .gt(
        "departure_date",
        arrivalDate
      )
      .in(
        "reservations.status",
        [
          "provisional",
          "confirmed",
          "checked_in",
        ]
      );

    if (error) {
      throw new Error(
        `Availability: ${error.message}`
      );
    }

    return Array.from(
      new Set(
        (data ?? [])
          .map(
            (row: any) =>
              row.room_id as string | null
          )
          .filter(
            (value): value is string =>
              Boolean(value)
          )
      )
    );
  }

  async function confirmConversion() {
    if (!quotation) {
      return;
    }

    setErrorMessage("");
    setMessage("");

    if (
      quotation.status !== "accepted"
    ) {
      setErrorMessage(
        "Only an accepted quotation can be converted."
      );
      return;
    }

    if (!roomId) {
      setErrorMessage(
        "Please select an available physical room."
      );
      return;
    }

    setSaving(true);

    let createdReservationId:
      string | null = null;

    try {
      // ---------------------------------------------------
      // RECHECK THE ROOM IMMEDIATELY BEFORE SAVE
      // ---------------------------------------------------

      const conflictRoomIds =
        await findUnavailableRooms(
          [roomId],
          quotation.arrival_date,
          quotation.departure_date
        );

      if (
        conflictRoomIds.includes(
          roomId
        )
      ) {
        setUnavailableRoomIds(
          (current) =>
            Array.from(
              new Set([
                ...current,
                roomId,
              ])
            )
        );

        setRoomId("");

        throw new Error(
          "That room has just become unavailable. Please select another room."
        );
      }

      // ---------------------------------------------------
      // CREATE RESERVATION
      // ---------------------------------------------------

      const reservationNumber =
        createReservationNumber();

      const {
        data: reservationData,
        error: reservationError,
      } = await supabase
        .from("reservations")
        .insert({
          property_id:
            quotation.property_id,

          guest_id:
            quotation.guest_id,

          company_id:
            quotation.company_id,

          quotation_id:
            quotation.id,

          reservation_number:
            reservationNumber,

          status:
            "confirmed",

          booking_source:
            "quotation",

          arrival_date:
            quotation.arrival_date,

          departure_date:
            quotation.departure_date,

          adults:
            quotation.adults,

          children:
            quotation.children,

          subtotal:
            quotation.subtotal,

          discount_amount:
            quotation.discount_amount,

          vat_amount:
            quotation.vat_amount,

          total_amount:
            quotation.total_amount,

          deposit_required:
            0,

          notes:
            quotation.notes,
        })
        .select(
          "id,reservation_number"
        )
        .single();

      if (
        reservationError ||
        !reservationData
      ) {
        throw new Error(
          reservationError?.message ??
            "Could not create reservation."
        );
      }

      createdReservationId =
        reservationData.id;

      // ---------------------------------------------------
      // CREATE RESERVATION ROOM
      // ---------------------------------------------------

      const {
        error: roomInsertError,
      } = await supabase
        .from("reservation_rooms")
        .insert({
          reservation_id:
            reservationData.id,

          room_type_id:
            quotation.room_type_id,

          room_id:
            roomId,

          adults:
            quotation.adults,

          children:
            quotation.children,

          nightly_rate:
            quotation.nightly_rate,

          original_rate:
            quotation.nightly_rate,

          rate_override_reason:
            "Converted from quotation",

          discount_amount:
            quotation.discount_amount,

          arrival_date:
            quotation.arrival_date,

          departure_date:
            quotation.departure_date,
        });

      if (roomInsertError) {
        await supabase
          .from("reservations")
          .delete()
          .eq(
            "id",
            reservationData.id
          );

        createdReservationId =
          null;

        throw new Error(
          roomInsertError.message
        );
      }

      // ---------------------------------------------------
      // MARK QUOTATION CONVERTED
      // ---------------------------------------------------

      const {
        error: quoteUpdateError,
      } = await supabase
        .from("quotations")
        .update({
          status:
            "converted",

          converted_reservation_id:
            reservationData.id,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          quotation.id
        )
        .eq(
          "status",
          "accepted"
        );

      if (quoteUpdateError) {
        await supabase
          .from("reservation_rooms")
          .delete()
          .eq(
            "reservation_id",
            reservationData.id
          );

        await supabase
          .from("reservations")
          .delete()
          .eq(
            "id",
            reservationData.id
          );

        createdReservationId =
          null;

        throw new Error(
          `Reservation was rolled back because the quotation could not be marked Converted: ${quoteUpdateError.message}`
        );
      }

      sessionStorage.removeItem(
        "netpos_quote_to_convert"
      );

      setMessage(
        `Reservation ${reservationData.reservation_number} created successfully from ${quotation.quotation_number}.`
      );

      router.push(
        `/reservations/${reservationData.id}`
      );

      router.refresh();
    } catch (error) {
      if (createdReservationId) {
        console.warn(
          "Reservation conversion error after reservation creation:",
          createdReservationId
        );
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not convert quotation."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main style={page}>
        <section style={loadingCard}>
          <div style={logoMark}>
            N
          </div>

          <strong>
            NETPOS HOSPITALITY
          </strong>

          <span>
            Loading quotation...
          </span>
        </section>
      </main>
    );
  }

  if (
    errorMessage &&
    !quotation
  ) {
    return (
      <main style={page}>
        <section style={errorCard}>
          <h2>
            Quotation Conversion
          </h2>

          <div style={errorBox}>
            {errorMessage}
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/quotations"
              )
            }
            style={secondaryButton}
          >
            ← Back to Quotations
          </button>
        </section>
      </main>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div>
          <div style={eyebrow}>
            NETPOS HOSPITALITY
          </div>

          <h1 style={title}>
            Convert Quotation
          </h1>

          <div style={heroSub}>
            {quotation.quotation_number}
            {" · "}
            {property?.name ?? ""}
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/quotations"
            )
          }
          style={heroBackButton}
        >
          ← Quotations
        </button>
      </section>

      <section style={content}>
        {errorMessage && (
          <div style={errorBox}>
            {errorMessage}
          </div>
        )}

        {message && (
          <div style={successBox}>
            {message}
          </div>
        )}

        <div style={grid}>
          <section style={card}>
            <div style={cardHeading}>
              Quotation Details
            </div>

            <Detail
              label="Guest / Customer"
              value={
                guest
                  ? `${guest.first_name} ${guest.last_name}`
                  : "-"
              }
            />

            <Detail
              label="Company"
              value={
                company?.name ??
                "Private Guest"
              }
            />

            <Detail
              label="Stay"
              value={`${formatDate(
                quotation.arrival_date
              )} → ${formatDate(
                quotation.departure_date
              )}`}
            />

            <Detail
              label="Nights"
              value={String(nights)}
            />

            <Detail
              label="Guests"
              value={`${quotation.adults} Adult(s), ${quotation.children} Child(ren)`}
            />

            <Detail
              label="Room Type"
              value={
                roomType?.name ?? "-"
              }
            />

            <Detail
              label="Nightly Rate"
              value={money(
                quotation.nightly_rate
              )}
            />

            {quotation.discount_amount > 0 && (
              <Detail
                label="Discount"
                value={`- ${money(
                  quotation.discount_amount
                )}`}
              />
            )}

            <Detail
              label={`VAT ${quotation.vat_rate}% Included`}
              value={money(
                quotation.vat_amount
              )}
            />

            <div style={totalRow}>
              <span>
                QUOTATION TOTAL
              </span>

              <strong>
                {money(
                  quotation.total_amount
                )}
              </strong>
            </div>
          </section>

          <section style={card}>
            <div style={cardHeading}>
              Allocate Physical Room
            </div>

            <p style={helpText}>
              The quotation keeps the room type and price.
              Select the actual room that will be reserved.
              Occupied rooms for this stay are automatically excluded.
            </p>

            <label style={label}>
              Physical Room
            </label>

            <select
              value={roomId}
              onChange={(event) =>
                setRoomId(
                  event.target.value
                )
              }
              style={select}
            >
              <option value="">
                Select available room...
              </option>

              {availableRooms.map(
                (room) => (
                  <option
                    key={room.id}
                    value={room.id}
                  >
                    Room {room.room_number}
                    {room.room_name
                      ? ` - ${room.room_name}`
                      : ""}
                    {room.housekeeping_status
                      ? ` · ${formatStatus(
                          room.housekeeping_status
                        )}`
                      : ""}
                  </option>
                )
              )}
            </select>

            {rooms.length > 0 &&
              availableRooms.length === 0 && (
                <div style={warningBox}>
                  No physical room of this type is available for the quoted dates.
                  Return to Quotations or change the stay before converting.
                </div>
              )}

            {selectedRoom && (
              <div style={roomSelectedBox}>
                <div style={selectedLabel}>
                  ROOM TO RESERVE
                </div>

                <div style={selectedRoomNumber}>
                  Room {selectedRoom.room_number}
                </div>

                <div style={selectedRoomMeta}>
                  {roomType?.name ?? ""}
                  {selectedRoom.housekeeping_status
                    ? ` · ${formatStatus(
                        selectedRoom.housekeeping_status
                      )}`
                    : ""}
                </div>
              </div>
            )}

            <div style={conversionNote}>
              <strong>
                What happens next?
              </strong>

              <div>
                The quotation becomes Converted, the new reservation becomes Confirmed,
                and the reservation remains linked back to this quotation for audit history.
              </div>
            </div>

            <button
              type="button"
              disabled={
                saving ||
                !roomId ||
                availableRooms.length === 0
              }
              onClick={
                confirmConversion
              }
              style={{
                ...confirmButton,
                opacity:
                  saving ||
                  !roomId ||
                  availableRooms.length === 0
                    ? 0.55
                    : 1,
              }}
            >
              {saving
                ? "Creating Reservation..."
                : "Confirm & Create Reservation"}
            </button>
          </section>
        </div>
      </section>
    </main>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={detailRow}>
      <span style={detailLabel}>
        {label}
      </span>

      <strong style={detailValue}>
        {value}
      </strong>
    </div>
  );
}

function calculateNights(
  arrival: string,
  departure: string
) {
  const start =
    new Date(
      `${arrival}T12:00:00`
    ).getTime();

  const end =
    new Date(
      `${departure}T12:00:00`
    ).getTime();

  return Math.max(
    1,
    Math.round(
      (end - start) /
        86400000
    )
  );
}

function formatDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(
      `${value}T12:00:00`
    )
  );
}

function formatStatus(
  value: string
) {
  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function money(
  value: number
) {
  return `N$${Number(
    value || 0
  ).toFixed(2)}`;
}

function createReservationNumber() {
  const now = new Date();

  const y =
    now
      .getFullYear()
      .toString();

  const m =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const d =
    String(
      now.getDate()
    ).padStart(2, "0");

  const tail =
    now
      .getTime()
      .toString()
      .slice(-6);

  return `RES-${y}${m}${d}-${tail}`;
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#F3F7FB",
  color: "#17324D",
  fontFamily:
    "Arial, sans-serif",
};

const loadingCard: CSSProperties = {
  width: 280,
  margin: "80px auto",
  padding: 25,
  borderRadius: 12,
  border:
    "1px solid #D5E1EC",
  background: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
};

const logoMark: CSSProperties = {
  width: 42,
  height: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 9,
  background: "#0D4E94",
  color: "#fff",
  fontSize: 23,
  fontWeight: 900,
};

const errorCard: CSSProperties = {
  maxWidth: 550,
  margin: "60px auto",
  padding: 25,
  background: "#fff",
  borderRadius: 12,
};

const hero: CSSProperties = {
  margin: "14px 22px 0",
  padding: "17px 19px",
  borderRadius: 14,
  background:
    "linear-gradient(135deg,#0C3D78,#1764B0)",
  color: "#fff",
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 20,
};

const eyebrow: CSSProperties = {
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: 1.2,
  opacity: 0.86,
};

const title: CSSProperties = {
  margin: "3px 0 2px",
  fontSize: 25,
};

const heroSub: CSSProperties = {
  fontSize: 10,
  opacity: 0.9,
};

const heroBackButton: CSSProperties = {
  border:
    "1px solid rgba(255,255,255,.55)",
  borderRadius: 7,
  padding: "8px 11px",
  background:
    "rgba(255,255,255,.08)",
  color: "#fff",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};

const content: CSSProperties = {
  padding: "17px 22px 30px",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1.05fr) minmax(0,.95fr)",
  gap: 14,
  maxWidth: 1100,
  margin: "0 auto",
};

const card: CSSProperties = {
  padding: 18,
  border:
    "1px solid #D5E1EC",
  borderRadius: 11,
  background: "#fff",
  boxShadow:
    "0 5px 16px rgba(15,60,105,.05)",
};

const cardHeading: CSSProperties = {
  marginBottom: 12,
  color: "#0D3F7A",
  fontSize: 16,
  fontWeight: 900,
};

const detailRow: CSSProperties = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  gap: 15,
  padding: "8px 0",
  borderBottom:
    "1px solid #EDF1F5",
};

const detailLabel: CSSProperties = {
  color: "#718196",
  fontSize: 9,
};

const detailValue: CSSProperties = {
  color: "#253D53",
  fontSize: 9,
  textAlign: "right",
};

const totalRow: CSSProperties = {
  marginTop: 10,
  padding: "11px 0",
  borderTop:
    "2px solid #0D5DAA",
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
  color: "#0D4E94",
  fontSize: 15,
  fontWeight: 900,
};

const helpText: CSSProperties = {
  color: "#687B8E",
  fontSize: 9,
  lineHeight: 1.55,
};

const label: CSSProperties = {
  display: "block",
  margin:
    "16px 0 5px",
  color: "#4F6579",
  fontSize: 8,
  fontWeight: 900,
};

const select: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 11px",
  border:
    "1px solid #C6D5E2",
  borderRadius: 7,
  background: "#fff",
  color: "#17324D",
  fontSize: 10,
};

const warningBox: CSSProperties = {
  marginTop: 12,
  padding: 10,
  border:
    "1px solid #F0C67A",
  borderRadius: 7,
  background: "#FFF8E9",
  color: "#8B641B",
  fontSize: 9,
  lineHeight: 1.5,
};

const roomSelectedBox: CSSProperties = {
  marginTop: 13,
  padding: 14,
  border:
    "1px solid #A8DCC2",
  borderRadius: 9,
  background: "#F0FBF5",
};

const selectedLabel: CSSProperties = {
  color: "#178A57",
  fontSize: 7,
  fontWeight: 900,
};

const selectedRoomNumber: CSSProperties = {
  marginTop: 4,
  color: "#116D45",
  fontSize: 21,
  fontWeight: 900,
};

const selectedRoomMeta: CSSProperties = {
  marginTop: 3,
  color: "#587467",
  fontSize: 9,
};

const conversionNote: CSSProperties = {
  marginTop: 14,
  padding: 11,
  borderRadius: 8,
  background: "#F3F7FB",
  color: "#617487",
  fontSize: 9,
  lineHeight: 1.5,
};

const confirmButton: CSSProperties = {
  width: "100%",
  marginTop: 14,
  border: 0,
  borderRadius: 8,
  padding: "11px 13px",
  background: "#178A57",
  color: "#fff",
  fontSize: 10,
  fontWeight: 900,
  cursor: "pointer",
};

const errorBox: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto 12px",
  padding: "10px 12px",
  border:
    "1px solid #F0B6B6",
  borderRadius: 7,
  background: "#FFF3F3",
  color: "#A33B3B",
  fontSize: 9,
};

const successBox: CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto 12px",
  padding: "10px 12px",
  border:
    "1px solid #A9DFC4",
  borderRadius: 7,
  background: "#F0FBF5",
  color: "#137A4B",
  fontSize: 9,
};

const secondaryButton: CSSProperties = {
  border:
    "1px solid #C6D3DF",
  borderRadius: 7,
  padding: "9px 11px",
  background: "#fff",
  color: "#0D4E94",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};
'@

Set-Content `
  -LiteralPath ".\app\quotations\[id]\convert\page.tsx" `
  -Value $convertCode `
  -Encoding UTF8

# ------------------------------------------------------------
# Update the existing Quotations page so Accepted -> Convert
# opens our dedicated no-retyping conversion screen.
# ------------------------------------------------------------

$quotationPath = ".\app\quotations\page.tsx"
$quotationText = Get-Content -Raw -Path $quotationPath

$oldLine = 'router.push(`/reservations/new?${params.toString()}`);'
$newLine = 'router.push(`/quotations/${quote.id}/convert`);'

if ($quotationText.Contains($oldLine)) {
    $quotationText =
        $quotationText.Replace(
            $oldLine,
            $newLine
        )

    Set-Content `
      -Path $quotationPath `
      -Value $quotationText `
      -Encoding UTF8

    Write-Host "Updated Convert to Reservation button." -ForegroundColor Green
}
elseif ($quotationText.Contains('router.push(`/quotations/${quote.id}/convert`);')) {
    Write-Host "Quotation conversion button is already updated." -ForegroundColor Green
}
else {
    Write-Host "WARNING: Could not find the expected conversion line in app\quotations\page.tsx." -ForegroundColor Yellow
    Write-Host "The conversion page was still created successfully." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "NETPOS QUOTATION CONVERSION INSTALLED" -ForegroundColor Green
Write-Host ""
Write-Host "Workflow:"
Write-Host "  Quotation -> Accepted"
Write-Host "  -> Convert to Reservation"
Write-Host "  -> select/confirm available physical room"
Write-Host "  -> Confirm Reservation"
Write-Host "  -> quotation marked Converted"
Write-Host "  -> reservation linked to quotation"
Write-Host "  -> reservation detail opens automatically"
Write-Host ""
Write-Host "Now restart Next.js:"
Write-Host "  Ctrl + C"
Write-Host "  npm run dev"
Write-Host ""
