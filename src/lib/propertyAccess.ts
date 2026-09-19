export type StoredStaff = {
  role?: "owner" | "manager" | "reception" | "housekeeping";
  property_id?: string | null;
};

export function getStoredStaff(): StoredStaff | null {
  if (typeof window === "undefined") return null;

  try {
    const value = sessionStorage.getItem("netpos_staff");
    return value ? (JSON.parse(value) as StoredStaff) : null;
  } catch {
    return null;
  }
}

export function scopeProperties<T extends { id: string }>(rows: T[]): T[] {
  const staff = getStoredStaff();

  if (!staff || staff.role === "owner") return rows;
  if (!staff.property_id) return [];

  return rows.filter((property) => property.id === staff.property_id);
}

export function canViewAllProperties(): boolean {
  return getStoredStaff()?.role === "owner";
}
