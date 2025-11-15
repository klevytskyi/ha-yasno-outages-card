import type { HomeAssistant as HomeAssistantBase, LovelaceCardConfig } from "custom-card-helpers";

// Extend HomeAssistant type with additional properties used in HA frontend
export interface HomeAssistant extends HomeAssistantBase {
  entities?: Record<
    string,
    {
      entity_id: string;
      device_id?: string;
      area_id?: string;
    }
  >;
  devices?: Record<
    string,
    {
      id: string;
      name: string;
      name_by_user?: string;
      area_id?: string;
    }
  >;
  areas?: Record<
    string,
    {
      area_id: string;
      name: string;
    }
  >;
  themes: {
    darkMode: boolean;
    default_theme: string;
    themes: Record<string, any>;
  };
}

// Content item types based on HA frontend patterns (tile card, entity badge)
export type EntityNameItem =
  | { type: "entity" }
  | { type: "name" }
  | { type: "device" }
  | { type: "area" }
  | { type: "text"; text: string };

export type SubtitleItem =
  | { type: "entity" }
  | { type: "name" }
  | { type: "device" }
  | { type: "area" }
  | { type: "state" }
  | { type: "attribute"; attribute: string }
  | { type: "text"; text: string };

export interface YasnoOutageConfig extends LovelaceCardConfig {
  entity: string;
  title?: string | EntityNameItem | EntityNameItem[]; // String (template), item, or array of items
  subtitle?: string | SubtitleItem | SubtitleItem[] | string[] | (SubtitleItem | string)[]; // Supports both object and string format from ui_state_content
  subtitle_entity?: string; // Entity to use for subtitle content items (if not specified, uses main entity)
  show_legend?: boolean; // Whether to show the legend (default: true)
}

export interface OutageData {
  hours: HourData[];
}

export interface HourData {
  state: "powered" | "certain_outage" | "possible_outage";
  partPercentage?: number; // 0-100: percentage of hour in current state (for partial hours)
  isCurrent?: boolean; // Indicates if this hour is the current hour
  partType?: "start" | "end"; // Type of partial: start (left-to-right) or end (right-to-left)
}
