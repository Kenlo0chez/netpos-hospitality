"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

// =========================================================
// TYPES
// =========================================================

type Property = {
  id: string;
  name: string;
  vat_rate: number | null;
  quotation_terms: string | null;
};

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  company_id?: string | null;
};

type Company = {
  id: string;
  name: string;
};

type RoomType = {
  id: string;
  property_id: string;
  name: string;
  code?: string | null;
};

type RatePlan = Record<string, any>;
type RoomRate = Record<string, any>;

type NightRate = {
  date: string;
  rate: number;
  planName: string;
};

// =========================================================
// PAGE
// =========================================================

export default function NewQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnedGuestId =
    searchParams.get("guestId") ?? "";

  // =========================================================
  // MASTER DATA
  // =========================================================

  const [properties, setProperties] = useState<Property[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [roomRates, setRoomRates] = useState<RoomRate[]>([]);

  // =========================================================
  // FORM
  // =========================================================

  const [propertyId, setPropertyId] = useState("");
  const [guestId, setGuestId] = useState("");
  const [companyId, setCompanyId] = useState("");

  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");

  const [roomTypeId, setRoomTypeId] = useState("");

  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");

  const [validUntil, setValidUntil] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");

  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");

  // =========================================================
  // UI
  // =========================================================

  const [loading, setLoading] = useState(true);
  const [loadingRates, setLoadingRates] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [rateMessage, setRateMessage] = useState("");

  const [nightRates, setNightRates] = useState<NightRate[]>([]);

  const [showMore, setShowMore] = useState(false);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadMasterData();
  }, []);

  async function loadMasterData() {
    setLoading(true);

    try {
      const {
        data: propertyData,
        error: propertyError,
      } = await supabase
        .from("properties")
        .select(`
          id,
          name,
          vat_rate,
          quotation_terms
        `)
        .order("name");

      if (propertyError) {
        throw new Error(
          `Properties: ${propertyError.message}`
        );
      }

      const propertyRows =
        (propertyData as Property[]) ?? [];

      setProperties(propertyRows);

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
          company_id
        `)
        .order("first_name");

      if (guestError) {
        throw new Error(
          `Guests: ${guestError.message}`
        );
      }

      const guestRows =
        (guestData as Guest[]) ?? [];

      setGuests(guestRows);

      const {
        data: companyData,
        error: companyError,
      } = await supabase
        .from("companies")
        .select("id,name")
        .order("name");

      if (companyError) {
        throw new Error(
          `Companies: ${companyError.message}`
        );
      }

      setCompanies(
        (companyData as Company[]) ?? []
      );

      if (propertyRows.length > 0) {
        const firstProperty =
          propertyRows[0];

        setPropertyId(
          firstProperty.id
        );

        setTerms(
          firstProperty.quotation_terms ??
            defaultQuotationTerms()
        );

        await loadPropertyData(
          firstProperty.id
        );
      }

      const today =
        getTodayString();

      setArrivalDate(
        today
      );

      setDepartureDate(
        addDays(
          today,
          1
        )
      );

      setValidUntil(
        addDays(
          today,
          7
        )
      );

      // =====================================================
      // AUTO SELECT NEWLY CREATED GUEST
      // =====================================================

      if (returnedGuestId) {
        const newGuest =
          guestRows.find(
            (guest) =>
              guest.id ===
              returnedGuestId
          );

        if (newGuest) {
          setGuestId(
            newGuest.id
          );

          if (
            newGuest.company_id
          ) {
            setCompanyId(
              newGuest.company_id
            );
          } else {
            setCompanyId("");
          }
        }
      }
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not load quotation setup."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // PROPERTY DATA
  // =========================================================

  async function loadPropertyData(
    selectedPropertyId: string
  ) {
    if (!selectedPropertyId) {
      setRoomTypes([]);
      setRatePlans([]);
      setRoomRates([]);
      return;
    }

    setLoadingRates(true);
    setRateMessage("");

    try {
      const {
        data: roomTypeData,
        error: roomTypeError,
      } = await supabase
        .from("room_types")
        .select(`
          id,
          property_id,
          name,
          code
        `)
        .eq(
          "property_id",
          selectedPropertyId
        )
        .order("name");

      if (roomTypeError) {
        throw new Error(
          `Room Types: ${roomTypeError.message}`
        );
      }

      const loadedRoomTypes =
        (roomTypeData as RoomType[]) ?? [];

      setRoomTypes(
        loadedRoomTypes
      );

      if (
        loadedRoomTypes.length > 0
      ) {
        setRoomTypeId(
          loadedRoomTypes[0].id
        );
      } else {
        setRoomTypeId("");
      }

      const {
        data: ratePlanData,
        error: ratePlanError,
      } = await supabase
        .from("rate_plans")
        .select("*")
        .eq(
          "property_id",
          selectedPropertyId
        );

      if (ratePlanError) {
        throw new Error(
          `Rate Plans: ${ratePlanError.message}`
        );
      }

      setRatePlans(
        (ratePlanData as RatePlan[]) ??
          []
      );

      const {
        data: roomRateData,
        error: roomRateError,
      } = await supabase
        .from("room_rates")
        .select("*")
        .eq(
          "property_id",
          selectedPropertyId
        );

      if (roomRateError) {
        throw new Error(
          `Room Rates: ${roomRateError.message}`
        );
      }

      setRoomRates(
        (roomRateData as RoomRate[]) ??
          []
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not load rates."
      );
    } finally {
      setLoadingRates(false);
    }
  }

  async function changeProperty(
    selectedPropertyId: string
  ) {
    setPropertyId(
      selectedPropertyId
    );

    setNightRates([]);
    setRateMessage("");

    const selectedProperty =
      properties.find(
        (property) =>
          property.id ===
          selectedPropertyId
      );

    setTerms(
      selectedProperty?.quotation_terms ??
        defaultQuotationTerms()
    );

    await loadPropertyData(
      selectedPropertyId
    );
  }

  // =========================================================
  // GUEST
  // =========================================================

  function changeGuest(
    selectedGuestId: string
  ) {
    if (
      selectedGuestId ===
      "__new_guest__"
    ) {
      router.push(
        `/guests?returnTo=${encodeURIComponent(
          "/quotations/new"
        )}`
      );

      return;
    }

    setGuestId(
      selectedGuestId
    );

    const selectedGuest =
      guests.find(
        (guest) =>
          guest.id ===
          selectedGuestId
      );

    if (
      selectedGuest?.company_id
    ) {
      setCompanyId(
        selectedGuest.company_id
      );
    } else {
      setCompanyId("");
    }
  }

  // =========================================================
  // RATE CALCULATION
  // =========================================================

  useEffect(() => {
    if (
      !propertyId ||
      !roomTypeId ||
      !arrivalDate ||
      !departureDate
    ) {
      setNightRates([]);
      return;
    }

    calculateQuotationRate();
  }, [
    propertyId,
    roomTypeId,
    arrivalDate,
    departureDate,
    adults,
    children,
    ratePlans,
    roomRates,
  ]);

  function calculateQuotationRate() {
    setRateMessage("");

    if (
      !arrivalDate ||
      !departureDate
    ) {
      setNightRates([]);
      return;
    }

    const stayNights =
      calculateNights(
        arrivalDate,
        departureDate
      );

    if (
      stayNights <= 0
    ) {
      setNightRates([]);
      setRateMessage(
        "Departure must be after arrival."
      );
      return;
    }

    if (
      !roomTypeId
    ) {
      setNightRates([]);
      return;
    }

    const results:
      NightRate[] = [];

    for (
      let index = 0;
      index < stayNights;
      index++
    ) {
      const date =
        addDays(
          arrivalDate,
          index
        );

      const rateResult =
        findRateForNight(
          date,
          roomTypeId,
          Number(adults || 1),
          Number(children || 0)
        );

      if (
        !rateResult
      ) {
        setNightRates([]);

        setRateMessage(
          `No configured rate was found for ${formatFriendlyDate(
            date
          )}. Please check Rates Setup.`
        );

        return;
      }

      results.push({
        date,
        rate:
          rateResult.rate,
        planName:
          rateResult.planName,
      });
    }

    setNightRates(
      results
    );

    const uniquePlans =
      Array.from(
        new Set(
          results.map(
            (result) =>
              result.planName
          )
        )
      );

    setRateMessage(
      uniquePlans.length === 1
        ? `Rate plan: ${uniquePlans[0]}`
        : `Multiple rate plans apply across this stay.`
    );
  }

  // =========================================================
  // RATE RESOLVER
  // =========================================================

  function findRateForNight(
    date: string,
    selectedRoomTypeId: string,
    adultCount: number,
    childCount: number
  ) {
    const applicablePlans =
      ratePlans
        .filter(
          (plan) =>
            planAppliesToDate(
              plan,
              date
            )
        )
        .sort(
          (
            first,
            second
          ) =>
            getNumber(
              second,
              ["priority"],
              0
            ) -
            getNumber(
              first,
              ["priority"],
              0
            )
        );

    for (
      const plan of
      applicablePlans
    ) {
      const result =
        findRoomRate(
          selectedRoomTypeId,
          plan.id,
          adultCount,
          childCount
        );

      if (result) {
        return {
          rate:
            result.rate,

          planName:
            getText(
              plan,
              [
                "name",
                "description",
                "code",
              ],
              "Rate Plan"
            ),
        };
      }
    }

    const fallback =
      findRoomRate(
        selectedRoomTypeId,
        null,
        adultCount,
        childCount
      );

    if (fallback) {
      return {
        rate:
          fallback.rate,

        planName:
          "Standard Rate",
      };
    }

    return null;
  }

  function findRoomRate(
    selectedRoomTypeId: string,
    ratePlanId: string | null,
    adultCount: number,
    childCount: number
  ) {
    const candidates =
      roomRates.filter(
        (row) => {
          const rowRoomTypeId =
            getText(
              row,
              ["room_type_id"],
              ""
            );

          if (
            rowRoomTypeId !==
            selectedRoomTypeId
          ) {
            return false;
          }

          const rowRatePlanId =
            row.rate_plan_id ??
            null;

          if (
            ratePlanId &&
            rowRatePlanId !==
              ratePlanId
          ) {
            return false;
          }

          if (
            !ratePlanId &&
            rowRatePlanId
          ) {
            return false;
          }

          return true;
        }
      );

    if (
      candidates.length === 0
    ) {
      return null;
    }

    const exactAdult =
      candidates.find(
        (row) => {
          const rowAdults =
            getNullableNumber(
              row,
              [
                "adults",
                "adult_count",
                "occupancy",
                "guest_count",
                "persons",
              ]
            );

          const rowChildren =
            getNullableNumber(
              row,
              [
                "children",
                "child_count",
              ]
            );

          if (
            rowAdults === null
          ) {
            return false;
          }

          if (
            rowAdults !==
            adultCount
          ) {
            return false;
          }

          if (
            rowChildren !== null &&
            rowChildren !==
              childCount
          ) {
            return false;
          }

          return true;
        }
      );

    if (
      exactAdult
    ) {
      const rate =
        extractNightlyRate(
          exactAdult,
          adultCount
        );

      if (
        rate !== null
      ) {
        return {
          rate,
          row:
            exactAdult,
        };
      }
    }

    for (
      const row of
      candidates
    ) {
      const rate =
        extractNightlyRate(
          row,
          adultCount
        );

      if (
        rate !== null
      ) {
        const extraAdult =
          getNumber(
            row,
            [
              "extra_adult_rate",
              "extra_adult",
              "extra_person_rate",
              "extra_person_charge",
            ],
            0
          );

        const extraChild =
          getNumber(
            row,
            [
              "extra_child_rate",
              "extra_child",
              "child_rate",
              "extra_child_charge",
            ],
            0
          );

        let finalRate =
          rate;

        if (
          adultCount > 2 &&
          extraAdult > 0
        ) {
          finalRate +=
            (adultCount - 2) *
            extraAdult;
        }

        if (
          childCount > 0 &&
          extraChild > 0
        ) {
          finalRate +=
            childCount *
            extraChild;
        }

        return {
          rate:
            finalRate,
          row,
        };
      }
    }

    return null;
  }

  function extractNightlyRate(
    row: RoomRate,
    adultCount: number
  ) {
    if (
      adultCount === 1
    ) {
      const single =
        getNullableNumber(
          row,
          [
            "single_rate",
            "single_occupancy_rate",
            "one_adult_rate",
            "rate_1_adult",
            "adult_1_rate",
          ]
        );

      if (
        single !== null &&
        single > 0
      ) {
        return single;
      }
    }

    if (
      adultCount >= 2
    ) {
      const double =
        getNullableNumber(
          row,
          [
            "double_rate",
            "double_occupancy_rate",
            "two_adadult_rate",
            "rate_2_adults",
            "adult_2_rate",
          ]
        );

      if (
        double !== null &&
        double > 0
      ) {
        return double;
      }
    }

    const standard =
      getNullableNumber(
        row,
        [
          "nightly_rate",
          "rate",
          "price",
          "amount",
          "base_rate",
        ]
      );

    if (
      standard !== null &&
      standard > 0
    ) {
      return standard;
    }

    return null;
  }

  function planAppliesToDate(
    plan: RatePlan,
    date: string
  ) {
    if (
      plan.active === false ||
      plan.is_active === false
    ) {
      return false;
    }

    const start =
      getText(
        plan,
        [
          "start_date",
          "valid_from",
          "date_from",
        ],
        ""
      );

    const end =
      getText(
        plan,
        [
          "end_date",
          "valid_to",
          "date_to",
        ],
        ""
      );

    if (
      start &&
      date < start.slice(
        0,
        10
      )
    ) {
      return false;
    }

    if (
      end &&
      date > end.slice(
        0,
        10
      )
    ) {
      return false;
    }

    const days =
      plan.days_of_week ??
      plan.weekdays ??
      plan.days ??
      null;

    if (
      days &&
      Array.isArray(days) &&
      days.length > 0
    ) {
      const dayIndex =
        getDayOfWeek(
          date
        );

      const dayName =
        [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ][dayIndex];

      const shortName =
        dayName.slice(
          0,
          3
        );

      const normalized =
        days.map(
          (day: any) =>
            String(day)
              .toLowerCase()
              .trim()
        );

      const matches =
        normalized.includes(
          String(dayIndex)
        ) ||
        normalized.includes(
          dayName
        ) ||
        normalized.includes(
          shortName
        );

      if (
        !matches
      ) {
        return false;
      }
    }

    return true;
  }

  // =========================================================
  // TOTALS
  // =========================================================

  const nights =
    useMemo(() => {
      if (
        !arrivalDate ||
        !departureDate
      ) {
        return 0;
      }

      return calculateNights(
        arrivalDate,
        departureDate
      );
    }, [
      arrivalDate,
      departureDate,
    ]);

  const accommodationTotal =
    useMemo(() => {
      return nightRates.reduce(
        (
          total,
          night
        ) =>
          total +
          Number(
            night.rate
          ),
        0
      );
    }, [nightRates]);

  const averageNightlyRate =
    nights > 0
      ? accommodationTotal /
        nights
      : 0;

  const discount =
    Math.max(
      0,
      Number(
        discountAmount ||
          0
      )
    );

  const totalAmount =
    Math.max(
      0,
      accommodationTotal -
        discount
    );

  const selectedProperty =
    properties.find(
      (property) =>
        property.id ===
        propertyId
    );

  const vatRate =
    Number(
      selectedProperty?.vat_rate ??
        15
    );

  const vatAmount =
    vatRate > 0
      ? totalAmount *
        (vatRate /
          (100 +
            vatRate))
      : 0;

  const selectedRoomType =
    roomTypes.find(
      (roomType) =>
        roomType.id ===
        roomTypeId
    );

  // =========================================================
  // GENERATE QUOTATION
  // =========================================================

  async function generateQuotation(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (
      !propertyId
    ) {
      alert(
        "Please select a property."
      );

      return;
    }

    if (
      !guestId
    ) {
      alert(
        "Please select a guest."
      );

      return;
    }

    if (
      !arrivalDate ||
      !departureDate
    ) {
      alert(
        "Arrival and departure dates are required."
      );

      return;
    }

    if (
      nights <= 0
    ) {
      alert(
        "Departure date must be after arrival date."
      );

      return;
    }

    if (
      !roomTypeId
    ) {
      alert(
        "Please select a room type."
      );

      return;
    }

    if (
      nightRates.length !==
      nights
    ) {
      alert(
        "A valid rate could not be calculated for the entire stay. Please check Rates Setup."
      );

      return;
    }

    if (
      accommodationTotal <= 0
    ) {
      alert(
        "Quotation amount must be greater than zero."
      );

      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const quoteNumber =
        generateDocumentNumber(
          "QUO"
        );

      const {
        data: createdQuote,
        error: quoteError,
      } = await supabase
        .from("quotations")
        .insert({
          property_id:
            propertyId,

          guest_id:
            guestId,

          company_id:
            companyId ||
            null,

          quote_number:
            quoteNumber,

          status:
            "draft",

          arrival_date:
            arrivalDate,

          departure_date:
            departureDate,

          adults:
            Number(
              adults || 1
            ),

          children:
            Number(
              children || 0
            ),

          valid_until:
            validUntil ||
            null,

          subtotal:
            accommodationTotal,

          discount_amount:
            discount,

          vat_amount:
            vatAmount,

          total_amount:
            totalAmount,

          notes:
            notes.trim() ||
            null,

          terms:
            terms.trim() ||
            null,
        })
        .select("id")
        .single();

      if (
        quoteError
      ) {
        throw new Error(
          quoteError.message
        );
      }

      const description =
        `${
          selectedRoomType?.name ??
          "Accommodation"
        } · ${formatFriendlyDate(
          arrivalDate
        )} - ${formatFriendlyDate(
          departureDate
        )}`;

      const {
        error: itemError,
      } = await supabase
        .from("quotation_items")
        .insert({
          quotation_id:
            createdQuote.id,

          room_type_id:
            roomTypeId,

          description,

          quantity:
            1,

          nights,

          unit_price:
            averageNightlyRate,

          discount_amount:
            discount,

          vat_amount:
            vatAmount,

          line_total:
            totalAmount,
        });

      if (
        itemError
      ) {
        await supabase
          .from("quotations")
          .delete()
          .eq(
            "id",
            createdQuote.id
          );

        throw new Error(
          itemError.message
        );
      }

      setMessage(
        `Quotation ${quoteNumber} generated successfully.`
      );

      router.push(
        `/quotations/${createdQuote.id}`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not generate quotation."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // SCREEN
  // =========================================================

  if (
    loading
  ) {
    return (
      <main style={pageStyle}>
        Loading quotation setup...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={headerRow}>
        <div>
          <button
            type="button"
            onClick={() =>
              router.push(
                "/quotations"
              )
            }
            style={backButton}
          >
            ← Quotations
          </button>

          <div style={eyebrow}>
            NETPOS HOSPITALITY
          </div>

          <h1 style={titleStyle}>
            New Quotation
          </h1>

          <div style={subtitleStyle}>
            Prepare an accommodation quote without reserving a physical room.
          </div>
        </div>

        <div style={headerProperty}>
          <label style={fieldLabel}>
            Property
          </label>

          <select
            value={
              propertyId
            }
            onChange={(event) =>
              changeProperty(
                event.target.value
              )
            }
            style={inputStyle}
          >
            {properties.map(
              (property) => (
                <option
                  key={
                    property.id
                  }
                  value={
                    property.id
                  }
                >
                  {property.name}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {returnedGuestId &&
        guestId === returnedGuestId && (
          <div style={successStyle}>
            ✓ New guest added and selected.
          </div>
        )}

      {message && (
        <div style={successStyle}>
          ✓ {message}
        </div>
      )}

      <form
        onSubmit={
          generateQuotation
        }
      >
        <div style={mainGrid}>
          <div style={leftColumn}>
            <section style={cardStyle}>
              <h2 style={sectionTitle}>
                Guest / Customer
              </h2>

              <div style={twoColumns}>
                <Field label="Guest">
                  <select
                    value={
                      guestId
                    }
                    onChange={(event) =>
                      changeGuest(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    <option value="">
                      Select Guest
                    </option>

                    <option value="__new_guest__">
                      + Add New Guest / Customer
                    </option>

                    {guests.map(
                      (guest) => (
                        <option
                          key={
                            guest.id
                          }
                          value={
                            guest.id
                          }
                        >
                          {guest.first_name}{" "}
                          {guest.last_name}
                          {guest.phone
                            ? ` · ${guest.phone}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field label="Organisation">
                  <select
                    value={
                      companyId
                    }
                    onChange={(event) =>
                      setCompanyId(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    <option value="">
                      Private / Walk-in
                    </option>

                    {companies.map(
                      (company) => (
                        <option
                          key={
                            company.id
                          }
                          value={
                            company.id
                          }
                        >
                          {company.name}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>
            </section>

            <section style={cardStyle}>
              <h2 style={sectionTitle}>
                Stay Details
              </h2>

              <div style={fourColumns}>
                <Field label="Arrival">
                  <input
                    type="date"
                    value={
                      arrivalDate
                    }
                    onChange={(event) =>
                      setArrivalDate(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Departure">
                  <input
                    type="date"
                    value={
                      departureDate
                    }
                    onChange={(event) =>
                      setDepartureDate(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Adults">
                  <select
                    value={
                      adults
                    }
                    onChange={(event) =>
                      setAdults(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    {[1, 2, 3, 4, 5, 6].map(
                      (value) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {value}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field label="Children">
                  <select
                    value={
                      children
                    }
                    onChange={(event) =>
                      setChildren(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    {[0, 1, 2, 3, 4].map(
                      (value) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {value}
                        </option>
                      )
                    )}
                  </select>
                </Field>
              </div>
            </section>

            <section style={cardStyle}>
              <div style={sectionHeader}>
                <div>
                  <h2 style={sectionTitle}>
                    Room Type & Rate
                  </h2>

                  <div style={sectionSubtext}>
                    A quotation does not allocate a physical room.
                  </div>
                </div>

                <div style={nightsBadge}>
                  {nights} Night
                  {nights === 1
                    ? ""
                    : "s"}
                </div>
              </div>

              <div style={rateGrid}>
                <Field label="Room Type">
                  <select
                    value={
                      roomTypeId
                    }
                    onChange={(event) =>
                      setRoomTypeId(
                        event.target.value
                      )
                    }
                    disabled={
                      loadingRates
                    }
                    style={inputStyle}
                  >
                    {roomTypes.length ===
                    0 ? (
                      <option value="">
                        No room types configured
                      </option>
                    ) : (
                      roomTypes.map(
                        (roomType) => (
                          <option
                            key={
                              roomType.id
                            }
                            value={
                              roomType.id
                            }
                          >
                            {roomType.name}
                          </option>
                        )
                      )
                    )}
                  </select>
                </Field>

                <InfoBox
                  label="Average Rate"
                  value={
                    averageNightlyRate > 0
                      ? money(
                          averageNightlyRate
                        )
                      : "-"
                  }
                />

                <InfoBox
                  label="Accommodation"
                  value={
                    accommodationTotal > 0
                      ? money(
                          accommodationTotal
                        )
                      : "-"
                  }
                />
              </div>

              {rateMessage && (
                <div
                  style={
                    nightRates.length ===
                    nights &&
                    nights > 0
                      ? rateSuccess
                      : rateWarning
                  }
                >
                  {rateMessage}
                </div>
              )}

              {nightRates.length > 1 && (
                <div style={nightRatePreview}>
                  {nightRates.map(
                    (night) => (
                      <div
                        key={
                          night.date
                        }
                        style={nightRateRow}
                      >
                        <span>
                          {formatFriendlyDate(
                            night.date
                          )}
                        </span>

                        <span style={nightPlan}>
                          {night.planName}
                        </span>

                        <strong>
                          {money(
                            night.rate
                          )}
                        </strong>
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <button
              type="button"
              onClick={() =>
                setShowMore(
                  (current) =>
                    !current
                )
              }
              style={moreButton}
            >
              More Options{" "}
              {showMore
                ? "▲"
                : "▼"}
            </button>

            {showMore && (
              <section style={cardStyle}>
                <div style={twoColumns}>
                  <Field label="Quotation Valid Until">
                    <input
                      type="date"
                      value={
                        validUntil
                      }
                      onChange={(event) =>
                        setValidUntil(
                          event.target.value
                        )
                      }
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Discount Amount">
                    <div style={moneyInputWrap}>
                      <span style={moneyPrefix}>
                        N$
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          discountAmount
                        }
                        onChange={(event) =>
                          setDiscountAmount(
                            event.target.value
                          )
                        }
                        placeholder="0.00"
                        style={{
                          ...inputStyle,
                          paddingLeft:
                            38,
                        }}
                      />
                    </div>
                  </Field>
                </div>

                <div style={textGrid}>
                  <Field label="Notes">
                    <textarea
                      value={
                        notes
                      }
                      onChange={(event) =>
                        setNotes(
                          event.target.value
                        )
                      }
                      rows={3}
                      placeholder="Optional quotation notes..."
                      style={{
                        ...inputStyle,
                        resize:
                          "vertical",
                      }}
                    />
                  </Field>

                  <Field label="Terms & Conditions">
                    <textarea
                      value={
                        terms
                      }
                      onChange={(event) =>
                        setTerms(
                          event.target.value
                        )
                      }
                      rows={3}
                      style={{
                        ...inputStyle,
                        resize:
                          "vertical",
                      }}
                    />
                  </Field>
                </div>
              </section>
            )}
          </div>

          <div style={rightColumn}>
            <section style={summaryCard}>
              <h2 style={sectionTitle}>
                Quotation Summary
              </h2>

              <SummaryLine
                label="Guest"
                value={
                  guests.find(
                    (guest) =>
                      guest.id ===
                      guestId
                  )
                    ? `${
                        guests.find(
                          (guest) =>
                            guest.id ===
                            guestId
                        )?.first_name
                      } ${
                        guests.find(
                          (guest) =>
                            guest.id ===
                            guestId
                        )?.last_name
                      }`
                    : "-"
                }
              />

              <SummaryLine
                label="Room Type"
                value={
                  selectedRoomType?.name ??
                  "-"
                }
              />

              <SummaryLine
                label="Stay"
                value={
                  nights > 0
                    ? `${nights} night${
                        nights === 1
                          ? ""
                          : "s"
                      }`
                    : "-"
                }
              />

              <SummaryLine
                label="Guests"
                value={`${Number(
                  adults || 1
                )} Adult${
                  Number(
                    adults || 1
                  ) === 1
                    ? ""
                    : "s"
                }${
                  Number(
                    children || 0
                  ) > 0
                    ? ` · ${children} ${
                        Number(
                          children
                        ) === 1
                          ? "Child"
                          : "Children"
                      }`
                    : ""
                }`}
              />

              <div style={summaryDivider} />

              <MoneyLine
                label="Accommodation"
                value={
                  accommodationTotal
                }
              />

              <MoneyLine
                label="Discount"
                value={
                  -discount
                }
              />

              <MoneyLine
                label={`VAT Included (${vatRate}%)`}
                value={
                  vatAmount
                }
                muted
              />

              <div style={totalBox}>
                <span style={totalLabel}>
                  QUOTATION TOTAL
                </span>

                <strong style={totalValue}>
                  {money(
                    totalAmount
                  )}
                </strong>
              </div>

              <button
                type="submit"
                disabled={
                  saving ||
                  loadingRates ||
                  nightRates.length !==
                    nights ||
                  nights <= 0
                }
                style={{
                  ...generateButton,
                  opacity:
                    saving ||
                    loadingRates ||
                    nightRates.length !==
                      nights ||
                    nights <= 0
                      ? 0.55
                      : 1,
                }}
              >
                {saving
                  ? "Generating..."
                  : "Generate Quotation"}
              </button>
            </section>

            <section style={helpCard}>
              <strong>
                Quotation only
              </strong>

              <div style={helpText}>
                This does not reserve or block a physical room. A room is allocated only when the quotation becomes a reservation.
              </div>
            </section>
          </div>
        </div>
      </form>
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
    <div>
      <label style={fieldLabel}>
        {label}
      </label>

      {children}
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={infoBox}>
      <span style={smallLabel}>
        {label}
      </span>

      <strong style={infoValue}>
        {value}
      </strong>
    </div>
  );
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={summaryLine}>
      <span style={summaryLineLabel}>
        {label}
      </span>

      <strong style={summaryLineValue}>
        {value}
      </strong>
    </div>
  );
}

function MoneyLine({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  const amount =
    Number(
      value ?? 0
    );

  return (
    <div style={moneyLine}>
      <span
        style={{
          color:
            muted
              ? "#777"
              : "#333",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color:
            muted
              ? "#777"
              : "#111",
        }}
      >
        {amount < 0
          ? "- "
          : ""}
        N$
        {Math.abs(
          amount
        ).toFixed(2)}
      </strong>
    </div>
  );
}

// =========================================================
// HELPERS
// =========================================================

function getText(
  object: Record<string, any>,
  keys: string[],
  fallback = ""
) {
  for (const key of keys) {
    const value =
      object?.[key];

    if (
      value !== null &&
      value !== undefined &&
      String(
        value
      ).trim() !== ""
    ) {
      return String(
        value
      );
    }
  }

  return fallback;
}

function getNullableNumber(
  object: Record<string, any>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const value =
      object?.[key];

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      continue;
    }

    const number =
      Number(
        value
      );

    if (
      Number.isFinite(
        number
      )
    ) {
      return number;
    }
  }

  return null;
}

function getNumber(
  object: Record<string, any>,
  keys: string[],
  fallback = 0
) {
  const result =
    getNullableNumber(
      object,
      keys
    );

  return result ??
    fallback;
}

function parseDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] =
    value
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
  const date =
    new Date();

  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    date.getDate()
  ).padStart(
    2,
    "0"
  )}`;
}

function addDays(
  value: string,
  days: number
) {
  const date =
    parseDate(
      value
    );

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return `${date.getUTCFullYear()}-${String(
    date.getUTCMonth() + 1
  ).padStart(
    2,
    "0"
  )}-${String(
    date.getUTCDate()
  ).padStart(
    2,
    "0"
  )}`;
}

function calculateNights(
  arrival: string,
  departure: string
) {
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

function getDayOfWeek(
  value: string
) {
  return parseDate(
    value
  ).getUTCDay();
}

function formatFriendlyDate(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-NA",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }
  ).format(
    parseDate(
      value
    )
  );
}

function money(
  value: number
) {
  return `N$${Number(
    value ?? 0
  ).toFixed(2)}`;
}

function generateDocumentNumber(
  prefix: string
) {
  const now =
    new Date();

  const date =
    `${now.getFullYear()}${String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    )}${String(
      now.getDate()
    ).padStart(
      2,
      "0"
    )}`;

  const time =
    `${String(
      now.getHours()
    ).padStart(
      2,
      "0"
    )}${String(
      now.getMinutes()
    ).padStart(
      2,
      "0"
    )}${String(
      now.getSeconds()
    ).padStart(
      2,
      "0"
    )}`;

  const milliseconds =
    String(
      now.getMilliseconds()
    ).padStart(
      3,
      "0"
    );

  return `${prefix}-${date}-${time}${milliseconds}`;
}

function defaultQuotationTerms() {
  return "Quotation is subject to availability and remains valid until the stated validity date. Confirmation is subject to receipt of the required payment or deposit.";
}

// =========================================================
// STYLES
// =========================================================

const pageStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: "0 auto",
  padding: "16px 24px",
  fontFamily:
    "Arial, sans-serif",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 20,
  marginBottom: 12,
};

const headerProperty: React.CSSProperties = {
  width: 280,
};

const backButton: React.CSSProperties = {
  border: 0,
  background: "transparent",
  padding: 0,
  marginBottom: 8,
  fontWeight: 700,
  fontSize: 11,
  cursor: "pointer",
};

const eyebrow: React.CSSProperties = {
  color: "#777",
  fontSize: 9,
  fontWeight: 800,
  marginBottom: 2,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
};

const subtitleStyle: React.CSSProperties = {
  color: "#666",
  fontSize: 11,
  marginTop: 3,
};

const mainGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0,1.7fr) minmax(320px,.72fr)",
  gap: 12,
};

const leftColumn: React.CSSProperties = {
  display: "grid",
  gap: 9,
  alignContent: "start",
};

const rightColumn: React.CSSProperties = {
  display: "grid",
  gap: 9,
  alignContent: "start",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 10,
  background: "white",
  padding: 13,
};

const summaryCard: React.CSSProperties = {
  ...cardStyle,
  padding: 15,
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 9px 0",
  fontSize: 15,
};

const sectionSubtext: React.CSSProperties = {
  color: "#777",
  fontSize: 10,
  marginTop: -5,
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
  marginBottom: 8,
};

const twoColumns: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 11,
};

const fourColumns: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.2fr 1.2fr .65fr .65fr",
  gap: 10,
};

const rateGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.4fr .8fr .8fr",
  gap: 10,
  alignItems: "end",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 10,
  fontWeight: 700,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #ccc",
  borderRadius: 7,
  padding: "9px 10px",
  background: "white",
  fontSize: 12,
};

const infoBox: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 7,
  background: "#f6f6f6",
  padding: "8px 10px",
};

const infoValue: React.CSSProperties = {
  fontSize: 15,
};

const smallLabel: React.CSSProperties = {
  display: "block",
  color: "#777",
  textTransform: "uppercase",
  fontSize: 8,
  fontWeight: 800,
  marginBottom: 3,
};

const nightsBadge: React.CSSProperties = {
  border: "1px solid #ccc",
  borderRadius: 20,
  padding: "5px 9px",
  fontSize: 10,
  fontWeight: 800,
  background: "#f6f6f6",
};

const rateSuccess: React.CSSProperties = {
  marginTop: 8,
  padding: "7px 9px",
  borderRadius: 7,
  background: "#eaf7ee",
  border: "1px solid #9ad5a8",
  color: "#176b2c",
  fontSize: 10,
  fontWeight: 700,
};

const rateWarning: React.CSSProperties = {
  marginTop: 8,
  padding: "7px 9px",
  borderRadius: 7,
  background: "#fff6df",
  border: "1px solid #e5c875",
  color: "#795900",
  fontSize: 10,
  fontWeight: 700,
};

const nightRatePreview: React.CSSProperties = {
  marginTop: 8,
  borderTop: "1px solid #eee",
};

const nightRateRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr .6fr",
  alignItems: "center",
  gap: 10,
  padding: "5px 3px",
  borderBottom: "1px solid #eee",
  fontSize: 9,
};

const nightPlan: React.CSSProperties = {
  color: "#777",
};

const moreButton: React.CSSProperties = {
  width: "100%",
  border: "1px solid #ddd",
  borderRadius: 8,
  background: "white",
  padding: 8,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const textGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 11,
  marginTop: 11,
};

const moneyInputWrap: React.CSSProperties = {
  position: "relative",
};

const moneyPrefix: React.CSSProperties = {
  position: "absolute",
  left: 10,
  top: 10,
  color: "#666",
  fontSize: 11,
};

const summaryLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
  padding: "4px 0",
};

const summaryLineLabel: React.CSSProperties = {
  color: "#777",
  fontSize: 10,
};

const summaryLineValue: React.CSSProperties = {
  fontSize: 10,
  textAlign: "right",
};

const summaryDivider: React.CSSProperties = {
  height: 1,
  background: "#ddd",
  margin: "9px 0",
};

const moneyLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
  padding: "5px 0",
  fontSize: 11,
};

const totalBox: React.CSSProperties = {
  marginTop: 10,
  padding: "12px 10px",
  borderTop: "2px solid #111",
  borderBottom: "2px solid #111",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 15,
};

const totalLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
};

const totalValue: React.CSSProperties = {
  fontSize: 23,
};

const generateButton: React.CSSProperties = {
  width: "100%",
  border: 0,
  borderRadius: 8,
  marginTop: 12,
  padding: 11,
  background: "#111",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const helpCard: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 9,
  padding: 11,
  background: "#f7f7f7",
  fontSize: 10,
};

const helpText: React.CSSProperties = {
  color: "#666",
  lineHeight: 1.5,
  marginTop: 4,
};

const successStyle: React.CSSProperties = {
  background: "#eaf7ee",
  border: "1px solid #9ad5a8",
  color: "#176b2c",
  borderRadius: 8,
  padding: "8px 10px",
  marginBottom: 9,
  fontSize: 10,
  fontWeight: 700,
};