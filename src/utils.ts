import type { HomeAssistant, EntityNameItem, SubtitleItem, YasnoOutageConfig } from "./types";

/**
 * Check if a value is a Jinja2 template string
 */
export function isTemplate(value: any): boolean {
  return typeof value === "string" && (value.includes("{{") || value.includes("{%"));
}

/**
 * Find entities matching domain and optional keyword
 */
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

  // First, try to find entities with the preferred keyword
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

  // If no preferred match found, return any entity matching domain
  const filtered: string[] = [];
  for (let i = 0; i < entityList.length && filtered.length < maxCount; i++) {
    if (conditions.every((cond) => cond(entityList[i]))) {
      filtered.push(entityList[i]);
    }
  }
  return filtered;
}

/**
 * Render a single content item (entity name, device, area, state, attribute, or text)
 * Handles both object format {type: "state"} and string format "state" from ui_state_content
 */
export function renderContentItem(
  item: EntityNameItem | SubtitleItem | string,
  entity: any,
  hass: HomeAssistant,
): string {
  if (!entity) return "";

  // Handle string format from ui_state_content selector
  if (typeof item === "string") {
    // Check if it's a standard type
    if (item === "name") {
      return entity.attributes?.friendly_name || entity.entity_id;
    }
    if (item === "state") {
      return (hass as any).formatEntityState?.(entity) || entity.state;
    }
    // Check for special timestamp attributes
    if (item === "last_changed" || item === "last_updated") {
      return entity[item] || "";
    }
    // Otherwise treat as attribute name
    const attrValue = entity.attributes?.[item];
    return attrValue !== undefined ? String(attrValue) : item; // Return the string itself if not found
  }

  // Handle object format with type property
  const entityEntry = hass.entities?.[entity.entity_id];

  switch (item.type) {
    case "entity":
    case "name":
      return entity.attributes?.friendly_name || entity.entity_id;

    case "device":
      if (entityEntry?.device_id) {
        const device = hass.devices?.[entityEntry.device_id];
        return device?.name_by_user || device?.name || "";
      }
      return "";

    case "area":
      if (entityEntry?.area_id) {
        const area = hass.areas?.[entityEntry.area_id];
        return area?.name || "";
      }
      if (entityEntry?.device_id) {
        const device = hass.devices?.[entityEntry.device_id];
        if (device?.area_id) {
          const area = hass.areas?.[device.area_id];
          return area?.name || "";
        }
      }
      return "";

    case "state":
      if ("state" in item) {
        return (hass as any).formatEntityState?.(entity) || entity.state;
      }
      return entity.state;

    case "attribute":
      if ("attribute" in item && item.attribute) {
        const attrValue = entity.attributes?.[item.attribute];
        return attrValue !== undefined ? String(attrValue) : "";
      }
      return "";

    case "text":
      return "text" in item ? item.text : "";

    default:
      return "";
  }
}

/**
 * Render an array of content items, joining them with a space
 * Handles both object format and string format from ui_state_content
 */
export function renderContentArray(
  items: (EntityNameItem | SubtitleItem | string)[],
  entity: any,
  hass: HomeAssistant,
): string {
  if (!entity) return "";
  return items
    .map((item) => renderContentItem(item, entity, hass))
    .filter((text) => text) // Remove empty strings
    .join(" ");
}

/**
 * Normalize entity_name selector values to proper format
 * Converts plain strings to {type: "text", text: "..."} format
 */
export function normalizeEntityNameValue(value: any): EntityNameItem | EntityNameItem[] {
  if (!Array.isArray(value)) {
    value = [value];
  }

  return value.map((item: any) => {
    if (typeof item === "string") {
      return { type: "text", text: item };
    }
    return item;
  });
}
