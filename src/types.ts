import type {
  HomeAssistant as HomeAssistantBase,
  LovelaceCardConfig,
  Theme,
} from "custom-card-helpers";

export type HaEntity = {
  entity_id: string;
  device_id?: string;
  area_id?: string;
  attributes: Record<string, string>;
  state: string;
  last_changed: string;
  last_updated: string;
};

// Extend HomeAssistant type with additional properties used in HA frontend
export interface HomeAssistant extends HomeAssistantBase {
  entities?: Record<string, HaEntity>;
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
    themes: Record<string, Theme>;
  };
  formatEntityState(entity: HaEntity): string;
}

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
  // Can be a single calendar entity or multiple calendar entities
  entity: string | string[];
  title?: string | EntityNameItem | EntityNameItem[];
  subtitle?: string | SubtitleItem | SubtitleItem[] | string[] | (SubtitleItem | string)[];
  subtitle_entity?: string;
  show_legend?: boolean;
  show_weekly?: boolean;
  show_emergency_badge?: boolean;
  show_schedule_badge?: boolean;
}

export interface OutageData {
  hours: HourData[];
  date?: Date;
  scheduleStatus?: "applies" | "waiting";
  emergencyOutages?: boolean;
}

export interface OutageDataCache {
  today: OutageData;
  tomorrow: OutageData;
}

export interface WeekDay {
  date: Date;
  label: string;
  isToday: boolean;
}

export interface HourData {
  state: "powered" | "certain_outage" | "possible_outage";
  partPercentage?: number;
  isCurrent?: boolean;
  partType?: "start" | "end";
}

export interface HaCalendarServiceResponse {
  response?: { [key: string]: { events: CalendarEvent[] } };
}
export interface CalendarEvent {
  start: string;
  end: string;
  summary: string;
  description?: string;
}
