/** Normalize Prisma Json fields that store string arrays (MySQL has no scalar lists). */
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function jsonArrayIncludes(value: unknown, needle: string): boolean {
  return asStringArray(value).includes(needle);
}
