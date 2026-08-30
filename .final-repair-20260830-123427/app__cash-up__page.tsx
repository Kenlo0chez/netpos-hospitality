"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
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

type TradingDay = {
  id: string;
  property_id: string;
  business_date: string;
  status: string;
  closed_at: string | null;
};

type Payment = {
  id: string;
  property_id: string;
  trading_day_id: string | null;
  reservation_id: string | null;
  payment_reference: string | null;
  payment_method: string;
  transaction_type: string;
  amount: number;
  notes: string | null;
  received_at: string;
};

type ReservationRoom = {
  room_id: string | null;
  rooms: {
    room_number: string;
  } | null;
};

type Reservation = {
  id: string;
  reservation_number: string;
  status: string;
  guest_id: string;
  cancelled_at: string | null;
  cancelled_trading_day_id: string | null;
  reservation_rooms: ReservationRoom[];
};

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
};

type ReportLine = {
  payment: Payment;
  reservationNumber: string;
  guestName: string;
  roomNumber: string;
};

// =========================================================
// PAGE
// =========================================================

export default function XReportPage() {
  const router = useRouter();

  const [properties, setProperties] =
    useState<Property[]>([]);

  const [propertyId, setPropertyId] =
    useState("");

  const [currentDay, setCurrentDay] =
    useState<TradingDay | null>(null);

  const [historyDays, setHistoryDays] =
    useState<TradingDay[]>([]);

  const [selectedReportDay, setSelectedReportDay] =
    useState<TradingDay | null>(null);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [reservations, setReservations] =
    useState<Reservation[]>([]);

  const [guests, setGuests] =
    useState<Guest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [endingDay, setEndingDay] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [message, setMessage] =
    useState("");

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    initialisePage();
  }, []);

  async function initialisePage() {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } =
        await supabase
          .from("properties")
          .select("id,name")
          .order("name");

      if (error) {
        throw new Error(error.message);
      }

      const rows =
        (data as Property[]) ?? [];

      setProperties(rows);

      const firstPropertyId =
        rows[0]?.id ?? "";

      setPropertyId(firstPropertyId);

      if (firstPropertyId) {
        await loadPropertyReport(
          firstPropertyId
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load X Report."
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
    setSelectedReportDay(null);

    await loadPropertyReport(value);
  }

  // =========================================================
  // TRADING DAY
  // =========================================================

  async function loadPropertyReport(
    selectedPropertyId: string
  ) {
    if (!selectedPropertyId) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: openDayRows,
        error: openDayError,
      } = await supabase
        .from("trading_days")
        .select(`
          id,
          property_id,
          business_date,
          status,
          closed_at
        `)
        .eq(
          "property_id",
          selectedPropertyId
        )
        .eq("status", "open")
        .order("business_date", {
          ascending: false,
        })
        .limit(1);

      if (openDayError) {
        throw new Error(
          openDayError.message
        );
      }

      let openDay =
        ((openDayRows as TradingDay[]) ??
          [])[0] ?? null;

      if (!openDay) {
        openDay =
          await createNextTradingDay(
            selectedPropertyId
          );
      }

      setCurrentDay(openDay);

      const {
        data: historyData,
        error: historyError,
      } = await supabase
        .from("trading_days")
        .select(`
          id,
          property_id,
          business_date,
          status,
          closed_at
        `)
        .eq(
          "property_id",
          selectedPropertyId
        )
        .eq("status", "closed")
        .order("business_date", {
          ascending: false,
        })
        .limit(60);

      if (historyError) {
        throw new Error(
          historyError.message
        );
      }

      setHistoryDays(
        (historyData as TradingDay[]) ??
          []
      );

      setSelectedReportDay(openDay);

      await loadReportData(
        selectedPropertyId,
        openDay.id
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load X Report."
      );
    } finally {
      setLoading(false);
    }
  }

  async function createNextTradingDay(
    selectedPropertyId: string
  ) {
    const {
      data: previousRows,
      error: previousError,
    } = await supabase
      .from("trading_days")
      .select(`
        id,
        property_id,
        business_date,
        status,
        closed_at
      `)
      .eq(
        "property_id",
        selectedPropertyId
      )
      .order("business_date", {
        ascending: false,
      })
      .limit(1);

    if (previousError) {
      throw new Error(
        previousError.message
      );
    }

    const previous =
      ((previousRows as TradingDay[]) ??
        [])[0] ?? null;

    const nextBusinessDate =
      previous
        ? addDays(
            previous.business_date,
            1
          )
        : getTodayString();

    const {
      data,
      error,
    } = await supabase
      .from("trading_days")
      .insert({
        property_id:
          selectedPropertyId,
        business_date:
          nextBusinessDate,
        status: "open",
      })
      .select(`
        id,
        property_id,
        business_date,
        status,
        closed_at
      `)
      .single();

    if (error) {
      throw new Error(
        error.message
      );
    }

    return data as TradingDay;
  }

  // =========================================================
  // LOAD REPORT DATA
  // =========================================================

  async function loadReportData(
    selectedPropertyId: string,
    tradingDayId: string
  ) {
    setLoading(true);
    setErrorMessage("");

    try {
      const [
        paymentResult,
        reservationResult,
        guestResult,
      ] = await Promise.all([
        supabase
          .from("payments")
          .select(`
            id,
            property_id,
            trading_day_id,
            reservation_id,
            payment_reference,
            payment_method,
            transaction_type,
            amount,
            notes,
            received_at
          `)
          .eq(
            "trading_day_id",
            tradingDayId
          )
          .order("received_at", {
            ascending: true,
          }),

        supabase
          .from("reservations")
          .select(`
            id,
            reservation_number,
            status,
            guest_id,
            cancelled_at,
            cancelled_trading_day_id,
            reservation_rooms (
              room_id,
              rooms (
                room_number
              )
            )
          `)
          .eq(
            "property_id",
            selectedPropertyId
          ),

        supabase
          .from("guests")
          .select(`
            id,
            first_name,
            last_name
          `),
      ]);

      if (paymentResult.error) {
        throw new Error(
          `Payments: ${paymentResult.error.message}`
        );
      }

      if (reservationResult.error) {
        throw new Error(
          `Reservations: ${reservationResult.error.message}`
        );
      }

      if (guestResult.error) {
        throw new Error(
          `Guests: ${guestResult.error.message}`
        );
      }

      setPayments(
        (paymentResult.data as Payment[]) ??
          []
      );

      setReservations(
        (reservationResult.data as Reservation[]) ??
          []
      );

      setGuests(
        (guestResult.data as Guest[]) ??
          []
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load report data."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // LOOKUPS / REPORT
  // =========================================================

  const guestsById =
    useMemo(() => {
      const map =
        new Map<string, Guest>();

      for (const guest of guests) {
        map.set(
          guest.id,
          guest
        );
      }

      return map;
    }, [guests]);

  const reservationsById =
    useMemo(() => {
      const map =
        new Map<string, Reservation>();

      for (const reservation of reservations) {
        map.set(
          reservation.id,
          reservation
        );
      }

      return map;
    }, [reservations]);

  const reportLines =
    useMemo(() => {
      return payments.map(
        (payment): ReportLine => {
          const reservation =
            payment.reservation_id
              ? reservationsById.get(
                  payment.reservation_id
                )
              : null;

          const guest =
            reservation
              ? guestsById.get(
                  reservation.guest_id
                )
              : null;

          const roomNumber =
            reservation
              ?.reservation_rooms?.[0]
              ?.rooms
              ?.room_number ??
            "-";

          return {
            payment,
            reservationNumber:
              reservation
                ?.reservation_number ??
              "-",
            guestName:
              guest
                ? `${guest.first_name} ${guest.last_name}`
                : "Guest / Customer",
            roomNumber,
          };
        }
      );
    }, [
      payments,
      reservationsById,
      guestsById,
    ]);

  const cancellations =
    useMemo(() => {
      if (!selectedReportDay) {
        return [];
      }

      return reservations.filter(
        (reservation) =>
          reservation
            .cancelled_trading_day_id ===
          selectedReportDay.id
      );
    }, [
      reservations,
      selectedReportDay,
    ]);

  function signedAmount(
    payment: Payment
  ) {
    const amount =
      Number(
        payment.amount ?? 0
      );

    return payment
      .transaction_type ===
      "refund"
      ? -amount
      : amount;
  }

  function methodTotal(
    method: string
  ) {
    return payments
      .filter(
        (payment) =>
          payment.payment_method ===
          method
      )
      .reduce(
        (total, payment) =>
          total +
          signedAmount(payment),
        0
      );
  }

  const cashTotal =
    methodTotal("cash");

  const cardTotal =
    methodTotal("card");

  const eftTotal =
    methodTotal("eft");

  const accountTotal =
    methodTotal("account");

  const refundTotal =
    payments
      .filter(
        (payment) =>
          payment.transaction_type ===
          "refund"
      )
      .reduce(
        (total, payment) =>
          total +
          Number(
            payment.amount ?? 0
          ),
        0
      );

  const grossPayments =
    payments
      .filter(
        (payment) =>
          payment.transaction_type !==
          "refund"
      )
      .reduce(
        (total, payment) =>
          total +
          Number(
            payment.amount ?? 0
          ),
        0
      );

  const netTotal =
    payments.reduce(
      (total, payment) =>
        total +
        signedAmount(payment),
      0
    );

  const isHistoric =
    selectedReportDay?.status ===
    "closed";

  // =========================================================
  // HISTORY
  // =========================================================

  async function openHistoryDay(
    day: TradingDay
  ) {
    setSelectedReportDay(day);
    setMessage("");

    await loadReportData(
      propertyId,
      day.id
    );
  }

  async function returnToCurrentReport() {
    if (!currentDay) {
      return;
    }

    setSelectedReportDay(
      currentDay
    );

    await loadReportData(
      propertyId,
      currentDay.id
    );
  }

  // =========================================================
  // PRINT X REPORT
  // =========================================================

  function printXReport() {
    if (!selectedReportDay) {
      return;
    }

    const propertyName =
      properties.find(
        (property) =>
          property.id === propertyId
      )?.name ??
      "Property";

    const cancellationRows =
      cancellations
        .map(
          (reservation) => {
            const guest =
              guestsById.get(
                reservation.guest_id
              );

            const room =
              reservation
                .reservation_rooms?.[0]
                ?.rooms?.room_number ??
              "-";

            return `
              <tr>
                <td>${escapeHtml(
                  reservation.reservation_number
                )}</td>
                <td>${escapeHtml(
                  guest
                    ? `${guest.first_name} ${guest.last_name}`
                    : "Guest / Customer"
                )}</td>
                <td>${escapeHtml(
                  room
                )}</td>
                <td>${escapeHtml(
                  reservation.cancelled_at
                    ? formatDateTime(
                        reservation.cancelled_at
                      )
                    : "-"
                )}</td>
              </tr>
            `;
          }
        )
        .join("");

    const paymentRows =
      reportLines
        .map(
          (line) => `
            <tr>
              <td>${escapeHtml(
                formatTime(
                  line.payment.received_at
                )
              )}</td>
              <td>${escapeHtml(
                line.reservationNumber
              )}</td>
              <td>${escapeHtml(
                line.roomNumber
              )}</td>
              <td>${escapeHtml(
                line.guestName
              )}</td>
              <td>${escapeHtml(
                line.payment.payment_method.toUpperCase()
              )}</td>
              <td>${escapeHtml(
                line.payment.transaction_type
                  .replaceAll("_", " ")
                  .toUpperCase()
              )}</td>
              <td style="text-align:right">
                ${
                  line.payment
                    .transaction_type ===
                  "refund"
                    ? "-"
                    : ""
                }${money(
                  Number(
                    line.payment.amount ??
                      0
                  )
                )}
              </td>
            </tr>
          `
        )
        .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>X Report - ${escapeHtml(
            selectedReportDay.business_date
          )}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #111;
              margin: 28px;
              font-size: 12px;
            }
            h1 {
              margin: 0 0 4px;
              font-size: 22px;
            }
            h2 {
              margin: 22px 0 8px;
              font-size: 15px;
            }
            .muted {
              color: #666;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin: 18px 0;
            }
            .box {
              border: 1px solid #bbb;
              padding: 9px;
            }
            .label {
              color: #666;
              font-size: 10px;
            }
            .value {
              margin-top: 3px;
              font-size: 16px;
              font-weight: 700;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th, td {
              border-bottom: 1px solid #ddd;
              padding: 6px 5px;
              text-align: left;
            }
            th {
              background: #f3f3f3;
              font-size: 10px;
            }
            .footer {
              margin-top: 24px;
              border-top: 1px solid #aaa;
              padding-top: 8px;
              font-size: 10px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <h1>NETPOS HOSPITALITY</h1>
          <div class="muted">${escapeHtml(
            propertyName
          )}</div>

          <h2>
            X REPORT — Business Day ${escapeHtml(
              formatDate(
                selectedReportDay.business_date
              )
            )}
          </h2>

          <div class="muted">
            ${
              isHistoric
                ? "Historical End-of-Day Report"
                : "Current report since the last End of Day"
            }
          </div>

          <div class="summary">
            <div class="box">
              <div class="label">CASH</div>
              <div class="value">${money(
                cashTotal
              )}</div>
            </div>
            <div class="box">
              <div class="label">CARD</div>
              <div class="value">${money(
                cardTotal
              )}</div>
            </div>
            <div class="box">
              <div class="label">EFT</div>
              <div class="value">${money(
                eftTotal
              )}</div>
            </div>
            <div class="box">
              <div class="label">ACCOUNT</div>
              <div class="value">${money(
                accountTotal
              )}</div>
            </div>
            <div class="box">
              <div class="label">REFUNDS</div>
              <div class="value">${money(
                refundTotal
              )}</div>
            </div>
            <div class="box">
              <div class="label">NET TOTAL</div>
              <div class="value">${money(
                netTotal
              )}</div>
            </div>
          </div>

          <h2>Transactions</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Reservation</th>
                <th>Room</th>
                <th>Guest</th>
                <th>Method</th>
                <th>Type</th>
                <th style="text-align:right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${
                paymentRows ||
                `<tr><td colspan="7">No transactions.</td></tr>`
              }
            </tbody>
          </table>

          <h2>Cancellations</h2>
          <table>
            <thead>
              <tr>
                <th>Reservation</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Cancelled</th>
              </tr>
            </thead>
            <tbody>
              ${
                cancellationRows ||
                `<tr><td colspan="4">No cancellations.</td></tr>`
              }
            </tbody>
          </table>

          <div class="footer">
            Gross payments: ${money(
              grossPayments
            )} |
            Refunds: ${money(
              refundTotal
            )} |
            Net: ${money(
              netTotal
            )}<br/>
            Printed ${escapeHtml(
              formatDateTime(
                new Date().toISOString()
              )
            )}
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=950,height=760"
      );

    if (!printWindow) {
      alert(
        "Please allow pop-ups so the X Report can be printed."
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(
      html
    );
    printWindow.document.close();
  }

  // =========================================================
  // END OF DAY
  // =========================================================

  async function endOfDay() {
    if (
      !currentDay ||
      selectedReportDay?.id !==
        currentDay.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `End business day ${formatDate(
          currentDay.business_date
        )}?\n\nThis X Report will move to History and a fresh trading day will begin immediately.`
      );

    if (!confirmed) {
      return;
    }

    setEndingDay(true);
    setMessage("");

    try {
      const {
        error: closeError,
      } = await supabase
        .from("trading_days")
        .update({
          status: "closed",
          closed_at:
            new Date().toISOString(),
        })
        .eq("id", currentDay.id);

      if (closeError) {
        throw new Error(
          closeError.message
        );
      }

      const nextDay =
        await createNextTradingDay(
          propertyId
        );

      setMessage(
        `End of Day completed. ${formatDate(
          currentDay.business_date
        )} moved to History.`
      );

      setCurrentDay(nextDay);
      setSelectedReportDay(nextDay);

      await loadPropertyReport(
        propertyId
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not complete End of Day."
      );
    } finally {
      setEndingDay(false);
    }
  }

  // =========================================================
  // SCREEN
  // =========================================================

  return (
    <main style={pageStyle}>
      {/* ===================================================
          HEADER
      =================================================== */}

      <header style={brandHeader}>
        <div style={brandIdentity}>
          <div style={brandMark}>
            N
          </div>

          <div>
            <div style={brandName}>
              NETPOS HOSPITALITY
            </div>

            <div style={brandTagline}>
              Property Management System
            </div>
          </div>
        </div>

        <div style={headerRight}>
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
                "/front-desk"
              )
            }
            style={headerButton}
          >
            Front Desk
          </button>
        </div>
      </header>

      {/* ===================================================
          TITLE
      =================================================== */}

      <section style={pageHeading}>
        <div>
          <h1 style={pageTitle}>
            {isHistoric
              ? "Historical X Report"
              : "X Report"}
          </h1>

          <div style={pageSubtitle}>
            {isHistoric
              ? "Previous End-of-Day sales report."
              : "All activity since the last End of Day."}
          </div>
        </div>

        <div style={businessDayBox}>
          <span style={businessDayLabel}>
            BUSINESS DAY
          </span>

          <strong style={businessDayValue}>
            {selectedReportDay
              ? formatDate(
                  selectedReportDay.business_date
                )
              : "-"}
          </strong>

          <span
            style={
              isHistoric
                ? closedBadge
                : openBadge
            }
          >
            {isHistoric
              ? "HISTORY"
              : "CURRENT"}
          </span>
        </div>
      </section>

      {errorMessage && (
        <div style={errorBox}>
          {errorMessage}
        </div>
      )}

      {message && (
        <div style={successBox}>
          ✓ {message}
        </div>
      )}

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <section style={summaryGrid}>
        <SummaryCard
          label="Cash"
          value={money(cashTotal)}
          tone="green"
        />

        <SummaryCard
          label="Card"
          value={money(cardTotal)}
          tone="blue"
        />

        <SummaryCard
          label="EFT"
          value={money(eftTotal)}
          tone="blue"
        />

        <SummaryCard
          label="Refunds"
          value={money(refundTotal)}
          tone="red"
        />

        <SummaryCard
          label="Net Total"
          value={money(netTotal)}
          tone="green"
        />
      </section>

      {/* ===================================================
          MAIN AREA
      =================================================== */}

      <section style={mainGrid}>
        {/* REPORT */}

        <div style={reportCard}>
          <div style={cardHeader}>
            <div>
              <h2 style={cardTitle}>
                Daily Activity
              </h2>

              <div style={cardSubtitle}>
                Payment method, reservation and room.
              </div>
            </div>

            <div style={countText}>
              {reportLines.length} transaction
              {reportLines.length === 1
                ? ""
                : "s"}
            </div>
          </div>

          <div style={transactionHeader}>
            <div>Time</div>
            <div>Reservation</div>
            <div>Room</div>
            <div>Guest</div>
            <div>Method</div>
            <div>Type</div>
            <div>Amount</div>
          </div>

          <div style={transactionScroll}>
            {loading ? (
              <div style={emptyState}>
                Loading X Report...
              </div>
            ) : reportLines.length ===
              0 ? (
              <div style={emptyState}>
                No transactions since the last End of Day.
              </div>
            ) : (
              reportLines.map(
                (line) => (
                  <div
                    key={
                      line.payment.id
                    }
                    style={transactionRow}
                  >
                    <div style={tableText}>
                      {formatTime(
                        line.payment.received_at
                      )}
                    </div>

                    <div style={reservationText}>
                      {line.reservationNumber}
                    </div>

                    <div style={roomText}>
                      {line.roomNumber}
                    </div>

                    <div style={tableText}>
                      {line.guestName}
                    </div>

                    <div>
                      <MethodBadge
                        method={
                          line.payment.payment_method
                        }
                      />
                    </div>

                    <div>
                      <TransactionBadge
                        type={
                          line.payment.transaction_type
                        }
                      />
                    </div>

                    <div
                      style={
                        line.payment.transaction_type ===
                        "refund"
                          ? refundAmount
                          : paymentAmount
                      }
                    >
                      {line.payment.transaction_type ===
                      "refund"
                        ? "-"
                        : ""}
                      {money(
                        Number(
                          line.payment.amount ??
                            0
                        )
                      )}
                    </div>
                  </div>
                )
              )
            )}
          </div>

          <div style={cancellationArea}>
            <div style={cancellationHeader}>
              <strong>
                Cancellations
              </strong>

              <span>
                {cancellations.length}
              </span>
            </div>

            {cancellations.length ===
            0 ? (
              <div style={noCancellation}>
                No cancellations in this business day.
              </div>
            ) : (
              cancellations.map(
                (reservation) => {
                  const guest =
                    guestsById.get(
                      reservation.guest_id
                    );

                  const room =
                    reservation
                      .reservation_rooms?.[0]
                      ?.rooms
                      ?.room_number ??
                    "-";

                  return (
                    <div
                      key={
                        reservation.id
                      }
                      style={cancellationRow}
                    >
                      <strong>
                        {
                          reservation.reservation_number
                        }
                      </strong>

                      <span>
                        Room {room}
                      </span>

                      <span>
                        {guest
                          ? `${guest.first_name} ${guest.last_name}`
                          : "Guest / Customer"}
                      </span>

                      <span>
                        {reservation.cancelled_at
                          ? formatDateTime(
                              reservation.cancelled_at
                            )
                          : "-"}
                      </span>
                    </div>
                  );
                }
              )
            )}
          </div>
        </div>

        {/* HISTORY */}

        <aside style={historyCard}>
          <div style={historyHeader}>
            <div>
              <h2 style={historyTitle}>
                History
              </h2>

              <div style={historySubtitle}>
                Previous End of Days
              </div>
            </div>

            {isHistoric && (
              <button
                type="button"
                onClick={
                  returnToCurrentReport
                }
                style={currentButton}
              >
                Current
              </button>
            )}
          </div>

          <div style={historyScroll}>
            {historyDays.length ===
            0 ? (
              <div style={historyEmpty}>
                No previous End of Day reports yet.
              </div>
            ) : (
              historyDays.map(
                (day) => (
                  <button
                    type="button"
                    key={day.id}
                    onClick={() =>
                      openHistoryDay(
                        day
                      )
                    }
                    style={{
                      ...historyDayButton,
                      ...(selectedReportDay
                        ?.id === day.id
                        ? historyDaySelected
                        : {}),
                    }}
                  >
                    <span style={calendarDay}>
                      {formatDayNumber(
                        day.business_date
                      )}
                    </span>

                    <span style={historyDateText}>
                      <strong>
                        {formatMonth(
                          day.business_date
                        )}
                      </strong>

                      <small>
                        {formatYear(
                          day.business_date
                        )}
                      </small>
                    </span>

                    <span style={historyArrow}>
                      ›
                    </span>
                  </button>
                )
              )
            )}
          </div>
        </aside>
      </section>

      {/* ===================================================
          ACTIONS
      =================================================== */}

      <footer style={footerStyle}>
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          style={backButton}
        >
          ← Back
        </button>

        <div style={footerCenter}>
          <span>
            Gross:{" "}
            <strong>
              {money(
                grossPayments
              )}
            </strong>
          </span>

          <span>
            Refunds:{" "}
            <strong>
              {money(
                refundTotal
              )}
            </strong>
          </span>

          <span>
            Net:{" "}
            <strong>
              {money(
                netTotal
              )}
            </strong>
          </span>
        </div>

        <div style={footerActions}>
          <button
            type="button"
            onClick={printXReport}
            disabled={
              !selectedReportDay
            }
            style={printButton}
          >
            Print X Report
          </button>

          {!isHistoric &&
            currentDay &&
            selectedReportDay?.id ===
              currentDay.id && (
              <button
                type="button"
                onClick={
                  endOfDay
                }
                disabled={
                  endingDay
                }
                style={{
                  ...endDayButton,
                  opacity:
                    endingDay
                      ? 0.6
                      : 1,
                }}
              >
                {endingDay
                  ? "Processing..."
                  : "End of Day"}
              </button>
            )}
        </div>
      </footer>
    </main>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone:
    | "blue"
    | "green"
    | "red";
}) {
  const toneStyle =
    tone === "green"
      ? summaryGreen
      : tone === "red"
      ? summaryRed
      : summaryBlue;

  return (
    <div
      style={{
        ...summaryCard,
        ...toneStyle,
      }}
    >
      <span style={summaryLabel}>
        {label}
      </span>

      <strong style={summaryValue}>
        {value}
      </strong>
    </div>
  );
}

function MethodBadge({
  method,
}: {
  method: string;
}) {
  return (
    <span style={methodBadge}>
      {method.toUpperCase()}
    </span>
  );
}

function TransactionBadge({
  type,
}: {
  type: string;
}) {
  const refund =
    type === "refund";

  return (
    <span
      style={{
        ...transactionBadge,
        ...(refund
          ? transactionRefund
          : transactionPayment),
      }}
    >
      {type
        .replaceAll("_", " ")
        .toUpperCase()}
    </span>
  );
}

// =========================================================
// HELPERS
// =========================================================

function getTodayString() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(
  value: string,
  numberOfDays: number
) {
  const date =
    parseDate(value);

  date.setUTCDate(
    date.getUTCDate() +
      numberOfDays
  );

  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getUTCDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
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

function formatDate(value: string) {
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

function formatDayNumber(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-NA",
    {
      day: "2-digit",
      timeZone: "UTC",
    }
  ).format(
    parseDate(value)
  );
}

function formatMonth(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-NA",
    {
      month: "short",
      timeZone: "UTC",
    }
  ).format(
    parseDate(value)
  );
}

function formatYear(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-NA",
    {
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(
    parseDate(value)
  );
}

function formatTime(value: string) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-NA",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-NA",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function money(value: number) {
  return `N$${Number(
    value ?? 0
  ).toFixed(2)}`;
}

function escapeHtml(
  value: string
) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =========================================================
// COLOURS
// =========================================================

const BLUE =
  "#0D5FA8";

const DARK_BLUE =
  "#0B477F";

const GREEN =
  "#16885A";

const LIGHT_GREEN =
  "#EAF7F0";

const RED =
  "#A32626";

const PAGE_BG =
  "#F4F8FC";

const TEXT =
  "#17212B";

const MUTED =
  "#6F7D8C";

// =========================================================
// STYLES
// =========================================================

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  maxWidth: 1500,
  margin: "0 auto",
  padding: "14px 24px 12px",
  boxSizing: "border-box",
  fontFamily: "Arial, sans-serif",
  color: TEXT,
  background: PAGE_BG,
};

const brandHeader: CSSProperties = {
  minHeight: 70,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  padding: "10px 16px",
  borderRadius: 12,
  background:
    "linear-gradient(135deg, #0B4E8A 0%, #0D668F 100%)",
  boxShadow:
    "0 6px 18px rgba(13,63,122,.16)",
};

const brandIdentity: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
};

const brandMark: CSSProperties = {
  width: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 10,
  background: "#fff",
  color: DARK_BLUE,
  fontSize: 24,
  fontWeight: 900,
};

const brandName: CSSProperties = {
  color: "#fff",
  fontSize: 20,
  fontWeight: 900,
  letterSpacing: 1.2,
};

const brandTagline: CSSProperties = {
  color: "#D7E7FA",
  fontSize: 9,
  marginTop: 2,
};

const headerRight: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 7,
};

const propertyArea: CSSProperties = {
  width: 240,
};

const propertyLabel: CSSProperties = {
  display: "block",
  color: "#DDEBFA",
  fontSize: 8,
  fontWeight: 900,
  marginBottom: 4,
};

const propertySelect: CSSProperties = {
  width: "100%",
  padding: "9px 10px",
  border:
    "1px solid rgba(255,255,255,.55)",
  borderRadius: 7,
  background: "#fff",
  color: TEXT,
  fontSize: 10,
  fontWeight: 700,
};

const headerButton: CSSProperties = {
  border:
    "1px solid #fff",
  borderRadius: 7,
  padding: "9px 11px",
  background: "#fff",
  color: DARK_BLUE,
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};

const pageHeading: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  margin: "10px 0 8px",
};

const pageTitle: CSSProperties = {
  margin: 0,
  color: DARK_BLUE,
  fontSize: 27,
};

const pageSubtitle: CSSProperties = {
  marginTop: 3,
  color: MUTED,
  fontSize: 10,
};

const businessDayBox: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "7px 10px",
  border: "1px solid #CBD8E5",
  borderRadius: 8,
  background: "#fff",
};

const businessDayLabel: CSSProperties = {
  color: MUTED,
  fontSize: 7,
  fontWeight: 900,
};

const businessDayValue: CSSProperties = {
  color: DARK_BLUE,
  fontSize: 10,
};

const openBadge: CSSProperties = {
  padding: "4px 7px",
  borderRadius: 20,
  background: LIGHT_GREEN,
  color: GREEN,
  fontSize: 7,
  fontWeight: 900,
};

const closedBadge: CSSProperties = {
  padding: "4px 7px",
  borderRadius: 20,
  background: "#EEF2F6",
  color: "#596777",
  fontSize: 7,
  fontWeight: 900,
};

const errorBox: CSSProperties = {
  marginBottom: 8,
  padding: "8px 10px",
  border: "1px solid #E0AAAA",
  borderRadius: 7,
  background: "#FFF1F1",
  color: RED,
  fontSize: 9,
};

const successBox: CSSProperties = {
  marginBottom: 8,
  padding: "8px 10px",
  border: "1px solid #9FCFB5",
  borderRadius: 7,
  background: LIGHT_GREEN,
  color: "#176C46",
  fontSize: 9,
  fontWeight: 700,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(5,minmax(0,1fr))",
  gap: 8,
  marginBottom: 8,
};

const summaryCard: CSSProperties = {
  minHeight: 58,
  padding: "8px 11px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  border: "1px solid",
  borderRadius: 9,
  background: "#fff",
};

const summaryBlue: CSSProperties = {
  borderColor: "#B9D0EA",
};

const summaryGreen: CSSProperties = {
  borderColor: "#AED9C2",
  background: "#FAFFFC",
};

const summaryRed: CSSProperties = {
  borderColor: "#E5B7B7",
  background: "#FFF9F9",
};

const summaryLabel: CSSProperties = {
  color: DARK_BLUE,
  fontSize: 8,
  fontWeight: 900,
  textTransform: "uppercase",
};

const summaryValue: CSSProperties = {
  color: DARK_BLUE,
  fontSize: 17,
};

const mainGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1fr) 185px",
  gap: 8,
};

const reportCard: CSSProperties = {
  border: "1px solid #CBD8E5",
  borderRadius: 10,
  background: "#fff",
  overflow: "hidden",
};

const cardHeader: CSSProperties = {
  minHeight: 42,
  padding: "7px 11px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #E2E9F0",
  background: "#F8FAFD",
};

const cardTitle: CSSProperties = {
  margin: 0,
  color: DARK_BLUE,
  fontSize: 12,
};

const cardSubtitle: CSSProperties = {
  marginTop: 2,
  color: MUTED,
  fontSize: 7,
};

const countText: CSSProperties = {
  color: BLUE,
  fontSize: 8,
  fontWeight: 900,
};

const transactionHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    ".65fr 1fr .55fr 1.25fr .75fr .85fr .8fr",
  gap: 8,
  padding: "7px 10px",
  background: "#EFF4F9",
  color: "#56697D",
  fontSize: 7,
  fontWeight: 900,
  textTransform: "uppercase",
};

const transactionRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    ".65fr 1fr .55fr 1.25fr .75fr .85fr .8fr",
  gap: 8,
  alignItems: "center",
  padding: "8px 10px",
  borderBottom: "1px solid #E8EDF2",
};

const transactionScroll: CSSProperties = {
  maxHeight: "calc(100vh - 520px)",
  minHeight: 190,
  overflowY: "auto",
};

const tableText: CSSProperties = {
  fontSize: 8,
};

const reservationText: CSSProperties = {
  color: BLUE,
  fontSize: 8,
  fontWeight: 800,
};

const roomText: CSSProperties = {
  color: DARK_BLUE,
  fontSize: 9,
  fontWeight: 900,
};

const methodBadge: CSSProperties = {
  display: "inline-block",
  padding: "4px 6px",
  borderRadius: 20,
  background: "#EEF3F8",
  color: "#506376",
  fontSize: 7,
  fontWeight: 900,
};

const transactionBadge: CSSProperties = {
  display: "inline-block",
  padding: "4px 6px",
  borderRadius: 20,
  fontSize: 7,
  fontWeight: 900,
};

const transactionPayment: CSSProperties = {
  background: LIGHT_GREEN,
  color: GREEN,
};

const transactionRefund: CSSProperties = {
  background: "#FFF0F0",
  color: RED,
};

const paymentAmount: CSSProperties = {
  color: GREEN,
  fontSize: 8,
  fontWeight: 900,
};

const refundAmount: CSSProperties = {
  color: RED,
  fontSize: 8,
  fontWeight: 900,
};

const emptyState: CSSProperties = {
  padding: 28,
  color: MUTED,
  fontSize: 9,
  textAlign: "center",
};

const cancellationArea: CSSProperties = {
  borderTop: "1px solid #DCE5EE",
};

const cancellationHeader: CSSProperties = {
  padding: "7px 10px",
  display: "flex",
  justifyContent: "space-between",
  background: "#FFF9F9",
  color: RED,
  fontSize: 8,
};

const noCancellation: CSSProperties = {
  padding: "8px 10px",
  color: MUTED,
  fontSize: 8,
};

const cancellationRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1fr .65fr 1.4fr 1fr",
  gap: 8,
  padding: "7px 10px",
  borderTop: "1px solid #F0E2E2",
  fontSize: 8,
};

const historyCard: CSSProperties = {
  border: "1px solid #CBD8E5",
  borderRadius: 10,
  background: "#fff",
  overflow: "hidden",
};

const historyHeader: CSSProperties = {
  padding: "8px 9px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #E2E9F0",
  background: "#F8FAFD",
};

const historyTitle: CSSProperties = {
  margin: 0,
  color: DARK_BLUE,
  fontSize: 11,
};

const historySubtitle: CSSProperties = {
  marginTop: 2,
  color: MUTED,
  fontSize: 7,
};

const currentButton: CSSProperties = {
  border: "1px solid #AFC8E3",
  borderRadius: 5,
  padding: "5px 6px",
  background: "#fff",
  color: BLUE,
  fontSize: 7,
  fontWeight: 800,
  cursor: "pointer",
};

const historyScroll: CSSProperties = {
  maxHeight: "calc(100vh - 390px)",
  overflowY: "auto",
};

const historyEmpty: CSSProperties = {
  padding: 15,
  color: MUTED,
  fontSize: 8,
  textAlign: "center",
};

const historyDayButton: CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns:
    "34px 1fr 15px",
  gap: 7,
  alignItems: "center",
  padding: "7px 8px",
  border: 0,
  borderBottom: "1px solid #EDF1F5",
  background: "#fff",
  textAlign: "left",
  cursor: "pointer",
};

const historyDaySelected: CSSProperties = {
  background: "#EAF3FF",
};

const calendarDay: CSSProperties = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  background: DARK_BLUE,
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
};

const historyDateText: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  color: DARK_BLUE,
  fontSize: 9,
};

const historyArrow: CSSProperties = {
  color: BLUE,
  fontSize: 17,
  fontWeight: 900,
};

const footerStyle: CSSProperties = {
  marginTop: 8,
  padding: "8px 10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  border: "1px solid #CBD8E5",
  borderRadius: 9,
  background: "#fff",
};

const backButton: CSSProperties = {
  border: "1px solid #A8BED7",
  borderRadius: 6,
  padding: "8px 11px",
  background: "#fff",
  color: BLUE,
  fontSize: 8,
  fontWeight: 800,
  cursor: "pointer",
};

const footerCenter: CSSProperties = {
  display: "flex",
  gap: 16,
  color: "#536273",
  fontSize: 8,
};

const footerActions: CSSProperties = {
  display: "flex",
  gap: 7,
};

const printButton: CSSProperties = {
  border: "1px solid #95B7DD",
  borderRadius: 6,
  padding: "8px 12px",
  background: "#EAF3FF",
  color: BLUE,
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const endDayButton: CSSProperties = {
  border: 0,
  borderRadius: 6,
  padding: "9px 14px",
  background: GREEN,
  color: "#fff",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};
