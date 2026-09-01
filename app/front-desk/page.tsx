"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

// =========================================================
// TYPES
// =========================================================

type Property = {
  id: string;
  name: string;
};

type Guest = {
  first_name: string;
  last_name: string;
  phone: string | null;
};

type ReservationRoom = {
  id: string;
  room_id: string | null;
  room_type_id: string;
  arrival_date: string;
  departure_date: string;
  nightly_rate: number;

  rooms: {
    room_number: string;
    room_name: string | null;
    housekeeping_status: string | null;
    operational_status: string;
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

  checked_in_at: string | null;
  checked_out_at: string | null;

  guests: Guest | null;

  reservation_rooms: ReservationRoom[];
};

type Payment = {
  id: string;
  reservation_id: string | null;
  transaction_type: string;
  amount: number;
};

type Room = {
  id: string;
  property_id: string;
  room_number: string;
  room_name: string | null;
  housekeeping_status: string | null;
  operational_status: string;
};

// =========================================================
// PAGE
// =========================================================

export default function FrontDeskPage() {
  const router = useRouter();

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState("");

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const today = getTodayString();

  useEffect(() => {
    initialisePage();
  }, []);

  async function initialisePage() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id,name")
        .order("name");

      if (error) {
        throw new Error(error.message);
      }

      const propertyRows = (data as Property[]) ?? [];

      setProperties(propertyRows);

      const firstPropertyId =
        propertyRows.length > 0
          ? propertyRows[0].id
          : "";

      setPropertyId(firstPropertyId);

      if (firstPropertyId) {
        await loadFrontDesk(firstPropertyId);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load Front Desk."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadFrontDesk(
    selectedPropertyId: string
  ) {
    if (!selectedPropertyId) {
      setReservations([]);
      setPayments([]);
      setRooms([]);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const [
        reservationResult,
        paymentResult,
        roomResult,
      ] = await Promise.all([
        supabase
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
            checked_in_at,
            checked_out_at,
            guests (
              first_name,
              last_name,
              phone
            ),
            reservation_rooms (
              id,
              room_id,
              room_type_id,
              arrival_date,
              departure_date,
              nightly_rate,
              rooms (
                room_number,
                room_name,
                housekeeping_status,
                operational_status
              ),
              room_types (
                name
              )
            )
          `)
          .eq(
            "property_id",
            selectedPropertyId
          )
          .order(
            "arrival_date",
            {
              ascending: true,
            }
          ),

        supabase
          .from("payments")
          .select(`
            id,
            reservation_id,
            transaction_type,
            amount
          `)
          .eq(
            "property_id",
            selectedPropertyId
          ),

        supabase
          .from("rooms")
          .select(`
            id,
            property_id,
            room_number,
            room_name,
            housekeeping_status,
            operational_status
          `)
          .eq(
            "property_id",
            selectedPropertyId
          )
          .order("room_number"),
      ]);

      if (reservationResult.error) {
        throw new Error(
          reservationResult.error.message
        );
      }

      if (paymentResult.error) {
        throw new Error(
          paymentResult.error.message
        );
      }

      if (roomResult.error) {
        throw new Error(
          roomResult.error.message
        );
      }

      setReservations(
        (reservationResult.data as unknown as Reservation[]) ??
          []
      );

      setPayments(
        (paymentResult.data as Payment[]) ??
          []
      );

      setRooms(
        (roomResult.data as Room[]) ??
          []
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load Front Desk information."
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeProperty(
    value: string
  ) {
    setPropertyId(value);
    setMessage("");
    setErrorMessage("");

    await loadFrontDesk(value);
  }

  // =========================================================
  // BALANCES
  // =========================================================

  function paidForReservation(
    reservationId: string
  ) {
    return payments
      .filter(
        (payment) =>
          payment.reservation_id === reservationId
      )
      .reduce((total, payment) => {
        const amount =
          Number(payment.amount ?? 0);

        if (
          payment.transaction_type ===
          "refund"
        ) {
          return total - amount;
        }

        return total + amount;
      }, 0);
  }

  function balanceForReservation(
    reservation: Reservation
  ) {
    return Math.max(
      0,
      Number(
        reservation.total_amount ?? 0
      ) -
        paidForReservation(
          reservation.id
        )
    );
  }

  // =========================================================
  // GROUPS
  // =========================================================

  const arrivalsToday = useMemo(() => {
    return reservations.filter(
      (reservation) =>
        reservation.arrival_date === today &&
        [
          "provisional",
          "confirmed",
        ].includes(
          reservation.status
        )
    );
  }, [reservations, today]);

  const inHouse = useMemo(() => {
    return reservations.filter(
      (reservation) =>
        reservation.status ===
        "checked_in"
    );
  }, [reservations]);

  const departuresToday = useMemo(() => {
    return reservations.filter(
      (reservation) =>
        reservation.departure_date ===
          today &&
        reservation.status ===
          "checked_in"
    );
  }, [reservations, today]);

  const outstandingReservations =
    useMemo(() => {
      return reservations
        .filter((reservation) =>
          [
            "confirmed",
            "checked_in",
            "checked_out",
          ].includes(
            reservation.status
          )
        )
        .filter(
          (reservation) =>
            balanceForReservation(
              reservation
            ) > 0
        )
        .sort(
          (a, b) =>
            balanceForReservation(b) -
            balanceForReservation(a)
        );
    }, [reservations, payments]);

  const dirtyRooms = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.operational_status ===
          "active" &&
        normaliseHousekeeping(
          room.housekeeping_status
        ) === "dirty"
    );
  }, [rooms]);

  const cleaningRooms = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.operational_status ===
          "active" &&
        normaliseHousekeeping(
          room.housekeeping_status
        ) === "cleaning"
    );
  }, [rooms]);

  const cleanRooms = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.operational_status ===
          "active" &&
        normaliseHousekeeping(
          room.housekeeping_status
        ) === "clean"
    );
  }, [rooms]);

  const activeRooms = useMemo(() => {
    return rooms.filter(
      (room) =>
        room.operational_status ===
        "active"
    );
  }, [rooms]);

  const occupiedRoomIdsToday =
    useMemo(() => {
      const occupied =
        new Set<string>();

      for (const reservation of reservations) {
        if (
          ![
            "provisional",
            "confirmed",
            "checked_in",
          ].includes(
            reservation.status
          )
        ) {
          continue;
        }

        for (
          const item of
            reservation.reservation_rooms
        ) {
          if (!item.room_id) {
            continue;
          }

          const arrival =
            item.arrival_date ||
            reservation.arrival_date;

          const departure =
            item.departure_date ||
            reservation.departure_date;

          if (
            today >= arrival &&
            today < departure
          ) {
            occupied.add(
              item.room_id
            );
          }
        }
      }

      return occupied;
    }, [reservations, today]);

  const availableTonight =
    activeRooms.filter(
      (room) =>
        !occupiedRoomIdsToday.has(
          room.id
        )
    ).length;

  const totalOutstanding =
    outstandingReservations.reduce(
      (total, reservation) =>
        total +
        balanceForReservation(
          reservation
        ),
      0
    );

  // =========================================================
  // CHECK IN
  // =========================================================

  async function checkIn(
    reservation: Reservation
  ) {
    const guest =
      getGuestName(reservation);

    const confirmed =
      window.confirm(
        `Check in ${guest}?\n\nReservation ${reservation.reservation_number}`
      );

    if (!confirmed) {
      return;
    }

    setUpdatingId(
      reservation.id
    );

    setMessage("");

    try {
      const { error } =
        await supabase
          .from("reservations")
          .update({
            status:
              "checked_in",

            checked_in_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            reservation.id
          );

      if (error) {
        throw new Error(
          error.message
        );
      }

      await loadFrontDesk(
        propertyId
      );

      setMessage(
        `${guest} checked in successfully.`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not check in guest."
      );
    } finally {
      setUpdatingId("");
    }
  }

  // =========================================================
  // CHECK OUT
  // =========================================================

  async function checkOut(
    reservation: Reservation
  ) {
    const guest =
      getGuestName(reservation);

    const balance =
      balanceForReservation(
        reservation
      );

    if (balance > 0) {
      const continueCheckout =
        window.confirm(
          `${guest} still has an outstanding balance of N$${balance.toFixed(
            2
          )}.\n\nContinue with checkout?`
        );

      if (!continueCheckout) {
        return;
      }
    }

    const reservationRoom =
      reservation.reservation_rooms[0] ??
      null;

    const roomNumber =
      reservationRoom?.rooms
        ?.room_number ?? "";

    const confirmed =
      window.confirm(
        `Check out ${guest}?\n\n${
          roomNumber
            ? `Room ${roomNumber} will automatically become DIRTY.`
            : "The assigned room will be sent to housekeeping."
        }`
      );

    if (!confirmed) {
      return;
    }

    setUpdatingId(
      reservation.id
    );

    setMessage("");

    try {
      const {
        error:
          reservationError,
      } = await supabase
        .from("reservations")
        .update({
          status:
            "checked_out",

          checked_out_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reservation.id
        );

      if (
        reservationError
      ) {
        throw new Error(
          reservationError.message
        );
      }

      if (
        reservationRoom?.room_id
      ) {
        const {
          error:
            roomError,
        } = await supabase
          .from("rooms")
          .update({
            housekeeping_status:
              "dirty",
          })
          .eq(
            "id",
            reservationRoom.room_id
          );

        if (roomError) {
          await supabase
            .from("reservations")
            .update({
              status:
                "checked_in",

              checked_out_at:
                null,
            })
            .eq(
              "id",
              reservation.id
            );

          throw new Error(
            `Checkout could not be completed because the room could not be sent to housekeeping: ${roomError.message}`
          );
        }
      }

      await loadFrontDesk(
        propertyId
      );

      setMessage(
        `${guest} checked out successfully.${
          roomNumber
            ? ` Room ${roomNumber} is now Dirty.`
            : ""
        }`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not check out guest."
      );
    } finally {
      setUpdatingId("");
    }
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main style={pageStyle}>
      {/* ===================================================
          PAGE TITLE
      =================================================== */}

      <section style={pageHeadingRow}>
        <div>
          <div style={eyebrowStyle}>
            DAILY OPERATIONS
          </div>

          <h1 style={titleStyle}>
            Front Desk
          </h1>

          <div style={subtitleStyle}>
            {formatFriendlyDate(today)}
          </div>
        </div>

        <div style={frontDeskActions}>
          <div style={propertyArea}>
            <label style={propertyLabel}>
              PROPERTY
            </label>

            <select
              value={propertyId}
              onChange={(event) =>
                changeProperty(
                  event.target.value
                )
              }
              style={propertySelect}
            >
              {properties.map(
                (property) => (
                  <option
                    key={property.id}
                    value={property.id}
                  >
                    {property.name}
                  </option>
                )
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/reservations"
              )
            }
            style={secondaryTopButton}
          >
            Reservation Calendar
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/reservations/new"
              )
            }
            style={newReservationButton}
          >
            + New Reservation
          </button>
        </div>
      </section>

      {/* ===================================================
          MESSAGE
      =================================================== */}

      {message && (
        <div style={successBox}>
          ✓ {message}
        </div>
      )}

      {errorMessage && (
        <div style={errorBox}>
          {errorMessage}
        </div>
      )}

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <section style={summaryGrid}>
        <SummaryCard
          label="Arrivals"
          value={
            arrivalsToday.length
          }
          description="Expected today"
          tone="blue"
        />

        <SummaryCard
          label="In House"
          value={inHouse.length}
          description="Guests staying"
          tone="blue"
        />

        <SummaryCard
          label="Departures"
          value={
            departuresToday.length
          }
          description="Leaving today"
          tone="blue"
        />

        <SummaryCard
          label="Available"
          value={
            availableTonight
          }
          description="Rooms tonight"
          tone="green"
        />

        <SummaryCard
          label="Dirty"
          value={
            dirtyRooms.length
          }
          description="Need cleaning"
          tone={
            dirtyRooms.length > 0
              ? "warning"
              : "green"
          }
        />

        <SummaryMoneyCard
          label="Outstanding"
          value={
            totalOutstanding
          }
          description="Guest balances"
        />
      </section>

      {loading ? (
        <section style={loadingBox}>
          Loading Front Desk...
        </section>
      ) : (
        <section style={dashboardGrid}>
          {/* =================================================
              LEFT
          ================================================= */}

          <div style={leftColumn}>
            <Panel
              title="Arrivals Today"
              count={
                arrivalsToday.length
              }
              subtitle="Guests expected to arrive"
              accent="blue"
            >
              {arrivalsToday.length ===
              0 ? (
                <EmptyRow
                  text="No arrivals scheduled for today."
                />
              ) : (
                arrivalsToday
                  .slice(0, 6)
                  .map(
                    (
                      reservation
                    ) => (
                      <GuestRow
                        key={
                          reservation.id
                        }
                        reservation={
                          reservation
                        }
                        balance={balanceForReservation(
                          reservation
                        )}
                        actionLabel={
                          reservation.status ===
                          "confirmed"
                            ? "Check In"
                            : "Open"
                        }
                        actionDisabled={
                          updatingId ===
                          reservation.id
                        }
                        onOpen={() =>
                          router.push(
                            `/reservations/${reservation.id}`
                          )
                        }
                        onAction={() => {
                          if (
                            reservation.status ===
                            "confirmed"
                          ) {
                            checkIn(
                              reservation
                            );
                          } else {
                            router.push(
                              `/reservations/${reservation.id}`
                            );
                          }
                        }}
                      />
                    )
                  )
              )}
            </Panel>

            <Panel
              title="Currently In House"
              count={inHouse.length}
              subtitle="Guests currently staying"
              accent="green"
            >
              {inHouse.length === 0 ? (
                <EmptyRow
                  text="No guests are currently checked in."
                />
              ) : (
                inHouse
                  .slice(0, 7)
                  .map(
                    (
                      reservation
                    ) => (
                      <GuestRow
                        key={
                          reservation.id
                        }
                        reservation={
                          reservation
                        }
                        balance={balanceForReservation(
                          reservation
                        )}
                        actionLabel={
                          reservation.departure_date ===
                          today
                            ? "Check Out"
                            : "Open"
                        }
                        actionDisabled={
                          updatingId ===
                          reservation.id
                        }
                        onOpen={() =>
                          router.push(
                            `/reservations/${reservation.id}`
                          )
                        }
                        onAction={() => {
                          if (
                            reservation.departure_date ===
                            today
                          ) {
                            checkOut(
                              reservation
                            );
                          } else {
                            router.push(
                              `/reservations/${reservation.id}`
                            );
                          }
                        }}
                      />
                    )
                  )
              )}
            </Panel>
          </div>

          {/* =================================================
              RIGHT
          ================================================= */}

          <div style={rightColumn}>
            <Panel
              title="Departures Today"
              count={
                departuresToday.length
              }
              subtitle="Rooms due to check out"
              accent="blue"
            >
              {departuresToday.length ===
              0 ? (
                <EmptyRow
                  text="No departures scheduled for today."
                />
              ) : (
                departuresToday
                  .slice(0, 5)
                  .map(
                    (
                      reservation
                    ) => (
                      <CompactGuestRow
                        key={
                          reservation.id
                        }
                        reservation={
                          reservation
                        }
                        balance={balanceForReservation(
                          reservation
                        )}
                        disabled={
                          updatingId ===
                          reservation.id
                        }
                        onClick={() =>
                          checkOut(
                            reservation
                          )
                        }
                        onOpen={() =>
                          router.push(
                            `/reservations/${reservation.id}`
                          )
                        }
                      />
                    )
                  )
              )}
            </Panel>

            <Panel
              title="Housekeeping"
              count={
                dirtyRooms.length +
                cleaningRooms.length
              }
              subtitle="Rooms requiring attention"
              accent="green"
              headerAction={
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/housekeeping"
                    )
                  }
                  style={
                    smallHeaderButton
                  }
                >
                  Open Housekeeping
                </button>
              }
            >
              {dirtyRooms.length ===
                0 &&
              cleaningRooms.length ===
                0 ? (
                <div
                  style={
                    housekeepingClear
                  }
                >
                  <div
                    style={
                      housekeepingClearIcon
                    }
                  >
                    ✓
                  </div>

                  <div>
                    <strong>
                      All rooms caught up
                    </strong>

                    <span>
                      No rooms currently require cleaning.
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  style={
                    roomStatusGrid
                  }
                >
                  {dirtyRooms
                    .slice(0, 5)
                    .map((room) => (
                      <RoomStatus
                        key={
                          room.id
                        }
                        room={room}
                        status="Dirty"
                      />
                    ))}

                  {cleaningRooms
                    .slice(0, 5)
                    .map((room) => (
                      <RoomStatus
                        key={
                          room.id
                        }
                        room={room}
                        status="Cleaning"
                      />
                    ))}
                </div>
              )}

              <div
                style={
                  housekeepingFooter
                }
              >
                <span>
                  Clean & ready rooms
                </span>

                <strong>
                  {cleanRooms.length}
                </strong>
              </div>
            </Panel>

            <Panel
              title="Outstanding Balances"
              count={
                outstandingReservations.length
              }
              subtitle="Reservations still owing"
              accent="warning"
            >
              {outstandingReservations.length ===
              0 ? (
                <EmptyRow
                  text="No outstanding guest balances."
                />
              ) : (
                outstandingReservations
                  .slice(0, 5)
                  .map(
                    (
                      reservation
                    ) => (
                      <BalanceRow
                        key={
                          reservation.id
                        }
                        reservation={
                          reservation
                        }
                        balance={balanceForReservation(
                          reservation
                        )}
                        onClick={() =>
                          router.push(
                            `/reservations/${reservation.id}`
                          )
                        }
                      />
                    )
                  )
              )}
            </Panel>
          </div>
        </section>
      )}

      {/* ===================================================
          BOTTOM
      =================================================== */}

      <footer style={footerStyle}>
        <div style={workflowStrip}>
          <WorkflowStep
            number="1"
            label="Arrival"
          />

          <span style={workflowArrow}>
            →
          </span>

          <WorkflowStep
            number="2"
            label="Check In"
          />

          <span style={workflowArrow}>
            →
          </span>

          <WorkflowStep
            number="3"
            label="Stay"
          />

          <span style={workflowArrow}>
            →
          </span>

          <WorkflowStep
            number="4"
            label="Check Out"
          />

          <span style={workflowArrow}>
            →
          </span>

          <WorkflowStep
            number="5"
            label="Housekeeping"
          />
        </div>

        <div style={footerActions}>
          <button
            type="button"
            onClick={() =>
              router.push(
                "/reservations"
              )
            }
            style={footerButton}
          >
            Reservation Calendar
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/housekeeping"
              )
            }
            style={footerGreenButton}
          >
            Housekeeping
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/reservations/new"
              )
            }
            style={footerPrimaryButton}
          >
            + New Reservation
          </button>
        </div>
      </footer>
    </main>
  );
}

// =========================================================
// PANEL
// =========================================================

function Panel({
  title,
  count,
  subtitle,
  headerAction,
  accent,
  children,
}: {
  title: string;
  count: number;
  subtitle: string;
  headerAction?: ReactNode;
  accent:
    | "blue"
    | "green"
    | "warning";
  children: ReactNode;
}) {
  return (
    <section style={panelStyle}>
      <div
        style={{
          ...panelHeader,

          ...(accent === "green"
            ? {
                borderLeftColor:
                  "#1f9d62",
              }
            : accent ===
              "warning"
            ? {
                borderLeftColor:
                  "#5F83A3",
              }
            : {
                borderLeftColor:
                  "#1f5fae",
              }),
        }}
      >
        <div>
          <div style={panelHeadingRow}>
            <strong style={panelTitle}>
              {title}
            </strong>

            <span
              style={{
                ...countBadge,

                ...(accent === "green"
                  ? {
                      background:
                        "#eaf7f0",
                      color:
                        "#187c4e",
                    }
                  : accent ===
                    "warning"
                  ? {
                      background:
                        "#EEF4F8",
                      color:
                        "#486A87",
                    }
                  : {}),
              }}
            >
              {count}
            </span>
          </div>

          <div style={panelSubtitle}>
            {subtitle}
          </div>
        </div>

        {headerAction}
      </div>

      <div>
        {children}
      </div>
    </section>
  );
}

// =========================================================
// GUEST ROW
// =========================================================

function GuestRow({
  reservation,
  balance,
  actionLabel,
  actionDisabled,
  onOpen,
  onAction,
}: {
  reservation: Reservation;
  balance: number;
  actionLabel: string;
  actionDisabled: boolean;
  onOpen: () => void;
  onAction: () => void;
}) {
  const room =
    reservation.reservation_rooms[0] ??
    null;

  return (
    <div style={guestRow}>
      <button
        type="button"
        onClick={onOpen}
        style={guestDetailsButton}
      >
        <div style={guestPrimary}>
          <strong style={guestNameStyle}>
            {getGuestName(
              reservation
            )}
          </strong>

          <span
            style={
              reservationNumber
            }
          >
            {
              reservation.reservation_number
            }
          </span>
        </div>

        <div style={guestInfoGroup}>
          <Info
            label="Room"
            value={
              room?.rooms
                ?.room_number
                ? `Room ${room.rooms.room_number}`
                : "Unassigned"
            }
          />

          <Info
            label="Stay"
            value={`${formatShortDate(
              reservation.arrival_date
            )} → ${formatShortDate(
              reservation.departure_date
            )}`}
          />

          <Info
            label="Guests"
            value={`${
              reservation.adults
            } Adult${
              reservation.adults ===
              1
                ? ""
                : "s"
            }${
              reservation.children >
              0
                ? ` · ${reservation.children} Child${
                    reservation.children ===
                    1
                      ? ""
                      : "ren"
                  }`
                : ""
            }`}
          />

          <Info
            label="Balance"
            value={`N$${balance.toFixed(
              2
            )}`}
            warning={balance > 0}
          />
        </div>
      </button>

      <button
        type="button"
        disabled={
          actionDisabled
        }
        onClick={onAction}
        style={
          actionLabel ===
            "Check In" ||
          actionLabel ===
            "Check Out"
            ? rowActionPrimary
            : rowActionSecondary
        }
      >
        {actionDisabled
          ? "Please wait..."
          : actionLabel}
      </button>
    </div>
  );
}

// =========================================================
// COMPACT GUEST ROW
// =========================================================

function CompactGuestRow({
  reservation,
  balance,
  disabled,
  onClick,
  onOpen,
}: {
  reservation: Reservation;
  balance: number;
  disabled: boolean;
  onClick: () => void;
  onOpen: () => void;
}) {
  const room =
    reservation.reservation_rooms[0] ??
    null;

  return (
    <div style={compactRow}>
      <button
        type="button"
        onClick={onOpen}
        style={compactOpenButton}
      >
        <div>
          <strong
            style={
              compactGuestName
            }
          >
            {getGuestName(
              reservation
            )}
          </strong>

          <div
            style={compactSubtext}
          >
            {room?.rooms
              ?.room_number
              ? `Room ${room.rooms.room_number}`
              : "Unassigned"}

            {" · "}

            {
              reservation.reservation_number
            }
          </div>
        </div>

        <div
          style={compactBalance}
        >
          <span>
            Balance
          </span>

          <strong>
            N$
            {balance.toFixed(2)}
          </strong>
        </div>
      </button>

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={
          compactActionButton
        }
      >
        {disabled
          ? "..."
          : "Check Out"}
      </button>
    </div>
  );
}

// =========================================================
// BALANCE ROW
// =========================================================

function BalanceRow({
  reservation,
  balance,
  onClick,
}: {
  reservation: Reservation;
  balance: number;
  onClick: () => void;
}) {
  const room =
    reservation.reservation_rooms[0] ??
    null;

  return (
    <button
      type="button"
      onClick={onClick}
      style={balanceRow}
    >
      <div>
        <strong
          style={balanceGuest}
        >
          {getGuestName(
            reservation
          )}
        </strong>

        <div
          style={compactSubtext}
        >
          {room?.rooms
            ?.room_number
            ? `Room ${room.rooms.room_number}`
            : reservation.reservation_number}
        </div>
      </div>

      <strong
        style={balanceAmount}
      >
        N$
        {balance.toFixed(2)}
      </strong>
    </button>
  );
}

// =========================================================
// ROOM STATUS
// =========================================================

function RoomStatus({
  room,
  status,
}: {
  room: Room;
  status:
    | "Dirty"
    | "Cleaning";
}) {
  return (
    <div
      style={{
        ...roomStatusCard,

        ...(status === "Dirty"
          ? dirtyRoomCard
          : cleaningRoomCard),
      }}
    >
      <div>
        <strong>
          Room {room.room_number}
        </strong>

        {room.room_name && (
          <span
            style={roomNameText}
          >
            {room.room_name}
          </span>
        )}
      </div>

      <span
        style={{
          ...roomStatusBadge,

          ...(status === "Dirty"
            ? dirtyRoomBadge
            : cleaningRoomBadge),
        }}
      >
        {status}
      </span>
    </div>
  );
}

// =========================================================
// INFO
// =========================================================

function Info({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div>
      <span style={infoLabel}>
        {label}
      </span>

      <strong
        style={{
          ...infoValue,

          ...(warning
            ? {
                color:
                  "#0D5FA8",
              }
            : {}),
        }}
      >
        {value}
      </strong>
    </div>
  );
}

// =========================================================
// SUMMARY
// =========================================================

function SummaryCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: number;
  description: string;
  tone:
    | "blue"
    | "green"
    | "warning";
}) {
  const toneStyle =
    tone === "green"
      ? summaryGreen
      : tone === "warning"
      ? summaryWarning
      : summaryBlue;

  return (
    <div
      style={{
        ...summaryCard,
        ...toneStyle,
      }}
    >
      <div>
        <div
          style={summaryLabel}
        >
          {label}
        </div>

        <div
          style={
            summaryDescription
          }
        >
          {description}
        </div>
      </div>

      <strong
        style={summaryValue}
      >
        {value}
      </strong>
    </div>
  );
}

function SummaryMoneyCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div
      style={{
        ...summaryCard,
        ...summaryOutstanding,
      }}
    >
      <div>
        <div
          style={summaryLabel}
        >
          {label}
        </div>

        <div
          style={
            summaryDescription
          }
        >
          {description}
        </div>
      </div>

      <strong
        style={summaryMoney}
      >
        N$
        {value.toFixed(2)}
      </strong>
    </div>
  );
}

// =========================================================
// WORKFLOW
// =========================================================

function WorkflowStep({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div style={workflowStep}>
      <span
        style={workflowNumber}
      >
        {number}
      </span>

      <strong>
        {label}
      </strong>
    </div>
  );
}

// =========================================================
// EMPTY
// =========================================================

function EmptyRow({
  text,
}: {
  text: string;
}) {
  return (
    <div style={emptyRow}>
      <div style={emptyIcon}>
        ✓
      </div>

      <span>
        {text}
      </span>
    </div>
  );
}

// =========================================================
// HELPERS
// =========================================================

function getGuestName(
  reservation: Reservation
) {
  if (
    !reservation.guests
  ) {
    return "Guest";
  }

  return `${reservation.guests.first_name} ${reservation.guests.last_name}`;
}

function normaliseHousekeeping(
  value:
    | string
    | null
    | undefined
) {
  const cleaned =
    String(
      value ?? ""
    )
      .trim()
      .toLowerCase();

  if (
    cleaned === "dirty"
  ) {
    return "dirty";
  }

  if (
    cleaned === "cleaning"
  ) {
    return "cleaning";
  }

  return "clean";
}

function getTodayString() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function parseDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] = value
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

function formatFriendlyDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-NA",
    {
      weekday:
        "short",

      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      timeZone:
        "UTC",
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
      day:
        "2-digit",

      month:
        "short",

      timeZone:
        "UTC",
    }
  ).format(
    parseDate(value)
  );
}

// =========================================================
// NETPOS CRYSTAL THEME
// =========================================================

const BLUE = "#0D5FA8";
const DARK_BLUE = "#0D4F91";
const LIGHT_BLUE = "#EDF6FE";
const GREEN = "#168257";
const LIGHT_GREEN = "#ECF8F2";
const PAGE_BG = "#F6F9FC";
const TEXT = "#183A59";
const MUTED = "#71869A";

// =========================================================
// STYLES
// =========================================================

const pageStyle: CSSProperties = {
  minHeight: "calc(100vh - 100px)",
  maxWidth: 1500,
  margin: "0 auto",
  padding: "12px 22px 10px",
  fontFamily: "Arial, sans-serif",
  color: TEXT,
  background:
    "linear-gradient(180deg,#F7FAFD 0%,#F5F8FB 100%)",
  boxSizing: "border-box",
};

const pageHeadingRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 18,
  marginBottom: 9,
};

const eyebrowStyle: CSSProperties = {
  marginBottom: 4,
  color: GREEN,
  fontSize: 11.5,
  fontWeight: 900,
  letterSpacing: 0.9,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1,
  color: DARK_BLUE,
  fontWeight: 900,
};

const subtitleStyle: CSSProperties = {
  color: MUTED,
  fontSize: 13,
  marginTop: 5,
};

const frontDeskActions: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 7,
};

const propertyArea: CSSProperties = {
  width: 235,
};

const propertyLabel: CSSProperties = {
  display: "block",
  color: "#668096",
  fontSize: 11.5,
  fontWeight: 900,
  letterSpacing: 0.65,
  marginBottom: 4,
};

const propertySelect: CSSProperties = {
  width: "100%",
  height: 34,
  padding: "0 10px",
  border: "1px solid #C9DAE7",
  borderRadius: 7,
  background: "#FFFFFF",
  color: TEXT,
  fontSize: 13,
  fontWeight: 800,
  outline: "none",
};

const newReservationButton: CSSProperties = {
  height: 34,
  border: "1px solid #0D5FA8",
  borderRadius: 7,
  background: BLUE,
  color: "#FFFFFF",
  padding: "0 13px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 3px 9px rgba(13,95,168,.14)",
};

const secondaryTopButton: CSSProperties = {
  height: 34,
  border: "1px solid #BFD3E2",
  borderRadius: 7,
  background: "#FFFFFF",
  color: BLUE,
  padding: "0 12px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(6,minmax(0,1fr))",
  gap: 7,
  marginBottom: 8,
};

const summaryCard: CSSProperties = {
  minHeight: 67,
  padding: "9px 11px",
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: 9,
  background: "#FFFFFF",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 7,
  boxShadow: "0 3px 10px rgba(22,62,94,.04)",
};

const summaryBlue: CSSProperties = {
  borderColor: "#CFE0ED",
  background: "#FBFDFF",
};

const summaryGreen: CSSProperties = {
  borderColor: "#C8E2D5",
  background: "#FBFEFC",
};

const summaryWarning: CSSProperties = {
  borderColor: "#D5E1EA",
  background: "#FAFCFD",
};

const summaryOutstanding: CSSProperties = {
  borderColor: "#C7DDEC",
  background: LIGHT_BLUE,
};

const summaryLabel: CSSProperties = {
  color: "#5F778C",
  fontSize: 11.5,
  fontWeight: 900,
  textTransform: "uppercase",
  marginBottom: 3,
  letterSpacing: 0.35,
};

const summaryDescription: CSSProperties = {
  color: "#8A99A7",
  fontSize: 11.5,
};

const summaryValue: CSSProperties = {
  fontSize: 29,
  lineHeight: 1,
  color: DARK_BLUE,
};

const summaryMoney: CSSProperties = {
  fontSize: 18,
  lineHeight: 1,
  color: DARK_BLUE,
  whiteSpace: "nowrap",
};

const dashboardGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1.58fr) minmax(365px,.82fr)",
  gap: 7,
  alignItems: "start",
};

const leftColumn: CSSProperties = {
  display: "grid",
  gap: 7,
};

const rightColumn: CSSProperties = {
  display: "grid",
  gap: 7,
};

const panelStyle: CSSProperties = {
  border: "1px solid #D2E0EA",
  borderRadius: 10,
  background: "#FFFFFF",
  overflow: "hidden",
  boxShadow: "0 4px 14px rgba(19,67,108,.045)",
};

const panelHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "9px 11px",
  borderBottom: "1px solid #E4ECF2",
  borderLeft: "4px solid",
  background:
    "linear-gradient(90deg,#F8FBFD 0%,#FFFFFF 100%)",
};

const panelHeadingRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const panelTitle: CSSProperties = {
  fontSize: 13,
  color: DARK_BLUE,
};

const panelSubtitle: CSSProperties = {
  color: MUTED,
  fontSize: 11.5,
  marginTop: 2,
};

const countBadge: CSSProperties = {
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  borderRadius: 20,
  background: LIGHT_BLUE,
  color: BLUE,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: 12,
  fontWeight: 900,
};

const smallHeaderButton: CSSProperties = {
  border: "1px solid #BFD4E3",
  borderRadius: 6,
  background: "#FFFFFF",
  color: BLUE,
  padding: "5px 8px",
  fontSize: 11.5,
  fontWeight: 900,
  cursor: "pointer",
};

const guestRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) 96px",
  borderBottom: "1px solid #EAF0F5",
};

const guestDetailsButton: CSSProperties = {
  border: 0,
  background: "#FFFFFF",
  padding: "9px 11px",
  textAlign: "left",
  display: "grid",
  gridTemplateColumns: "1.15fr 2.85fr",
  gap: 15,
  alignItems: "center",
  cursor: "pointer",
};

const guestPrimary: CSSProperties = {
  minWidth: 0,
};

const guestNameStyle: CSSProperties = {
  display: "block",
  fontSize: 12,
  color: TEXT,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const reservationNumber: CSSProperties = {
  display: "block",
  marginTop: 2,
  color: MUTED,
  fontSize: 11.5,
};

const guestInfoGroup: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 10,
};

const infoLabel: CSSProperties = {
  display: "block",
  color: "#8293A2",
  fontSize: 13,
  fontWeight: 900,
  textTransform: "uppercase",
  marginBottom: 2,
};

const infoValue: CSSProperties = {
  display: "block",
  fontSize: 13,
  color: TEXT,
  whiteSpace: "nowrap",
};

const rowActionPrimary: CSSProperties = {
  margin: 7,
  border: 0,
  borderRadius: 6,
  background: GREEN,
  color: "#FFFFFF",
  padding: "7px 5px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const rowActionSecondary: CSSProperties = {
  ...rowActionPrimary,
  background: BLUE,
};

const compactRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0,1fr) 86px",
  borderBottom: "1px solid #EAF0F5",
};

const compactOpenButton: CSSProperties = {
  border: 0,
  background: "#FFFFFF",
  padding: "8px 10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  textAlign: "left",
  cursor: "pointer",
};

const compactGuestName: CSSProperties = {
  fontSize: 11.5,
  color: TEXT,
};

const compactSubtext: CSSProperties = {
  marginTop: 2,
  color: MUTED,
  fontSize: 11.5,
};

const compactBalance: CSSProperties = {
  textAlign: "right",
  color: BLUE,
  fontSize: 11.5,
};

const compactActionButton: CSSProperties = {
  margin: 6,
  border: 0,
  borderRadius: 6,
  background: GREEN,
  color: "#FFFFFF",
  fontSize: 11.5,
  fontWeight: 900,
  cursor: "pointer",
};

const balanceRow: CSSProperties = {
  width: "100%",
  border: 0,
  borderBottom: "1px solid #EAF0F5",
  background: "#FFFFFF",
  padding: "8px 10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  textAlign: "left",
  cursor: "pointer",
};

const balanceGuest: CSSProperties = {
  fontSize: 11.5,
  color: TEXT,
};

const balanceAmount: CSSProperties = {
  color: BLUE,
  fontSize: 12,
};

const roomStatusGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
  gap: 6,
  padding: 8,
};

const roomStatusCard: CSSProperties = {
  minHeight: 40,
  padding: "6px 8px",
  borderRadius: 7,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 7,
  fontSize: 13,
};

const dirtyRoomCard: CSSProperties = {
  border: "1px solid #D6E1EA",
  background: "#F8FAFC",
};

const cleaningRoomCard: CSSProperties = {
  border: "1px solid #C7DDED",
  background: "#F1F8FD",
};

const roomNameText: CSSProperties = {
  display: "block",
  marginTop: 2,
  color: MUTED,
  fontSize: 11.5,
};

const roomStatusBadge: CSSProperties = {
  padding: "3px 6px",
  borderRadius: 15,
  fontSize: 13,
  fontWeight: 900,
};

const dirtyRoomBadge: CSSProperties = {
  background: "#E9EEF3",
  color: "#566B7E",
};

const cleaningRoomBadge: CSSProperties = {
  background: "#E5F2FB",
  color: BLUE,
};

const housekeepingClear: CSSProperties = {
  padding: "13px 11px",
  display: "flex",
  alignItems: "center",
  gap: 7,
  color: GREEN,
  fontSize: 13,
};

const housekeepingClearIcon: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  background: LIGHT_GREEN,
  color: GREEN,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 14,
  fontWeight: 900,
};

const housekeepingFooter: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "7px 10px",
  borderTop: "1px solid #E4ECF2",
  background: "#F7FCF9",
  color: GREEN,
  fontSize: 13,
};

const emptyRow: CSSProperties = {
  padding: "13px 11px",
  color: MUTED,
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const emptyIcon: CSSProperties = {
  width: 21,
  height: 21,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: LIGHT_GREEN,
  color: GREEN,
  fontSize: 13,
  fontWeight: 900,
};

const successBox: CSSProperties = {
  marginBottom: 9,
  padding: "8px 11px",
  border: "1px solid #B6DCC8",
  borderRadius: 7,
  background: LIGHT_GREEN,
  color: "#146D45",
  fontSize: 13,
  fontWeight: 800,
};

const errorBox: CSSProperties = {
  marginBottom: 9,
  padding: "8px 11px",
  border: "1px solid #E0AAAA",
  borderRadius: 7,
  background: "#FFF4F4",
  color: "#A11A1A",
  fontSize: 13,
};

const loadingBox: CSSProperties = {
  padding: 35,
  border: "1px solid #D2E0EA",
  borderRadius: 9,
  textAlign: "center",
  background: "#FFFFFF",
  color: MUTED,
  fontSize: 11.5,
};

const footerStyle: CSSProperties = {
  marginTop: 10,
  padding: "8px 10px",
  border: "1px solid #D2E0EA",
  borderRadius: 9,
  background: "#FFFFFF",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  boxShadow: "0 3px 10px rgba(22,62,94,.035)",
};

const workflowStrip: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
};

const workflowStep: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  color: "#60778B",
  fontSize: 11.5,
};

const workflowNumber: CSSProperties = {
  width: 19,
  height: 19,
  borderRadius: "50%",
  background: LIGHT_BLUE,
  color: BLUE,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 11.5,
  fontWeight: 900,
};

const workflowArrow: CSSProperties = {
  color: "#A1AFBD",
  fontSize: 11.5,
};

const footerActions: CSSProperties = {
  display: "flex",
  gap: 6,
};

const footerButton: CSSProperties = {
  border: "1px solid #BFD3E2",
  borderRadius: 6,
  background: "#FFFFFF",
  color: BLUE,
  padding: "7px 10px",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const footerGreenButton: CSSProperties = {
  ...footerButton,
  borderColor: "#B9DDCA",
  background: LIGHT_GREEN,
  color: GREEN,
};

const footerPrimaryButton: CSSProperties = {
  ...footerButton,
  borderColor: BLUE,
  background: BLUE,
  color: "#FFFFFF",
};
