type PropertyRow = { id: string };

type StaffScope = {
  role?: "owner" | "manager" | "reception" | "housekeeping";
  property_id?: string | null;
};

export function scopePropertiesForCurrentStaff<T extends PropertyRow>(properties: T[]): T[] {
  if (typeof window === "undefined") return properties;

  try {
    const staff = JSON.parse(sessionStorage.getItem("netpos_staff") ?? "null") as StaffScope | null;
    if (staff?.role === "owner") return properties;
    if (staff?.property_id) return properties.filter((property) => property.id === staff.property_id);
    return [];
  } catch {
    return [];
  }
}

export function selectInitialProperty<T extends PropertyRow>(properties: T[]) {
  const scoped = scopePropertiesForCurrentStaff(properties);
  const assigned = sessionStorage.getItem("netpos_property_id");
  const selected = scoped.some((property) => property.id === assigned)
    ? assigned!
    : scoped[0]?.id ?? "";
  return { scoped, selected };
}
