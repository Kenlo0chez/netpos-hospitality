"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

type Property = {
  id: string;
  name: string;
};

type Room = {
  id: string;
  property_id: string;
  room_type_id: string;
  room_number: string;
  room_name: string | null;
  operational_status: string;
  room_types: {
    name: string;
  } | null;
};

type ReservationRoom = {
  room_id: string | null;
  room_type_id: string;
  nightly_rate: number;
  arrival_date: string;
  departure_date: string;
  rooms: {
    room_number: string;
    room_name: string | null;
  } | null;
  room_types: {
    name: string;
  } | null;
};

type Reservation = {
  id: string;
  property_id: string;
  reservation_number: string;
  status: string;
  booking_source: string | null;
  arrival_date: string;
  departure_date: string;
  adults: number;
  children: number;
  total_amount: number;
  deposit_required: number;
  created_at: string;
  guests: {
    first_name: string;
    last_name: string;
    phone: string | null;
  } | null;
  reservation_rooms: ReservationRoom[];
};

type DateSelection = {
  roomId: string;
  roomNumber: string;
  propertyId: string;
  roomTypeId: string;
  roomTypeName: string;
  arrivalDate: string;
};

export default function ReservationsPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [propertyId, setPropertyId] = useState("");
  const [boardStartDate, setBoardStartDate] = useState(getTodayString());

  const boardDays = 14;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  const [dateSelection, setDateSelection] =
    useState<DateSelection | null>(null);

  useEffect(() => {
    initialisePage();
  }, []);

  async function initialisePage() {
    setLoading(true);

    try {
      await Promise.all([
        loadProperties(),
        loadRooms(),
        loadReservations(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function loadProperties() {
    const { data, error } = await supabase
      .from("properties")
      .select("id,name")
      .order("name");

    if (error) {
      alert(`Properties: ${error.message}`);
      return;
    }

    const rows = (data as Property[]) ?? [];

    setProperties(rows);

    if (rows.length === 1) {
      setPropertyId(rows[0].id);
    }
  }

  async function loadRooms() {
    const { data, error } = await supabase
      .from("rooms")
      .select(`
        id,
        property_id,
        room_type_id,
        room_number,
        room_name,
        operational_status,
        room_types (
          name
        )
      `)
      .eq("operational_status", "active")
      .order("room_number");

    if (error) {
      alert(`Rooms: ${error.message}`);
      return;
    }

    setRooms((data as unknown as Room[]) ?? []);
  }

  async function loadReservations() {
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        id,
        property_id,
        reservation_number,
        status,
        booking_source,
        arrival_date,
        departure_date,
        adults,
        children,
        total_amount,
        deposit_required,
        created_at,
        guests (
          first_name,
          last_name,
          phone
        ),
        reservation_rooms (
          room_id,
          room_type_id,
          nightly_rate,
          arrival_date,
          departure_date,
          rooms (
            room_number,
            room_name
          ),
          room_types (
            name
          )
        )
      `)
      .order("arrival_date", { ascending: true });

    if (error) {
      alert(`Reservations: ${error.message}`);
      return;
    }

    setReservations((data as unknown as Reservation[]) ?? []);
  }

  const boardDates = useMemo(() => {
    return Array.from({ length: boardDays }, (_, index) =>
      addDays(boardStartDate, index)
    );
  }, [boardStartDate]);

  const visibleRooms = useMemo(() => {
    if (!propertyId) {
      return rooms;
    }

    return rooms.filter((room) => room.property_id === propertyId);
  }, [rooms, propertyId]);

  const boardReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      if (propertyId && reservation.property_id !== propertyId) {
        return false;
      }

      return ["provisional", "confirmed", "checked_in"].includes(
        reservation.status
      );
    });
  }, [reservations, propertyId]);

  function findBooking(roomId: string, date: string) {
    for (const reservation of boardReservations) {
      for (const reservationRoom of reservation.reservation_rooms) {
        if (reservationRoom.room_id !== roomId) {
          continue;
        }

        const arrival =
          reservationRoom.arrival_date || reservation.arrival_date;

        const departure =
          reservationRoom.departure_date || reservation.departure_date;

        if (date >= arrival && date < departure) {
          return {
            reservation,
            reservationRoom,
          };
        }
      }
    }

    return null;
  }

  function findConflictInStay(
    roomId: string,
    arrivalDate: string,
    departureDate: string
  ) {
    let currentDate = arrivalDate;

    while (currentDate < departureDate) {
      const booking = findBooking(roomId, currentDate);

      if (booking) {
        return booking;
      }

      currentDate = addDays(currentDate, 1);
    }

    return null;
  }

  function startSelection(room: Room, date: string) {
    setDateSelection({
      roomId: room.id,
      roomNumber: room.room_number,
      propertyId: room.property_id,
      roomTypeId: room.room_type_id,
      roomTypeName: room.room_types?.name ?? "Room",
      arrivalDate: date,
    });
  }

  function openReservationWizard(
    selection: DateSelection,
    departureDate: string
  ) {
    const params = new URLSearchParams();

    params.set("propertyId", selection.propertyId);
    params.set("roomTypeId", selection.roomTypeId);
    params.set("roomId", selection.roomId);

    params.set("arrival", selection.arrivalDate);
    params.set("departure", departureDate);

    params.set("arrivalDate", selection.arrivalDate);
    params.set("departureDate", departureDate);

    params.set("from", "board");

    const wizardUrl = `/reservations/new?${params.toString()}`;

    setDateSelection(null);

    router.push(wizardUrl);
  }

  function handleDateClick(room: Room, date: string) {
    const existingBooking = findBooking(room.id, date);

    /*
      NO ACTIVE SELECTION
    */
    if (!dateSelection) {
      if (existingBooking) {
        router.push(`/reservations/${existingBooking.reservation.id}`);
        return;
      }

      startSelection(room, date);
      return;
    }

    /*
      DIFFERENT ROOM CLICKED
    */
    if (dateSelection.roomId !== room.id) {
      if (existingBooking) {
        router.push(`/reservations/${existingBooking.reservation.id}`);
        return;
      }

      startSelection(room, date);
      return;
    }

    /*
      SAME CHECK-IN DATE CLICKED AGAIN
      = DESELECT
    */
    if (date === dateSelection.arrivalDate) {
      setDateSelection(null);
      return;
    }

    /*
      EARLIER DATE CLICKED
      = MOVE CHECK-IN
    */
    if (date < dateSelection.arrivalDate) {
      if (existingBooking) {
        alert("That date is already occupied.");
        return;
      }

      startSelection(room, date);
      return;
    }

    /*
      LATER DATE CLICKED
      = CHECK-OUT
    */

    const departureDate = date;

    const conflict = findConflictInStay(
      room.id,
      dateSelection.arrivalDate,
      departureDate
    );

    if (conflict) {
      const guest = conflict.reservation.guests;

      const guestName = guest
        ? `${guest.first_name} ${guest.last_name}`
        : "another guest";

      alert(
        `Room ${room.room_number} cannot be reserved for this stay.\n\n` +
          `There is already a reservation for ${guestName} during the selected dates.`
      );

      return;
    }

    openReservationWizard(dateSelection, departureDate);
  }

  const today = getTodayString();

  const arrivalsToday = reservations.filter(
    (reservation) =>
      reservation.arrival_date === today &&
      ["provisional", "confirmed"].includes(reservation.status) &&
      (!propertyId || reservation.property_id === propertyId)
  ).length;

  const departuresToday = reservations.filter(
    (reservation) =>
      reservation.departure_date === today &&
      reservation.status === "checked_in" &&
      (!propertyId || reservation.property_id === propertyId)
  ).length;

  const occupiedToday = countOccupiedRoomsForDate(
    visibleRooms,
    boardReservations,
    today
  );

  const availableToday = Math.max(
    0,
    visibleRooms.length - occupiedToday
  );

  const filteredReservations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return reservations.filter((reservation) => {
      if (propertyId && reservation.property_id !== propertyId) {
        return false;
      }

      const guestName = reservation.guests
        ? `${reservation.guests.first_name} ${reservation.guests.last_name}`
        : "";

      const roomNumbers = reservation.reservation_rooms
        .map((item) => item.rooms?.room_number ?? "")
        .join(" ");

      const matchesSearch =
        !term ||
        reservation.reservation_number.toLowerCase().includes(term) ||
        guestName.toLowerCase().includes(term) ||
        roomNumbers.toLowerCase().includes(term) ||
        (reservation.guests?.phone ?? "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? ["provisional", "confirmed", "checked_in"].includes(
              reservation.status
            )
          : reservation.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [reservations, search, statusFilter, propertyId]);

  function previousPeriod() {
    setBoardStartDate(addDays(boardStartDate, -boardDays));
    setDateSelection(null);
  }

  function nextPeriod() {
    setBoardStartDate(addDays(boardStartDate, boardDays));
    setDateSelection(null);
  }

  function goToday() {
    setBoardStartDate(getTodayString());
    setDateSelection(null);
  }

  const selectedProperty =
    properties.find((property) => property.id === propertyId) ?? null;

  return (
    <main style={pageStyle}>
      <div style={viewMode === "board" ? compactBoardPageHeader : pageHeader}>
        <div>
          <div style={eyebrow}>ROOM CONTROL</div>

          <h1 style={pageTitle}>Reservations</h1>

          <div style={pageSubtitle}>
            Room availability, arrivals and guest bookings.
          </div>
        </div>

        <div style={headerActions}>
          <div style={viewToggle}>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              style={{
                ...viewButton,
                ...(viewMode === "board" ? activeViewButton : {}),
              }}
            >
              Availability Board
            </button>

            <button
              type="button"
              onClick={() => {
                setDateSelection(null);
                setViewMode("list");
              }}
              style={{
                ...viewButton,
                ...(viewMode === "list" ? activeViewButton : {}),
              }}
            >
              Reservation List
            </button>
          </div>

          <button
            type="button"
            onClick={() => router.push("/housekeeping")}
            style={housekeepingButton}
          >
            Housekeeping
          </button>

          <button
            type="button"
            onClick={() => router.push("/reservations/new")}
            style={newReservationButton}
          >
            + New Reservation
          </button>
        </div>
      </div>

      <section style={controlBar}>
        <div style={propertyControl}>
          <label style={smallControlLabel}>
            Property
          </label>

          <select
            value={propertyId}
            onChange={(event) => {
              setPropertyId(event.target.value);
              setDateSelection(null);
            }}
            style={controlSelect}
          >
            {properties.length > 1 && (
              <option value="">
                All Properties
              </option>
            )}

            {properties.map((property) => (
              <option
                key={property.id}
                value={property.id}
              >
                {property.name}
              </option>
            ))}
          </select>
        </div>

        <div style={statsRow}>
          <StatBox
            label="Arrivals Today"
            value={arrivalsToday}
          />

          <StatBox
            label="Departures Today"
            value={departuresToday}
          />

          <StatBox
            label="Occupied"
            value={occupiedToday}
          />

          <StatBox
            label="Rooms Available"
            value={availableToday}
          />
        </div>
      </section>

      {loading ? (
        <section style={loadingCard}>
          Loading reservations...
        </section>
      ) : (
        <>
          {viewMode === "board" && (
            <>
              <section style={boardToolbar}>
                <div>
                  <strong style={boardTitle}>
                    Availability Board
                  </strong>

                  <div style={boardSubtext}>
                    {selectedProperty?.name ?? "All Properties"}
                    {" · "}
                    {formatFriendlyDate(boardDates[0])}
                    {" - "}
                    {formatFriendlyDate(
                      boardDates[boardDates.length - 1]
                    )}
                  </div>
                </div>

                <div style={dateActions}>
                  <button
                    type="button"
                    onClick={previousPeriod}
                    style={dateButton}
                  >
                    ← Previous
                  </button>

                  <button
                    type="button"
                    onClick={goToday}
                    style={todayButton}
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    onClick={nextPeriod}
                    style={dateButton}
                  >
                    Next →
                  </button>
                </div>
              </section>

              {!dateSelection && (
                <div style={selectionInstruction}>
                  <div>
                    <strong>New reservation:</strong>{" "}
                    click the check-in date, then click the
                    check-out date on the same room.
                  </div>

                  <div style={selectionExample}>
                    Example: 31 Aug → 03 Sep = 3 nights
                  </div>
                </div>
              )}

              {dateSelection && (
                <div style={activeSelectionBar}>
                  <div style={activeSelectionLeft}>
                    <div style={selectionIcon}>
                      1
                    </div>

                    <div>
                      <strong>
                        Room {dateSelection.roomNumber} ·{" "}
                        {dateSelection.roomTypeName}
                      </strong>

                      <div style={activeSelectionText}>
                        Check-in:{" "}
                        <strong>
                          {formatFriendlyDate(
                            dateSelection.arrivalDate
                          )}
                        </strong>
                        {" · "}
                        Now select the check-out date.
                      </div>

                      <div style={roomTypeSmall}>
                        Click the check-in date again to
                        deselect it.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDateSelection(null)}
                    style={cancelSelectionButton}
                  >
                    Cancel Selection
                  </button>
                </div>
              )}

              <div style={legendRow}>
                <LegendItem
                  label="Confirmed"
                  style={confirmedCell}
                />

                <LegendItem
                  label="Checked In"
                  style={checkedInCell}
                />

                <LegendItem
                  label="Provisional"
                  style={provisionalCell}
                />

                <LegendItem
                  label="Available"
                  style={availableLegend}
                />

                <LegendItem
                  label="Selected Check-in"
                  style={selectedLegend}
                />
              </div>

              <section style={boardWrapper}>
                {visibleRooms.length === 0 ? (
                  <div style={emptyState}>
                    No active rooms are configured for this
                    property.
                  </div>
                ) : (
                  <div style={boardScroll}>
                    <div
                      style={{
                        ...boardGrid,
                        gridTemplateColumns:
                          `180px repeat(${boardDays}, 94px)`,
                      }}
                    >
                      <div style={roomHeaderCell}>
                        Room
                      </div>

                      {boardDates.map((date) => {
                        const isToday = date === today;

                        return (
                          <div
                            key={date}
                            style={{
                              ...dateHeaderCell,
                              ...(isToday
                                ? todayHeaderCell
                                : {}),
                            }}
                          >
                            <div style={dayName}>
                              {formatDayName(date)}
                            </div>

                            <strong>
                              {formatShortDate(date)}
                            </strong>

                            {isToday && (
                              <div style={todayText}>
                                TODAY
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {visibleRooms.map((room) => (
                        <RoomBoardRow
                          key={room.id}
                          room={room}
                          dates={boardDates}
                          today={today}
                          dateSelection={dateSelection}
                          findBooking={findBooking}
                          onDateClick={handleDateClick}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div style={boardBottomBar}>
                <div style={boardHint}>
                  Click once for check-in · click the checkout date
                  on the same room · reservation wizard opens
                  automatically.
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/housekeeping")}
                  style={bottomHousekeepingButton}
                >
                  Housekeeping
                </button>
              </div>
            </>
          )}

          {viewMode === "list" && (
            <>
              <section style={filterCard}>
                <div style={filterGrid}>
                  <div>
                    <label style={labelStyle}>
                      Search
                    </label>

                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Guest, reservation number, room or mobile..."
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Status
                    </label>

                    <select
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value)
                      }
                      style={inputStyle}
                    >
                      <option value="active">
                        Active Reservations
                      </option>

                      <option value="all">
                        All Reservations
                      </option>

                      <option value="provisional">
                        Provisional
                      </option>

                      <option value="confirmed">
                        Confirmed
                      </option>

                      <option value="checked_in">
                        Checked In
                      </option>

                      <option value="checked_out">
                        Checked Out
                      </option>

                      <option value="cancelled">
                        Cancelled
                      </option>

                      <option value="no_show">
                        No Show
                      </option>
                    </select>
                  </div>
                </div>
              </section>

              <section style={listCard}>
                <div style={listHeader}>
                  <div>
                    <strong>
                      Reservation List
                    </strong>

                    <div style={listSubtext}>
                      Current bookings and room allocations.
                    </div>
                  </div>

                  <div style={countBadge}>
                    {filteredReservations.length}{" "}
                    {filteredReservations.length === 1
                      ? "Reservation"
                      : "Reservations"}
                  </div>
                </div>

                {filteredReservations.length === 0 ? (
                  <div style={emptyState}>
                    No reservations found.
                  </div>
                ) : (
                  <>
                    <div style={headerGrid}>
                      <div>Reservation</div>
                      <div>Guest</div>
                      <div>Room</div>
                      <div>Check-in</div>
                      <div>Check-out</div>
                      <div>Total</div>
                      <div>Status</div>
                    </div>

                    {filteredReservations.map((reservation) => {
                      const guestName = reservation.guests
                        ? `${reservation.guests.first_name} ${reservation.guests.last_name}`
                        : "Unknown Guest";

                      const roomText =
                        reservation.reservation_rooms.length > 0
                          ? reservation.reservation_rooms
                              .map((item) => {
                                const number =
                                  item.rooms?.room_number ??
                                  "Unassigned";

                                const type =
                                  item.room_types?.name ?? "";

                                return type
                                  ? `${number} · ${type}`
                                  : number;
                              })
                              .join(", ")
                          : "No room";

                      return (
                        <div
                          key={reservation.id}
                          onClick={() =>
                            router.push(
                              `/reservations/${reservation.id}`
                            )
                          }
                          style={rowGrid}
                        >
                          <div>
                            <strong>
                              {reservation.reservation_number}
                            </strong>

                            <div style={secondaryText}>
                              {formatBookingSource(
                                reservation.booking_source
                              )}
                            </div>
                          </div>

                          <div>
                            <strong>
                              {guestName}
                            </strong>

                            {reservation.guests?.phone && (
                              <div style={secondaryText}>
                                {reservation.guests.phone}
                              </div>
                            )}
                          </div>

                          <div>
                            <strong>
                              {roomText}
                            </strong>

                            <div style={secondaryText}>
                              {reservation.adults}{" "}
                              {reservation.adults === 1
                                ? "Adult"
                                : "Adults"}

                              {reservation.children > 0 &&
                                ` · ${reservation.children} ${
                                  reservation.children === 1
                                    ? "Child"
                                    : "Children"
                                }`}
                            </div>
                          </div>

                          <div>
                            {formatFriendlyDate(
                              reservation.arrival_date
                            )}
                          </div>

                          <div>
                            {formatFriendlyDate(
                              reservation.departure_date
                            )}
                          </div>

                          <div>
                            <strong>
                              N$
                              {Number(
                                reservation.total_amount ?? 0
                              ).toFixed(2)}
                            </strong>
                          </div>

                          <div>
                            <StatusBadge
                              status={reservation.status}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

function RoomBoardRow({
  room,
  dates,
  today,
  dateSelection,
  findBooking,
  onDateClick,
}: {
  room: Room;
  dates: string[];
  today: string;
  dateSelection: DateSelection | null;

  findBooking: (
    roomId: string,
    date: string
  ) => {
    reservation: Reservation;
    reservationRoom: ReservationRoom;
  } | null;

  onDateClick: (
    room: Room,
    date: string
  ) => void;
}) {
  const rowSelected =
    dateSelection?.roomId === room.id;

  return (
    <>
      <div
        style={{
          ...roomNameCell,
          ...(rowSelected
            ? selectedRoomNameCell
            : {}),
        }}
      >
        <strong style={roomNumber}>
          Room {room.room_number}
        </strong>

        <div style={roomTypeText}>
          {room.room_types?.name ?? "Room"}

          {room.room_name
            ? ` · ${room.room_name}`
            : ""}
        </div>

        {rowSelected && (
          <div style={roomSelectingBadge}>
            SELECT CHECK-OUT
          </div>
        )}
      </div>

      {dates.map((date) => {
        const booking = findBooking(
          room.id,
          date
        );

        const isArrival =
          rowSelected &&
          dateSelection?.arrivalDate === date;

        const isCheckoutCandidate =
          rowSelected &&
          !!dateSelection &&
          date > dateSelection.arrivalDate;

        if (!booking) {
          return (
            <button
              key={`${room.id}-${date}`}
              type="button"
              onClick={() =>
                onDateClick(room, date)
              }
              title={
                isArrival
                  ? "Check-in selected — click again to deselect"
                  : isCheckoutCandidate
                  ? "Select as check-out"
                  : "Available"
              }
              style={{
                ...availableRoomButton,

                ...(date === today
                  ? todayRoomCell
                  : {}),

                ...(isCheckoutCandidate
                  ? possibleCheckoutCell
                  : {}),

                ...(isArrival
                  ? selectedCheckInCell
                  : {}),
              }}
            >
              {isArrival ? (
                <div style={selectedCheckInContent}>
                  <strong>
                    IN
                  </strong>

                  <span>
                    Check-in
                  </span>
                </div>
              ) : isCheckoutCandidate ? (
                <div style={checkoutCandidateContent}>
                  <span style={checkoutArrow}>
                    →
                  </span>

                  <span style={checkoutText}>
                    OUT
                  </span>
                </div>
              ) : (
                <span style={availablePlus}>
                  +
                </span>
              )}
            </button>
          );
        }

        const {
          reservation,
          reservationRoom,
        } = booking;

        const arrival =
          reservationRoom.arrival_date ||
          reservation.arrival_date;

        const departure =
          reservationRoom.departure_date ||
          reservation.departure_date;

        const start = arrival === date;

        const finalNight =
          departure === addDays(date, 1);

        const guestName =
          reservation.guests
            ? `${reservation.guests.first_name} ${reservation.guests.last_name}`
            : "Guest";

        return (
          <button
            key={`${room.id}-${date}`}
            type="button"
            onClick={() =>
              onDateClick(room, date)
            }
            style={{
              ...bookingCell,
              ...getBoardStatusStyle(
                reservation.status
              ),

              borderTopLeftRadius:
                start ? 7 : 0,

              borderBottomLeftRadius:
                start ? 7 : 0,

              borderTopRightRadius:
                finalNight ? 7 : 0,

              borderBottomRightRadius:
                finalNight ? 7 : 0,
            }}
          >
            {start ? (
              <>
                <strong style={bookingGuest}>
                  {guestName}
                </strong>

                <span style={bookingNumber}>
                  {reservation.reservation_number}
                </span>
              </>
            ) : (
              <span style={continuationMark}>
                •
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={statBox}>
      <span style={statLabel}>
        {label}
      </span>

      <strong style={statValue}>
        {value}
      </strong>
    </div>
  );
}

function LegendItem({
  label,
  style,
}: {
  label: string;
  style: React.CSSProperties;
}) {
  return (
    <div style={legendItem}>
      <span
        style={{
          ...legendSwatch,
          ...style,
        }}
      />

      <span>
        {label}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const label =
    status === "provisional"
      ? "Provisional"
      : status === "confirmed"
      ? "Confirmed"
      : status === "checked_in"
      ? "Checked In"
      : status === "checked_out"
      ? "Checked Out"
      : status === "cancelled"
      ? "Cancelled"
      : status === "no_show"
      ? "No Show"
      : status;

  let background = "#f1f1f1";
  let color = "#555";
  let borderColor = "#ddd";

  if (status === "confirmed") {
    background = "#E8F3FC";
    color = "#0D5FA8";
    borderColor = "#B9D5EA";
  }

  if (status === "checked_in") {
    background = "#EAF8F1";
    color = "#14714C";
    borderColor = "#B8DDCA";
  }

  if (status === "provisional") {
    background = "#F1F5F8";
    color = "#5E7385";
    borderColor = "#CEDAE3";
  }

  if (
    status === "cancelled" ||
    status === "no_show"
  ) {
    background = "#fff0f0";
    color = "#a11a1a";
    borderColor = "#e4a0a0";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        whiteSpace: "nowrap",
        background,
        color,
        borderTopWidth: 1,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderLeftWidth: 1,
        borderTopStyle: "solid",
        borderRightStyle: "solid",
        borderBottomStyle: "solid",
        borderLeftStyle: "solid",
        borderTopColor: borderColor,
        borderRightColor: borderColor,
        borderBottomColor: borderColor,
        borderLeftColor: borderColor,
      }}
    >
      {label}
    </span>
  );
}

function getBoardStatusStyle(
  status: string
): React.CSSProperties {
  if (status === "checked_in") {
    return checkedInCell;
  }

  if (status === "provisional") {
    return provisionalCell;
  }

  return confirmedCell;
}

function countOccupiedRoomsForDate(
  rooms: Room[],
  reservations: Reservation[],
  date: string
) {
  const occupied = new Set<string>();

  for (const reservation of reservations) {
    for (const reservationRoom of reservation.reservation_rooms) {
      if (!reservationRoom.room_id) {
        continue;
      }

      const roomExists = rooms.some(
        (room) =>
          room.id === reservationRoom.room_id
      );

      if (!roomExists) {
        continue;
      }

      const arrival =
        reservationRoom.arrival_date ||
        reservation.arrival_date;

      const departure =
        reservationRoom.departure_date ||
        reservation.departure_date;

      if (
        date >= arrival &&
        date < departure
      ) {
        occupied.add(
          reservationRoom.room_id
        );
      }
    }
  }

  return occupied.size;
}

function formatBookingSource(
  source: string | null
) {
  if (!source) {
    return "";
  }

  const names: Record<
    string,
    string
  > = {
    walk_in: "Walk-in",
    phone: "Phone",
    whatsapp: "WhatsApp",
    email: "Email",
    website: "Website",
    agent: "Agent",
    corporate: "Corporate",
    other: "Other",
  };

  return names[source] ?? source;
}

function parseDate(
  value: string
) {
  const [year, month, day] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
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

  date.setUTCDate(
    date.getUTCDate() + days
  );

  const year = date.getUTCFullYear();

  const month = String(
    date.getUTCMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatFriendlyDate(
  value: string
) {
  if (!value) {
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
  ).format(
    parseDate(value)
  );
}

function formatShortDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-NA",
    {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }
  ).format(
    parseDate(value)
  );
}

function formatDayName(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-NA",
    {
      weekday: "short",
      timeZone: "UTC",
    }
  ).format(
    parseDate(value)
  );
}

/* =====================================================
   NETPOS CRYSTAL RESERVATION STYLES
===================================================== */

const BLUE = "#0D5FA8";
const DARK_BLUE = "#0D4F91";
const GREEN = "#168257";
const TEXT = "#183A59";
const MUTED = "#71869A";
const BORDER = "#D2E0EA";
const LIGHT_BLUE = "#EDF6FE";
const LIGHT_GREEN = "#ECF8F2";

const pageStyle: React.CSSProperties = {
  maxWidth: 1600,
  margin: "0 auto",
  padding: "8px 14px 10px",
  fontFamily: "Arial, sans-serif",
  color: TEXT,
  background: "linear-gradient(180deg,#F7FAFD 0%,#F5F8FB 100%)",
  minHeight: "calc(100vh - 100px)",
  boxSizing: "border-box",
};

const pageHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 18,
  marginBottom: 11,
};

const compactBoardPageHeader: React.CSSProperties = {
  display: "none",
};

const eyebrow: React.CSSProperties = {
  color: GREEN,
  fontSize: 7.5,
  fontWeight: 900,
  letterSpacing: 0.9,
  marginBottom: 4,
};

const pageTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 25,
  lineHeight: 1,
  color: DARK_BLUE,
  fontWeight: 900,
};

const pageSubtitle: React.CSSProperties = {
  color: MUTED,
  fontSize: 9,
  marginTop: 5,
};

const headerActions: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const viewToggle: React.CSSProperties = {
  display: "flex",
  border: "1px solid #C7D9E6",
  borderRadius: 7,
  padding: 2,
  background: "#F2F7FA",
};

const viewButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#61798E",
  borderRadius: 5,
  padding: "7px 9px",
  fontWeight: 800,
  fontSize: 8,
  cursor: "pointer",
};

const activeViewButton: React.CSSProperties = {
  background: "#FFFFFF",
  color: BLUE,
  boxShadow: "0 1px 4px rgba(13,79,145,.12)",
};

const housekeepingButton: React.CSSProperties = {
  border: "1px solid #B9DDCA",
  background: LIGHT_GREEN,
  color: GREEN,
  borderRadius: 7,
  padding: "8px 11px",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const newReservationButton: React.CSSProperties = {
  border: "1px solid #0D5FA8",
  background: BLUE,
  color: "#FFFFFF",
  borderRadius: 7,
  padding: "8px 12px",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 3px 9px rgba(13,95,168,.14)",
};

const controlBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  border: `1px solid ${BORDER}`,
  borderRadius: 9,
  padding: "6px 9px",
  background: "#FFFFFF",
  marginBottom: 7,
  boxShadow: "0 3px 10px rgba(22,62,94,.035)",
};

const propertyControl: React.CSSProperties = {
  width: 230,
};

const smallControlLabel: React.CSSProperties = {
  display: "block",
  fontSize: 7,
  fontWeight: 900,
  color: "#668096",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 3,
};

const controlSelect: React.CSSProperties = {
  width: "100%",
  border: "1px solid #C9DAE7",
  borderRadius: 6,
  background: "#FFFFFF",
  color: TEXT,
  padding: "7px 9px",
  fontSize: 9,
  fontWeight: 700,
};

const statsRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const statBox: React.CSSProperties = {
  minWidth: 108,
  border: "1px solid #D5E3ED",
  background: "#FAFCFE",
  borderRadius: 7,
  padding: "6px 9px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
};

const statLabel: React.CSSProperties = {
  color: "#71869A",
  fontSize: 7,
  fontWeight: 800,
};

const statValue: React.CSSProperties = {
  fontSize: 16,
  color: DARK_BLUE,
};

const loadingCard: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 9,
  padding: 24,
  color: MUTED,
  background: "#FFFFFF",
  textAlign: "center",
};

const boardToolbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  border: `1px solid ${BORDER}`,
  borderRadius: "10px 10px 0 0",
  padding: "7px 10px",
  background: "linear-gradient(90deg,#F8FBFD 0%,#FFFFFF 100%)",
};

const boardTitle: React.CSSProperties = {
  fontSize: 11,
  color: DARK_BLUE,
};

const boardSubtext: React.CSSProperties = {
  color: MUTED,
  fontSize: 7.5,
  marginTop: 3,
};

const dateActions: React.CSSProperties = {
  display: "flex",
  gap: 5,
};

const dateButton: React.CSSProperties = {
  border: "1px solid #C5D7E4",
  background: "#FFFFFF",
  color: BLUE,
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 7.5,
  fontWeight: 900,
  cursor: "pointer",
};

const todayButton: React.CSSProperties = {
  ...dateButton,
  background: BLUE,
  color: "#FFFFFF",
  borderColor: BLUE,
};

const selectionInstruction: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "5px 10px",
  borderLeft: `1px solid ${BORDER}`,
  borderRight: `1px solid ${BORDER}`,
  background: "#F7FAFD",
  fontSize: 8,
  color: "#4F687E",
};

const selectionExample: React.CSSProperties = {
  color: "#7D8FA0",
  fontSize: 7.5,
};

const activeSelectionBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: "9px 11px",
  borderLeft: "1px solid #AFCDE5",
  borderRight: "1px solid #AFCDE5",
  background: LIGHT_BLUE,
  color: DARK_BLUE,
};

const activeSelectionLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
};

const selectionIcon: React.CSSProperties = {
  width: 25,
  height: 25,
  borderRadius: "50%",
  background: BLUE,
  color: "#FFFFFF",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: 9,
  fontWeight: 900,
};

const activeSelectionText: React.CSSProperties = {
  marginTop: 2,
  fontSize: 8,
};

const roomTypeSmall: React.CSSProperties = {
  fontSize: 7,
  color: "#6483A0",
  marginTop: 2,
};

const cancelSelectionButton: React.CSSProperties = {
  border: "1px solid #AFC9DD",
  background: "#FFFFFF",
  color: BLUE,
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 7.5,
  fontWeight: 900,
  cursor: "pointer",
};

const legendRow: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  borderLeft: `1px solid ${BORDER}`,
  borderRight: `1px solid ${BORDER}`,
  padding: "4px 10px",
  background: "#FBFCFD",
  fontSize: 7.25,
};

const legendItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  color: "#5F7588",
};

const legendSwatch: React.CSSProperties = {
  width: 15,
  height: 9,
  borderRadius: 3,
  display: "inline-block",
};

const boardWrapper: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: "0 0 10px 10px",
  background: "#FFFFFF",
  overflow: "hidden",
  boxShadow: "0 5px 16px rgba(19,67,108,.045)",
};

const boardScroll: React.CSSProperties = {
  width: "100%",
  maxHeight: "calc(100vh - 300px)",
  overflowX: "auto",
  overflowY: "auto",
};

const boardGrid: React.CSSProperties = {
  display: "grid",
  minWidth: "max-content",
};

const roomHeaderCell: React.CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 5,
  background: "#EAF2F8",
  borderRight: "1px solid #C8D9E6",
  borderBottom: "1px solid #C8D9E6",
  padding: "8px 10px",
  textTransform: "uppercase",
  color: "#557087",
  fontSize: 7.5,
  fontWeight: 900,
  letterSpacing: 0.35,
};

const dateHeaderCell: React.CSSProperties = {
  height: 38,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  background: "#F4F8FB",
  borderRight: "1px solid #DCE6EE",
  borderBottom: "1px solid #C8D9E6",
  color: TEXT,
  fontSize: 8,
};

const todayHeaderCell: React.CSSProperties = {
  background: "#E3F1FC",
  color: DARK_BLUE,
};

const dayName: React.CSSProperties = {
  color: "#74899B",
  fontSize: 7,
  marginBottom: 2,
};

const todayText: React.CSSProperties = {
  color: BLUE,
  fontSize: 5.5,
  fontWeight: 900,
  marginTop: 2,
};

const roomNameCell: React.CSSProperties = {
  position: "sticky",
  left: 0,
  zIndex: 4,
  minHeight: 42,
  background: "#FFFFFF",
  borderRight: "1px solid #C8D9E6",
  borderBottom: "1px solid #E7EEF3",
  padding: "5px 9px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const selectedRoomNameCell: React.CSSProperties = {
  background: LIGHT_BLUE,
  borderRight: `2px solid ${BLUE}`,
};

const roomNumber: React.CSSProperties = {
  fontSize: 10,
  color: DARK_BLUE,
};

const roomTypeText: React.CSSProperties = {
  color: MUTED,
  fontSize: 7,
  marginTop: 2,
};

const roomSelectingBadge: React.CSSProperties = {
  color: BLUE,
  fontSize: 5.5,
  fontWeight: 900,
  marginTop: 3,
};

const availableRoomButton: React.CSSProperties = {
  minHeight: 42,
  border: 0,
  borderRight: "1px solid #EDF1F4",
  borderBottom: "1px solid #EDF1F4",
  background: "#FFFFFF",
  cursor: "pointer",
  padding: 0,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const todayRoomCell: React.CSSProperties = {
  background: "#F8FCFF",
};

const possibleCheckoutCell: React.CSSProperties = {
  background: "#F0F7FD",
};

const selectedCheckInCell: React.CSSProperties = {
  background: BLUE,
  color: "#FFFFFF",
  borderTop: `2px solid ${BLUE}`,
  borderBottom: `2px solid ${BLUE}`,
};

const selectedCheckInContent: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  fontSize: 7,
};

const checkoutCandidateContent: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const checkoutArrow: React.CSSProperties = {
  color: BLUE,
  fontSize: 13,
  fontWeight: 900,
};

const checkoutText: React.CSSProperties = {
  color: BLUE,
  fontSize: 5.5,
  fontWeight: 900,
};

const availablePlus: React.CSSProperties = {
  color: "#C8D4DE",
  fontSize: 13,
  fontWeight: 700,
};

const bookingCell: React.CSSProperties = {
  minHeight: 42,
  border: 0,
  borderRight: "1px solid rgba(0,0,0,.06)",
  borderBottom: "1px solid #E8EEF3",
  padding: "5px 6px",
  cursor: "pointer",
  textAlign: "left",
  overflow: "hidden",
};

const bookingGuest: React.CSSProperties = {
  display: "block",
  fontSize: 7.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const bookingNumber: React.CSSProperties = {
  display: "block",
  fontSize: 5.5,
  marginTop: 2,
  opacity: 0.75,
};

const continuationMark: React.CSSProperties = {
  opacity: 0.22,
};

const confirmedCell: React.CSSProperties = {
  background: "#E8F3FC",
  color: "#0D5FA8",
  borderColor: "#B9D5EA",
};

const checkedInCell: React.CSSProperties = {
  background: "#EAF8F1",
  color: "#14714C",
  borderColor: "#B8DDCA",
};

const provisionalCell: React.CSSProperties = {
  background: "#F1F5F8",
  color: "#5E7385",
  borderColor: "#CEDAE3",
};

const availableLegend: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #D5E0E8",
};

const selectedLegend: React.CSSProperties = {
  background: BLUE,
  border: `1px solid ${BLUE}`,
};

const boardBottomBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  marginTop: 5,
};

const boardHint: React.CSSProperties = {
  color: "#7A8C9B",
  fontSize: 7,
  textAlign: "left",
};

const bottomHousekeepingButton: React.CSSProperties = {
  minWidth: 125,
  border: "1px solid #B9DDCA",
  background: LIGHT_GREEN,
  color: GREEN,
  borderRadius: 6,
  padding: "7px 11px",
  fontSize: 7.5,
  fontWeight: 900,
  cursor: "pointer",
};

const filterCard: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 9,
  padding: 10,
  marginBottom: 8,
  background: "#FFFFFF",
};

const filterGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) 220px",
  gap: 10,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 9px",
  border: "1px solid #C9DAE7",
  borderRadius: 6,
  fontSize: 9,
  color: TEXT,
  background: "#FFFFFF",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 7.5,
  fontWeight: 900,
  color: "#607A90",
  marginBottom: 4,
};

const listCard: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 9,
  overflow: "hidden",
  background: "#FFFFFF",
  boxShadow: "0 4px 14px rgba(19,67,108,.04)",
};

const listHeader: React.CSSProperties = {
  padding: "9px 11px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  background: "#F8FBFD",
};

const listSubtext: React.CSSProperties = {
  fontSize: 7.5,
  color: MUTED,
  marginTop: 2,
};

const countBadge: React.CSSProperties = {
  border: "1px solid #C6DCEB",
  borderRadius: 20,
  padding: "4px 7px",
  background: LIGHT_BLUE,
  color: BLUE,
  fontSize: 7.5,
  fontWeight: 900,
};

const emptyState: React.CSSProperties = {
  padding: 22,
  color: MUTED,
  fontSize: 9,
};

const secondaryText: React.CSSProperties = {
  color: MUTED,
  fontSize: 7.5,
  marginTop: 3,
};

const headerGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1.3fr 1.2fr 1fr 1fr .8fr .8fr",
  gap: 12,
  padding: "8px 11px",
  background: "#EDF4F8",
  borderTop: "1px solid #D7E3EC",
  color: "#5E7487",
  fontSize: 7,
  fontWeight: 900,
  textTransform: "uppercase",
};

const rowGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1.3fr 1.2fr 1fr 1fr .8fr .8fr",
  gap: 12,
  padding: "9px 11px",
  borderTop: "1px solid #E9EFF4",
  alignItems: "center",
  fontSize: 8.5,
  color: TEXT,
  cursor: "pointer",
};

