import type { EntityNameItem } from "./types";

export function isTemplate(value: unknown): boolean {
  return typeof value === "string" && (value.includes("{{") || value.includes("{%"));
}

export function findEntity(
  entityList: string[],
  maxCount: number,
  includeDomains: string[],
  preferredKeyword?: string,
): string[] {
  const conditions: ((eid: string) => boolean)[] = [];

  if (includeDomains.length) {
    conditions.push((eid) => {
      const domain = eid.split(".")[0];
      return includeDomains.includes(domain);
    });
  }

  if (preferredKeyword) {
    const preferredFiltered: string[] = [];
    for (let i = 0; i < entityList.length && preferredFiltered.length < maxCount; i++) {
      if (
        conditions.every((cond) => cond(entityList[i])) &&
        entityList[i].toLowerCase().includes(preferredKeyword.toLowerCase())
      ) {
        preferredFiltered.push(entityList[i]);
      }
    }
    if (preferredFiltered.length > 0) {
      return preferredFiltered;
    }
  }

  const filtered: string[] = [];
  for (let i = 0; i < entityList.length && filtered.length < maxCount; i++) {
    if (conditions.every((cond) => cond(entityList[i]))) {
      filtered.push(entityList[i]);
    }
  }
  return filtered;
}

export function normalizeEntityNameValue(value: unknown): EntityNameItem | EntityNameItem[] {
  const items = Array.isArray(value) ? value : [value];

  return items.map((item: unknown) => {
    if (typeof item === "string") {
      return { type: "text", text: item };
    }
    return item as EntityNameItem;
  });
}
