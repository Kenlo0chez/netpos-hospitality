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
  phone: string | null;
  email: string | null;
  vat_number: string | null;
  vat_rate: number | null;
  town: string | null;
};

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  company_id: string | null;
};

type Company = {
  id: string;
  name: string;
};

type RoomType = {
  id: string;
  name: string;
  base_rate: number | null;
};

type Room = {
  id: string;
  room_number: string;
  room_name: string | null;
  room_type_id: string;
  operational_status: string;
};

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
  created_at: string;
};

type Staff = {
  role: "owner" | "manager" | "reception" | "housekeeping";
  property_id: string | null;
};

const ACTIVE_QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
];

export default function QuotationsPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);

  const [staff, setStaff] = useState<Staff | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [arrivalDate, setArrivalDate] = useState(today());
  const [departureDate, setDepartureDate] = useState(addDays(today(), 1));
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [nightlyRate, setNightlyRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [validUntil, setValidUntil] = useState(addDays(today(), 7));
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProperty = properties.find((x) => x.id === propertyId);
  const selectedGuest = guests.find((x) => x.id === guestId);
  const selectedCompany = companies.find((x) => x.id === companyId);
  const selectedRoomType = roomTypes.find((x) => x.id === roomTypeId);
  const selectedRoom = rooms.find((x) => x.id === roomId);

  const nights = Math.max(
    1,
    differenceInDays(arrivalDate, departureDate)
  );

  const grossBeforeDiscount = nightlyRate * nights;
  const subtotal = Math.max(0, grossBeforeDiscount - discountAmount);
  const vatRate = Number(selectedProperty?.vat_rate ?? 15);

  // Rates in Netpos Hospitality are treated as VAT inclusive.
  const vatAmount =
    vatRate > 0
      ? subtotal - subtotal / (1 + vatRate / 100)
      : 0;

  const filteredQuotes = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return quotes.filter((quote) => {
      if (
        statusFilter !== "all" &&
        quote.status !== statusFilter
      ) {
        return false;
      }

      if (!needle) return true;

      const guest = guests.find((g) => g.id === quote.guest_id);
      const company = companies.find((c) => c.id === quote.company_id);
      const roomType = roomTypes.find((r) => r.id === quote.room_type_id);

      const haystack = [
        quote.quotation_number,
        guest ? `${guest.first_name} ${guest.last_name}` : "",
        company?.name ?? "",
        roomType?.name ?? "",
        quote.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [
    quotes,
    guests,
    companies,
    roomTypes,
    search,
    statusFilter,
  ]);

  useEffect(() => {
    const raw = sessionStorage.getItem("netpos_staff");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Staff;
        setStaff(parsed);
      } catch {
        setStaff(null);
      }
    }

    loadBaseData();
  }, []);

  useEffect(() => {
    if (!propertyId) {
      setRoomTypes([]);
      setRooms([]);
      return;
    }

    loadPropertyData(propertyId);
    loadQuotes(propertyId);
  }, [propertyId]);

  useEffect(() => {
    if (!roomTypeId) {
      setRoomId("");
      return;
    }

    const type = roomTypes.find((x) => x.id === roomTypeId);

    if (type) {
      setNightlyRate(Number(type.base_rate ?? 0));
    }

    const firstMatchingRoom = rooms.find(
      (x) =>
        x.room_type_id === roomTypeId &&
        x.operational_status === "active"
    );

    setRoomId(firstMatchingRoom?.id ?? "");
  }, [roomTypeId, roomTypes, rooms]);

  async function loadBaseData() {
    setLoading(true);
    setError("");

    const [
      propertyResult,
      guestResult,
      companyResult,
    ] = await Promise.all([
      supabase
        .from("properties")
        .select(`
          id,
          name,
          phone,
          email,
          vat_number,
          vat_rate,
          town
        `)
        .order("name"),
      supabase
        .from("guests")
        .select(`
          id,
          first_name,
          last_name,
          phone,
          email,
          company_id
        `)
        .order("last_name"),
      supabase
        .from("companies")
        .select("id,name")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (propertyResult.error) {
      setError(propertyResult.error.message);
      setLoading(false);
      return;
    }

    if (guestResult.error) {
      setError(guestResult.error.message);
      setLoading(false);
      return;
    }

    if (companyResult.error) {
      setError(companyResult.error.message);
      setLoading(false);
      return;
    }

    const propertyRows =
      (propertyResult.data ?? []) as Property[];

    setProperties(propertyRows);
    setGuests((guestResult.data ?? []) as Guest[]);
    setCompanies((companyResult.data ?? []) as Company[]);

    const rawStaff = sessionStorage.getItem("netpos_staff");
    let parsedStaff: Staff | null = null;

    if (rawStaff) {
      try {
        parsedStaff = JSON.parse(rawStaff) as Staff;
      } catch {
        parsedStaff = null;
      }
    }

    const firstPropertyId =
      parsedStaff?.property_id ??
      propertyRows[0]?.id ??
      "";

    setPropertyId(firstPropertyId);
    setLoading(false);
  }

  async function loadPropertyData(id: string) {
    const [typeResult, roomResult] = await Promise.all([
      supabase
        .from("room_types")
        .select("id,name,base_rate")
        .eq("property_id", id)
        .order("name"),
      supabase
        .from("rooms")
        .select(`
          id,
          room_number,
          room_name,
          room_type_id,
          operational_status
        `)
        .eq("property_id", id)
        .eq("operational_status", "active")
        .order("room_number"),
    ]);

    if (typeResult.error) {
      setError(typeResult.error.message);
      return;
    }

    if (roomResult.error) {
      setError(roomResult.error.message);
      return;
    }

    const typeRows = (typeResult.data ?? []) as RoomType[];
    const roomRows = (roomResult.data ?? []) as Room[];

    setRoomTypes(typeRows);
    setRooms(roomRows);

    if (typeRows.length > 0) {
      setRoomTypeId(typeRows[0].id);
      setNightlyRate(Number(typeRows[0].base_rate ?? 0));
    } else {
      setRoomTypeId("");
      setNightlyRate(0);
    }
  }

  async function loadQuotes(id: string) {
    const { data, error: quoteError } = await supabase
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
        created_at
      `)
      .eq("property_id", id)
      .order("created_at", { ascending: false });

    if (quoteError) {
      setError(quoteError.message);
      return;
    }

    setQuotes((data ?? []) as Quotation[]);
  }

  function openNewQuote() {
    setMessage("");
    setError("");
    setGuestId("");
    setCompanyId("");
    setArrivalDate(today());
    setDepartureDate(addDays(today(), 1));
    setAdults(1);
    setChildren(0);
    setDiscountAmount(0);
    setValidUntil(addDays(today(), 7));
    setNotes("");

    if (roomTypes[0]) {
      setRoomTypeId(roomTypes[0].id);
      setNightlyRate(Number(roomTypes[0].base_rate ?? 0));
    }

    setShowForm(true);
  }

  async function saveQuote() {
    setError("");
    setMessage("");

    if (!propertyId) {
      setError("Select a property.");
      return;
    }

    if (!guestId) {
      setError("Select a guest / customer.");
      return;
    }

    if (!roomTypeId) {
      setError("Select a room type.");
      return;
    }

    if (!arrivalDate || !departureDate) {
      setError("Arrival and departure dates are required.");
      return;
    }

    if (departureDate <= arrivalDate) {
      setError("Departure must be after arrival.");
      return;
    }

    if (nightlyRate <= 0) {
      setError("Nightly rate must be greater than zero.");
      return;
    }

    setSaving(true);

    const { data, error: insertError } = await supabase
      .from("quotations")
      .insert({
        property_id: propertyId,
        guest_id: guestId,
        company_id: companyId || null,
        room_type_id: roomTypeId,
        room_id: roomId || null,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        adults,
        children,
        nightly_rate: nightlyRate,
        discount_amount: discountAmount,
        vat_rate: vatRate,
        subtotal,
        vat_amount: vatAmount,
        total_amount: subtotal,
        valid_until: validUntil,
        status: "draft",
        notes: notes.trim() || null,
      })
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
        created_at
      `)
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setShowForm(false);
    setMessage(`Quotation ${data.quotation_number} created.`);
    await loadQuotes(propertyId);
  }

  async function updateStatus(
    quote: Quotation,
    status: string
  ) {
    setError("");
    setMessage("");

    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quote.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(
      `${quote.quotation_number} marked ${status.replace("_", " ")}.`
    );

    await loadQuotes(propertyId);
  }

  function startReservation(quote: Quotation) {
    const params = new URLSearchParams();

    params.set("quoteId", quote.id);
    params.set("propertyId", quote.property_id);
    params.set("guestId", quote.guest_id);
    params.set("roomTypeId", quote.room_type_id);

    if (quote.room_id) {
      params.set("roomId", quote.room_id);
    }

    params.set("arrivalDate", quote.arrival_date);
    params.set("departureDate", quote.departure_date);
    params.set("adults", String(quote.adults));
    params.set("children", String(quote.children));
    params.set("nightlyRate", String(quote.nightly_rate));

    sessionStorage.setItem(
      "netpos_quote_to_convert",
      JSON.stringify(quote)
    );

    router.push(`/quotations/${quote.id}/convert`);
  }

  function printQuote(quote: Quotation) {
    const property = properties.find(
      (x) => x.id === quote.property_id
    );

    const guest = guests.find(
      (x) => x.id === quote.guest_id
    );

    const company = companies.find(
      (x) => x.id === quote.company_id
    );

    const roomType = roomTypes.find(
      (x) => x.id === quote.room_type_id
    );

    const room = rooms.find(
      (x) => x.id === quote.room_id
    );

    const quoteNights = Math.max(
      1,
      differenceInDays(
        quote.arrival_date,
        quote.departure_date
      )
    );

    const popup = window.open(
      "",
      "_blank",
      "width=900,height=900"
    );

    if (!popup) {
      setError("Please allow pop-ups to print the quotation.");
      return;
    }

    const guestName = guest
      ? `${guest.first_name} ${guest.last_name}`
      : "Guest";

    popup.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(quote.quotation_number)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #18324c;
            margin: 0;
            padding: 35px;
          }
          .header {
            background: #0d4e94;
            color: white;
            padding: 22px;
            border-radius: 10px;
            display: flex;
            justify-content: space-between;
          }
          h1, h2, p { margin-top: 0; }
          .muted { color: #6d7f91; }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 18px;
            margin-top: 24px;
          }
          .box {
            border: 1px solid #d7e2ec;
            border-radius: 8px;
            padding: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 22px;
          }
          th, td {
            padding: 11px;
            border-bottom: 1px solid #dce5ed;
            text-align: left;
          }
          th {
            background: #f3f7fb;
            color: #0d3f7a;
          }
          .right { text-align: right; }
          .total {
            font-size: 22px;
            font-weight: 800;
            color: #0d4e94;
          }
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #d7e2ec;
            font-size: 12px;
            color: #67798c;
          }
          @media print {
            body { padding: 10mm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>NETPOS HOSPITALITY</h1>
            <div>${escapeHtml(property?.name ?? "")}</div>
          </div>
          <div style="text-align:right">
            <h2>QUOTATION</h2>
            <div>${escapeHtml(quote.quotation_number)}</div>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <strong>Quotation For</strong>
            <p style="margin-top:10px;margin-bottom:4px">
              ${escapeHtml(guestName)}
            </p>
            ${
              company
                ? `<div>${escapeHtml(company.name)}</div>`
                : ""
            }
            ${
              guest?.phone
                ? `<div>${escapeHtml(guest.phone)}</div>`
                : ""
            }
            ${
              guest?.email
                ? `<div>${escapeHtml(guest.email)}</div>`
                : ""
            }
          </div>

          <div class="box">
            <strong>Quotation Details</strong>
            <p style="margin-top:10px;margin-bottom:4px">
              Created: ${formatDate(quote.created_at.slice(0, 10))}
            </p>
            <div>Valid until: ${formatDate(quote.valid_until)}</div>
            <div>Status: ${escapeHtml(quote.status.toUpperCase())}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Stay</th>
              <th>Nights</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                ${escapeHtml(roomType?.name ?? "Accommodation")}
                ${
                  room
                    ? ` - Room ${escapeHtml(room.room_number)}`
                    : ""
                }
                <br/>
                <span class="muted">
                  ${quote.adults} Adult(s), ${quote.children} Child(ren)
                </span>
              </td>
              <td>
                ${formatDate(quote.arrival_date)}
                to
                ${formatDate(quote.departure_date)}
              </td>
              <td>${quoteNights}</td>
              <td class="right">${money(quote.nightly_rate)}</td>
              <td class="right">${money(quote.nightly_rate * quoteNights)}</td>
            </tr>
          </tbody>
        </table>

        <div style="width:340px;margin-left:auto;margin-top:18px">
          ${
            quote.discount_amount > 0
              ? `
                <div style="display:flex;justify-content:space-between;padding:5px 0">
                  <span>Discount</span>
                  <strong>- ${money(quote.discount_amount)}</strong>
                </div>
              `
              : ""
          }

          <div style="display:flex;justify-content:space-between;padding:5px 0">
            <span>VAT (${quote.vat_rate}%) included</span>
            <strong>${money(quote.vat_amount)}</strong>
          </div>

          <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:2px solid #0d4e94">
            <span class="total">TOTAL</span>
            <span class="total">${money(quote.total_amount)}</span>
          </div>
        </div>

        ${
          quote.notes
            ? `
              <div class="box" style="margin-top:25px">
                <strong>Notes</strong>
                <p style="margin-top:8px;margin-bottom:0">
                  ${escapeHtml(quote.notes)}
                </p>
              </div>
            `
            : ""
        }

        <div class="footer">
          <strong>${escapeHtml(property?.name ?? "")}</strong><br/>
          ${escapeHtml(property?.town ?? "")}
          ${
            property?.phone
              ? ` | ${escapeHtml(property.phone)}`
              : ""
          }
          ${
            property?.email
              ? ` | ${escapeHtml(property.email)}`
              : ""
          }
          ${
            property?.vat_number
              ? `<br/>VAT No: ${escapeHtml(property.vat_number)}`
              : ""
          }
          <br/><br/>
          This quotation is valid until ${formatDate(quote.valid_until)}
          and remains subject to room availability until a reservation is confirmed.
        </div>

        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
      </html>
    `);

    popup.document.close();
  }

  return (
    <main style={page}>
      <section style={hero}>
        <div style={brandRow}>
          <div style={mark}>N</div>
          <div>
            <h1 style={brand}>NETPOS HOSPITALITY</h1>
            <div style={subtitle}>
              Quotations & Proposals
            </div>
          </div>
        </div>

        <div style={heroActions}>
          <select
            value={propertyId}
            disabled={
              staff?.role !== "owner" &&
              Boolean(staff?.property_id)
            }
            onChange={(event) =>
              setPropertyId(event.target.value)
            }
            style={heroSelect}
          >
            {properties.map((property) => (
              <option
                key={property.id}
                value={property.id}
              >
                {property.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={openNewQuote}
            style={newButton}
          >
            + New Quotation
          </button>
        </div>
      </section>

      <section style={content}>
        <div style={titleRow}>
          <div>
            <h2 style={title}>Quotations</h2>
            <p style={muted}>
              Create, print, track and convert accommodation quotations.
            </p>
          </div>

          <div style={summaryRow}>
            <Summary
              label="TOTAL"
              value={String(quotes.length)}
            />
            <Summary
              label="ACTIVE"
              value={String(
                quotes.filter((q) =>
                  ACTIVE_QUOTE_STATUSES.includes(q.status)
                ).length
              )}
            />
            <Summary
              label="ACCEPTED"
              value={String(
                quotes.filter(
                  (q) => q.status === "accepted"
                ).length
              )}
            />
            <Summary
              label="VALUE"
              value={money(
                quotes
                  .filter((q) =>
                    ACTIVE_QUOTE_STATUSES.includes(q.status)
                  )
                  .reduce(
                    (sum, q) => sum + Number(q.total_amount),
                    0
                  )
              )}
            />
          </div>
        </div>

        {error && <div style={errorBox}>{error}</div>}
        {message && <div style={successBox}>{message}</div>}

        <div style={toolbar}>
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search quote, guest, company..."
            style={searchInput}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            style={filterSelect}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
            <option value="converted">Converted</option>
          </select>
        </div>

        <div style={tableCard}>
          <div style={tableHeader}>
            <span>Quotation</span>
            <span>Guest / Customer</span>
            <span>Stay</span>
            <span>Room</span>
            <span>Status</span>
            <span style={{ textAlign: "right" }}>Total</span>
            <span style={{ textAlign: "right" }}>Actions</span>
          </div>

          {loading ? (
            <div style={emptyState}>Loading quotations...</div>
          ) : filteredQuotes.length === 0 ? (
            <div style={emptyState}>
              No quotations found. Click + New Quotation to create the first one.
            </div>
          ) : (
            filteredQuotes.map((quote) => {
              const guest = guests.find(
                (g) => g.id === quote.guest_id
              );

              const company = companies.find(
                (c) => c.id === quote.company_id
              );

              const roomType = roomTypes.find(
                (r) => r.id === quote.room_type_id
              );

              const room = rooms.find(
                (r) => r.id === quote.room_id
              );

              return (
                <div
                  key={quote.id}
                  style={tableRow}
                >
                  <div>
                    <strong style={quoteNumber}>
                      {quote.quotation_number}
                    </strong>
                    <div style={smallMuted}>
                      Valid to {formatDate(quote.valid_until)}
                    </div>
                  </div>

                  <div>
                    <strong>
                      {guest
                        ? `${guest.first_name} ${guest.last_name}`
                        : "Guest"}
                    </strong>
                    {company && (
                      <div style={smallMuted}>
                        {company.name}
                      </div>
                    )}
                  </div>

                  <div>
                    {formatDate(quote.arrival_date)}
                    <div style={smallMuted}>
                      to {formatDate(quote.departure_date)}
                    </div>
                  </div>

                  <div>
                    {roomType?.name ?? "Room"}
                    <div style={smallMuted}>
                      {room
                        ? `Room ${room.room_number}`
                        : "Room to be allocated"}
                    </div>
                  </div>

                  <div>
                    <StatusBadge status={quote.status} />
                  </div>

                  <div style={amountCell}>
                    {money(quote.total_amount)}
                  </div>

                  <div style={actionsCell}>
                    <button
                      type="button"
                      onClick={() => printQuote(quote)}
                      style={smallButton}
                    >
                      Print / PDF
                    </button>

                    {quote.status === "draft" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(quote, "sent")
                        }
                        style={smallButton}
                      >
                        Mark Sent
                      </button>
                    )}

                    {["draft", "sent"].includes(
                      quote.status
                    ) && (
                      <button
                        type="button"
                        onClick={() =>
                          updateStatus(quote, "accepted")
                        }
                        style={acceptButton}
                      >
                        Accept
                      </button>
                    )}

                    {quote.status === "accepted" && (
                      <button
                        type="button"
                        onClick={() =>
                          startReservation(quote)
                        }
                        style={convertButton}
                      >
                        Convert to Reservation
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {showForm && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div>
                <h3 style={modalTitle}>
                  New Quotation
                </h3>
                <div style={smallMuted}>
                  Create an accommodation quote
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={closeButton}
              >
                ×
              </button>
            </div>

            <div style={formGrid}>
              <Field label="Guest / Customer">
                <select
                  value={guestId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setGuestId(id);

                    const guest = guests.find(
                      (x) => x.id === id
                    );

                    setCompanyId(
                      guest?.company_id ?? ""
                    );
                  }}
                  style={input}
                >
                  <option value="">
                    Select guest...
                  </option>

                  {guests.map((guest) => (
                    <option
                      key={guest.id}
                      value={guest.id}
                    >
                      {guest.first_name} {guest.last_name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/guests?returnTo=/quotations"
                    )
                  }
                  style={addGuestButton}
                >
                  + Add New Guest / Customer
                </button>
              </Field>

              <Field label="Company">
                <select
                  value={companyId}
                  onChange={(event) =>
                    setCompanyId(event.target.value)
                  }
                  style={input}
                >
                  <option value="">
                    Private guest / no company
                  </option>
                  {companies.map((company) => (
                    <option
                      key={company.id}
                      value={company.id}
                    >
                      {company.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Arrival">
                <input
                  type="date"
                  value={arrivalDate}
                  onChange={(event) =>
                    setArrivalDate(event.target.value)
                  }
                  style={input}
                />
              </Field>

              <Field label="Departure">
                <input
                  type="date"
                  value={departureDate}
                  min={addDays(arrivalDate, 1)}
                  onChange={(event) =>
                    setDepartureDate(event.target.value)
                  }
                  style={input}
                />
              </Field>

              <Field label="Room Type">
                <select
                  value={roomTypeId}
                  onChange={(event) =>
                    setRoomTypeId(event.target.value)
                  }
                  style={input}
                >
                  <option value="">
                    Select room type...
                  </option>
                  {roomTypes.map((type) => (
                    <option
                      key={type.id}
                      value={type.id}
                    >
                      {type.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Physical Room">
                <select
                  value={roomId}
                  onChange={(event) =>
                    setRoomId(event.target.value)
                  }
                  style={input}
                >
                  <option value="">
                    Allocate later
                  </option>
                  {rooms
                    .filter(
                      (room) =>
                        room.room_type_id === roomTypeId
                    )
                    .map((room) => (
                      <option
                        key={room.id}
                        value={room.id}
                      >
                        Room {room.room_number}
                        {room.room_name
                          ? ` - ${room.room_name}`
                          : ""}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Adults">
                <input
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(event) =>
                    setAdults(
                      Math.max(
                        1,
                        Number(event.target.value)
                      )
                    )
                  }
                  style={input}
                />
              </Field>

              <Field label="Children">
                <input
                  type="number"
                  min={0}
                  value={children}
                  onChange={(event) =>
                    setChildren(
                      Math.max(
                        0,
                        Number(event.target.value)
                      )
                    )
                  }
                  style={input}
                />
              </Field>

              <Field label="Nightly Rate">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={nightlyRate}
                  onChange={(event) =>
                    setNightlyRate(
                      Number(event.target.value)
                    )
                  }
                  style={input}
                />
              </Field>

              <Field label="Discount">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountAmount}
                  onChange={(event) =>
                    setDiscountAmount(
                      Math.max(
                        0,
                        Number(event.target.value)
                      )
                    )
                  }
                  style={input}
                />
              </Field>

              <Field label="Valid Until">
                <input
                  type="date"
                  value={validUntil}
                  onChange={(event) =>
                    setValidUntil(event.target.value)
                  }
                  style={input}
                />
              </Field>

              <div style={totalBox}>
                <div style={totalLine}>
                  <span>
                    {nights} night{nights === 1 ? "" : "s"}
                  </span>
                  <strong>
                    {money(grossBeforeDiscount)}
                  </strong>
                </div>

                {discountAmount > 0 && (
                  <div style={totalLine}>
                    <span>Discount</span>
                    <strong>
                      - {money(discountAmount)}
                    </strong>
                  </div>
                )}

                <div style={totalLine}>
                  <span>
                    VAT {vatRate}% included
                  </span>
                  <strong>{money(vatAmount)}</strong>
                </div>

                <div style={grandTotalLine}>
                  <span>TOTAL</span>
                  <strong>{money(subtotal)}</strong>
                </div>
              </div>

              <div style={notesField}>
                <Field label="Notes / Terms">
                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    placeholder="Optional quotation notes..."
                    style={{
                      ...input,
                      minHeight: 72,
                      resize: "vertical",
                    }}
                  />
                </Field>
              </div>
            </div>

            <div style={modalFooter}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={cancelButton}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={saveQuote}
                style={saveButton}
              >
                {saving
                  ? "Creating..."
                  : "Create Quotation"}
              </button>
            </div>
          </div>
        </div>
      )}
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

function Summary({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={summaryCard}>
      <div style={summaryLabel}>{label}</div>
      <div style={summaryValue}>{value}</div>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, CSSProperties> = {
    draft: {
      background: "#EEF2F6",
      color: "#526579",
    },
    sent: {
      background: "#EAF4FF",
      color: "#0D5DAA",
    },
    accepted: {
      background: "#E8F8F0",
      color: "#137A4B",
    },
    declined: {
      background: "#FFF0F0",
      color: "#A03A3A",
    },
    expired: {
      background: "#FFF4DF",
      color: "#976714",
    },
    converted: {
      background: "#EAE9FF",
      color: "#4E46A5",
    },
  };

  return (
    <span
      style={{
        ...statusBadge,
        ...(styles[status] ?? styles.draft),
      }}
    >
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}

function today() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(
    d.getTime() - offset * 60 * 1000
  );
  return local.toISOString().slice(0, 10);
}

function addDays(
  dateString: string,
  days: number
) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function differenceInDays(
  start: string,
  end: string
) {
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);

  return Math.round(
    (endDate.getTime() - startDate.getTime()) /
      86400000
  );
}

function formatDate(value: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function money(value: number) {
  return `N$${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const page: CSSProperties = {
  minHeight: "100vh",
  background: "#F4F8FC",
  color: "#17324D",
  fontFamily: "Arial, sans-serif",
};

const hero: CSSProperties = {
  margin: "14px 22px 0",
  padding: "16px 18px",
  borderRadius: 12,
  background: "linear-gradient(135deg,#0B4E8A,#0D668F)",
  color: "#fff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
};

const brandRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const mark: CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  background: "#fff",
  color: "#0D4E94",
  fontSize: 24,
  fontWeight: 900,
};

const brand: CSSProperties = {
  margin: 0,
  fontSize: 22,
  letterSpacing: 1.2,
};

const subtitle: CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  opacity: 0.9,
};

const heroActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const heroSelect: CSSProperties = {
  minWidth: 240,
  padding: "9px 10px",
  border: 0,
  borderRadius: 8,
  background: "#fff",
  color: "#17324D",
  fontSize: 10,
  fontWeight: 700,
};

const newButton: CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "10px 14px",
  background: "#FFFFFF",
  color: "#0D4E94",
  fontSize: 10,
  fontWeight: 900,
  cursor: "pointer",
};

const content: CSSProperties = {
  padding: "17px 22px 30px",
};

const titleRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 18,
  marginBottom: 13,
};

const title: CSSProperties = {
  margin: 0,
  color: "#0D3F7A",
  fontSize: 26,
};

const muted: CSSProperties = {
  margin: "4px 0 0",
  color: "#718196",
  fontSize: 10,
};

const summaryRow: CSSProperties = {
  display: "flex",
  gap: 7,
};

const summaryCard: CSSProperties = {
  minWidth: 92,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #D6E2ED",
  background: "#FFFFFF",
};

const summaryLabel: CSSProperties = {
  color: "#718196",
  fontSize: 7,
  fontWeight: 900,
};

const summaryValue: CSSProperties = {
  marginTop: 3,
  color: "#0D4E94",
  fontSize: 14,
  fontWeight: 900,
};

const toolbar: CSSProperties = {
  display: "flex",
  gap: 8,
  marginBottom: 10,
};

const searchInput: CSSProperties = {
  flex: 1,
  padding: "9px 11px",
  border: "1px solid #CEDBE7",
  borderRadius: 8,
  background: "#fff",
  fontSize: 10,
};

const filterSelect: CSSProperties = {
  width: 160,
  padding: "9px 10px",
  border: "1px solid #CEDBE7",
  borderRadius: 8,
  background: "#fff",
  fontSize: 10,
};

const tableCard: CSSProperties = {
  border: "1px solid #D5E1EC",
  borderRadius: 10,
  overflow: "hidden",
  background: "#fff",
};

const tableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.05fr 1.25fr 1fr 1fr .75fr .75fr 2fr",
  gap: 10,
  alignItems: "center",
  padding: "9px 12px",
  background: "#EDF4FA",
  color: "#456077",
  fontSize: 8,
  fontWeight: 900,
};

const tableRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.05fr 1.25fr 1fr 1fr .75fr .75fr 2fr",
  gap: 10,
  alignItems: "center",
  padding: "11px 12px",
  borderTop: "1px solid #E1E8EF",
  fontSize: 9,
};

const quoteNumber: CSSProperties = {
  color: "#0D4E94",
};

const smallMuted: CSSProperties = {
  marginTop: 3,
  color: "#78899B",
  fontSize: 8,
};

const amountCell: CSSProperties = {
  textAlign: "right",
  fontWeight: 900,
  color: "#0D3F7A",
};

const actionsCell: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  flexWrap: "wrap",
  gap: 5,
};

const smallButton: CSSProperties = {
  border: "1px solid #BCCBDA",
  borderRadius: 6,
  padding: "6px 7px",
  background: "#fff",
  color: "#31526D",
  fontSize: 7,
  fontWeight: 800,
  cursor: "pointer",
};

const acceptButton: CSSProperties = {
  ...smallButton,
  border: "1px solid #9BD7B8",
  color: "#137A4B",
  background: "#F0FBF5",
};

const convertButton: CSSProperties = {
  ...smallButton,
  border: 0,
  background: "#0D5FA8",
  color: "#fff",
};

const statusBadge: CSSProperties = {
  display: "inline-block",
  padding: "5px 7px",
  borderRadius: 20,
  fontSize: 7,
  fontWeight: 900,
};

const emptyState: CSSProperties = {
  padding: 30,
  textAlign: "center",
  color: "#77899A",
  fontSize: 10,
};

const errorBox: CSSProperties = {
  marginBottom: 10,
  padding: "9px 11px",
  borderRadius: 7,
  border: "1px solid #F0B6B6",
  background: "#FFF3F3",
  color: "#A33B3B",
  fontSize: 9,
};

const successBox: CSSProperties = {
  marginBottom: 10,
  padding: "9px 11px",
  borderRadius: 7,
  border: "1px solid #A9DFC4",
  background: "#F0FBF5",
  color: "#137A4B",
  fontSize: 9,
};

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2000,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  background: "rgba(15,37,58,.48)",
};

const modal: CSSProperties = {
  width: "min(900px,95vw)",
  maxHeight: "92vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 24px 70px rgba(0,0,0,.22)",
};

const modalHeader: CSSProperties = {
  padding: "16px 18px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #DCE5ED",
};

const modalTitle: CSSProperties = {
  margin: 0,
  color: "#0D3F7A",
  fontSize: 19,
};

const closeButton: CSSProperties = {
  border: 0,
  background: "transparent",
  fontSize: 26,
  color: "#77899A",
  cursor: "pointer",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 12,
  padding: 18,
};

const field: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const fieldLabel: CSSProperties = {
  color: "#4E6478",
  fontSize: 8,
  fontWeight: 900,
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  border: "1px solid #C9D7E3",
  borderRadius: 7,
  background: "#fff",
  color: "#17324D",
  fontSize: 10,
};

const addGuestButton: CSSProperties = {
  alignSelf: "flex-start",
  border: 0,
  background: "transparent",
  color: "#0D5DAA",
  padding: 0,
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const totalBox: CSSProperties = {
  padding: 11,
  borderRadius: 8,
  background: "#F3F8FC",
  border: "1px solid #D7E4EF",
  alignSelf: "end",
};

const totalLine: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
  padding: "3px 0",
  fontSize: 9,
};

const grandTotalLine: CSSProperties = {
  ...totalLine,
  marginTop: 5,
  paddingTop: 7,
  borderTop: "2px solid #0D5DAA",
  color: "#0D4E94",
  fontSize: 13,
  fontWeight: 900,
};

const notesField: CSSProperties = {
  gridColumn: "1 / -1",
};

const modalFooter: CSSProperties = {
  padding: "13px 18px",
  borderTop: "1px solid #DCE5ED",
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

const cancelButton: CSSProperties = {
  border: "1px solid #C6D3DF",
  borderRadius: 7,
  padding: "9px 12px",
  background: "#fff",
  color: "#52677B",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};

const saveButton: CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: "9px 13px",
  background: "#0D5FA8",
  color: "#fff",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};


