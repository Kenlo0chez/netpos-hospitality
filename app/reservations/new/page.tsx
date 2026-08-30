"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type Property = {
  id: string;
  name: string;
  vat_rate: number | null;
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
  operational_status: string;
};

type RatePlan = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  applies_monday: boolean;
  applies_tuesday: boolean;
  applies_wednesday: boolean;
  applies_thursday: boolean;
  applies_friday: boolean;
  applies_saturday: boolean;
  applies_sunday: boolean;
  priority: number;
  is_active: boolean;
};

type RoomRate = {
  id: string;
  nightly_rate: number;
  single_occupancy_rate: number | null;
  double_occupancy_rate: number | null;
  extra_adult_rate: number;
  extra_child_rate: number;
  minimum_nights: number;
  is_active: boolean;
  rate_plans: RatePlan | null;
};

type NightPrice = {
  date: string;
  rate: number;
  planName: string;
};

export default function NewReservationPage() {
  const router = useRouter();

  const prefillPropertyId = useRef("");
  const prefillRoomTypeId = useRef("");
  const prefillRoomId = useRef("");
  const openedFromBoard = useRef(false);

  const [step, setStep] = useState(1);

  const [properties, setProperties] = useState<Property[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomRates, setRoomRates] = useState<RoomRate[]>([]);

  const [propertyId, setPropertyId] = useState("");
  const [bookingSource, setBookingSource] = useState("walk_in");
  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomId, setRoomId] = useState("");

  const [calendarRoomLocked, setCalendarRoomLocked] = useState(false);

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [guestId, setGuestId] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [depositRequired, setDepositRequired] = useState(0);
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);

  const [availability, setAvailability] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");

  const [availabilityMessage, setAvailabilityMessage] = useState("");

  const [saving, setSaving] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [savingGuest, setSavingGuest] = useState(false);

  const [newFirstName, setNewFirstName] = useState("");
  const [newSurname, setNewSurname] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newIdNumber, setNewIdNumber] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");

  useEffect(() => {
    initialisePage();
  }, []);

  async function initialisePage() {
    const today = getTodayString();

    let initialArrival = today;
    let initialDeparture = addDays(today, 1);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);

      const property = params.get("propertyId") ?? "";
      const roomType = params.get("roomTypeId") ?? "";
      const room = params.get("roomId") ?? "";

      const arrival =
        params.get("arrival") ??
        params.get("arrivalDate") ??
        "";

      const departure =
        params.get("departure") ??
        params.get("departureDate") ??
        "";

      const from = params.get("from") ?? "";

      prefillPropertyId.current = property;
      prefillRoomTypeId.current = roomType;
      prefillRoomId.current = room;
      openedFromBoard.current = from === "board";

      if (isValidDateString(arrival)) {
        initialArrival = arrival;
      }

      if (
        isValidDateString(departure) &&
        departure > initialArrival
      ) {
        initialDeparture = departure;
      } else {
        initialDeparture = addDays(initialArrival, 1);
      }
    }

    setArrivalDate(initialArrival);
    setDepartureDate(initialDeparture);

    await Promise.all([
      loadProperties(),
      loadGuests(),
      loadCompanies(),
    ]);
  }

  async function loadProperties() {
    const { data, error } = await supabase
      .from("properties")
      .select("id,name,vat_rate")
      .order("name");

    if (error) {
      alert(`Properties: ${error.message}`);
      return;
    }

    const rows = (data as Property[]) ?? [];
    setProperties(rows);

    if (
      prefillPropertyId.current &&
      rows.some(
        (property) => property.id === prefillPropertyId.current
      )
    ) {
      setPropertyId(prefillPropertyId.current);
      return;
    }

    if (rows.length === 1) {
      setPropertyId(rows[0].id);
    }
  }

  async function loadGuests() {
    const { data, error } = await supabase
      .from("guests")
      .select(`
        id,
        first_name,
        last_name,
        phone,
        email,
        company_id
      `)
      .order("last_name");

    if (error) {
      alert(`Guests: ${error.message}`);
      return;
    }

    setGuests((data as Guest[]) ?? []);
  }

  async function loadCompanies() {
    const { data, error } = await supabase
      .from("companies")
      .select("id,name")
      .eq("is_active", true)
      .order("name");

    if (error) {
      alert(`Companies: ${error.message}`);
      return;
    }

    setCompanies((data as Company[]) ?? []);
  }

  useEffect(() => {
    if (!propertyId) {
      setRoomTypes([]);
      setRoomTypeId("");
      setRoomId("");
      setRooms([]);
      setRoomRates([]);
      setCalendarRoomLocked(false);
      return;
    }

    loadRoomTypes();
  }, [propertyId]);

  async function loadRoomTypes() {
    const { data, error } = await supabase
      .from("room_types")
      .select(`
        id,
        name,
        base_rate
      `)
      .eq("property_id", propertyId)
      .order("name");

    if (error) {
      alert(`Room Types: ${error.message}`);
      return;
    }

    const rows = (data as RoomType[]) ?? [];

    setRoomTypes(rows);

    if (
      prefillRoomTypeId.current &&
      rows.some(
        (roomType) => roomType.id === prefillRoomTypeId.current
      )
    ) {
      setRoomTypeId(prefillRoomTypeId.current);
      return;
    }

    if (rows.length === 1) {
      setRoomTypeId(rows[0].id);
    }
  }

  useEffect(() => {
    if (!propertyId || !roomTypeId) {
      setRooms([]);
      setRoomRates([]);
      setRoomId("");
      setCalendarRoomLocked(false);
      return;
    }

    loadRooms();
    loadRates();
  }, [propertyId, roomTypeId]);

  async function loadRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select(`
        id,
        room_number,
        room_name,
        operational_status
      `)
      .eq("property_id", propertyId)
      .eq("room_type_id", roomTypeId)
      .eq("operational_status", "active")
      .order("room_number");

    if (error) {
      alert(`Rooms: ${error.message}`);
      return;
    }

    const rows = (data as Room[]) ?? [];

    setRooms(rows);

    if (
      prefillRoomId.current &&
      rows.some((room) => room.id === prefillRoomId.current)
    ) {
      setRoomId(prefillRoomId.current);

      if (openedFromBoard.current) {
        setCalendarRoomLocked(true);
      }

      return;
    }

    if (rows.length === 1) {
      setRoomId(rows[0].id);
    }
  }

  async function loadRates() {
    const { data, error } = await supabase
      .from("room_rates")
      .select(`
        id,
        nightly_rate,
        single_occupancy_rate,
        double_occupancy_rate,
        extra_adult_rate,
        extra_child_rate,
        minimum_nights,
        is_active,

        rate_plans!inner (
          id,
          name,
          start_date,
          end_date,
          applies_monday,
          applies_tuesday,
          applies_wednesday,
          applies_thursday,
          applies_friday,
          applies_saturday,
          applies_sunday,
          priority,
          is_active
        )
      `)
      .eq("property_id", propertyId)
      .eq("room_type_id", roomTypeId)
      .eq("is_active", true)
      .eq("rate_plans.is_active", true);

    if (error) {
      alert(`Rates: ${error.message}`);
      return;
    }

    setRoomRates((data as unknown as RoomRate[]) ?? []);
  }

  const nights = useMemo(() => {
    if (!arrivalDate || !departureDate) {
      return 0;
    }

    const arrival = parseDate(arrivalDate);
    const departure = parseDate(departureDate);

    if (!arrival || !departure) {
      return 0;
    }

    const difference = departure.getTime() - arrival.getTime();

    return Math.max(0, Math.round(difference / 86400000));
  }, [arrivalDate, departureDate]);

  const nightlyBreakdown = useMemo<NightPrice[]>(() => {
    if (
      !arrivalDate ||
      !departureDate ||
      nights <= 0 ||
      !roomTypeId
    ) {
      return [];
    }

    const result: NightPrice[] = [];
    const start = parseDate(arrivalDate);

    if (!start) {
      return [];
    }

    for (let index = 0; index < nights; index++) {
      const nightDate = new Date(start);

      nightDate.setUTCDate(
        nightDate.getUTCDate() + index
      );

      const dateString = formatDateForDatabase(nightDate);

      const applicableRates = roomRates
        .filter((roomRate) =>
          rateAppliesOnDate(
            roomRate,
            dateString,
            nightDate,
            nights
          )
        )
        .sort(
          (a, b) =>
            Number(b.rate_plans?.priority ?? 0) -
            Number(a.rate_plans?.priority ?? 0)
        );

      const selectedRate = applicableRates[0];

      if (selectedRate) {
        result.push({
          date: dateString,
          rate: calculateOccupancyRate(
            selectedRate,
            adults,
            children
          ),
          planName:
            selectedRate.rate_plans?.name ?? "Room Rate",
        });

        continue;
      }

      const roomType = roomTypes.find(
        (type) => type.id === roomTypeId
      );

      result.push({
        date: dateString,
        rate: Number(roomType?.base_rate ?? 0),
        planName: "Base Rate",
      });
    }

    return result;
  }, [
    arrivalDate,
    departureDate,
    nights,
    roomTypeId,
    roomRates,
    roomTypes,
    adults,
    children,
  ]);

  const subtotal = useMemo(() => {
    return nightlyBreakdown.reduce(
      (total, night) => total + night.rate,
      0
    );
  }, [nightlyBreakdown]);

  const totalAmount = Math.max(
    0,
    subtotal - Number(discountAmount || 0)
  );

  const selectedProperty = properties.find(
    (property) => property.id === propertyId
  );

  const selectedRoomType = roomTypes.find(
    (roomType) => roomType.id === roomTypeId
  );

  const selectedRoom = rooms.find(
    (room) => room.id === roomId
  );

  const selectedGuest = guests.find(
    (guest) => guest.id === guestId
  );

  const selectedCompany = companies.find(
    (company) => company.id === selectedGuest?.company_id
  );

  const vatRate = Number(selectedProperty?.vat_rate ?? 15);

  const vatAmount =
    vatRate > 0
      ? totalAmount -
        totalAmount / (1 + vatRate / 100)
      : 0;

  const averageNightlyRate =
    nights > 0 ? subtotal / nights : 0;

  const selectedRatePlanNames = Array.from(
    new Set(
      nightlyBreakdown.map((night) => night.planName)
    )
  );

  useEffect(() => {
    setAvailability("idle");
    setAvailabilityMessage("");

    if (
      !roomId ||
      !arrivalDate ||
      !departureDate ||
      nights <= 0
    ) {
      return;
    }

    checkRoomAvailability();
  }, [
    roomId,
    arrivalDate,
    departureDate,
    nights,
  ]);

  async function checkRoomAvailability() {
    if (
      !roomId ||
      !arrivalDate ||
      !departureDate ||
      nights <= 0
    ) {
      setAvailability("idle");
      return false;
    }

    setAvailability("checking");
    setAvailabilityMessage("Checking room availability...");

    const { data, error } = await supabase
      .from("reservation_rooms")
      .select(`
        id,
        arrival_date,
        departure_date,

        reservations!inner (
          id,
          reservation_number,
          status
        )
      `)
      .eq("room_id", roomId)
      .lt("arrival_date", departureDate)
      .gt("departure_date", arrivalDate)
      .in("reservations.status", [
        "provisional",
        "confirmed",
        "checked_in",
      ]);

    if (error) {
      setAvailability("idle");
      setAvailabilityMessage("");

      alert(
        `Availability check failed: ${error.message}`
      );

      return false;
    }

    if (data && data.length > 0) {
      setAvailability("unavailable");
      setAvailabilityMessage(
        "This room is already reserved during part of the selected stay."
      );

      return false;
    }

    setAvailability("available");
    setAvailabilityMessage(
      "This physical room is available for the selected dates."
    );

    return true;
  }

  async function nextStep() {
    if (step === 1) {
      if (!propertyId) {
        alert("Please select a property.");
        return;
      }

      if (!arrivalDate || !departureDate) {
        alert(
          "Please select check-in and check-out dates."
        );
        return;
      }

      if (nights <= 0) {
        alert("Check-out must be after check-in.");
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (!roomTypeId) {
        alert("Please select a room type.");
        return;
      }

      if (!roomId) {
        alert("Please select a physical room.");
        return;
      }

      if (subtotal <= 0) {
        alert(
          "No valid price was found. Please configure a room rate first."
        );
        return;
      }

      const available = await checkRoomAvailability();

      if (!available) {
        return;
      }

      setStep(3);
      return;
    }

    if (step === 3) {
      if (!guestId) {
        alert("Please select or add a guest.");
        return;
      }

      setStep(4);
    }
  }

  function openGuestModal() {
    setNewFirstName("");
    setNewSurname("");
    setNewMobile("");
    setNewEmail("");
    setNewIdNumber("");
    setNewCompanyId("");

    setShowGuestModal(true);
  }

  function closeGuestModal() {
    if (savingGuest) {
      return;
    }

    setShowGuestModal(false);
  }

  async function saveNewGuest(event: React.FormEvent) {
    event.preventDefault();

    if (
      !newFirstName.trim() ||
      !newSurname.trim() ||
      !newMobile.trim()
    ) {
      alert(
        "First name, surname and mobile number are required."
      );

      return;
    }

    setSavingGuest(true);

    const { data, error } = await supabase
      .from("guests")
      .insert({
        first_name: newFirstName.trim(),
        last_name: newSurname.trim(),
        phone: newMobile.trim(),
        whatsapp_number: newMobile.trim(),
        email: newEmail.trim() || null,
        id_number: newIdNumber.trim() || null,
        company_id: newCompanyId || null,
        nationality: null,
        address: null,
        notes: null,
      })
      .select(`
        id,
        first_name,
        last_name,
        phone,
        email,
        company_id
      `)
      .single();

    setSavingGuest(false);

    if (error || !data) {
      alert(
        error?.message ?? "Could not create guest."
      );
      return;
    }

    const newGuest = data as Guest;

    setGuests((current) =>
      [...current, newGuest].sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      )
    );

    setGuestId(newGuest.id);
    setShowGuestModal(false);
  }

  async function saveReservation() {
    if (saving) {
      return;
    }

    if (
      !propertyId ||
      !roomTypeId ||
      !roomId ||
      !guestId
    ) {
      alert(
        "The reservation is missing required information."
      );
      return;
    }

    const available = await checkRoomAvailability();

    if (!available) {
      setStep(2);
      return;
    }

    setSaving(true);

    const reservationNumber = createReservationNumber();

    const {
      data: reservation,
      error: reservationError,
    } = await supabase
      .from("reservations")
      .insert({
        property_id: propertyId,
        guest_id: guestId,
        company_id: selectedGuest?.company_id ?? null,
        quotation_id: null,
        reservation_number: reservationNumber,
        status: "confirmed",
        booking_source: bookingSource,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        adults,
        children,
        subtotal,
        discount_amount: Number(discountAmount || 0),
        vat_amount: vatAmount,
        total_amount: totalAmount,
        deposit_required: Number(depositRequired || 0),
        notes: notes.trim() || null,
      })
      .select("id,reservation_number")
      .single();

    if (reservationError || !reservation) {
      setSaving(false);

      alert(
        reservationError?.message ??
          "Could not create reservation."
      );

      return;
    }

    const primaryRate = findPrimaryRate();

    const { error: roomInsertError } = await supabase
      .from("reservation_rooms")
      .insert({
        reservation_id: reservation.id,
        room_type_id: roomTypeId,
        room_id: roomId,
        rate_plan_id: primaryRate?.rate_plans?.id ?? null,
        adults,
        children,
        nightly_rate: averageNightlyRate,
        original_rate: averageNightlyRate,
        rate_override_reason: null,
        discount_amount: Number(discountAmount || 0),
        arrival_date: arrivalDate,
        departure_date: departureDate,
      });

    if (roomInsertError) {
      await supabase
        .from("reservations")
        .delete()
        .eq("id", reservation.id);

      setSaving(false);

      alert(roomInsertError.message);
      return;
    }

    setSaving(false);

    router.push("/reservations");
    router.refresh();
  }

  function findPrimaryRate() {
    if (!arrivalDate) {
      return null;
    }

    const date = parseDate(arrivalDate);

    if (!date) {
      return null;
    }

    return (
      roomRates
        .filter((roomRate) =>
          rateAppliesOnDate(
            roomRate,
            arrivalDate,
            date,
            nights
          )
        )
        .sort(
          (a, b) =>
            Number(b.rate_plans?.priority ?? 0) -
            Number(a.rate_plans?.priority ?? 0)
        )[0] ?? null
    );
  }

  function changeCalendarRoom() {
    setCalendarRoomLocked(false);
  }

  return (
    <main style={pageStyle}>
      <div style={pageHeader}>
        <div>
          <div style={eyebrow}>
            NETPOS HOSPITALITY
          </div>

          <h1 style={pageTitle}>
            New Reservation
          </h1>

          <div style={pageSubtitle}>
            Fast front-desk booking
          </div>
        </div>

        <div style={headerRight}>
          <button
            type="button"
            onClick={() =>
              router.push("/reservations")
            }
            style={backToBoardButton}
          >
            â† Availability Board
          </button>

          <div style={stepCounter}>
            Step {step} of 4
          </div>
        </div>
      </div>

      <WizardProgress currentStep={step} />

      {step === 1 && (
        <section style={wizardCard}>
          <StepHeading
            number="1"
            title="Stay Details"
            description="Confirm the guest's stay dates."
          />

          {openedFromBoard.current && (
            <div style={calendarPrefillNotice}>
              <strong>
                âœ“ Selected from Availability Board
              </strong>

              <span>
                Room and dates were selected on the calendar.
              </span>
            </div>
          )}

          <div style={twoColumns}>
            <Field label="Property">
              <select
                value={propertyId}
                onChange={(event) => {
                  prefillRoomTypeId.current = "";
                  prefillRoomId.current = "";

                  setPropertyId(event.target.value);
                  setRoomTypeId("");
                  setRoomId("");
                  setCalendarRoomLocked(false);
                }}
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

            <Field label="Booking Source">
              <select
                value={bookingSource}
                onChange={(event) =>
                  setBookingSource(event.target.value)
                }
                style={inputStyle}
              >
                <option value="walk_in">Walk-in</option>
                <option value="phone">Phone</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="website">Website</option>
                <option value="agent">Agent</option>
                <option value="corporate">Corporate</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>

          <div
            style={{
              ...twoColumns,
              marginTop: 16,
            }}
          >
            <Field label="Check-in">
              <input
                type="date"
                value={arrivalDate}
                onChange={(event) => {
                  const value = event.target.value;

                  setArrivalDate(value);

                  if (
                    value &&
                    (
                      !departureDate ||
                      departureDate <= value
                    )
                  ) {
                    setDepartureDate(
                      addDays(value, 1)
                    );
                  }
                }}
                style={inputStyle}
              />
            </Field>

            <Field label="Check-out">
              <input
                type="date"
                min={
                  arrivalDate
                    ? addDays(arrivalDate, 1)
                    : undefined
                }
                value={departureDate}
                onChange={(event) =>
                  setDepartureDate(event.target.value)
                }
                style={inputStyle}
              />
            </Field>
          </div>

          {nights > 0 && (
            <div style={staySummary}>
              <div>
                <span style={summaryLabel}>
                  Selected Stay
                </span>

                <strong>
                  {formatFriendlyDate(arrivalDate)}
                  {" â†’ "}
                  {formatFriendlyDate(departureDate)}
                </strong>
              </div>

              <div style={nightBadge}>
                {nights}{" "}
                {nights === 1 ? "Night" : "Nights"}
              </div>
            </div>
          )}

          <WizardButtons
            nextLabel="Choose Room â†’"
            onNext={nextStep}
          />
        </section>
      )}

      {step === 2 && (
        <section style={wizardCard}>
          <StepHeading
            number="2"
            title="Room & Occupancy"
            description={
              calendarRoomLocked
                ? "Confirm the room already selected from the calendar."
                : "Select or change the room for this reservation."
            }
          />

          <div style={stayStrip}>
            {formatFriendlyDate(arrivalDate)}
            <strong>â†’</strong>
            {formatFriendlyDate(departureDate)}
            <strong>
              Â· {nights}{" "}
              {nights === 1 ? "Night" : "Nights"}
            </strong>
          </div>

          {calendarRoomLocked && selectedRoom ? (
            <div style={calendarRoomCard}>
              <div style={calendarRoomBadge}>
                SELECTED FROM CALENDAR
              </div>

              <div style={calendarRoomMain}>
                <div>
                  <span style={summaryLabel}>
                    Physical Room
                  </span>

                  <strong style={calendarRoomNumber}>
                    Room {selectedRoom.room_number}
                  </strong>

                  {selectedRoom.room_name && (
                    <div style={calendarRoomName}>
                      {selectedRoom.room_name}
                    </div>
                  )}
                </div>

                <div>
                  <span style={summaryLabel}>
                    Room Type
                  </span>

                  <strong>
                    {selectedRoomType?.name ?? "-"}
                  </strong>
                </div>

                <div>
                  <span style={summaryLabel}>
                    Stay
                  </span>

                  <strong>
                    {nights}{" "}
                    {nights === 1 ? "Night" : "Nights"}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={changeCalendarRoom}
                style={changeRoomButton}
              >
                Change Room
              </button>
            </div>
          ) : (
            <>
              <div style={twoColumns}>
                <Field label="Room Type">
                  <select
                    value={roomTypeId}
                    onChange={(event) => {
                      prefillRoomId.current = "";

                      setRoomTypeId(event.target.value);
                      setRoomId("");
                      setCalendarRoomLocked(false);
                    }}
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

                <Field label="Physical Room">
                  <select
                    value={roomId}
                    onChange={(event) =>
                      setRoomId(event.target.value)
                    }
                    disabled={!roomTypeId}
                    style={inputStyle}
                  >
                    <option value="">
                      Select Room
                    </option>

                    {rooms.map((room) => (
                      <option
                        key={room.id}
                        value={room.id}
                      >
                        Room {room.room_number}
                        {room.room_name
                          ? ` Â· ${room.room_name}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              {selectedRoom && (
                <div style={selectedRoomCard}>
                  <div>
                    <span style={summaryLabel}>
                      Physical Room
                    </span>

                    <strong style={selectedRoomNumber}>
                      Room {selectedRoom.room_number}
                    </strong>
                  </div>

                  <div>
                    <span style={summaryLabel}>
                      Room Type
                    </span>

                    <strong>
                      {selectedRoomType?.name}
                    </strong>
                  </div>
                </div>
              )}
            </>
          )}

          <div
            style={{
              ...twoColumns,
              marginTop: 16,
            }}
          >
            <Field label="Adults">
              <select
                value={adults}
                onChange={(event) =>
                  setAdults(
                    Number(event.target.value)
                  )
                }
                style={inputStyle}
              >
                {[1, 2, 3, 4, 5, 6].map((number) => (
                  <option
                    key={number}
                    value={number}
                  >
                    {number}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Children">
              <select
                value={children}
                onChange={(event) =>
                  setChildren(
                    Number(event.target.value)
                  )
                }
                style={inputStyle}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((number) => (
                  <option
                    key={number}
                    value={number}
                  >
                    {number}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {roomId && (
            <div style={{ marginTop: 16 }}>
              {availability === "checking" && (
                <div style={checkingStyle}>
                  Checking room availability...
                </div>
              )}

              {availability === "available" && (
                <div style={availableStyle}>
                  <strong>
                    âœ“ ROOM AVAILABLE
                  </strong>

                  <div style={statusSubtext}>
                    {availabilityMessage}
                  </div>
                </div>
              )}

              {availability === "unavailable" && (
                <div style={unavailableStyle}>
                  <strong>
                    âœ• ROOM UNAVAILABLE
                  </strong>

                  <div style={statusSubtext}>
                    {availabilityMessage}
                  </div>
                </div>
              )}
            </div>
          )}

          {roomTypeId && subtotal > 0 && (
            <div style={pricePreview}>
              <div>
                <span style={summaryLabel}>
                  Average Rate
                </span>

                <strong style={priceValue}>
                  N${averageNightlyRate.toFixed(2)}
                </strong>
              </div>

              <div>
                <span style={summaryLabel}>
                  Rate Plan
                </span>

                <strong>
                  {selectedRatePlanNames.join(" + ")}
                </strong>
              </div>

              <div>
                <span style={summaryLabel}>
                  Accommodation
                </span>

                <strong style={priceValue}>
                  N${subtotal.toFixed(2)}
                </strong>
              </div>
            </div>
          )}

          <WizardButtons
            showBack
            onBack={() => setStep(1)}
            nextLabel={
              availability === "checking"
                ? "Checking..."
                : availability === "unavailable"
                ? "Room Unavailable"
                : "Guest Details â†’"
            }
            nextDisabled={
              availability === "checking" ||
              availability === "unavailable"
            }
            onNext={nextStep}
          />
        </section>
      )}

      {step === 3 && (
        <section style={wizardCard}>
          <StepHeading
            number="3"
            title="Guest / Customer"
            description="Select an existing guest or add a new one."
          />

          <Field label="Guest / Customer">
            <select
              value={guestId}
              onChange={(event) => {
                const value = event.target.value;

                if (value === "__new_guest__") {
                  openGuestModal();
                  return;
                }

                setGuestId(value);
              }}
              style={largeSelect}
            >
              <option value="">
                Select Guest / Customer
              </option>

              <option value="__new_guest__">
                + Add New Guest / Customer
              </option>

              {guests.map((guest) => (
                <option
                  key={guest.id}
                  value={guest.id}
                >
                  {guest.first_name} {guest.last_name}
                  {guest.phone
                    ? ` Â· ${guest.phone}`
                    : ""}
                </option>
              ))}
            </select>
          </Field>

          <button
            type="button"
            onClick={openGuestModal}
            style={addGuestButton}
          >
            + Add New Guest / Customer
          </button>

          {selectedGuest && (
            <div style={guestSelectedCard}>
              <div style={guestAvatar}>
                {selectedGuest.first_name
                  .slice(0, 1)
                  .toUpperCase()}

                {selectedGuest.last_name
                  .slice(0, 1)
                  .toUpperCase()}
              </div>

              <div style={{ flex: 1 }}>
                <strong style={guestName}>
                  {selectedGuest.first_name}{" "}
                  {selectedGuest.last_name}
                </strong>

                <div style={guestMeta}>
                  {selectedGuest.phone ?? "No mobile"}
                </div>

                <div style={guestMeta}>
                  {selectedCompany?.name ??
                    "Private / Walk-in"}
                </div>
              </div>

              <div style={selectedBadge}>
                Selected âœ“
              </div>
            </div>
          )}

          <WizardButtons
            showBack
            onBack={() => setStep(2)}
            nextLabel="Review Booking â†’"
            onNext={nextStep}
          />
        </section>
      )}

      {step === 4 && (
        <section style={wizardCard}>
          <StepHeading
            number="4"
            title="Review & Confirm"
            description="Check the booking before confirming."
          />

          <div style={reviewGrid}>
            <ReviewItem
              label="Guest"
              value={
                selectedGuest
                  ? `${selectedGuest.first_name} ${selectedGuest.last_name}`
                  : "-"
              }
            />

            <ReviewItem
              label="Property"
              value={selectedProperty?.name ?? "-"}
            />

            <ReviewItem
              label="Room"
              value={
                selectedRoom
                  ? `Room ${selectedRoom.room_number}`
                  : "-"
              }
            />

            <ReviewItem
              label="Room Type"
              value={selectedRoomType?.name ?? "-"}
            />

            <ReviewItem
              label="Check-in"
              value={formatFriendlyDate(arrivalDate)}
            />

            <ReviewItem
              label="Check-out"
              value={formatFriendlyDate(departureDate)}
            />

            <ReviewItem
              label="Stay"
              value={`${nights} ${
                nights === 1 ? "Night" : "Nights"
              }`}
            />

            <ReviewItem
              label="Occupancy"
              value={`${adults} ${
                adults === 1 ? "Adult" : "Adults"
              }${
                children > 0
                  ? ` Â· ${children} ${
                      children === 1
                        ? "Child"
                        : "Children"
                    }`
                  : ""
              }`}
            />
          </div>

          <div style={financialBox}>
            <MoneyRow
              label="Accommodation"
              value={subtotal}
            />

            <div style={moneyEditRow}>
              <label>Discount</label>

              <div style={moneyInputWrap}>
                <span>N$</span>

                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountAmount}
                  onChange={(event) =>
                    setDiscountAmount(
                      Number(event.target.value)
                    )
                  }
                  style={moneyInput}
                />
              </div>
            </div>

            <div style={moneyEditRow}>
              <label>
                Deposit Required
              </label>

              <div style={moneyInputWrap}>
                <span>N$</span>

                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={depositRequired}
                  onChange={(event) =>
                    setDepositRequired(
                      Number(event.target.value)
                    )
                  }
                  style={moneyInput}
                />
              </div>
            </div>

            <MoneyRow
              label={`VAT Included (${vatRate}%)`}
              value={vatAmount}
              muted
            />

            <div style={grandTotalRow}>
              <span>TOTAL</span>

              <strong>
                N${totalAmount.toFixed(2)}
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowMore(!showMore)
            }
            style={moreButton}
          >
            {showMore
              ? "âˆ’ Hide Notes"
              : "+ More Details / Notes"}
          </button>

          {showMore && (
            <div style={{ marginTop: 12 }}>
              <Field label="Reservation Notes">
                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(event.target.value)
                  }
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                  }}
                  placeholder="Special requests, arrival notes, payment notes..."
                />
              </Field>
            </div>
          )}

          <div style={finalButtons}>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={saving}
              style={backButton}
            >
              â† Back
            </button>

            <button
              type="button"
              onClick={saveReservation}
              disabled={saving}
              style={{
                ...confirmButton,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving
                ? "Confirming..."
                : "Confirm Reservation"}
            </button>
          </div>
        </section>
      )}

      {showGuestModal && (
        <div style={modalOverlay}>
          <form
            onSubmit={saveNewGuest}
            style={modalCard}
          >
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>
                  Add New Guest
                </h2>

                <div style={modalSubtitle}>
                  Create the guest without leaving this reservation.
                </div>
              </div>

              <button
                type="button"
                onClick={closeGuestModal}
                style={closeButton}
              >
                Ã—
              </button>
            </div>

            <div style={twoColumns}>
              <Field label="First Name">
                <input
                  value={newFirstName}
                  onChange={(event) =>
                    setNewFirstName(event.target.value)
                  }
                  style={inputStyle}
                  autoFocus
                />
              </Field>

              <Field label="Surname">
                <input
                  value={newSurname}
                  onChange={(event) =>
                    setNewSurname(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <div
              style={{
                ...twoColumns,
                marginTop: 14,
              }}
            >
              <Field label="Mobile Number">
                <input
                  value={newMobile}
                  onChange={(event) =>
                    setNewMobile(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) =>
                    setNewEmail(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>
            </div>

            <div
              style={{
                ...twoColumns,
                marginTop: 14,
              }}
            >
              <Field label="ID / Passport">
                <input
                  value={newIdNumber}
                  onChange={(event) =>
                    setNewIdNumber(event.target.value)
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Company">
                <select
                  value={newCompanyId}
                  onChange={(event) =>
                    setNewCompanyId(event.target.value)
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Private Guest
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
            </div>

            <div style={modalActions}>
              <button
                type="button"
                onClick={closeGuestModal}
                disabled={savingGuest}
                style={backButton}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={savingGuest}
                style={confirmButton}
              >
                {savingGuest
                  ? "Saving..."
                  : "Save Guest"}
              </button>
            </div>
          </form>
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
    <label style={fieldWrap}>
      <span style={fieldLabel}>
        {label}
      </span>

      {children}
    </label>
  );
}

function StepHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div style={stepHeading}>
      <div style={stepNumber}>
        {number}
      </div>

      <div>
        <h2 style={sectionTitle}>
          {title}
        </h2>

        <div style={sectionDescription}>
          {description}
        </div>
      </div>
    </div>
  );
}

function WizardProgress({
  currentStep,
}: {
  currentStep: number;
}) {
  const steps = [
    "Stay",
    "Room",
    "Guest",
    "Review",
  ];

  return (
    <div style={progressBar}>
      {steps.map((label, index) => {
        const number = index + 1;
        const active = number === currentStep;
        const completed = number < currentStep;

        return (
          <div
            key={label}
            style={progressItem}
          >
            <div
              style={{
                ...progressCircle,
                ...(active
                  ? progressCircleActive
                  : {}),
                ...(completed
                  ? progressCircleDone
                  : {}),
              }}
            >
              {completed ? "âœ“" : number}
            </div>

            <span
              style={{
                ...progressLabel,
                ...(active
                  ? progressLabelActive
                  : {}),
              }}
            >
              {label}
            </span>

            {index < steps.length - 1 && (
              <div style={progressLine} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function WizardButtons({
  showBack = false,
  onBack,
  nextLabel,
  onNext,
  nextDisabled = false,
}: {
  showBack?: boolean;
  onBack?: () => void;
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div style={wizardButtons}>
      <div>
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            style={backButton}
          >
            â† Back
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        style={{
          ...nextButton,
          opacity: nextDisabled ? 0.5 : 1,
          cursor: nextDisabled
            ? "not-allowed"
            : "pointer",
        }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function ReviewItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={reviewItem}>
      <span style={summaryLabel}>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        ...moneyRow,
        color: muted ? "#777" : "#222",
      }}
    >
      <span>{label}</span>

      <strong>
        {value < 0 ? "-" : ""}
        N${Math.abs(value).toFixed(2)}
      </strong>
    </div>
  );
}

function calculateOccupancyRate(
  roomRate: RoomRate,
  adults: number,
  children: number
) {
  let rate = Number(roomRate.nightly_rate ?? 0);

  if (
    adults === 1 &&
    roomRate.single_occupancy_rate != null
  ) {
    rate = Number(roomRate.single_occupancy_rate);
  }

  if (
    adults >= 2 &&
    roomRate.double_occupancy_rate != null
  ) {
    rate = Number(roomRate.double_occupancy_rate);
  }

  if (adults > 2) {
    rate +=
      (adults - 2) *
      Number(roomRate.extra_adult_rate ?? 0);
  }

  if (children > 0) {
    rate +=
      children *
      Number(roomRate.extra_child_rate ?? 0);
  }

  return rate;
}

function rateAppliesOnDate(
  roomRate: RoomRate,
  dateString: string,
  date: Date,
  nights: number
) {
  const plan = roomRate.rate_plans;

  if (!plan) {
    return false;
  }

  if (
    !roomRate.is_active ||
    !plan.is_active
  ) {
    return false;
  }

  if (
    Number(roomRate.minimum_nights ?? 1) >
    nights
  ) {
    return false;
  }

  if (
    plan.start_date &&
    dateString < plan.start_date
  ) {
    return false;
  }

  if (
    plan.end_date &&
    dateString > plan.end_date
  ) {
    return false;
  }

  const day = date.getUTCDay();

  if (day === 1 && !plan.applies_monday) return false;
  if (day === 2 && !plan.applies_tuesday) return false;
  if (day === 3 && !plan.applies_wednesday) return false;
  if (day === 4 && !plan.applies_thursday) return false;
  if (day === 5 && !plan.applies_friday) return false;
  if (day === 6 && !plan.applies_saturday) return false;
  if (day === 0 && !plan.applies_sunday) return false;

  return true;
}

function isValidDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDate(value: string) {
  if (!isValidDateString(value)) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(year, month - 1, day)
  );
}

function formatDateForDatabase(date: Date) {
  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayString() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(
  value: string,
  days: number
) {
  const date = parseDate(value);

  if (!date) {
    return value;
  }

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return formatDateForDatabase(date);
}

function formatFriendlyDate(value: string) {
  const date = parseDate(value);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-NA",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(date);
}

function createReservationNumber() {
  const now = new Date();

  const datePart =
    `${now.getFullYear()}` +
    `${String(
      now.getMonth() + 1
    ).padStart(2, "0")}` +
    `${String(
      now.getDate()
    ).padStart(2, "0")}`;

  const timePart =
    `${String(
      now.getHours()
    ).padStart(2, "0")}` +
    `${String(
      now.getMinutes()
    ).padStart(2, "0")}` +
    `${String(
      now.getSeconds()
    ).padStart(2, "0")}`;

  const random = Math.floor(
    100 + Math.random() * 900
  );

  return `RES-${datePart}-${timePart}-${random}`;
}

/* =========================================================
   STYLES
========================================================= */

const pageStyle: React.CSSProperties = {
  maxWidth: 1050,
  margin: "0 auto",
  padding: "24px 28px 50px",
  fontFamily: "Arial, sans-serif", color: "#17324D", background: "#F4F8FC", minHeight: "100vh",
};

const pageHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  marginBottom: 18,
};

const eyebrow: React.CSSProperties = {
  color: "#777",
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.7,
  marginBottom: 4,
};

const pageTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 27,
};

const pageSubtitle: React.CSSProperties = {
  color: "#666",
  fontSize: 11,
  marginTop: 5,
};

const headerRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const backToBoardButton: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccc",
  background: "white",
  borderRadius: 8,
  padding: "8px 11px",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const stepCounter: React.CSSProperties = {
  background: "#111",
  color: "white",
  borderRadius: 20,
  padding: "7px 11px",
  fontSize: 10,
  fontWeight: 800,
};

const progressBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: 18,
  padding: "10px 16px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  borderRadius: 10,
  background: "#fafafa",
};

const progressItem: React.CSSProperties = {
  flex: 1,
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const progressCircle: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  width: 24,
  height: 24,
  borderRadius: "50%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#bbb",
  background: "white",
  color: "#777",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: 9,
  fontWeight: 800,
};

const progressCircleActive: React.CSSProperties = {
  background: "#173f73",
  color: "white",
  borderColor: "#173f73",
};

const progressCircleDone: React.CSSProperties = {
  background: "#176332",
  color: "white",
  borderColor: "#176332",
};

const progressLabel: React.CSSProperties = {
  position: "relative",
  zIndex: 2,
  background: "#fafafa",
  paddingRight: 8,
  color: "#777",
  fontSize: 9,
  fontWeight: 700,
};

const progressLabelActive: React.CSSProperties = {
  color: "#173f73",
};

const progressLine: React.CSSProperties = {
  position: "absolute",
  left: 25,
  right: 0,
  top: 12,
  height: 1,
  background: "#ddd",
  zIndex: 1,
};

const wizardCard: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  borderRadius: 12,
  background: "white",
  padding: 18,
};

const stepHeading: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  marginBottom: 12,
};

const stepNumber: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#111",
  color: "white",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 800,
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
};

const sectionDescription: React.CSSProperties = {
  marginTop: 3,
  color: "#777",
  fontSize: 10,
};

const calendarPrefillNotice: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#acd0b8",
  background: "#f1faf4",
  color: "#245d35",
  borderRadius: 8,
  padding: "9px 11px",
  marginBottom: 18,
  fontSize: 9,
};

const calendarRoomCard: React.CSSProperties = {
  position: "relative",
  borderWidth: 2,
  borderStyle: "solid",
  borderColor: "#173f73",
  background: "#eef5ff",
  borderRadius: 10,
  padding: "16px",
};

const calendarRoomBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#173f73",
  color: "white",
  fontSize: 7,
  fontWeight: 800,
  borderRadius: 20,
  padding: "5px 8px",
  marginBottom: 12,
};

const calendarRoomMain: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1fr 1fr",
  gap: 16,
};

const calendarRoomNumber: React.CSSProperties = {
  display: "block",
  color: "#173f73",
  fontSize: 20,
};

const calendarRoomName: React.CSSProperties = {
  fontSize: 9,
  color: "#57708f",
  marginTop: 3,
};

const changeRoomButton: React.CSSProperties = {
  marginTop: 14,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#173f73",
  background: "white",
  color: "#173f73",
  borderRadius: 7,
  padding: "7px 10px",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};

const twoColumns: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const fieldWrap: React.CSSProperties = {
  display: "block",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  color: "#555",
  fontSize: 9,
  fontWeight: 800,
  textTransform: "uppercase",
  marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccc",
  borderRadius: 8,
  background: "white",
  padding: "10px 11px",
  fontSize: 12,
  outline: "none",
};

const largeSelect: React.CSSProperties = {
  ...inputStyle,
  padding: "12px 11px",
  fontSize: 13,
};

const staySummary: React.CSSProperties = {
  marginTop: 18,
  borderRadius: 9,
  background: "#f6f8fb",
  padding: "11px 13px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
};

const summaryLabel: React.CSSProperties = {
  display: "block",
  fontSize: 8,
  color: "#777",
  textTransform: "uppercase",
  fontWeight: 800,
  marginBottom: 4,
};

const nightBadge: React.CSSProperties = {
  background: "#173f73",
  color: "white",
  borderRadius: 20,
  padding: "6px 10px",
  fontSize: 9,
  fontWeight: 800,
};

const stayStrip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  background: "#f6f8fb",
  padding: "9px 11px",
  borderRadius: 8,
  marginBottom: 18,
  fontSize: 10,
};

const selectedRoomCard: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  padding: 12,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#aac4e5",
  background: "#eef5ff",
  borderRadius: 8,
};

const selectedRoomNumber: React.CSSProperties = {
  color: "#173f73",
  fontSize: 14,
};

const checkingStyle: React.CSSProperties = {
  background: "#F4F8FC",
  padding: 10,
  borderRadius: 8,
  fontSize: 10,
  color: "#555",
};

const availableStyle: React.CSSProperties = {
  background: "#eff9f2",
  color: "#1d6735",
  padding: 11,
  borderRadius: 8,
  fontSize: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#aad0b6",
};

const unavailableStyle: React.CSSProperties = {
  background: "#FFF3F3",
  color: "#A33B3B",
  padding: 11,
  borderRadius: 8,
  fontSize: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#e3a6a6",
};

const statusSubtext: React.CSSProperties = {
  marginTop: 3,
  fontSize: 9,
};

const pricePreview: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
  marginTop: 16,
  background: "#fafafa",
  borderRadius: 9,
  padding: 13,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#e2e2e2",
};

const priceValue: React.CSSProperties = {
  fontSize: 14,
};

const wizardButtons: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 24,
};

const backButton: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccc",
  background: "white",
  borderRadius: 8,
  padding: "9px 13px",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const nextButton: React.CSSProperties = {
  borderWidth: 0,
  background: "#111",
  color: "white",
  borderRadius: 8,
  padding: "10px 15px",
  fontSize: 10,
  fontWeight: 800,
};

const addGuestButton: React.CSSProperties = {
  marginTop: 10,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#aaa",
  background: "white",
  borderRadius: 8,
  padding: "8px 11px",
  fontSize: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const guestSelectedCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  marginTop: 16,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#a8c9b3",
  background: "#f2faf4",
  borderRadius: 9,
  padding: 12,
};

const guestAvatar: React.CSSProperties = {
  width: 37,
  height: 37,
  borderRadius: "50%",
  background: "#176332",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11,
  fontWeight: 800,
};

const guestName: React.CSSProperties = {
  fontSize: 12,
};

const guestMeta: React.CSSProperties = {
  fontSize: 9,
  color: "#666",
  marginTop: 2,
};

const selectedBadge: React.CSSProperties = {
  background: "#176332",
  color: "white",
  padding: "5px 8px",
  borderRadius: 20,
  fontSize: 8,
  fontWeight: 800,
};

const reviewGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const reviewItem: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#e3e3e3",
  borderRadius: 8,
  padding: 11,
};

const financialBox: React.CSSProperties = {
  marginTop: 18,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  borderRadius: 9,
  padding: 13,
  background: "#fafafa",
};

const moneyRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "7px 0",
  fontSize: 10,
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#eee",
};

const moneyEditRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "7px 0",
  fontSize: 10,
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#eee",
};

const moneyInputWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const moneyInput: React.CSSProperties = {
  width: 100,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccc",
  borderRadius: 6,
  padding: "6px 7px",
  textAlign: "right",
};

const grandTotalRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingTop: 12,
  fontSize: 16,
};

const moreButton: React.CSSProperties = {
  marginTop: 13,
  borderWidth: 0,
  background: "transparent",
  color: "#173f73",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
  padding: 0,
};

const finalButtons: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 22,
};

const confirmButton: React.CSSProperties = {
  borderWidth: 0,
  background: "#176332",
  color: "white",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 10,
  fontWeight: 800,
  cursor: "pointer",
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.38)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 20,
  zIndex: 9999,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 600,
  background: "white",
  borderRadius: 12,
  padding: 20,
  boxShadow: "0 20px 60px rgba(0,0,0,.25)",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 15,
  marginBottom: 18,
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
};

const modalSubtitle: React.CSSProperties = {
  color: "#777",
  fontSize: 9,
  marginTop: 3,
};

const closeButton: React.CSSProperties = {
  borderWidth: 0,
  background: "#f2f2f2",
  width: 29,
  height: 29,
  borderRadius: "50%",
  fontSize: 17,
  cursor: "pointer",
};

const modalActions: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  marginTop: 20,
};
