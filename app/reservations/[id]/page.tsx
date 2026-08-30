"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  supabase,
} from "@/src/lib/supabase";

// =========================================================
// TYPES
// =========================================================

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  id_number: string | null;
};

type Company = {
  id: string;
  name: string;
};

type Property = {
  id: string;
  name: string;

  phone: string | null;
  email: string | null;
  vat_number: string | null;
  vat_rate: number | null;
  town: string | null;

  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;

  payment_reference_instruction: string | null;
  invoice_terms: string | null;
};

type Reservation = {
  id: string;

  property_id: string;
  guest_id: string;
  company_id: string | null;

  reservation_number: string;

  status: string;
  booking_source: string | null;

  arrival_date: string;
  departure_date: string;

  adults: number;
  children: number;

  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total_amount: number;

  deposit_required: number;

  notes: string | null;

  checked_in_at: string | null;
  checked_out_at: string | null;
};

type ReservationRoom = {
  id: string;

  reservation_id: string;

  room_id: string | null;
  room_type_id: string;

  adults: number;
  children: number;

  nightly_rate: number;
  original_rate: number | null;

  arrival_date: string;
  departure_date: string;
};

type Room = {
  id: string;
  room_number: string;
  housekeeping_status: string | null;
  operational_status: string | null;
};

type RoomType = {
  id: string;
  name: string;
};

type Payment = {
  id: string;

  payment_reference: string | null;
  payment_method: string;
  transaction_type: string;

  amount: number;

  notes: string | null;
  received_at: string;
};

type Invoice = {
  id: string;

  property_id: string;
  reservation_id: string | null;
  guest_id: string | null;
  company_id: string | null;

  invoice_number: string;

  status: string;

  invoice_date: string;
  due_date: string | null;

  subtotal: number;
  discount_amount: number;
  vat_amount: number;
  total_amount: number;

  notes: string | null;
  created_at: string;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;

  description: string;

  quantity: number;
  unit_price: number;

  discount_amount: number;
  vat_amount: number;
  line_total: number;

  created_at: string;
};

// =========================================================
// PAGE
// =========================================================

export default function ReservationDetailsPage() {
  const router = useRouter();
  const pathname = usePathname();

  // =========================================================
  // RESERVATION ID
  // =========================================================

  const reservationId = useMemo(() => {
    if (!pathname) {
      return "";
    }

    const parts = pathname
      .split("/")
      .filter(Boolean);

    const reservationsIndex =
      parts.findIndex(
        (part) => part === "reservations"
      );

    if (reservationsIndex === -1) {
      return "";
    }

    const possibleId =
      parts[reservationsIndex + 1];

    if (
      !possibleId ||
      possibleId === "new" ||
      possibleId === "edit"
    ) {
      return "";
    }

    return decodeURIComponent(possibleId);
  }, [pathname]);

  // =========================================================
  // DATA
  // =========================================================

  const [
    reservation,
    setReservation,
  ] = useState<Reservation | null>(null);

  const [
    guest,
    setGuest,
  ] = useState<Guest | null>(null);

  const [
    company,
    setCompany,
  ] = useState<Company | null>(null);

  const [
    property,
    setProperty,
  ] = useState<Property | null>(null);

  const [
    reservationRoom,
    setReservationRoom,
  ] = useState<ReservationRoom | null>(null);

  const [
    room,
    setRoom,
  ] = useState<Room | null>(null);

  const [
    roomType,
    setRoomType,
  ] = useState<RoomType | null>(null);

  const [
    payments,
    setPayments,
  ] = useState<Payment[]>([]);

  const [
    invoice,
    setInvoice,
  ] = useState<Invoice | null>(null);

  const [
    invoiceItems,
    setInvoiceItems,
  ] = useState<InvoiceItem[]>([]);

  // =========================================================
  // PAGE STATE
  // =========================================================

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    updating,
    setUpdating,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  // =========================================================
  // PAYMENT
  // =========================================================

  const [
    showPaymentModal,
    setShowPaymentModal,
  ] = useState(false);

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("cash");

  const [
    transactionType,
    setTransactionType,
  ] = useState("payment");

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    paymentReference,
    setPaymentReference,
  ] = useState("");

  const [
    paymentNotes,
    setPaymentNotes,
  ] = useState("");

  const [
    savingPayment,
    setSavingPayment,
  ] = useState(false);

  // =========================================================
  // INVOICE
  // =========================================================

  const [
    generatingInvoice,
    setGeneratingInvoice,
  ] = useState(false);

  // =========================================================
  // GUEST FOLIO TABS
  // =========================================================

  const [
    activeAccountTab,
    setActiveAccountTab,
  ] = useState<
    "folio" | "payments" | "invoices" | "documents"
  >("folio");

  const [
    currentStaffRole,
    setCurrentStaffRole,
  ] = useState("");

  const canProcessRefund =
    currentStaffRole === "owner" ||
    currentStaffRole === "manager";

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadCurrentStaffRole();
  }, []);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (!reservationId) {
      setLoading(false);

      setErrorMessage(
        "Reservation ID could not be detected."
      );

      return;
    }

    loadReservation(reservationId);
  }, [
    pathname,
    reservationId,
  ]);

  async function loadCurrentStaffRole() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCurrentStaffRole("");
        return;
      }

      const { data, error } = await supabase
        .from("staff_users")
        .select("role,is_active")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (error || !data || data.is_active === false) {
        setCurrentStaffRole("");
        return;
      }

      setCurrentStaffRole(String(data.role ?? ""));
    } catch {
      setCurrentStaffRole("");
    }
  }

  // =========================================================
  // LOAD RESERVATION
  // =========================================================

  async function loadReservation(id: string) {
    setLoading(true);
    setErrorMessage("");

    try {
      // -----------------------------------------------------
      // RESERVATION
      // -----------------------------------------------------

      const {
        data: reservationData,
        error: reservationError,
      } = await supabase
        .from("reservations")
        .select(`
          id,
          property_id,
          guest_id,
          company_id,
          reservation_number,
          status,
          booking_source,
          arrival_date,
          departure_date,
          adults,
          children,
          subtotal,
          discount_amount,
          vat_amount,
          total_amount,
          deposit_required,
          notes,
          checked_in_at,
          checked_out_at
        `)
        .eq("id", id)
        .maybeSingle();

      if (reservationError) {
        throw new Error(
          reservationError.message
        );
      }

      if (!reservationData) {
        throw new Error(
          "Reservation could not be found."
        );
      }

      const loadedReservation =
        reservationData as Reservation;

      setReservation(
        loadedReservation
      );

      // -----------------------------------------------------
      // PROPERTY
      // -----------------------------------------------------

      const {
        data: propertyData,
        error: propertyError,
      } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          phone,
          email,
          vat_number,
          vat_rate,
          town,
          bank_name,
          bank_account_name,
          bank_account_number,
          bank_branch_code,
          payment_reference_instruction,
          invoice_terms
        `)
        .eq(
          "id",
          loadedReservation.property_id
        )
        .maybeSingle();

      if (propertyError) {
        throw new Error(
          propertyError.message
        );
      }

      setProperty(
        propertyData as Property | null
      );

      // -----------------------------------------------------
      // GUEST
      // -----------------------------------------------------

      const {
        data: guestData,
        error: guestError,
      } = await supabase
        .from("guests")
        .select(`
          id,
          first_name,
          last_name,
          phone,
          email,
          id_number
        `)
        .eq(
          "id",
          loadedReservation.guest_id
        )
        .maybeSingle();

      if (guestError) {
        throw new Error(
          guestError.message
        );
      }

      setGuest(
        guestData as Guest | null
      );

      // -----------------------------------------------------
      // COMPANY
      // -----------------------------------------------------

      if (
        loadedReservation.company_id
      ) {
        const {
          data: companyData,
          error: companyError,
        } = await supabase
          .from("companies")
          .select("id,name")
          .eq(
            "id",
            loadedReservation.company_id
          )
          .maybeSingle();

        if (companyError) {
          throw new Error(
            companyError.message
          );
        }

        setCompany(
          companyData as Company | null
        );
      } else {
        setCompany(null);
      }

      // -----------------------------------------------------
      // RESERVATION ROOM
      // -----------------------------------------------------

      const {
        data: reservationRoomData,
        error: reservationRoomError,
      } = await supabase
        .from("reservation_rooms")
        .select(`
          id,
          reservation_id,
          room_id,
          room_type_id,
          adults,
          children,
          nightly_rate,
          original_rate,
          arrival_date,
          departure_date
        `)
        .eq(
          "reservation_id",
          id
        )
        .limit(1)
        .maybeSingle();

      if (reservationRoomError) {
        throw new Error(
          reservationRoomError.message
        );
      }

      const loadedRoom =
        reservationRoomData as
          | ReservationRoom
          | null;

      setReservationRoom(
        loadedRoom
      );

      // -----------------------------------------------------
      // PHYSICAL ROOM
      // -----------------------------------------------------

      if (loadedRoom?.room_id) {
        const {
          data: roomData,
          error: roomError,
        } = await supabase
          .from("rooms")
          .select(`
            id,
            room_number,
            housekeeping_status,
            operational_status
          `)
          .eq(
            "id",
            loadedRoom.room_id
          )
          .maybeSingle();

        if (roomError) {
          throw new Error(
            roomError.message
          );
        }

        setRoom(
          roomData as Room | null
        );
      } else {
        setRoom(null);
      }

      // -----------------------------------------------------
      // ROOM TYPE
      // -----------------------------------------------------

      if (
        loadedRoom?.room_type_id
      ) {
        const {
          data: roomTypeData,
          error: roomTypeError,
        } = await supabase
          .from("room_types")
          .select(
            "id,name"
          )
          .eq(
            "id",
            loadedRoom.room_type_id
          )
          .maybeSingle();

        if (roomTypeError) {
          throw new Error(
            roomTypeError.message
          );
        }

        setRoomType(
          roomTypeData as
            | RoomType
            | null
        );
      } else {
        setRoomType(null);
      }

      await loadPayments(id);
      await loadInvoice(id);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load reservation."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // PAYMENTS
  // =========================================================

  async function loadPayments(id: string) {
    const {
      data,
      error,
    } = await supabase
      .from("payments")
      .select(`
        id,
        payment_reference,
        payment_method,
        transaction_type,
        amount,
        notes,
        received_at
      `)
      .eq(
        "reservation_id",
        id
      )
      .order(
        "received_at",
        {
          ascending: false,
        }
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    setPayments(
      (data as Payment[]) ?? []
    );
  }

  // =========================================================
  // INVOICE
  // =========================================================

  async function loadInvoice(id: string) {
    const {
      data,
      error,
    } = await supabase
      .from("invoices")
      .select(`
        id,
        property_id,
        reservation_id,
        guest_id,
        company_id,
        invoice_number,
        status,
        invoice_date,
        due_date,
        subtotal,
        discount_amount,
        vat_amount,
        total_amount,
        notes,
        created_at
      `)
      .eq(
        "reservation_id",
        id
      )
      .neq(
        "status",
        "void"
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    const loadedInvoice =
      data as Invoice | null;

    setInvoice(
      loadedInvoice
    );

    if (!loadedInvoice) {
      setInvoiceItems([]);
      return;
    }

    const {
      data: items,
      error: itemError,
    } = await supabase
      .from("invoice_items")
      .select(`
        id,
        invoice_id,
        description,
        quantity,
        unit_price,
        discount_amount,
        vat_amount,
        line_total,
        created_at
      `)
      .eq(
        "invoice_id",
        loadedInvoice.id
      )
      .order("created_at");

    if (itemError) {
      throw new Error(
        itemError.message
      );
    }

    setInvoiceItems(
      (items as InvoiceItem[]) ?? []
    );
  }

  // =========================================================
  // FINANCIALS
  // =========================================================

  const totalPaid = useMemo(() => {
    return payments.reduce(
      (
        total,
        payment
      ) => {
        const amount =
          Number(
            payment.amount ?? 0
          );

        if (
          payment.transaction_type ===
          "refund"
        ) {
          return total - amount;
        }

        return total + amount;
      },
      0
    );
  }, [payments]);

  const balanceOutstanding =
    Math.max(
      0,
      Number(
        reservation?.total_amount ?? 0
      ) -
        totalPaid
    );

  // =========================================================
  // GUEST NAME
  // =========================================================

  function guestName() {
    if (!guest) {
      return "Guest";
    }

    return `${guest.first_name} ${guest.last_name}`;
  }

  // =========================================================
  // TRADING DAY
  // =========================================================

  async function getTradingDay(
    propertyId: string
  ) {
    const {
      data: openDays,
      error: openDayError,
    } = await supabase
      .from("trading_days")
      .select(
        "id,business_date,status"
      )
      .eq(
        "property_id",
        propertyId
      )
      .eq(
        "status",
        "open"
      )
      .order(
        "business_date",
        {
          ascending: false,
        }
      )
      .limit(1);

    if (openDayError) {
      throw new Error(
        openDayError.message
      );
    }

    const openDay =
      openDays?.[0];

    if (openDay) {
      return openDay.id;
    }

    const {
      data: previousDays,
      error: previousDayError,
    } = await supabase
      .from("trading_days")
      .select(
        "business_date"
      )
      .eq(
        "property_id",
        propertyId
      )
      .order(
        "business_date",
        {
          ascending: false,
        }
      )
      .limit(1);

    if (previousDayError) {
      throw new Error(
        previousDayError.message
      );
    }

    const previousBusinessDate =
      previousDays?.[0]
        ?.business_date;

    const nextBusinessDate =
      previousBusinessDate
        ? addDays(
            previousBusinessDate,
            1
          )
        : todayString();

    const {
      data: created,
      error: createError,
    } = await supabase
      .from("trading_days")
      .insert({
        property_id:
          propertyId,

        business_date:
          nextBusinessDate,

        status:
          "open",
      })
      .select("id")
      .single();

    if (createError) {
      throw new Error(
        createError.message
      );
    }

    return created.id;
  }

  // =========================================================
  // RECORD PAYMENT
  // =========================================================

  async function recordPayment(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!reservation) {
      return;
    }

    if (
      transactionType === "refund" &&
      !canProcessRefund
    ) {
      alert("Your user role is not authorised to process refunds.");
      setTransactionType("payment");
      return;
    }

    const amount =
      Number(
        paymentAmount
      );

    if (
      !amount ||
      amount <= 0
    ) {
      alert(
        "Enter a valid payment amount."
      );

      return;
    }

    setSavingPayment(true);

    try {
      const tradingDayId =
        await getTradingDay(
          reservation.property_id
        );

      const {
        error,
      } = await supabase
        .from("payments")
        .insert({
          property_id:
            reservation.property_id,

          trading_day_id:
            tradingDayId,

          reservation_id:
            reservation.id,

          guest_id:
            reservation.guest_id,

          company_id:
            reservation.company_id,

          payment_reference:
            paymentReference.trim() ||
            null,

          payment_method:
            paymentMethod,

          transaction_type:
            transactionType,

          amount,

          notes:
            paymentNotes.trim() ||
            null,

          received_at:
            new Date().toISOString(),
        });

      if (error) {
        throw new Error(
          error.message
        );
      }

      setShowPaymentModal(false);

      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");

      await loadPayments(
        reservation.id
      );

      setMessage(
        "Payment recorded successfully."
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not record payment."
      );
    } finally {
      setSavingPayment(false);
    }
  }

  // =========================================================
  // CHECK IN
  // =========================================================

  async function checkIn() {
    if (
      !reservation ||
      reservation.status !==
        "confirmed"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Check in ${guestName()}?`
      );

    if (!confirmed) {
      return;
    }

    setUpdating(true);
    setMessage("");

    try {
      const {
        error,
      } = await supabase
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

      await loadReservation(
        reservation.id
      );

      setMessage(
        `${guestName()} checked in successfully.`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not check in guest."
      );
    } finally {
      setUpdating(false);
    }
  }

  // =========================================================
  // CHECK OUT
  // IMPORTANT:
  // RESERVATION -> CHECKED OUT
  // ROOM -> DIRTY
  // =========================================================

  async function checkOut() {
    if (
      !reservation ||
      reservation.status !==
        "checked_in"
    ) {
      return;
    }

    if (
      balanceOutstanding > 0
    ) {
      const continueCheckout =
        window.confirm(
          `The reservation still has a balance of N$${balanceOutstanding.toFixed(
            2
          )}.\n\nContinue with check-out?`
        );

      if (!continueCheckout) {
        return;
      }
    }

    const confirmed =
      window.confirm(
        `Check out ${guestName()}?\n\nAfter checkout, ${
          room
            ? `Room ${room.room_number}`
            : "the room"
        } will automatically be marked DIRTY for housekeeping.`
      );

    if (!confirmed) {
      return;
    }

    setUpdating(true);
    setMessage("");

    const checkoutTime =
      new Date().toISOString();

    try {
      // -----------------------------------------------------
      // 1. CHECK OUT RESERVATION
      // -----------------------------------------------------

      const {
        error:
          reservationError,
      } = await supabase
        .from("reservations")
        .update({
          status:
            "checked_out",

          checked_out_at:
            checkoutTime,
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

      // -----------------------------------------------------
      // 2. MARK PHYSICAL ROOM DIRTY
      // -----------------------------------------------------

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
          // Try to reverse checkout so the two systems
          // remain consistent.

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
            `Checkout could not be completed because housekeeping could not be updated: ${roomError.message}`
          );
        }
      }

      // -----------------------------------------------------
      // 3. RELOAD
      // -----------------------------------------------------

      await loadReservation(
        reservation.id
      );

      setMessage(
        `${guestName()} checked out successfully. ${
          room
            ? `Room ${room.room_number}`
            : "The room"
        } is now marked Dirty for housekeeping.`
      );

      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not check out guest."
      );
    } finally {
      setUpdating(false);
    }
  }

  // =========================================================
  // CANCEL
  // =========================================================

  async function cancelReservation() {
    if (!reservation) {
      return;
    }

    if (
      ![
        "provisional",
        "confirmed",
      ].includes(
        reservation.status
      )
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Cancel reservation ${reservation.reservation_number} for ${guestName()}?\n\nThe room will become available again on the calendar.`
      );

    if (!confirmed) {
      return;
    }

    setUpdating(true);
    setMessage("");

    try {
      const tradingDayId =
        await getTradingDay(
          reservation.property_id
        );

      const {
        error,
      } = await supabase
        .from("reservations")
        .update({
          status:
            "cancelled",

          cancelled_at:
            new Date().toISOString(),

          cancelled_trading_day_id:
            tradingDayId,
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

      await loadReservation(
        reservation.id
      );

      setMessage(
        "Reservation cancelled successfully."
      );

      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not cancel reservation."
      );
    } finally {
      setUpdating(false);
    }
  }

  // =========================================================
  // NO SHOW
  // =========================================================

  async function markNoShow() {
    if (
      !reservation ||
      reservation.status !==
        "confirmed"
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Mark ${guestName()} as NO SHOW?\n\nReservation: ${reservation.reservation_number}\n\nThe reservation remains recorded, but the room will be released on the availability calendar.`
      );

    if (!confirmed) {
      return;
    }

    setUpdating(true);
    setMessage("");

    try {
      const {
        error,
      } = await supabase
        .from("reservations")
        .update({
          status:
            "no_show",
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

      await loadReservation(
        reservation.id
      );

      setMessage(
        `${guestName()} marked as No Show. The room has been released.`
      );

      router.refresh();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not mark reservation as No Show."
      );
    } finally {
      setUpdating(false);
    }
  }

  // =========================================================
  // GENERATE INVOICE
  // =========================================================

  async function generateInvoice() {
    if (
      !reservation ||
      !reservationRoom
    ) {
      return;
    }

    if (invoice) {
      openInvoicePDF();
      return;
    }

    setGeneratingInvoice(true);

    try {
      const invoiceNumber =
        generateDocumentNumber(
          "INV"
        );

      const nights =
        calculateNights(
          reservation.arrival_date,
          reservation.departure_date
        );

      const {
        data:
          invoiceData,

        error:
          invoiceError,
      } = await supabase
        .from("invoices")
        .insert({
          property_id:
            reservation.property_id,

          reservation_id:
            reservation.id,

          guest_id:
            reservation.guest_id,

          company_id:
            reservation.company_id,

          invoice_number:
            invoiceNumber,

          status:
            totalPaid >=
            Number(
              reservation.total_amount
            )
              ? "paid"
              : totalPaid > 0
              ? "part_paid"
              : "issued",

          invoice_date:
            todayString(),

          due_date:
            todayString(),

          subtotal:
            reservation.subtotal,

          discount_amount:
            reservation.discount_amount,

          vat_amount:
            reservation.vat_amount,

          total_amount:
            reservation.total_amount,

          notes:
            `Reservation ${reservation.reservation_number}`,
        })
        .select(`
          id,
          property_id,
          reservation_id,
          guest_id,
          company_id,
          invoice_number,
          status,
          invoice_date,
          due_date,
          subtotal,
          discount_amount,
          vat_amount,
          total_amount,
          notes,
          created_at
        `)
        .single();

      if (invoiceError) {
        throw new Error(
          invoiceError.message
        );
      }

      const createdInvoice =
        invoiceData as Invoice;

      const description =
        `Accommodation Â· ${
          room
            ? `Room ${room.room_number}`
            : "Room"
        } Â· ${
          roomType?.name ?? ""
        }`;

      const {
        data:
          itemData,

        error:
          itemError,
      } = await supabase
        .from("invoice_items")
        .insert({
          invoice_id:
            createdInvoice.id,

          description,

          quantity:
            nights || 1,

          unit_price:
            Number(
              reservationRoom.nightly_rate ??
                0
            ),

          discount_amount:
            Number(
              reservation.discount_amount ??
                0
            ),

          vat_amount:
            Number(
              reservation.vat_amount ??
                0
            ),

          line_total:
            Number(
              reservation.total_amount ??
                0
            ),
        })
        .select(`
          id,
          invoice_id,
          description,
          quantity,
          unit_price,
          discount_amount,
          vat_amount,
          line_total,
          created_at
        `)
        .single();

      if (itemError) {
        await supabase
          .from("invoices")
          .delete()
          .eq(
            "id",
            createdInvoice.id
          );

        throw new Error(
          itemError.message
        );
      }

      const createdItem =
        itemData as InvoiceItem;

      setInvoice(
        createdInvoice
      );

      setInvoiceItems(
        [
          createdItem,
        ]
      );

      setMessage(
        `Invoice ${invoiceNumber} generated.`
      );

      openInvoicePDF(
        createdInvoice,
        [
          createdItem,
        ]
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not generate invoice."
      );
    } finally {
      setGeneratingInvoice(false);
    }
  }

  // =========================================================
  // CONFIRMATION DOCUMENT
  // =========================================================

  function openConfirmationPDF() {
    if (!reservation) {
      return;
    }

    const nights =
      calculateNights(
        reservation.arrival_date,
        reservation.departure_date
      );

    const html = `
      ${documentHeader(
        "RESERVATION CONFIRMATION",
        reservation.reservation_number
      )}

      <div class="section">

        <div class="section-title">
          Guest
        </div>

        ${documentRow(
          "Guest",
          guestName()
        )}

        ${documentRow(
          "Mobile",
          guest?.phone ?? "-"
        )}

        ${documentRow(
          "Email",
          guest?.email ?? "-"
        )}

        ${documentRow(
          "Company",
          company?.name ??
            "Private / Walk-in"
        )}

      </div>

      <div class="section">

        <div class="section-title">
          Stay Details
        </div>

        ${documentRow(
          "Check-in",
          formatFriendlyDate(
            reservation.arrival_date
          )
        )}

        ${documentRow(
          "Check-out",
          formatFriendlyDate(
            reservation.departure_date
          )
        )}

        ${documentRow(
          "Nights",
          String(nights)
        )}

        ${documentRow(
          "Room",
          room
            ? `Room ${room.room_number}`
            : "-"
        )}

        ${documentRow(
          "Room Type",
          roomType?.name ?? "-"
        )}

      </div>

      <div class="section">

        <div class="section-title">
          Charges
        </div>

        ${documentRow(
          "Accommodation",
          money(
            reservation.subtotal
          )
        )}

        ${documentRow(
          "Discount",
          money(
            reservation.discount_amount
          )
        )}

        ${documentRow(
          "VAT Included",
          money(
            reservation.vat_amount
          )
        )}

        ${documentRow(
          "Total",
          money(
            reservation.total_amount
          ),
          true
        )}

        ${documentRow(
          "Paid",
          money(totalPaid)
        )}

        ${documentRow(
          "Balance",
          money(
            balanceOutstanding
          ),
          true
        )}

      </div>

      ${bankingDetails(
        reservation.reservation_number
      )}
    `;

    openPrintWindow(
      `${reservation.reservation_number} - Reservation Confirmation`,
      html
    );
  }

  // =========================================================
  // INVOICE DOCUMENT
  // =========================================================

  function openInvoicePDF(
    selectedInvoice:
      | Invoice
      | null =
      invoice,

    selectedItems:
      InvoiceItem[] =
      invoiceItems
  ) {
    if (
      !selectedInvoice ||
      !reservation
    ) {
      alert(
        "No invoice has been generated yet."
      );

      return;
    }

    const rows =
      selectedItems
        .map(
          (item) => `
            <tr>
              <td>
                ${escapeHtml(
                  item.description
                )}
              </td>

              <td class="right">
                ${item.quantity}
              </td>

              <td class="right">
                ${money(
                  item.unit_price
                )}
              </td>

              <td class="right">
                ${money(
                  item.line_total
                )}
              </td>
            </tr>
          `
        )
        .join("");

    const html = `
      ${documentHeader(
        "TAX INVOICE",
        selectedInvoice.invoice_number
      )}

      <div class="section">

        ${documentRow(
          "Guest",
          guestName()
        )}

        ${documentRow(
          "Reservation",
          reservation.reservation_number
        )}

        ${documentRow(
          "Invoice Date",
          formatFriendlyDate(
            selectedInvoice.invoice_date
          )
        )}

      </div>

      <div class="section">

        <table>

          <thead>
            <tr>
              <th>Description</th>
              <th class="right">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Total</th>
            </tr>
          </thead>

          <tbody>
            ${rows}
          </tbody>

        </table>

      </div>

      <div class="totals">

        ${documentRow(
          "Subtotal",
          money(
            selectedInvoice.subtotal
          )
        )}

        ${documentRow(
          "Discount",
          money(
            selectedInvoice.discount_amount
          )
        )}

        ${documentRow(
          "VAT Included",
          money(
            selectedInvoice.vat_amount
          )
        )}

        ${documentRow(
          "TOTAL",
          money(
            selectedInvoice.total_amount
          ),
          true
        )}

        ${documentRow(
          "Paid",
          money(totalPaid)
        )}

        ${documentRow(
          "Balance",
          money(
            balanceOutstanding
          ),
          true
        )}

      </div>

      ${bankingDetails(
        selectedInvoice.invoice_number
      )}
    `;

    openPrintWindow(
      `${selectedInvoice.invoice_number} - Tax Invoice`,
      html
    );
  }

  // =========================================================
  // GUEST STATEMENT
  // =========================================================

  function openStatementPDF() {
    if (!reservation) {
      return;
    }

    const paymentRows =
      payments.length === 0
        ? `
          <tr>
            <td colspan="4">
              No payments recorded.
            </td>
          </tr>
        `
        : payments
            .map(
              (payment) => `
                <tr>
                  <td>
                    ${escapeHtml(
                      formatDateTime(
                        payment.received_at
                      )
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      formatPaymentMethod(
                        payment.payment_method
                      )
                    )}
                  </td>

                  <td>
                    ${escapeHtml(
                      formatStatusText(
                        payment.transaction_type
                      )
                    )}
                  </td>

                  <td class="right">
                    ${
                      payment.transaction_type ===
                      "refund"
                        ? "-"
                        : ""
                    }${escapeHtml(
                      money(payment.amount)
                    )}
                  </td>
                </tr>
              `
            )
            .join("");

    const html = `
      ${documentHeader(
        "GUEST STATEMENT",
        reservation.reservation_number
      )}

      <div class="section">
        ${documentRow(
          "Guest",
          guestName()
        )}

        ${documentRow(
          "Company",
          company?.name ??
            "Private / Walk-in"
        )}

        ${documentRow(
          "Stay",
          `${formatFriendlyDate(
            reservation.arrival_date
          )} - ${formatFriendlyDate(
            reservation.departure_date
          )}`
        )}

        ${documentRow(
          "Room",
          room
            ? `Room ${room.room_number}`
            : "-"
        )}
      </div>

      <div class="section">
        <div class="section-title">
          Account Summary
        </div>

        ${documentRow(
          "Total Charges",
          money(
            reservation.total_amount
          )
        )}

        ${documentRow(
          "Payments",
          money(totalPaid)
        )}

        ${documentRow(
          "BALANCE DUE",
          money(
            balanceOutstanding
          ),
          true
        )}
      </div>

      <div class="section">
        <div class="section-title">
          Payment Activity
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Type</th>
              <th class="right">Amount</th>
            </tr>
          </thead>

          <tbody>
            ${paymentRows}
          </tbody>
        </table>
      </div>

      ${bankingDetails(
        reservation.reservation_number
      )}
    `;

    openPrintWindow(
      `${reservation.reservation_number} - Guest Statement`,
      html
    );
  }

  // =========================================================
  // PAYMENT RECEIPT
  // =========================================================

  function openReceiptPDF() {
    if (
      !reservation ||
      payments.length === 0
    ) {
      alert(
        "No payment has been recorded yet."
      );

      return;
    }

    const paymentRows =
      payments
        .map(
          (payment) => `
            <tr>
              <td>
                ${escapeHtml(
                  formatDateTime(
                    payment.received_at
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  formatPaymentMethod(
                    payment.payment_method
                  )
                )}
              </td>

              <td>
                ${escapeHtml(
                  payment.payment_reference ??
                    "-"
                )}
              </td>

              <td class="right">
                ${
                  payment.transaction_type ===
                  "refund"
                    ? "-"
                    : ""
                }${escapeHtml(
                  money(payment.amount)
                )}
              </td>
            </tr>
          `
        )
        .join("");

    const html = `
      ${documentHeader(
        "PAYMENT RECEIPT",
        reservation.reservation_number
      )}

      <div class="section">
        ${documentRow(
          "Received From",
          guestName()
        )}

        ${documentRow(
          "Reservation",
          reservation.reservation_number
        )}

        ${documentRow(
          "Net Amount Received",
          money(totalPaid),
          true
        )}
      </div>

      <div class="section">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th class="right">Amount</th>
            </tr>
          </thead>

          <tbody>
            ${paymentRows}
          </tbody>
        </table>
      </div>

      <div class="section">
        ${documentRow(
          "Reservation Total",
          money(
            reservation.total_amount
          )
        )}

        ${documentRow(
          "Balance Due",
          money(
            balanceOutstanding
          ),
          true
        )}
      </div>
    `;

    openPrintWindow(
      `${reservation.reservation_number} - Payment Receipt`,
      html
    );
  }

  // =========================================================
  // DOCUMENT HELPERS
  // =========================================================

  function documentHeader(
    title: string,
    number: string
  ) {
    return `
      <div class="document-header">

        <div>

          <div class="property-name">
            ${escapeHtml(
              property?.name ??
                "Netpos Hospitality"
            )}
          </div>

          ${
            property?.town
              ? `<div>${escapeHtml(
                  property.town
                )}</div>`
              : ""
          }

          ${
            property?.phone
              ? `<div>Tel: ${escapeHtml(
                  property.phone
                )}</div>`
              : ""
          }

          ${
            property?.email
              ? `<div>Email: ${escapeHtml(
                  property.email
                )}</div>`
              : ""
          }

          ${
            property?.vat_number
              ? `<div>VAT No: ${escapeHtml(
                  property.vat_number
                )}</div>`
              : ""
          }

        </div>

        <div class="document-title">

          <h1>
            ${escapeHtml(title)}
          </h1>

          <strong>
            ${escapeHtml(number)}
          </strong>

        </div>

      </div>
    `;
  }

  function bankingDetails(
    reference: string
  ) {
    if (
      !property?.bank_name &&
      !property?.bank_account_number
    ) {
      return "";
    }

    return `
      <div class="bank">

        <strong>
          BANKING DETAILS
        </strong>

        ${
          property?.bank_name
            ? `<div>${escapeHtml(
                property.bank_name
              )}</div>`
            : ""
        }

        ${
          property?.bank_account_name
            ? `<div>Account Name: ${escapeHtml(
                property.bank_account_name
              )}</div>`
            : ""
        }

        ${
          property?.bank_account_number
            ? `<div>Account Number: ${escapeHtml(
                property.bank_account_number
              )}</div>`
            : ""
        }

        ${
          property?.bank_branch_code
            ? `<div>Branch Code: ${escapeHtml(
                property.bank_branch_code
              )}</div>`
            : ""
        }

        <div style="margin-top:6px">

          ${
            property?.payment_reference_instruction
              ? escapeHtml(
                  property.payment_reference_instruction
                )
              : `Please use ${escapeHtml(
                  reference
                )} as payment reference.`
          }

        </div>

      </div>
    `;
  }

  function openPrintWindow(
    title: string,
    body: string
  ) {
    const printWindow =
      window.open(
        "",
        "_blank",
        "width=900,height=850"
      );

    if (!printWindow) {
      alert(
        "Please allow browser pop-ups."
      );

      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>

<html>

<head>

<title>
${escapeHtml(title)}
</title>

<style>

* {
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  color: #111;
  padding: 30px;
  margin: 0;
}

.toolbar {
  max-width: 800px;
  margin: 0 auto 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.toolbar button {
  padding: 9px 15px;
  border-radius: 6px;
  border: 1px solid #bbb;
  cursor: pointer;
  font-weight: 700;
}

.print {
  background: #111;
  color: white;
  border-color: #111 !important;
}

.document {
  max-width: 800px;
  margin: auto;
}

.document-header {
  display: flex;
  justify-content: space-between;
  gap: 30px;
  border-bottom: 2px solid #111;
  padding-bottom: 16px;
}

.property-name {
  font-size: 25px;
  font-weight: 800;
}

.document-title {
  text-align: right;
}

.document-title h1 {
  margin: 0 0 6px;
  font-size: 20px;
}

.section {
  margin-top: 20px;
}

.section-title {
  font-weight: 800;
  font-size: 11px;
  text-transform: uppercase;
  border-bottom: 1px solid #ddd;
  padding-bottom: 5px;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 6px 0;
  font-size: 12px;
}

.large {
  font-size: 18px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  padding: 8px;
  border-bottom: 1px solid #ddd;
  text-align: left;
}

.right {
  text-align: right;
}

.totals {
  width: 340px;
  margin-left: auto;
  margin-top: 18px;
}

.bank {
  margin-top: 25px;
  font-size: 11px;
  line-height: 1.7;
}

@media print {

  body {
    padding: 0;
  }

  .toolbar {
    display: none;
  }

}

</style>

</head>

<body>

<div class="toolbar">

<button onclick="window.close()">
  Close
</button>

<button
  class="print"
  onclick="window.print()"
>
  Print / Save as PDF
</button>

</div>

<div class="document">

${body}

</div>

</body>

</html>
    `);

    printWindow.document.close();
    printWindow.focus();
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <main style={pageStyle}>
        Loading reservation...
      </main>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (
    errorMessage ||
    !reservation
  ) {
    return (
      <main style={pageStyle}>
        <button
          type="button"
          onClick={() =>
            router.push(
              "/reservations"
            )
          }
          style={textButton}
        >
          â† Reservation Calendar
        </button>

        <div style={errorBox}>
          {errorMessage ||
            "Reservation was not found."}
        </div>
      </main>
    );
  }

  const nights =
    calculateNights(
      reservation.arrival_date,
      reservation.departure_date
    );

  const canEdit =
    [
      "provisional",
      "confirmed",
    ].includes(
      reservation.status
    );

  const canCancel =
    [
      "provisional",
      "confirmed",
    ].includes(
      reservation.status
    );

  const canNoShow =
    reservation.status ===
    "confirmed";

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <>
      <main style={pageStyle}>
        {/* HEADER */}

        <header style={headerStyle}>
          <div>
            <button
              type="button"
              onClick={() =>
                router.push(
                  "/reservations"
                )
              }
              style={textButton}
            >
              â† Reservation Calendar
            </button>

            <div style={reservationHeading}>
              <h1 style={titleStyle}>
                {
                  reservation.reservation_number
                }
              </h1>

              <StatusBadge
                status={
                  reservation.status
                }
              />

              <span style={sourceStyle}>
                {formatBookingSource(
                  reservation.booking_source
                )}
              </span>
            </div>
          </div>

          <div style={actionBar}>
            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/reservations/${reservation.id}/edit`
                  )
                }
                style={editButton}
              >
                âœŽ Edit Reservation
              </button>
            )}

            <button
              type="button"
              onClick={
                openConfirmationPDF
              }
              style={secondaryButton}
            >
              Confirmation PDF
            </button>

            {reservation.status ===
              "confirmed" && (
              <button
                type="button"
                onClick={checkIn}
                disabled={updating}
                style={primaryButton}
              >
                Check In
              </button>
            )}

            {reservation.status ===
              "checked_in" && (
              <button
                type="button"
                onClick={checkOut}
                disabled={updating}
                style={primaryButton}
              >
                Check Out
              </button>
            )}

            {canNoShow && (
              <button
                type="button"
                onClick={markNoShow}
                disabled={updating}
                style={noShowButton}
              >
                Mark No Show
              </button>
            )}

            {canCancel && (
              <button
                type="button"
                onClick={
                  cancelReservation
                }
                disabled={updating}
                style={cancelButton}
              >
                Cancel Reservation
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                router.push(
                  "/reservations"
                );

                router.refresh();
              }}
              style={finishButton}
            >
              âœ“ Finish
            </button>
          </div>
        </header>

        {message && (
          <div style={successBox}>
            âœ“ {message}
          </div>
        )}

        {reservation.status ===
          "cancelled" && (
          <div style={cancelledBox}>
            <strong>
              Reservation Cancelled
            </strong>

            <span>
              This room has been released on the reservation calendar.
            </span>
          </div>
        )}

        {reservation.status ===
          "no_show" && (
          <div style={noShowNotice}>
            <strong>
              Guest Marked as No Show
            </strong>

            <span>
              This reservation remains on record, but the room has been released.
            </span>
          </div>
        )}

        {reservation.status ===
          "checked_out" && (
          <div style={checkoutNotice}>
            <strong>
              Guest Checked Out
            </strong>

            <span>
              {room
                ? `Room ${room.room_number} is now ${formatHousekeeping(
                    room.housekeeping_status
                  )}.`
                : "Stay completed."}
            </span>
          </div>
        )}

        {/* MAIN GRID */}

        <div style={mainGrid}>
          {/* LEFT */}

          <div style={leftColumn}>
            <section style={cardStyle}>
              <div style={twoPanelGrid}>
                <div>
                  <div style={sectionTitle}>
                    GUEST / CUSTOMER
                  </div>

                  <div style={guestNameStyle}>
                    {guestName()}
                  </div>

                  <DetailRow
                    label="Mobile"
                    value={
                      guest?.phone ?? "-"
                    }
                  />

                  <DetailRow
                    label="Email"
                    value={
                      guest?.email ?? "-"
                    }
                  />

                  <DetailRow
                    label="ID / Passport"
                    value={
                      guest?.id_number ?? "-"
                    }
                  />

                  <DetailRow
                    label="Organisation"
                    value={
                      company?.name ??
                      "Private / Walk-in"
                    }
                  />
                </div>

                <div>
                  <div style={sectionTitle}>
                    STAY DETAILS
                  </div>

                  <DetailRow
                    label="Check-in"
                    value={
                      formatFriendlyDate(
                        reservation.arrival_date
                      )
                    }
                  />

                  <DetailRow
                    label="Check-out"
                    value={
                      formatFriendlyDate(
                        reservation.departure_date
                      )
                    }
                  />

                  <DetailRow
                    label="Nights"
                    value={
                      String(nights)
                    }
                  />

                  <DetailRow
                    label="Guests"
                    value={`${reservation.adults} Adult${
                      reservation.adults === 1
                        ? ""
                        : "s"
                    }, ${reservation.children} ${
                      reservation.children === 1
                        ? "Child"
                        : "Children"
                    }`}
                  />
                </div>
              </div>
            </section>

            {/* ROOM */}

            <section style={cardStyle}>
              <div style={sectionTitle}>
                ROOM
              </div>

              <div style={roomGrid}>
                <div>
                  <span style={smallLabel}>
                    PHYSICAL ROOM
                  </span>

                  <strong style={roomNumber}>
                    {room
                      ? `Room ${room.room_number}`
                      : "Unassigned"}
                  </strong>
                </div>

                <InfoCell
                  label="Room Type"
                  value={
                    roomType?.name ?? "-"
                  }
                />

                <InfoCell
                  label="Rate / Night"
                  value={`N$${Number(
                    reservationRoom?.nightly_rate ??
                      0
                  ).toFixed(2)}`}
                />

                <div>
                  <span style={smallLabel}>
                    HOUSEKEEPING
                  </span>

                  <HousekeepingBadge
                    status={
                      room?.housekeeping_status
                    }
                  />
                </div>
              </div>
            </section>

            {/* NOTES / PAYMENTS */}

            <section style={cardStyle}>
              <div style={twoPanelGrid}>
                <div>
                  <div style={sectionTitle}>
                    RESERVATION NOTES
                  </div>

                  <div style={notesBox}>
                    {reservation.notes ||
                      "No reservation notes."}
                  </div>
                </div>

                <div>
                  <div style={sectionHeader}>
                    <div style={sectionTitle}>
                      PAYMENTS
                    </div>

                    <span style={countText}>
                      {payments.length} recorded
                    </span>
                  </div>

                  {payments.length === 0 ? (
                    <div style={emptyText}>
                      No payments recorded.
                    </div>
                  ) : (
                    payments
                      .slice(0, 4)
                      .map((payment) => (
                        <div
                          key={payment.id}
                          style={paymentRow}
                        >
                          <div>
                            <strong>
                              {formatPaymentMethod(
                                payment.payment_method
                              )}
                            </strong>

                            <span style={paymentDate}>
                              {" Â· "}
                              {formatDateTime(
                                payment.received_at
                              )}
                            </span>
                          </div>

                          <strong>
                            {payment.transaction_type ===
                            "refund"
                              ? "-"
                              : ""}

                            N$
                            {Number(
                              payment.amount
                            ).toFixed(2)}
                          </strong>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT - GUEST FOLIO / ACCOUNT */}

          <div style={rightColumn}>
            <section style={folioCard}>
              <div style={folioHeader}>
                <div>
                  <div style={sectionTitle}>
                    GUEST FOLIO / ACCOUNT
                  </div>

                  <div style={folioGuestName}>
                    {guestName()}
                  </div>

                  <div style={folioReference}>
                    {reservation.reservation_number}
                    {room
                      ? ` Â· Room ${room.room_number}`
                      : ""}
                  </div>
                </div>

                <div style={folioBalanceBlock}>
                  <span style={smallLabel}>
                    BALANCE DUE
                  </span>

                  <strong
                    style={{
                      ...folioBalanceAmount,
                      color:
                        balanceOutstanding > 0
                          ? "#0D4F91"
                          : "#168257",
                    }}
                  >
                    N$
                    {balanceOutstanding.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div style={folioSummaryGrid}>
                <SummaryTile
                  label="Total Charges"
                  value={money(
                    reservation.total_amount
                  )}
                />

                <SummaryTile
                  label="Total Payments"
                  value={money(totalPaid)}
                  positive
                />

                <SummaryTile
                  label="Balance Due"
                  value={money(
                    balanceOutstanding
                  )}
                  emphasis
                />

                <SummaryTile
                  label="Deposit Required"
                  value={money(
                    reservation.deposit_required
                  )}
                />
              </div>

              <div style={folioTabs}>
                <FolioTab
                  label="Folio"
                  active={
                    activeAccountTab === "folio"
                  }
                  onClick={() =>
                    setActiveAccountTab("folio")
                  }
                />

                <FolioTab
                  label={`Payments (${payments.length})`}
                  active={
                    activeAccountTab === "payments"
                  }
                  onClick={() =>
                    setActiveAccountTab("payments")
                  }
                />

                <FolioTab
                  label={`Invoices (${invoice ? 1 : 0})`}
                  active={
                    activeAccountTab === "invoices"
                  }
                  onClick={() =>
                    setActiveAccountTab("invoices")
                  }
                />

                <FolioTab
                  label="Documents"
                  active={
                    activeAccountTab === "documents"
                  }
                  onClick={() =>
                    setActiveAccountTab("documents")
                  }
                />
              </div>

              {activeAccountTab === "folio" && (
                <div style={folioPanel}>
                  <div style={folioLineHeader}>
                    <span>DESCRIPTION</span>
                    <span>AMOUNT</span>
                  </div>

                  <div style={folioLine}>
                    <div>
                      <strong>
                        Accommodation
                      </strong>

                      <span style={folioLineMeta}>
                        {room
                          ? `Room ${room.room_number}`
                          : "Room"}
                        {" Â· "}
                        {roomType?.name ?? "-"}
                        {" Â· "}
                        {nights} night
                        {nights === 1 ? "" : "s"}
                        {" Ã— "}
                        {money(
                          Number(
                            reservationRoom?.nightly_rate ??
                              0
                          )
                        )}
                      </span>
                    </div>

                    <strong>
                      {money(
                        reservation.subtotal
                      )}
                    </strong>
                  </div>

                  {Number(
                    reservation.discount_amount ?? 0
                  ) > 0 && (
                    <div style={folioLine}>
                      <div>
                        <strong>
                          Discount
                        </strong>
                      </div>

                      <strong style={greenText}>
                        -
                        {money(
                          reservation.discount_amount
                        )}
                      </strong>
                    </div>
                  )}

                  <div style={folioLine}>
                    <div>
                      <strong>
                        VAT Included
                      </strong>

                      <span style={folioLineMeta}>
                        {Number(
                          property?.vat_rate ?? 0
                        ).toFixed(0)}
                        % VAT included in total
                      </span>
                    </div>

                    <strong>
                      {money(
                        reservation.vat_amount
                      )}
                    </strong>
                  </div>

                  <div style={folioTotalLine}>
                    <strong>
                      Total Charges
                    </strong>

                    <strong>
                      {money(
                        reservation.total_amount
                      )}
                    </strong>
                  </div>

                  <div style={folioPaymentSection}>
                    <div style={folioSubheading}>
                      PAYMENTS / CREDITS
                    </div>

                    {payments.length === 0 ? (
                      <div style={emptyFolioState}>
                        No payments recorded yet.
                      </div>
                    ) : (
                      payments.map((payment) => (
                        <div
                          key={payment.id}
                          style={folioPaymentLine}
                        >
                          <div>
                            <strong>
                              {formatPaymentMethod(
                                payment.payment_method
                              )}
                              {" Â· "}
                              {formatStatusText(
                                payment.transaction_type
                              )}
                            </strong>

                            <span style={folioLineMeta}>
                              {formatDateTime(
                                payment.received_at
                              )}
                              {payment.payment_reference
                                ? ` Â· Ref ${payment.payment_reference}`
                                : ""}
                            </span>
                          </div>

                          <strong
                            style={
                              payment.transaction_type ===
                              "refund"
                                ? refundText
                                : greenText
                            }
                          >
                            {payment.transaction_type ===
                            "refund"
                              ? "+"
                              : "-"}
                            {money(
                              payment.amount
                            )}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={folioClosingBalance}>
                    <span>
                      CURRENT BALANCE
                    </span>

                    <strong>
                      {money(
                        balanceOutstanding
                      )}
                    </strong>
                  </div>
                </div>
              )}

              {activeAccountTab === "payments" && (
                <div style={folioPanel}>
                  <div style={panelActionHeader}>
                    <div>
                      <div style={folioSubheading}>
                        PAYMENT HISTORY
                      </div>

                      <div style={folioHelp}>
                        Deposits, payments and refunds recorded against this reservation.
                      </div>
                    </div>

                    {![
                      "cancelled",
                      "no_show",
                    ].includes(
                      reservation.status
                    ) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAmount(
                            balanceOutstanding > 0
                              ? balanceOutstanding.toFixed(
                                  2
                                )
                              : ""
                          );

                          setShowPaymentModal(true);
                        }}
                        style={greenActionButton}
                      >
                        + Record Payment
                      </button>
                    )}
                  </div>

                  {payments.length === 0 ? (
                    <div style={emptyFolioState}>
                      No payments recorded.
                    </div>
                  ) : (
                    payments.map((payment) => (
                      <div
                        key={payment.id}
                        style={historyRow}
                      >
                        <div>
                          <strong>
                            {formatPaymentMethod(
                              payment.payment_method
                            )}
                          </strong>

                          <div style={folioLineMeta}>
                            {formatDateTime(
                              payment.received_at
                            )}
                            {" Â· "}
                            {formatStatusText(
                              payment.transaction_type
                            )}
                            {payment.payment_reference
                              ? ` Â· ${payment.payment_reference}`
                              : ""}
                          </div>

                          {payment.notes && (
                            <div style={paymentNote}>
                              {payment.notes}
                            </div>
                          )}
                        </div>

                        <strong
                          style={{
                            fontSize: 13,
                            color:
                              payment.transaction_type ===
                              "refund"
                                ? "#A85B3A"
                                : "#168257",
                          }}
                        >
                          {payment.transaction_type ===
                          "refund"
                            ? "-"
                            : ""}
                          {money(
                            payment.amount
                          )}
                        </strong>
                      </div>
                    ))
                  )}

                  <div style={folioClosingBalance}>
                    <span>
                      NET PAYMENTS
                    </span>

                    <strong>
                      {money(totalPaid)}
                    </strong>
                  </div>
                </div>
              )}

              {activeAccountTab === "invoices" && (
                <div style={folioPanel}>
                  <div style={panelActionHeader}>
                    <div>
                      <div style={folioSubheading}>
                        INVOICE
                      </div>

                      <div style={folioHelp}>
                        Generate or reopen the tax invoice for this reservation.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={generateInvoice}
                      disabled={generatingInvoice}
                      style={blueActionButton}
                    >
                      {generatingInvoice
                        ? "Generating..."
                        : invoice
                        ? "Open Invoice"
                        : "Generate Invoice"}
                    </button>
                  </div>

                  {!invoice ? (
                    <div style={emptyFolioState}>
                      No invoice has been generated yet.
                    </div>
                  ) : (
                    <div style={invoiceCard}>
                      <div>
                        <span style={smallLabel}>
                          INVOICE NUMBER
                        </span>

                        <strong style={invoiceNumberStyle}>
                          {invoice.invoice_number}
                        </strong>

                        <div style={folioLineMeta}>
                          {formatFriendlyDate(
                            invoice.invoice_date
                          )}
                        </div>
                      </div>

                      <div style={invoiceAmountBlock}>
                        <StatusPill
                          label={formatInvoiceStatus(
                            invoice.status
                          )}
                          positive={
                            invoice.status === "paid"
                          }
                        />

                        <strong>
                          {money(
                            invoice.total_amount
                          )}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeAccountTab === "documents" && (
                <div style={folioPanel}>
                  <div style={folioSubheading}>
                    PRINT / PDF DOCUMENTS
                  </div>

                  <div style={documentActionGrid}>
                    <button
                      type="button"
                      onClick={openConfirmationPDF}
                      style={documentActionCard}
                    >
                      <span style={documentIcon}>
                        R
                      </span>

                      <span>
                        <strong>
                          Reservation Confirmation
                        </strong>

                        <small>
                          Print or save booking confirmation
                        </small>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={generateInvoice}
                      disabled={generatingInvoice}
                      style={documentActionCard}
                    >
                      <span style={documentIcon}>
                        I
                      </span>

                      <span>
                        <strong>
                          {invoice
                            ? "Tax Invoice"
                            : "Generate Tax Invoice"}
                        </strong>

                        <small>
                          Print or save invoice
                        </small>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openStatementPDF()
                      }
                      style={documentActionCard}
                    >
                      <span style={documentIcon}>
                        S
                      </span>

                      <span>
                        <strong>
                          Guest Statement
                        </strong>

                        <small>
                          Charges, payments and balance
                        </small>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openReceiptPDF()
                      }
                      disabled={payments.length === 0}
                      style={{
                        ...documentActionCard,
                        opacity:
                          payments.length === 0
                            ? 0.5
                            : 1,
                      }}
                    >
                      <span style={documentIcon}>
                        P
                      </span>

                      <span>
                        <strong>
                          Payment Receipt
                        </strong>

                        <small>
                          Receipt for payments received
                        </small>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {![
                "cancelled",
                "no_show",
              ].includes(
                reservation.status
              ) && (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentAmount(
                      balanceOutstanding > 0
                        ? balanceOutstanding.toFixed(
                            2
                          )
                        : ""
                    );

                    setShowPaymentModal(true);
                  }}
                  style={folioPaymentButton}
                >
                  + Record Payment
                </button>
              )}
            </section>

            <section style={cardStyle}>
              <div style={sectionTitle}>
                STAY ACTIVITY
              </div>

              <DetailRow
                label="Status"
                value={
                  formatStatus(
                    reservation.status
                  )
                }
              />

              <DetailRow
                label="Booking Source"
                value={
                  formatBookingSource(
                    reservation.booking_source
                  )
                }
              />

              <DetailRow
                label="Checked In"
                value={
                  reservation.checked_in_at
                    ? formatDateTime(
                        reservation.checked_in_at
                      )
                    : "-"
                }
              />

              <DetailRow
                label="Checked Out"
                value={
                  reservation.checked_out_at
                    ? formatDateTime(
                        reservation.checked_out_at
                      )
                    : "-"
                }
              />
            </section>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/housekeeping"
                )
              }
              style={housekeepingPageButton}
            >
              Open Housekeeping
            </button>
          </div>
        </div>
      </main>

      {/* PAYMENT MODAL */}

      {showPaymentModal && (
        <div style={modalOverlay}>
          <form
            onSubmit={
              recordPayment
            }
            style={modalBox}
          >
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>
                  Record Payment
                </h2>

                <div style={modalSubtitle}>
                  {
                    reservation.reservation_number
                  }
                  {" Â· "}
                  {guestName()}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPaymentModal(
                    false
                  )
                }
                style={closeButton}
              >
                Ã—
              </button>
            </div>

            <div style={paymentSummary}>
              <InfoCell
                label="Total"
                value={`N$${Number(
                  reservation.total_amount
                ).toFixed(2)}`}
              />

              <InfoCell
                label="Paid"
                value={`N$${totalPaid.toFixed(
                  2
                )}`}
              />

              <InfoCell
                label="Balance"
                value={`N$${balanceOutstanding.toFixed(
                  2
                )}`}
              />
            </div>

            <div style={modalGrid}>
              <Field label="Transaction">
                <select
                  value={
                    transactionType
                  }
                  onChange={(event) =>
                    setTransactionType(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="payment">
                    Payment
                  </option>

                  <option value="deposit">
                    Deposit
                  </option>

                  {canProcessRefund && (
                    <option value="refund">
                      Refund
                    </option>
                  )}
                </select>
              </Field>

              <Field label="Payment Method">
                <select
                  value={
                    paymentMethod
                  }
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="cash">
                    Cash
                  </option>

                  <option value="card">
                    Card
                  </option>

                  <option value="eft">
                    EFT
                  </option>

                  <option value="account">
                    Account
                  </option>
                </select>
              </Field>
            </div>

            <Field label="Amount">
              <input
                autoFocus
                type="number"
                min="0.01"
                step="0.01"
                value={
                  paymentAmount
                }
                onChange={(event) =>
                  setPaymentAmount(
                    event.target.value
                  )
                }
                style={inputStyle}
              />
            </Field>

            <Field label="Reference">
              <input
                value={
                  paymentReference
                }
                onChange={(event) =>
                  setPaymentReference(
                    event.target.value
                  )
                }
                placeholder="Optional reference"
                style={inputStyle}
              />
            </Field>

            <Field label="Notes">
              <input
                value={
                  paymentNotes
                }
                onChange={(event) =>
                  setPaymentNotes(
                    event.target.value
                  )
                }
                placeholder="Optional notes"
                style={inputStyle}
              />
            </Field>

            <div style={modalActions}>
              <button
                type="button"
                onClick={() =>
                  setShowPaymentModal(
                    false
                  )
                }
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  savingPayment
                }
                style={primaryButton}
              >
                {savingPayment
                  ? "Saving..."
                  : "Save Payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
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
  children: ReactNode;
}) {
  return (
    <div>
      <label style={fieldLabel}>
        {label}
      </label>

      {children}
    </div>
  );
}

function DetailRow({
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

function InfoCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <span style={smallLabel}>
        {label}
      </span>

      <strong
        style={{
          fontSize: 11,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  const number =
    Number(
      value ?? 0
    );

  return (
    <div style={moneyRow}>
      <span>
        {label}
      </span>

      <strong
        style={{
          fontSize:
            strong ? 18 : 12,
        }}
      >
        {number < 0
          ? "-"
          : ""}

        N$
        {Math.abs(
          number
        ).toFixed(2)}
      </strong>
    </div>
  );
}

function HousekeepingBadge({
  status,
}: {
  status:
    | string
    | null
    | undefined;
}) {
  const value =
    String(
      status ?? "clean"
    ).toLowerCase();

  if (
    value === "dirty"
  ) {
    return (
      <span style={dirtyHousekeepingBadge}>
        DIRTY
      </span>
    );
  }

  if (
    value === "cleaning"
  ) {
    return (
      <span style={cleaningHousekeepingBadge}>
        CLEANING
      </span>
    );
  }

  return (
    <span style={cleanHousekeepingBadge}>
      CLEAN
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const colours: Record<
    string,
    {
      background: string;
      border: string;
      color: string;
    }
  > = {
    provisional: {
      background: "#fff7df",
      border: "#e2c878",
      color: "#755600",
    },

    confirmed: {
      background: "#eaf2ff",
      border: "#a9c5ef",
      color: "#1d4f91",
    },

    checked_in: {
      background: "#f1eaff",
      border: "#c8afe8",
      color: "#5a2e91",
    },

    checked_out: {
      background: "#edf8f0",
      border: "#acd0b8",
      color: "#176332",
    },

    cancelled: {
      background: "#fff0f0",
      border: "#e4a0a0",
      color: "#a11a1a",
    },

    no_show: {
      background: "#fff1e8",
      border: "#e5b28b",
      color: "#994b13",
    },
  };

  const colour =
    colours[status] ?? {
      background: "#eee",
      border: "#ccc",
      color: "#555",
    };

  return (
    <span
      style={{
        background:
          colour.background,

        color:
          colour.color,

        borderWidth: 1,

        borderStyle:
          "solid",

        borderColor:
          colour.border,

        borderRadius: 20,

        padding:
          "4px 9px",

        fontSize: 10,

        fontWeight: 800,
      }}
    >
      {formatStatus(status)}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  positive = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        ...summaryTile,
        background:
          emphasis
            ? "#EEF6FF"
            : positive
            ? "#F0FAF5"
            : "#F8FBFE",
        borderColor:
          emphasis
            ? "#B8D6F1"
            : positive
            ? "#BCE1CE"
            : "#DCE7F0",
      }}
    >
      <span style={smallLabel}>
        {label}
      </span>

      <strong
        style={{
          fontSize: 15,
          color:
            positive
              ? "#168257"
              : emphasis
              ? "#0D4F91"
              : "#183A59",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function FolioTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...folioTabButton,
        color:
          active
            ? "#0D4F91"
            : "#60758A",
        borderBottomColor:
          active
            ? "#1688D4"
            : "transparent",
        background:
          active
            ? "#F4F9FD"
            : "transparent",
      }}
    >
      {label}
    </button>
  );
}

function StatusPill({
  label,
  positive = false,
}: {
  label: string;
  positive?: boolean;
}) {
  return (
    <span
      style={{
        ...statusPill,
        color:
          positive
            ? "#168257"
            : "#0D4F91",
        background:
          positive
            ? "#EAF8F1"
            : "#EAF4FD",
        borderColor:
          positive
            ? "#B5DDC9"
            : "#BDD7ED",
      }}
    >
      {label}
    </span>
  );
}

// =========================================================
// HELPERS
// =========================================================

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

function calculateNights(
  arrival: string,
  departure: string
) {
  if (
    !arrival ||
    !departure
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.round(
      (
        parseDate(
          departure
        ).getTime() -
        parseDate(
          arrival
        ).getTime()
      ) /
        86400000
    )
  );
}

function formatFriendlyDate(
  value: string
) {
  if (!value) {
    return "-";
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

function formatDateTime(
  value: string
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "en-NA",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
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
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function todayString() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function generateDocumentNumber(
  prefix: string
) {
  return `${prefix}-${Date.now()}`;
}

function money(
  value: number
) {
  return `N$${Number(
    value ?? 0
  ).toFixed(2)}`;
}

function formatStatus(
  status: string
) {
  const values: Record<
    string,
    string
  > = {
    provisional: "Provisional",
    confirmed: "Confirmed",
    checked_in: "Checked In",
    checked_out: "Checked Out",
    cancelled: "Cancelled",
    no_show: "No Show",
  };

  return values[status] ?? status;
}

function formatBookingSource(
  source:
    | string
    | null
) {
  if (!source) {
    return "-";
  }

  const values: Record<
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

  return values[source] ?? source;
}

function formatInvoiceStatus(
  status: string
) {
  const values: Record<
    string,
    string
  > = {
    draft: "Draft",
    issued: "Issued",
    part_paid: "Part Paid",
    paid: "Paid",
    void: "Void",
  };

  return values[status] ?? status;
}

function formatPaymentMethod(
  method: string
) {
  const values: Record<
    string,
    string
  > = {
    cash: "Cash",
    card: "Card",
    eft: "EFT",
    account: "Account",
  };

  return values[method] ?? method;
}

function formatStatusText(
  value: string
) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatHousekeeping(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "Clean";
  }

  return value
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function documentRow(
  label: string,
  value: string,
  large = false
) {
  return `
    <div class="row">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong class="${
        large ? "large" : ""
      }">
        ${escapeHtml(value)}
      </strong>

    </div>
  `;
}

function escapeHtml(
  value: string
) {
  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

// =========================================================
// STYLES
// =========================================================

const pageStyle: CSSProperties = {
  maxWidth: 1380,
  margin: "0 auto",
  padding: "14px 22px 28px",
  fontFamily: "Arial, sans-serif",
  boxSizing: "border-box",
  color: "#183A59",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  marginBottom: 8,
};

const reservationHeading: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginTop: 5,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 21,
};

const sourceStyle: CSSProperties = {
  fontSize: 9,
  color: "#777",
};

const actionBar: CSSProperties = {
  display: "flex",
  gap: 5,
  justifyContent: "flex-end",
  alignItems: "center",
  flexWrap: "wrap",
};

const mainGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1.55fr) minmax(300px,.7fr)",
  gap: 8,
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

const cardStyle: CSSProperties = {
  background: "#fff",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#D9E5EE",
  borderRadius: 10,
  padding: "11px 13px",
  boxShadow: "0 4px 14px rgba(19,67,108,.045)",
};

const twoPanelGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 25,
};

const sectionHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const sectionTitle: CSSProperties = {
  fontSize: 9,
  color: "#536579",
  fontWeight: 900,
  letterSpacing: 0.5,
  marginBottom: 5,
};

const guestNameStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  marginBottom: 5,
};

const detailRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
  padding: "3px 0",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#f0f0f0",
};

const detailLabel: CSSProperties = {
  fontSize: 9,
  color: "#777",
};

const detailValue: CSSProperties = {
  fontSize: 9,
  textAlign: "right",
};

const roomGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.25fr 1fr 1fr 1fr",
  alignItems: "center",
  gap: 15,
};

const smallLabel: CSSProperties = {
  display: "block",
  fontSize: 7,
  color: "#777",
  fontWeight: 900,
  textTransform: "uppercase",
  marginBottom: 3,
};

const roomNumber: CSSProperties = {
  display: "block",
  color: "#173f73",
  fontSize: 22,
};

const notesBox: CSSProperties = {
  minHeight: 45,
  background: "#f8f8f8",
  borderRadius: 6,
  padding: 8,
  color: "#555",
  fontSize: 9,
  lineHeight: 1.45,
};

const countText: CSSProperties = {
  fontSize: 8,
  color: "#888",
};

const emptyText: CSSProperties = {
  fontSize: 9,
  color: "#888",
  padding: "5px 0",
};

const paymentRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "4px 0",
  borderBottomWidth: 1,
  borderBottomStyle: "solid",
  borderBottomColor: "#eee",
  fontSize: 9,
};

const paymentDate: CSSProperties = {
  color: "#888",
  fontSize: 8,
};

const moneyRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  padding: "3px 0",
  fontSize: 10,
};

const totalDivider: CSSProperties = {
  marginTop: 4,
  paddingTop: 5,
  borderTopWidth: 1,
  borderTopStyle: "solid",
  borderTopColor: "#bbb",
};

const paidGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 6,
  marginTop: 7,
};

const paidBox: CSSProperties = {
  padding: "7px 9px",
  borderRadius: 6,
  background: "#f3f3f3",
};

const bigMoney: CSSProperties = {
  display: "block",
  fontSize: 16,
};

const paymentButton: CSSProperties = {
  width: "100%",
  marginTop: 7,
  borderWidth: 0,
  borderRadius: 6,
  background: "#0D5FA8",
  color: "#fff",
  padding: "8px 10px",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};

const documentGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 5,
};

const documentButton: CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccc",
  borderRadius: 6,
  background: "#fff",
  padding: "8px 6px",
  fontSize: 9,
  fontWeight: 700,
  cursor: "pointer",
};

const documentPrimaryButton: CSSProperties = {
  ...documentButton,
  background: "#0D5FA8",
  color: "#fff",
  borderColor: "#0D5FA8",
};

const invoiceInfo: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 5,
  padding: "5px 7px",
  borderRadius: 5,
  background: "#f5f5f5",
  fontSize: 8,
};

const textButton: CSSProperties = {
  borderWidth: 0,
  background: "transparent",
  padding: 0,
  fontSize: 9,
  fontWeight: 700,
  cursor: "pointer",
};

const primaryButton: CSSProperties = {
  borderWidth: 0,
  borderRadius: 6,
  background: "#0D5FA8",
  color: "#fff",
  padding: "8px 11px",
  fontSize: 9,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccc",
  borderRadius: 6,
  background: "#fff",
  padding: "8px 11px",
  fontSize: 9,
  fontWeight: 700,
  cursor: "pointer",
};

const editButton: CSSProperties = {
  ...secondaryButton,
  borderColor: "#99b6d8",
  background: "#eef5ff",
  color: "#173f73",
  fontWeight: 900,
};

const noShowButton: CSSProperties = {
  ...secondaryButton,
  borderColor: "#d79a69",
  background: "#fff5ec",
  color: "#994b13",
  fontWeight: 900,
};

const cancelButton: CSSProperties = {
  ...secondaryButton,
  borderColor: "#d6a0a0",
  background: "#fff3f3",
  color: "#a11a1a",
  fontWeight: 800,
};

const finishButton: CSSProperties = {
  borderWidth: 0,
  borderRadius: 6,
  background: "#176332",
  color: "#fff",
  padding: "8px 13px",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};

const housekeepingPageButton: CSSProperties = {
  width: "100%",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#afd0b7",
  borderRadius: 7,
  background: "#edf8f0",
  color: "#176332",
  padding: "8px",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};

const successBox: CSSProperties = {
  marginBottom: 7,
  padding: "6px 9px",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#acd0b8",
  borderRadius: 6,
  background: "#edf8f0",
  color: "#176332",
  fontSize: 9,
  fontWeight: 700,
};

const cancelledBox: CSSProperties = {
  ...successBox,
  display: "flex",
  flexDirection: "column",
  gap: 2,
  borderColor: "#e4a0a0",
  background: "#fff0f0",
  color: "#a11a1a",
};

const noShowNotice: CSSProperties = {
  ...cancelledBox,
  borderColor: "#e5b28b",
  background: "#fff5ec",
  color: "#994b13",
};

const checkoutNotice: CSSProperties = {
  ...cancelledBox,
  borderColor: "#afd0b7",
  background: "#edf8f0",
  color: "#176332",
};

const errorBox: CSSProperties = {
  marginTop: 15,
  borderRadius: 8,
  padding: 15,
  background: "#fff0f0",
  color: "#a11a1a",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "rgba(0,0,0,.45)",
  zIndex: 1000,
};

const modalBox: CSSProperties = {
  width: "100%",
  maxWidth: 470,
  background: "#fff",
  borderRadius: 12,
  padding: 18,
  boxShadow:
    "0 20px 60px rgba(0,0,0,.25)",
  display: "grid",
  gap: 10,
};

const modalHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const modalTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
};

const modalSubtitle: CSSProperties = {
  marginTop: 3,
  color: "#777",
  fontSize: 9,
};

const paymentSummary: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(3,1fr)",
  gap: 8,
  background: "#f4f4f4",
  borderRadius: 7,
  padding: 9,
};

const modalGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 7,
  marginTop: 4,
};

const closeButton: CSSProperties = {
  width: 30,
  height: 30,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ddd",
  background: "#fff",
  borderRadius: 6,
  fontSize: 18,
  cursor: "pointer",
};

const fieldLabel: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 9,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#ccc",
  borderRadius: 6,
  padding: "8px 9px",
  background: "#fff",
  fontSize: 11,
};

const housekeepingBadgeBase: CSSProperties = {
  display: "inline-block",
  padding: "4px 7px",
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: 20,
  fontSize: 7,
  fontWeight: 900,
};

const cleanHousekeepingBadge: CSSProperties = {
  ...housekeepingBadgeBase,
  borderColor: "#9ac5a4",
  background: "#eaf7ed",
  color: "#176332",
};

const dirtyHousekeepingBadge: CSSProperties = {
  ...housekeepingBadgeBase,
  borderColor: "#dfa4a4",
  background: "#ffeded",
  color: "#992626",
};

const cleaningHousekeepingBadge: CSSProperties = {
  ...housekeepingBadgeBase,
  borderColor: "#d8c36d",
  background: "#fff7d9",
  color: "#6c5600",
};

// =========================================================
// NETPOS CRYSTAL BLUE / GREEN FOLIO STYLES
// =========================================================

const folioCard: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #CFE0ED",
  borderRadius: 12,
  overflow: "hidden",
  boxShadow: "0 8px 24px rgba(15,72,116,.07)",
};

const folioHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  padding: "13px 14px 10px",
  background:
    "linear-gradient(135deg,#F7FBFF 0%,#FFFFFF 62%,#F2FBF7 100%)",
  borderBottom: "1px solid #E0EAF2",
};

const folioGuestName: CSSProperties = {
  color: "#123F69",
  fontSize: 16,
  fontWeight: 900,
};

const folioReference: CSSProperties = {
  marginTop: 2,
  color: "#71869A",
  fontSize: 8,
  fontWeight: 700,
};

const folioBalanceBlock: CSSProperties = {
  textAlign: "right",
};

const folioBalanceAmount: CSSProperties = {
  display: "block",
  marginTop: 2,
  fontSize: 21,
  fontWeight: 900,
};

const folioSummaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 6,
  padding: "9px 10px",
  borderBottom: "1px solid #E3ECF3",
};

const summaryTile: CSSProperties = {
  minWidth: 0,
  padding: "8px 9px",
  border: "1px solid #DCE7F0",
  borderRadius: 8,
};

const folioTabs: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  borderBottom: "1px solid #DDE8F0",
  background: "#FBFDFE",
};

const folioTabButton: CSSProperties = {
  border: 0,
  borderBottom: "2px solid transparent",
  padding: "9px 6px 8px",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const folioPanel: CSSProperties = {
  minHeight: 190,
  padding: "10px 12px 12px",
};

const folioLineHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  padding: "0 0 5px",
  color: "#7A8DA0",
  fontSize: 7,
  fontWeight: 900,
  letterSpacing: 0.4,
};

const folioLine: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 12,
  padding: "7px 0",
  borderBottom: "1px solid #EDF2F6",
  color: "#24445F",
  fontSize: 9,
};

const folioLineMeta: CSSProperties = {
  display: "block",
  marginTop: 2,
  color: "#8091A1",
  fontSize: 7.5,
  fontWeight: 500,
};

const folioTotalLine: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  color: "#0D4F91",
  fontSize: 11,
  borderBottom: "1px solid #DCE7F0",
};

const folioPaymentSection: CSSProperties = {
  marginTop: 8,
};

const folioSubheading: CSSProperties = {
  color: "#536F88",
  fontSize: 7.5,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const folioHelp: CSSProperties = {
  marginTop: 2,
  color: "#8797A5",
  fontSize: 7.5,
};

const folioPaymentLine: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 12,
  padding: "6px 0",
  borderBottom: "1px solid #EDF2F6",
  color: "#294760",
  fontSize: 8.5,
};

const folioClosingBalance: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 8,
  padding: "9px 10px",
  borderRadius: 8,
  background: "#EDF6FE",
  color: "#0D4F91",
  fontSize: 12,
  fontWeight: 900,
};

const emptyFolioState: CSSProperties = {
  marginTop: 8,
  padding: "18px 10px",
  border: "1px dashed #CCDCE8",
  borderRadius: 8,
  background: "#FAFCFE",
  color: "#8293A2",
  textAlign: "center",
  fontSize: 8.5,
};

const panelActionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 7,
};

const greenActionButton: CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: "7px 10px",
  background: "#168257",
  color: "#FFFFFF",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const blueActionButton: CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: "7px 10px",
  background: "#0D5FA8",
  color: "#FFFFFF",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};

const historyRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  padding: "8px 0",
  borderBottom: "1px solid #EAF0F5",
  color: "#294760",
  fontSize: 9,
};

const paymentNote: CSSProperties = {
  marginTop: 3,
  color: "#61788D",
  fontSize: 7.5,
};

const invoiceCard: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  marginTop: 10,
  padding: "12px",
  border: "1px solid #D7E5EF",
  borderRadius: 9,
  background: "#F8FBFD",
};

const invoiceNumberStyle: CSSProperties = {
  display: "block",
  color: "#123F69",
  fontSize: 15,
};

const invoiceAmountBlock: CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 6,
  color: "#173E61",
  fontSize: 14,
};

const statusPill: CSSProperties = {
  display: "inline-block",
  padding: "3px 7px",
  border: "1px solid",
  borderRadius: 20,
  fontSize: 7,
  fontWeight: 900,
};

const documentActionGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 7,
  marginTop: 8,
};

const documentActionCard: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minHeight: 56,
  border: "1px solid #D4E2ED",
  borderRadius: 8,
  padding: "8px",
  background: "#FFFFFF",
  color: "#24445F",
  textAlign: "left",
  cursor: "pointer",
};

const documentIcon: CSSProperties = {
  width: 28,
  height: 28,
  flex: "0 0 28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 7,
  background: "#EAF4FD",
  color: "#0D5FA8",
  fontSize: 11,
  fontWeight: 900,
};

const folioPaymentButton: CSSProperties = {
  width: "calc(100% - 20px)",
  margin: "0 10px 10px",
  border: 0,
  borderRadius: 8,
  padding: "9px 10px",
  background: "#168257",
  color: "#FFFFFF",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};

const greenText: CSSProperties = {
  color: "#168257",
};

const refundText: CSSProperties = {
  color: "#A85B3A",
};
