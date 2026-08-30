"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";

type Property = {
  id: string;
  name: string;
  code: string;
  town: string | null;
  phone: string | null;
  email: string | null;
  vat_number: string | null;
  vat_rate: number | null;

  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch_code: string | null;
  bank_account_type: string | null;
  bank_swift_code: string | null;

  payment_reference_instruction: string | null;
  invoice_terms: string | null;
};

export default function PropertiesPage() {
  const [properties, setProperties] =
    useState<Property[]>([]);

  const [selectedId, setSelectedId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  // PROPERTY DETAILS
  const [name, setName] =
    useState("");

  const [code, setCode] =
    useState("");

  const [town, setTown] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [vatNumber, setVatNumber] =
    useState("");

  const [vatRate, setVatRate] =
    useState("15");

  // BANKING
  const [bankName, setBankName] =
    useState("");

  const [
    bankAccountName,
    setBankAccountName,
  ] = useState("");

  const [
    bankAccountNumber,
    setBankAccountNumber,
  ] = useState("");

  const [
    bankBranchCode,
    setBankBranchCode,
  ] = useState("");

  const [
    bankAccountType,
    setBankAccountType,
  ] = useState("");

  const [
    bankSwiftCode,
    setBankSwiftCode,
  ] = useState("");

  // INVOICE SETTINGS
  const [
    paymentReferenceInstruction,
    setPaymentReferenceInstruction,
  ] = useState(
    "Please use the invoice number as payment reference."
  );

  const [
    invoiceTerms,
    setInvoiceTerms,
  ] = useState(
    "Payment is due as indicated on the invoice. Please retain proof of payment for your records."
  );

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties() {
    setLoading(true);

    const { data, error } =
      await supabase
        .from("properties")
        .select(`
          id,
          name,
          code,
          town,
          phone,
          email,
          vat_number,
          vat_rate,
          bank_name,
          bank_account_name,
          bank_account_number,
          bank_branch_code,
          bank_account_type,
          bank_swift_code,
          payment_reference_instruction,
          invoice_terms
        `)
        .order("name");

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    const rows =
      (data as Property[]) ?? [];

    setProperties(rows);

    if (rows.length > 0) {
      setSelectedId(
        rows[0].id
      );

      loadPropertyIntoForm(
        rows[0]
      );
    }
  }

  function loadPropertyIntoForm(
    property: Property
  ) {
    setName(
      property.name ?? ""
    );

    setCode(
      property.code ?? ""
    );

    setTown(
      property.town ?? ""
    );

    setPhone(
      property.phone ?? ""
    );

    setEmail(
      property.email ?? ""
    );

    setVatNumber(
      property.vat_number ?? ""
    );

    setVatRate(
      String(
        property.vat_rate ?? 15
      )
    );

    setBankName(
      property.bank_name ?? ""
    );

    setBankAccountName(
      property.bank_account_name ??
        ""
    );

    setBankAccountNumber(
      property.bank_account_number ??
        ""
    );

    setBankBranchCode(
      property.bank_branch_code ??
        ""
    );

    setBankAccountType(
      property.bank_account_type ??
        ""
    );

    setBankSwiftCode(
      property.bank_swift_code ??
        ""
    );

    setPaymentReferenceInstruction(
      property.payment_reference_instruction ??
        "Please use the invoice number as payment reference."
    );

    setInvoiceTerms(
      property.invoice_terms ??
        "Payment is due as indicated on the invoice. Please retain proof of payment for your records."
    );
  }

  function changeProperty(
    id: string
  ) {
    setSelectedId(id);
    setMessage("");

    const selected =
      properties.find(
        (property) =>
          property.id === id
      );

    if (selected) {
      loadPropertyIntoForm(
        selected
      );
    }
  }

  async function saveProperty(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!selectedId) {
      alert(
        "Please select a property."
      );
      return;
    }

    if (!name.trim()) {
      alert(
        "Property name is required."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } =
      await supabase
        .from("properties")
        .update({
          name:
            name.trim(),

          code:
            code.trim(),

          town:
            town.trim() ||
            null,

          phone:
            phone.trim() ||
            null,

          email:
            email.trim() ||
            null,

          vat_number:
            vatNumber.trim() ||
            null,

          vat_rate:
            Number(
              vatRate || 0
            ),

          bank_name:
            bankName.trim() ||
            null,

          bank_account_name:
            bankAccountName.trim() ||
            null,

          bank_account_number:
            bankAccountNumber.trim() ||
            null,

          bank_branch_code:
            bankBranchCode.trim() ||
            null,

          bank_account_type:
            bankAccountType.trim() ||
            null,

          bank_swift_code:
            bankSwiftCode.trim() ||
            null,

          payment_reference_instruction:
            paymentReferenceInstruction.trim() ||
            null,

          invoice_terms:
            invoiceTerms.trim() ||
            null,
        })
        .eq(
          "id",
          selectedId
        );

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setMessage(
      "Property setup saved successfully."
    );

    await loadProperties();
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        Loading property setup...
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      {/* HEADER */}

      <div style={headerRow}>
        <div>
          <div style={eyebrow}>
            NETPOS HOSPITALITY
          </div>

          <h1 style={titleStyle}>
            Property Setup
          </h1>

          <div style={subtitleStyle}>
            Property, invoice and banking setup.
          </div>
        </div>

        <div style={propertySelector}>
          <label style={labelStyle}>
            Property
          </label>

          <select
            value={selectedId}
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

      {message && (
        <div style={successStyle}>
          ✓ {message}
        </div>
      )}

      <form
        onSubmit={saveProperty}
      >
        <div style={pageGrid}>

          {/* ================================================
              LEFT COLUMN
          ================================================ */}

          <div style={columnStyle}>

            {/* PROPERTY DETAILS */}

            <section style={cardStyle}>
              <h2 style={sectionTitle}>
                Property Details
              </h2>

              <div style={twoColumns}>
                <Field label="Property Name">
                  <input
                    value={name}
                    onChange={(event) =>
                      setName(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Property Code">
                  <input
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Town">
                  <input
                    value={town}
                    onChange={(event) =>
                      setTown(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Telephone">
                  <input
                    value={phone}
                    onChange={(event) =>
                      setPhone(
                        event.target.value
                      )
                    }
                    placeholder="+264..."
                    style={inputStyle}
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="VAT Number">
                  <input
                    value={
                      vatNumber
                    }
                    onChange={(event) =>
                      setVatNumber(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="VAT Rate %">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={vatRate}
                    onChange={(event) =>
                      setVatRate(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>
              </div>
            </section>

            {/* INVOICE SETTINGS */}

            <section style={cardStyle}>
              <h2 style={sectionTitle}>
                Invoice Settings
              </h2>

              <Field label="Payment Reference Instruction">

                <input
                  value={
                    paymentReferenceInstruction
                  }
                  onChange={(event) =>
                    setPaymentReferenceInstruction(
                      event.target.value
                    )
                  }
                  placeholder="Use invoice number as reference."
                  style={inputStyle}
                />

              </Field>

              <div
                style={{
                  height: 9,
                }}
              />

              <Field label="Terms & Conditions">

                <textarea
                  value={
                    invoiceTerms
                  }
                  onChange={(event) =>
                    setInvoiceTerms(
                      event.target.value
                    )
                  }
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: "none",
                  }}
                />

              </Field>
            </section>

          </div>

          {/* ================================================
              RIGHT COLUMN
          ================================================ */}

          <div style={columnStyle}>

            {/* BANKING DETAILS */}

            <section style={cardStyle}>
              <h2 style={sectionTitle}>
                Banking Details
              </h2>

              <div style={twoColumns}>
                <Field label="Bank Name">
                  <input
                    value={
                      bankName
                    }
                    onChange={(event) =>
                      setBankName(
                        event.target.value
                      )
                    }
                    placeholder="FNB Namibia"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Account Name">
                  <input
                    value={
                      bankAccountName
                    }
                    onChange={(event) =>
                      setBankAccountName(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Account Number">
                  <input
                    value={
                      bankAccountNumber
                    }
                    onChange={(event) =>
                      setBankAccountNumber(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Branch Code">
                  <input
                    value={
                      bankBranchCode
                    }
                    onChange={(event) =>
                      setBankBranchCode(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  />
                </Field>

                <Field label="Account Type">

                  <select
                    value={
                      bankAccountType
                    }
                    onChange={(event) =>
                      setBankAccountType(
                        event.target.value
                      )
                    }
                    style={inputStyle}
                  >
                    <option value="">
                      Select
                    </option>

                    <option value="Current">
                      Current
                    </option>

                    <option value="Cheque">
                      Cheque
                    </option>

                    <option value="Savings">
                      Savings
                    </option>

                    <option value="Business">
                      Business
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>

                </Field>

                <Field label="SWIFT / BIC">
                  <input
                    value={
                      bankSwiftCode
                    }
                    onChange={(event) =>
                      setBankSwiftCode(
                        event.target.value
                      )
                    }
                    placeholder="Optional"
                    style={inputStyle}
                  />
                </Field>
              </div>
            </section>

            {/* INVOICE PREVIEW INFO */}

            <section style={cardStyle}>
              <h2 style={sectionTitle}>
                Invoice Preview Info
              </h2>

              <div style={previewBox}>

                <div>
                  <span style={smallLabel}>
                    Property
                  </span>

                  <strong>
                    {name || "-"}
                  </strong>
                </div>

                <div>
                  <span style={smallLabel}>
                    Telephone
                  </span>

                  <strong>
                    {phone || "-"}
                  </strong>
                </div>

                <div>
                  <span style={smallLabel}>
                    VAT Number
                  </span>

                  <strong>
                    {vatNumber || "-"}
                  </strong>
                </div>

                <div>
                  <span style={smallLabel}>
                    Bank
                  </span>

                  <strong>
                    {bankName || "-"}
                  </strong>
                </div>

              </div>

              <div style={previewNote}>
                These details will print automatically on invoices.
              </div>
            </section>

          </div>

        </div>

        {/* SAVE BAR */}

        <div style={saveBar}>
          <div style={saveHint}>
            Changes apply to invoices and receipts for this property.
          </div>

          <button
            type="submit"
            disabled={saving}
            style={saveButton}
          >
            {saving
              ? "Saving..."
              : "Save Property Setup"}
          </button>
        </div>

      </form>
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
    <div>
      <label style={labelStyle}>
        {label}
      </label>

      {children}
    </div>
  );
}

// =========================================================
// STYLES
// =========================================================

const pageStyle: React.CSSProperties = {
  maxWidth: 1220,
  margin: "0 auto",
  padding: "16px 24px",
  fontFamily: "Arial, sans-serif",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 20,
  marginBottom: 12,
};

const propertySelector: React.CSSProperties = {
  width: 280,
};

const eyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "#777",
  marginBottom: 3,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
};

const subtitleStyle: React.CSSProperties = {
  color: "#666",
  fontSize: 12,
  marginTop: 4,
};

const pageGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
};

const columnStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 14,
  background: "white",
};

const sectionTitle: React.CSSProperties = {
  margin: "0 0 10px 0",
  fontSize: 16,
};

const twoColumns: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "9px 12px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  border: "1px solid #ccc",
  borderRadius: 7,
  fontSize: 13,
  background: "white",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  marginBottom: 4,
};

const previewBox: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  background: "#f6f6f6",
  padding: 12,
  borderRadius: 8,
};

const smallLabel: React.CSSProperties = {
  display: "block",
  color: "#777",
  fontSize: 9,
  textTransform: "uppercase",
  fontWeight: 700,
  marginBottom: 2,
};

const previewNote: React.CSSProperties = {
  fontSize: 11,
  color: "#777",
  marginTop: 9,
};

const saveBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  marginTop: 10,
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#fafafa",
};

const saveHint: React.CSSProperties = {
  color: "#666",
  fontSize: 11,
};

const saveButton: React.CSSProperties = {
  border: 0,
  background: "#111",
  color: "white",
  padding: "10px 18px",
  borderRadius: 7,
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const successStyle: React.CSSProperties = {
  background: "#eaf7ee",
  border: "1px solid #9ad5a8",
  color: "#176b2c",
  padding: "8px 11px",
  borderRadius: 8,
  marginBottom: 10,
  fontSize: 12,
  fontWeight: 700,
};