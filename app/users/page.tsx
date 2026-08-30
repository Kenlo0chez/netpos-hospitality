"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";

// =========================================================
// TYPES
// =========================================================

type Role =
  | "owner"
  | "manager"
  | "reception"
  | "housekeeping";

type Property = {
  id: string;
  name: string;
};

type StaffUser = {
  id: string;
  property_id: string | null;
  full_name: string;
  email: string | null;
  login_id: string | null;
  auth_user_id: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RolePermissions = {
  id: string;
  property_id: string;
  role: Role;

  view_reports: boolean;
  record_payments: boolean;
  process_refunds: boolean;
  cancel_reservations: boolean;
  override_rates: boolean;
  run_end_of_day: boolean;
  manage_housekeeping: boolean;
  edit_setup: boolean;
  manage_users: boolean;

  created_at: string;
  updated_at: string;
};

type PermissionKey =
  | "view_reports"
  | "record_payments"
  | "process_refunds"
  | "cancel_reservations"
  | "override_rates"
  | "run_end_of_day"
  | "manage_housekeeping"
  | "edit_setup"
  | "manage_users";

// =========================================================
// CONSTANTS
// =========================================================

const ROLES: {
  role: Role;
  title: string;
  description: string;
}[] = [
  {
    role: "owner",
    title: "Owner / Admin",
    description:
      "Full access to every property, management, reports, financials, setup and users.",
  },
  {
    role: "manager",
    title: "Manager",
    description:
      "Full access, but only inside the manager's assigned property.",
  },
  {
    role: "reception",
    title: "Reception",
    description:
      "Front desk, payments, cancellations and End of Day. No reports or setup.",
  },
  {
    role: "housekeeping",
    title: "Housekeeping",
    description:
      "Housekeeping status changes only. No other system functions.",
  },
];

const PERMISSIONS: {
  key: PermissionKey;
  label: string;
  description: string;
}[] = [
  {
    key: "view_reports",
    label: "View Management Reports",
    description:
      "Access revenue, occupancy, guest counts and room performance reports.",
  },
  {
    key: "record_payments",
    label: "Record Payments",
    description:
      "Record Cash, Card, EFT and Account payments.",
  },
  {
    key: "process_refunds",
    label: "Process Refunds",
    description:
      "Record refunds against guest reservations.",
  },
  {
    key: "cancel_reservations",
    label: "Cancel Reservations",
    description:
      "Cancel provisional or confirmed reservations.",
  },
  {
    key: "override_rates",
    label: "Change Rates / Discounts",
    description:
      "Override room pricing or apply authorised discounts.",
  },
  {
    key: "run_end_of_day",
    label: "Run End of Day",
    description:
      "Print X Report and process End of Day.",
  },
  {
    key: "manage_housekeeping",
    label: "Manage Housekeeping",
    description:
      "Change room status between Dirty, Cleaning and Clean.",
  },
  {
    key: "edit_setup",
    label: "Edit Property / Room / Rate Setup",
    description:
      "Add or change properties, rooms, room types and rates.",
  },
  {
    key: "manage_users",
    label: "Manage Users",
    description:
      "Add staff, change roles and manage access permissions.",
  },
];

// =========================================================
// PAGE
// =========================================================

export default function UsersPermissionsPage() {
  const router = useRouter();

  const [properties, setProperties] =
    useState<Property[]>([]);

  const [propertyId, setPropertyId] =
    useState("");

  const [users, setUsers] =
    useState<StaffUser[]>([]);

  const [rolePermissions, setRolePermissions] =
    useState<RolePermissions[]>([]);

  const [selectedRole, setSelectedRole] =
    useState<Role>("owner");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [showUserModal, setShowUserModal] =
    useState(false);

  const [editingUser, setEditingUser] =
    useState<StaffUser | null>(null);

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [loginId, setLoginId] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [userRole, setUserRole] =
    useState<Role>("reception");

  const [isActive, setIsActive] =
    useState(true);

  const [assignedPropertyId, setAssignedPropertyId] =
    useState("");

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    initialise();
  }, []);

  async function initialise() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data,
        error,
      } = await supabase
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
        await loadAccessControl(
          firstPropertyId
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load Users & Permissions."
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

    await loadAccessControl(value);
  }

  // =========================================================
  // LOAD
  // =========================================================

  async function loadAccessControl(
    selectedPropertyId: string
  ) {
    if (!selectedPropertyId) {
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const [
        usersResult,
        permissionsResult,
      ] = await Promise.all([
        supabase
          .from("staff_users")
          .select(`
            id,
            property_id,
            full_name,
            email,
            login_id,
            auth_user_id,
            role,
            is_active,
            created_at,
            updated_at
          `)
          .or(
            `property_id.eq.${selectedPropertyId},role.eq.owner`
          )
          .order("full_name"),

        supabase
          .from("role_permissions")
          .select(`
            id,
            property_id,
            role,
            view_reports,
            record_payments,
            process_refunds,
            cancel_reservations,
            override_rates,
            run_end_of_day,
            manage_housekeeping,
            edit_setup,
            manage_users,
            created_at,
            updated_at
          `)
          .eq(
            "property_id",
            selectedPropertyId
          )
          .order("role"),
      ]);

      if (usersResult.error) {
        throw new Error(
          `Users: ${usersResult.error.message}`
        );
      }

      if (permissionsResult.error) {
        throw new Error(
          `Permissions: ${permissionsResult.error.message}`
        );
      }

      setUsers(
        (usersResult.data as StaffUser[]) ??
          []
      );

      setRolePermissions(
        (permissionsResult.data as RolePermissions[]) ??
          []
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not load access control."
      );
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // ROLE SUMMARY
  // =========================================================

  const roleCounts = useMemo(() => {
    const counts: Record<Role, number> = {
      owner: 0,
      manager: 0,
      reception: 0,
      housekeeping: 0,
    };

    for (const user of users) {
      if (user.is_active) {
        counts[user.role] += 1;
      }
    }

    return counts;
  }, [users]);

  const activeUsers =
    users.filter(
      (user) => user.is_active
    ).length;

  const inactiveUsers =
    users.length - activeUsers;

  const selectedPermissions =
    selectedRole === "owner"
      ? ({
          id: "owner-global",
          property_id: propertyId,
          role: "owner",
          view_reports: true,
          record_payments: true,
          process_refunds: true,
          cancel_reservations: true,
          override_rates: true,
          run_end_of_day: true,
          manage_housekeeping: true,
          edit_setup: true,
          manage_users: true,
          created_at: "",
          updated_at: "",
        } as RolePermissions)
      : rolePermissions.find(
          (item) =>
            item.role === selectedRole
        ) ?? null;

  // =========================================================
  // USER MODAL
  // =========================================================

  function openNewUser() {
    setEditingUser(null);
    setFullName("");
    setEmail("");
    setLoginId("");
    setPassword("");
    setUserRole("reception");
    setIsActive(true);
    setAssignedPropertyId(propertyId);
    setShowUserModal(true);
  }

  function openEditUser(
    user: StaffUser
  ) {
    setEditingUser(user);
    setFullName(user.full_name);
    setEmail(user.email ?? "");
    setLoginId(user.login_id ?? "");
    setPassword("");
    setUserRole(user.role);
    setIsActive(user.is_active);
    setAssignedPropertyId(
      user.property_id ?? propertyId
    );
    setShowUserModal(true);
  }

  async function saveUser(
    event: FormEvent
  ) {
    event.preventDefault();

    if (!propertyId) {
      return;
    }

    if (!fullName.trim()) {
      alert(
        "Enter the staff member's name."
      );
      return;
    }

    if (!loginId.trim()) {
      alert(
        "Enter a User ID."
      );
      return;
    }

    if (
      !editingUser &&
      password.length < 6
    ) {
      alert(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (
      userRole !== "owner" &&
      !assignedPropertyId
    ) {
      alert(
        "Select the property this staff member is assigned to."
      );
      return;
    }

    setSaving(true);

    try {
      if (editingUser) {
        const {
          error,
        } = await supabase
          .from("staff_users")
          .update({
            property_id:
              userRole === "owner"
                ? null
                : assignedPropertyId,
            full_name:
              fullName.trim(),
            email:
              email.trim() || null,
            role: userRole,
            is_active: isActive,
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", editingUser.id);

        if (error) {
          throw new Error(
            error.message
          );
        }

        setMessage(
          `${fullName.trim()} updated successfully.`
        );
      } else {
        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(
            sessionError.message
          );
        }

        const accessToken =
          sessionData.session?.access_token;

        if (!accessToken) {
          throw new Error(
            "Your login session has expired. Please log in again."
          );
        }

        const response = await fetch(
          "/api/staff/create",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              full_name:
                fullName.trim(),
              email:
                email.trim(),
              login_id:
                loginId.trim(),
              password,
              role: userRole,
              property_id:
                userRole === "owner"
                  ? null
                  : assignedPropertyId,
              is_active: isActive,
            }),
          }
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ??
              "Could not create user."
          );
        }

        setMessage(
          `${fullName.trim()} added successfully. User ID: ${loginId.trim()}`
        );
      }

      setShowUserModal(false);

      await loadAccessControl(
        propertyId
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not save staff user."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // PERMISSIONS
  // =========================================================

  async function togglePermission(
    key: PermissionKey
  ) {
    if (!selectedPermissions) {
      return;
    }

    if (selectedRole === "owner") {
      return;
    }

    const newValue =
      !selectedPermissions[key];

    const previous =
      rolePermissions;

    setRolePermissions(
      rolePermissions.map(
        (item) =>
          item.id ===
          selectedPermissions.id
            ? {
                ...item,
                [key]:
                  newValue,
              }
            : item
      )
    );

    const {
      error,
    } = await supabase
      .from("role_permissions")
      .update({
        [key]: newValue,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        selectedPermissions.id
      );

    if (error) {
      setRolePermissions(
        previous
      );

      alert(
        error.message
      );

      return;
    }

    setMessage(
      `${roleTitle(
        selectedRole
      )} permissions updated.`
    );
  }

  // =========================================================
  // SCREEN
  // =========================================================

  return (
    <main style={pageStyle}>
      {/* HEADER */}

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

      {/* TITLE */}

      <section style={pageHeading}>
        <div>
          <h1 style={pageTitle}>
            Users & Permissions
          </h1>

          <div style={pageSubtitle}>
            Control staff roles and what each role is allowed to do.
          </div>
        </div>

        <button
          type="button"
          onClick={openNewUser}
          style={addUserButton}
        >
          + Add Staff User
        </button>
      </section>

      <section style={roleRuleStrip}>
        <div style={roleRuleItem}>
          <strong>OWNER / ADMIN</strong>
          <span>Full access Â· All properties</span>
        </div>

        <div style={roleRuleItem}>
          <strong>MANAGER</strong>
          <span>Full access Â· Assigned property only</span>
        </div>

        <div style={roleRuleItem}>
          <strong>RECEPTION</strong>
          <span>Front desk + payments + End of Day Â· No reports/setup</span>
        </div>

        <div style={roleRuleItem}>
          <strong>HOUSEKEEPING</strong>
          <span>Room status changes only</span>
        </div>
      </section>

      {errorMessage && (
        <div style={errorBox}>
          {errorMessage}
        </div>
      )}

      {message && (
        <div style={successBox}>
          âœ“ {message}
        </div>
      )}

      {/* SUMMARY */}

      <section style={summaryGrid}>
        <SummaryCard
          label="Active Staff"
          value={String(
            activeUsers
          )}
          tone="green"
        />

        <SummaryCard
          label="Owners / Admin"
          value={String(
            roleCounts.owner
          )}
          tone="blue"
        />

        <SummaryCard
          label="Managers"
          value={String(
            roleCounts.manager
          )}
          tone="blue"
        />

        <SummaryCard
          label="Reception"
          value={String(
            roleCounts.reception
          )}
          tone="blue"
        />

        <SummaryCard
          label="Housekeeping"
          value={String(
            roleCounts.housekeeping
          )}
          tone="blue"
        />

        <SummaryCard
          label="Inactive"
          value={String(
            inactiveUsers
          )}
          tone="neutral"
        />
      </section>

      {/* MAIN */}

      <section style={mainGrid}>
        {/* STAFF */}

        <div style={usersCard}>
          <div style={cardHeader}>
            <div>
              <h2 style={cardTitle}>
                Staff Users
              </h2>

              <div style={cardSubtitle}>
                Click a staff member to edit their role or status.
              </div>
            </div>

            <span style={recordCount}>
              {users.length} user
              {users.length === 1
                ? ""
                : "s"}
            </span>
          </div>

          <div style={userTableHeader}>
            <div>Name</div>
            <div>Role / Scope</div>
            <div>Status</div>
            <div />
          </div>

          <div style={userScroll}>
            {loading ? (
              <div style={emptyState}>
                Loading users...
              </div>
            ) : users.length ===
              0 ? (
              <div style={emptyState}>
                No staff users yet. Add the first owner or receptionist.
              </div>
            ) : (
              users.map(
                (user) => (
                  <button
                    type="button"
                    key={user.id}
                    onClick={() =>
                      openEditUser(
                        user
                      )
                    }
                    style={userRow}
                  >
                    <div>
                      <strong style={userName}>
                        {user.full_name}
                      </strong>

                      <div style={userEmail}>
                        User ID: {user.login_id ?? "Not linked"}
                      </div>

                      <div style={userEmail}>
                        {user.email ?? "No contact email"}
                      </div>
                    </div>

                    <div>
                      <RoleBadge
                        role={user.role}
                      />

                      <div style={scopeText}>
                        {user.role === "owner"
                          ? "All Properties"
                          : properties.find(
                              (property) =>
                                property.id ===
                                user.property_id
                            )?.name ?? "Assigned Property"}
                      </div>
                    </div>

                    <StatusBadge
                      active={
                        user.is_active
                      }
                    />

                    <span style={editText}>
                      Edit â†’
                    </span>
                  </button>
                )
              )
            )}
          </div>
        </div>

        {/* PERMISSIONS */}

        <div style={permissionsCard}>
          <div style={cardHeader}>
            <div>
              <h2 style={cardTitle}>
                Role Permissions
              </h2>

              <div style={cardSubtitle}>
                Changes affect everyone assigned to that role.
              </div>
            </div>
          </div>

          <div style={roleTabs}>
            {ROLES.map(
              (role) => (
                <button
                  type="button"
                  key={role.role}
                  onClick={() =>
                    setSelectedRole(
                      role.role
                    )
                  }
                  style={
                    selectedRole ===
                    role.role
                      ? activeRoleTab
                      : roleTab
                  }
                >
                  {role.title}
                </button>
              )
            )}
          </div>

          <div style={roleDescription}>
            <strong>
              {roleTitle(
                selectedRole
              )}
            </strong>

            <span>
              {
                ROLES.find(
                  (role) =>
                    role.role ===
                    selectedRole
                )?.description
              }
            </span>
          </div>

          <div style={permissionScroll}>
            {!selectedPermissions ? (
              <div style={emptyState}>
                No permissions were found for this role. Run the Users & Permissions SQL migration first.
              </div>
            ) : (
              PERMISSIONS.map(
                (permission) => {
                  const enabled =
                    Boolean(
                      selectedPermissions[
                        permission.key
                      ]
                    );

                  return (
                    <button
                      type="button"
                      key={
                        permission.key
                      }
                      onClick={() =>
                        togglePermission(
                          permission.key
                        )
                      }
                      disabled={
                        selectedRole === "owner"
                      }
                      style={{
                        ...permissionRow,
                        cursor:
                          selectedRole === "owner"
                            ? "default"
                            : "pointer",
                      }}
                    >
                      <div>
                        <strong style={permissionTitle}>
                          {permission.label}
                        </strong>

                        <div style={permissionDescription}>
                          {
                            permission.description
                          }
                        </div>
                      </div>

                      <Toggle
                        enabled={
                          enabled
                        }
                      />
                    </button>
                  );
                }
              )
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}

      <footer style={footerStyle}>
        <div>
          <strong style={footerTitle}>
            Access Control
          </strong>

          <div style={footerText}>
            Owners keep full control while staff see only the functions needed for their job.
          </div>
        </div>

        <div style={footerActions}>
          <button
            type="button"
            onClick={() =>
              router.push(
                "/reports"
              )
            }
            style={footerButton}
          >
            Reports
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/front-desk"
              )
            }
            style={footerPrimaryButton}
          >
            Finish
          </button>
        </div>
      </footer>

      {/* USER MODAL */}

      {showUserModal && (
        <div style={modalOverlay}>
          <form
            onSubmit={saveUser}
            style={modalCard}
          >
            <div style={modalHeader}>
              <div>
                <div style={modalEyebrow}>
                  STAFF ACCESS
                </div>

                <h2 style={modalTitle}>
                  {editingUser
                    ? "Edit Staff User"
                    : "Add Staff User"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowUserModal(
                    false
                  )
                }
                style={modalClose}
              >
                Ã—
              </button>
            </div>

            <label style={fieldLabel}>
              Full Name
            </label>

            <input
              autoFocus
              value={fullName}
              onChange={(event) =>
                setFullName(
                  event.target.value
                )
              }
              placeholder="e.g. Anna Amutenya"
              style={inputStyle}
            />

            <label style={fieldLabel}>
              User ID
            </label>

            <input
              value={loginId}
              onChange={(event) =>
                setLoginId(
                  event.target.value
                )
              }
              disabled={Boolean(editingUser)}
              placeholder="e.g. JAKE"
              style={{
                ...inputStyle,
                background:
                  editingUser
                    ? "#F1F4F7"
                    : "#fff",
              }}
            />

            {!editingUser && (
              <>
                <label style={fieldLabel}>
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  placeholder="Minimum 6 characters"
                  style={inputStyle}
                />
              </>
            )}

            <label style={fieldLabel}>
              Contact Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(
                  event.target.value
                )
              }
              placeholder="Optional for now"
              style={inputStyle}
            />

            <label style={fieldLabel}>
              Role
            </label>

            <select
              value={userRole}
              onChange={(event) =>
                setUserRole(
                  event.target.value as Role
                )
              }
              style={inputStyle}
            >
              {ROLES.map(
                (role) => (
                  <option
                    key={role.role}
                    value={role.role}
                  >
                    {role.title}
                  </option>
                )
              )}
            </select>

            {userRole === "owner" ? (
              <div style={globalOwnerNotice}>
                <strong>All Properties</strong>
                <span>
                  Owner / Admin automatically has full access to every property in Netpos Hospitality.
                </span>
              </div>
            ) : (
              <>
                <label style={fieldLabel}>
                  Assigned Property
                </label>

                <select
                  value={assignedPropertyId}
                  onChange={(event) =>
                    setAssignedPropertyId(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Select property
                  </option>

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
              </>
            )}

            <label style={activeRow}>
              <span>
                <strong>
                  Active User
                </strong>

                <small>
                  Inactive staff should no longer receive system access.
                </small>
              </span>

              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) =>
                  setIsActive(
                    event.target.checked
                  )
                }
              />
            </label>

            <div style={securityNotice}>
              Owner / Admin has full access to all properties. Manager, Reception and Housekeeping are restricted to their assigned property. Staff creation is protected by the signed-in user's secure login session.
            </div>

            <div style={modalActions}>
              <button
                type="button"
                onClick={() =>
                  setShowUserModal(
                    false
                  )
                }
                style={secondaryButton}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  ...saveButton,
                  opacity:
                    saving
                      ? 0.6
                      : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingUser
                  ? "Save Changes"
                  : "Add User"}
              </button>
            </div>
          </form>
        </div>
      )}
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
    | "neutral";
}) {
  const toneStyle =
    tone === "green"
      ? summaryGreen
      : tone === "neutral"
      ? summaryNeutral
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

function RoleBadge({
  role,
}: {
  role: Role;
}) {
  return (
    <span
      style={{
        ...roleBadge,
        ...(role === "owner"
          ? ownerBadge
          : role === "manager"
          ? managerBadge
          : role === "reception"
          ? receptionBadge
          : housekeepingBadge),
      }}
    >
      {roleTitle(role)}
    </span>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      style={{
        ...statusBadge,
        ...(active
          ? activeBadge
          : inactiveBadge),
      }}
    >
      {active
        ? "ACTIVE"
        : "INACTIVE"}
    </span>
  );
}

function Toggle({
  enabled,
}: {
  enabled: boolean;
}) {
  return (
    <span
      style={{
        ...toggleTrack,
        background:
          enabled
            ? GREEN
            : "#CDD5DE",
      }}
    >
      <span
        style={{
          ...toggleThumb,
          transform:
            enabled
              ? "translateX(17px)"
              : "translateX(0)",
        }}
      />
    </span>
  );
}

// =========================================================
// HELPERS
// =========================================================

function roleTitle(
  role: Role
) {
  const labels: Record<Role, string> = {
    owner: "Owner / Admin",
    manager: "Manager",
    reception: "Reception",
    housekeeping: "Housekeeping",
  };

  return labels[role];
}

// =========================================================
// COLOURS
// =========================================================

const BLUE = "#0D5FA8";
const DARK_BLUE = "#0B477F";
const GREEN = "#16885A";
const PAGE_BG = "#F4F8FC";
const TEXT = "#17212B";
const MUTED = "#6F7D8C";

// =========================================================
// STYLES
// =========================================================

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  maxWidth: 1450,
  margin: "0 auto",
  padding: "14px 24px 12px",
  boxSizing: "border-box",
  fontFamily: "Arial, sans-serif",
  background: PAGE_BG,
  color: TEXT,
};

const brandHeader: CSSProperties = {
  minHeight: 72,
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
  width: 250,
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
  border: "1px solid #fff",
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

const addUserButton: CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: "9px 13px",
  background: GREEN,
  color: "#fff",
  fontSize: 9,
  fontWeight: 900,
  cursor: "pointer",
};

const errorBox: CSSProperties = {
  marginBottom: 8,
  padding: "8px 10px",
  border: "1px solid #E0AAAA",
  borderRadius: 7,
  background: "#FFF1F1",
  color: "#A11A1A",
  fontSize: 9,
};

const successBox: CSSProperties = {
  marginBottom: 8,
  padding: "8px 10px",
  border: "1px solid #9FCFB5",
  borderRadius: 7,
  background: "#EAF7F0",
  color: "#176C46",
  fontSize: 9,
  fontWeight: 700,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(6,minmax(0,1fr))",
  gap: 7,
  marginBottom: 8,
};

const summaryCard: CSSProperties = {
  minHeight: 57,
  padding: "8px 10px",
  border: "1px solid",
  borderRadius: 8,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const summaryBlue: CSSProperties = {
  borderColor: "#BAD1EA",
  background: "#F8FBFF",
};

const summaryGreen: CSSProperties = {
  borderColor: "#AED9C2",
  background: "#F7FFF9",
};

const summaryNeutral: CSSProperties = {
  borderColor: "#CDD7E1",
  background: "#FAFBFC",
};

const summaryLabel: CSSProperties = {
  color: "#607184",
  fontSize: 7,
  fontWeight: 900,
  textTransform: "uppercase",
};

const summaryValue: CSSProperties = {
  color: DARK_BLUE,
  fontSize: 18,
};

const mainGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(330px,.85fr) minmax(0,1.5fr)",
  gap: 8,
};

const usersCard: CSSProperties = {
  border: "1px solid #CBD8E5",
  borderRadius: 10,
  background: "#fff",
  overflow: "hidden",
};

const permissionsCard: CSSProperties = {
  ...usersCard,
};

const cardHeader: CSSProperties = {
  minHeight: 45,
  padding: "8px 11px",
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

const recordCount: CSSProperties = {
  color: BLUE,
  fontSize: 8,
  fontWeight: 900,
};

const userTableHeader: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "1.5fr .9fr .75fr .45fr",
  gap: 8,
  padding: "7px 10px",
  background: "#EFF4F9",
  color: "#56697D",
  fontSize: 7,
  fontWeight: 900,
  textTransform: "uppercase",
};

const userRow: CSSProperties = {
  width: "100%",
  display: "grid",
  gridTemplateColumns:
    "1.5fr .9fr .75fr .45fr",
  gap: 8,
  alignItems: "center",
  padding: "9px 10px",
  border: 0,
  borderBottom: "1px solid #E9EEF3",
  background: "#fff",
  color: TEXT,
  textAlign: "left",
  cursor: "pointer",
};

const userScroll: CSSProperties = {
  maxHeight:
    "calc(100vh - 390px)",
  minHeight: 280,
  overflowY: "auto",
};

const userName: CSSProperties = {
  fontSize: 9,
  color: TEXT,
};

const userEmail: CSSProperties = {
  marginTop: 2,
  fontSize: 7,
  color: MUTED,
};

const roleBadge: CSSProperties = {
  display: "inline-block",
  width: "fit-content",
  padding: "4px 7px",
  borderRadius: 20,
  fontSize: 7,
  fontWeight: 900,
};

const ownerBadge: CSSProperties = {
  background: "#EAF3FF",
  color: BLUE,
};

const managerBadge: CSSProperties = {
  background: "#F0EAFE",
  color: "#6841A2",
};

const receptionBadge: CSSProperties = {
  background: "#EAF7F0",
  color: GREEN,
};

const housekeepingBadge: CSSProperties = {
  background: "#FFF4D9",
  color: "#8B6200",
};

const statusBadge: CSSProperties = {
  display: "inline-block",
  width: "fit-content",
  padding: "4px 7px",
  borderRadius: 20,
  fontSize: 7,
  fontWeight: 900,
};

const activeBadge: CSSProperties = {
  background: "#EAF7F0",
  color: GREEN,
};

const inactiveBadge: CSSProperties = {
  background: "#F0F2F4",
  color: "#687584",
};

const editText: CSSProperties = {
  color: BLUE,
  fontSize: 7,
  fontWeight: 900,
  textAlign: "right",
};

const roleTabs: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4,minmax(0,1fr))",
  gap: 3,
  padding: 5,
  background: "#E9EEF5",
};

const roleTab: CSSProperties = {
  border: 0,
  borderRadius: 6,
  padding: "7px 7px",
  background: "transparent",
  color: "#5D6C7B",
  fontSize: 7,
  fontWeight: 800,
  cursor: "pointer",
};

const activeRoleTab: CSSProperties = {
  ...roleTab,
  background: BLUE,
  color: "#fff",
};

const roleDescription: CSSProperties = {
  padding: "9px 11px",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  borderBottom: "1px solid #E7EDF3",
};

const permissionScroll: CSSProperties = {
  maxHeight:
    "calc(100vh - 455px)",
  minHeight: 240,
  overflowY: "auto",
};

const permissionRow: CSSProperties = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  padding: "9px 11px",
  border: 0,
  borderBottom: "1px solid #EDF1F5",
  background: "#fff",
  color: TEXT,
  textAlign: "left",
  cursor: "pointer",
};

const permissionTitle: CSSProperties = {
  fontSize: 8,
};

const permissionDescription: CSSProperties = {
  marginTop: 2,
  color: MUTED,
  fontSize: 7,
};

const toggleTrack: CSSProperties = {
  flexShrink: 0,
  width: 38,
  height: 21,
  padding: 2,
  borderRadius: 20,
  display: "flex",
  alignItems: "center",
  transition: "background .15s ease",
};

const toggleThumb: CSSProperties = {
  width: 17,
  height: 17,
  borderRadius: "50%",
  background: "#fff",
  boxShadow:
    "0 1px 3px rgba(0,0,0,.25)",
  transition: "transform .15s ease",
};

const emptyState: CSSProperties = {
  padding: 28,
  color: MUTED,
  fontSize: 9,
  textAlign: "center",
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

const footerTitle: CSSProperties = {
  color: DARK_BLUE,
  fontSize: 9,
};

const footerText: CSSProperties = {
  marginTop: 2,
  color: MUTED,
  fontSize: 7,
};

const footerActions: CSSProperties = {
  display: "flex",
  gap: 6,
};

const footerButton: CSSProperties = {
  border: "1px solid #A8BED7",
  borderRadius: 6,
  padding: "7px 10px",
  background: "#fff",
  color: BLUE,
  fontSize: 8,
  fontWeight: 800,
  cursor: "pointer",
};

const footerPrimaryButton: CSSProperties = {
  ...footerButton,
  borderColor: GREEN,
  background: GREEN,
  color: "#fff",
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 18,
  background: "rgba(8,27,50,.48)",
};

const modalCard: CSSProperties = {
  width: "min(460px,100%)",
  padding: 18,
  borderRadius: 12,
  background: "#fff",
  boxShadow:
    "0 18px 55px rgba(0,0,0,.22)",
};

const modalHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 15,
  marginBottom: 14,
};

const modalEyebrow: CSSProperties = {
  color: BLUE,
  fontSize: 8,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const modalTitle: CSSProperties = {
  margin: "3px 0 0",
  color: DARK_BLUE,
  fontSize: 20,
};

const modalClose: CSSProperties = {
  width: 30,
  height: 30,
  border: "1px solid #CCD5DF",
  borderRadius: 7,
  background: "#fff",
  color: "#5D6875",
  fontSize: 18,
  cursor: "pointer",
};

const fieldLabel: CSSProperties = {
  display: "block",
  marginTop: 9,
  marginBottom: 4,
  color: "#41546A",
  fontSize: 8,
  fontWeight: 800,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 10px",
  border: "1px solid #AFC0D2",
  borderRadius: 7,
  background: "#fff",
  color: TEXT,
  fontSize: 9,
};

const activeRow: CSSProperties = {
  marginTop: 11,
  padding: "9px 10px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  border: "1px solid #D3DEE9",
  borderRadius: 7,
  background: "#F8FAFD",
  fontSize: 8,
};

const securityNotice: CSSProperties = {
  marginTop: 10,
  padding: "8px 9px",
  border: "1px solid #B9CFE8",
  borderRadius: 7,
  background: "#EFF5FC",
  color: "#536A83",
  fontSize: 8,
  lineHeight: 1.4,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 7,
  marginTop: 15,
  paddingTop: 12,
  borderTop: "1px solid #E6EBF0",
};

const secondaryButton: CSSProperties = {
  border: "1px solid #A8BED7",
  borderRadius: 6,
  padding: "8px 11px",
  background: "#fff",
  color: BLUE,
  fontSize: 8,
  fontWeight: 800,
  cursor: "pointer",
};

const saveButton: CSSProperties = {
  border: 0,
  borderRadius: 6,
  padding: "8px 12px",
  background: GREEN,
  color: "#fff",
  fontSize: 8,
  fontWeight: 900,
  cursor: "pointer",
};


const roleRuleStrip: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,minmax(0,1fr))",
  gap: 7,
  marginBottom: 8,
};

const roleRuleItem: CSSProperties = {
  minHeight: 48,
  padding: "7px 9px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: 2,
  border: "1px solid #CBD8E5",
  borderRadius: 8,
  background: "#fff",
  color: DARK_BLUE,
  fontSize: 7,
};

const scopeText: CSSProperties = {
  marginTop: 3,
  color: MUTED,
  fontSize: 6,
};

const globalOwnerNotice: CSSProperties = {
  marginTop: 10,
  padding: "9px 10px",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  border: "1px solid #AFC9E5",
  borderRadius: 7,
  background: "#EFF6FE",
  color: DARK_BLUE,
  fontSize: 8,
};
