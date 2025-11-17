import type { LovelaceCardEditor } from "custom-card-helpers";
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type {
  CalendarEvent,
  EntityNameItem,
  HaCalendarServiceResponse,
  HaEntity,
  HomeAssistant,
  HourData,
  OutageData,
  OutageDataCache,
  SubtitleItem,
  YasnoOutageConfig,
} from "./types";

import { localize } from "./localize";
import { findEntity, isTemplate } from "./utils";
import "./editor";

declare global {
  interface Window {
    customCards?: unknown[];
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "yasno-outages-card",
  name: "Yasno Outages Card",
  description: "Display 24-hour power outage schedule from Yasno calendar integration",
  preview: true,
});

console.info(
  // @ts-ignore - __VERSION__ is injected by esbuild
  `%c YASNO-CARD %c ${__VERSION__} `,
  "color: white; background: #ffc107; font-weight: 700;",
  "color: #ffc107; background: white; font-weight: 700;",
);
@customElement("yasno-outages-card")
export class YasnoOutagesCard extends LitElement {
  @property({ attribute: false })
  hass!: HomeAssistant;

  @property({ attribute: false })
  config!: YasnoOutageConfig;

  private _templateUnsubscribes: Map<string, () => void> = new Map();

  public setConfig(config: YasnoOutageConfig): void {
    if (!config.entity) {
      throw new Error("Entity is required");
    }
    this.config = config;
  }

  public getCardSize(): number {
    return 6;
  }

  public getGridOptions() {
    return {
      min_columns: 6,
      min_rows: 6,
    };
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement("yasno-outages-card-editor") as LovelaceCardEditor;
  }

  public static getStubConfig(
    hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): YasnoOutageConfig {
    const includeDomains = ["calendar"];
    const maxEntities = 1;

    let foundEntities = findEntity(entities, maxEntities, includeDomains, "yasno");
    if (foundEntities.length === 0) {
      foundEntities = findEntity(entitiesFallback, maxEntities, includeDomains, "yasno");
    }

    return {
      type: "custom:yasno-outages-card",
      entity: foundEntities[0] || "",
      title: "",
    };
  }

  private async fetchBothDaysData(): Promise<void> {
    const entity = this.hass.states[this.config.entity];

    if (!entity || !entity.entity_id.startsWith("calendar.")) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(tomorrow.getDate() + 1);

    try {
      const response: HaCalendarServiceResponse = await this.hass.callWS({
        type: "call_service",
        domain: "calendar",
        service: "get_events",
        service_data: {
          start_date_time: today.toISOString(),
          end_date_time: dayAfterTomorrow.toISOString(),
        },
        target: {
          entity_id: this.config.entity,
        },
        return_response: true,
      });

      const events = response?.response?.[this.config.entity]?.events || [];

      const todayData = this._processEventsForDay(events, today);
      const tomorrowData = this._processEventsForDay(events, tomorrow);

      this.outageDataCache = {
        today: todayData,
        tomorrow: tomorrowData,
      };

      this._updateDisplayedData();
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    }
  }

  private _processEventsForDay(events: CalendarEvent[], targetDate: Date): OutageData {
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    const hours: HourData[] = Array.from({ length: 24 }, () => ({
      state: "powered" as const,
    }));

    if (events && Array.isArray(events)) {
      for (const event of events) {
        const start = new Date(event.start);
        const end = new Date(event.end);

        if (event.description === "NotPlanned") {
          continue;
        }

        if (start.toDateString() !== dayStart.toDateString()) {
          continue;
        }

        const startHour = start.getHours();
        const startMinute = start.getMinutes();
        const endHour = end.getHours();
        const endMinute = end.getMinutes();

        for (let h = startHour; h <= endHour; h++) {
          let partType: HourData["partType"];
          let partPercentage: HourData["partPercentage"];

          if (h === startHour || h === endHour) {
            if (h === startHour && startMinute > 0) {
              partType = "start";
              partPercentage = 100 - Math.floor((startMinute / 60) * 100);
            } else if (h === endHour && endMinute > 0 && endMinute !== 59) {
              partType = "end";
              partPercentage = Math.floor((endMinute / 60) * 100);
            }
          }
          hours[h] = {
            state: "certain_outage",
            partType,
            partPercentage,
          };
        }
      }
    }

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dayStart.toDateString() === today.toDateString()) {
      const nowH = now.getHours();
      hours[nowH].isCurrent = true;
    }

    return { hours, date: dayStart };
  }

  private _updateDisplayedData(): void {
    if (!this.outageDataCache) {
      this.outageData = { hours: [] };
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateString = this.selectedDate.toDateString();
    const todayString = today.toDateString();

    if (selectedDateString === todayString) {
      this.outageData = this.outageDataCache.today;
    } else {
      this.outageData = this.outageDataCache.tomorrow;
    }
  }

  private getStateClass(state: string, isPart: boolean): string {
    let baseClass = "";
    switch (state) {
      case "powered":
        baseClass = "powered";
        break;
      case "certain_outage":
        baseClass = "certain-outage";
        break;
      case "possible_outage":
        baseClass = "possible-outage";
        break;
    }
    return isPart ? `${baseClass} partial` : baseClass;
  }

  private formatTime(hour: number): string {
    return `${String(hour).padStart(2, "0")}:00`;
  }

  private formatDate(date?: Date): string {
    const targetDate = date || new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "long",
    };
    return targetDate.toLocaleDateString(this.hass?.locale?.language || "en", options);
  }

  private _generateWeekDays(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const days: { date: Date; label: string; isToday: boolean }[] = [];

    const formatDayLabel = (date: Date): string => {
      const weekdayOptions: Intl.DateTimeFormatOptions = {
        weekday: "short",
      };
      const weekday = date.toLocaleDateString(this.hass?.locale?.language || "en", weekdayOptions);

      const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");

      return `${capitalizedWeekday}, ${day}.${month}`;
    };

    const todayLabel = formatDayLabel(today);
    const tomorrowLabel = formatDayLabel(tomorrow);

    days.push({ date: today, label: todayLabel, isToday: true });
    days.push({ date: tomorrow, label: tomorrowLabel, isToday: false });

    this.weekDays = days;
  }

  private _selectDay(date: Date): void {
    this.selectedDate = new Date(date);
    this.selectedDate.setHours(0, 0, 0, 0);
    this._updateDisplayedData();
  }

  @property({ attribute: false })
  private outageData: OutageData = { hours: [] };

  @state()
  private outageDataCache: OutageDataCache | null = null;

  @property({ attribute: false })
  private renderedTitle = "";

  @property({ attribute: false })
  private renderedSubtitle = "";

  @state()
  private selectedDate: Date = new Date();

  @state()
  private weekDays: { date: Date; label: string; isToday: boolean }[] = [];

  async connectedCallback() {
    super.connectedCallback();
    this.selectedDate = new Date();
    this.selectedDate.setHours(0, 0, 0, 0);
    this._generateWeekDays();
    await this.fetchOutageData();
    this._subscribeTemplate("title", this.config.title, (result) => {
      this.renderedTitle = result;
    });
    this._subscribeTemplate("subtitle", this.config.subtitle, (result) => {
      this.renderedSubtitle = result;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribeAllTemplates();
  }

  async updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);

    if (changedProperties.has("hass")) {
      const darkMode = this.hass?.themes?.darkMode ?? false;
      this.toggleAttribute("dark-mode", darkMode);
    }

    if (changedProperties.has("hass") || changedProperties.has("config")) {
      await this.fetchOutageData();

      if (changedProperties.has("config")) {
        if (this.config.show_weekly) {
          this._generateWeekDays();
        }

        this._subscribeTemplate("title", this.config.title, (result) => {
          this.renderedTitle = result;
        });
        this._subscribeTemplate("subtitle", this.config.subtitle, (result) => {
          this.renderedSubtitle = result;
        });
      }

      if (changedProperties.has("hass") && this.config.subtitle_entity) {
        this._subscribeTemplate("subtitle", this.config.subtitle, (result) => {
          this.renderedSubtitle = result;
        });
      }
    }
  }

  private async fetchOutageData() {
    await this.fetchBothDaysData();
  }

  private _subscribeTemplate(
    key: string,
    content:
      | string
      | EntityNameItem
      | EntityNameItem[]
      | SubtitleItem
      | SubtitleItem[]
      | string[]
      | (SubtitleItem | string)[]
      | undefined,
    callback: (result: string) => void,
  ): void {
    this._unsubscribe(key);

    if (!content) {
      if (key === "title") {
        const entity = this.hass.states[this.config.entity];
        const lang = this.hass?.locale?.language || this.hass?.language;
        const defaultTitle = entity?.attributes?.friendly_name || localize("default_title", lang);
        callback(defaultTitle);
        return;
      }
      if (key === "subtitle") {
        callback(this.formatDate());
        return;
      }
      callback("");
      return;
    }

    if (typeof content === "string") {
      if (!isTemplate(content)) {
        callback(content);
        return;
      }

      if (!this.hass?.connection) {
        console.warn("No hass connection available for template subscription");
        callback(content);
        return;
      }
      this.hass.connection
        .subscribeMessage<{ result: string }>(
          (msg) => {
            callback(msg.result || content);
          },
          {
            type: "render_template",
            template: content,
          },
        )
        .then((unsubscribe) => {
          this._templateUnsubscribes.set(key, unsubscribe);
        })
        .catch((error) => {
          console.error(`Error subscribing to template for ${key}:`, error);
          callback(content);
        });
      return;
    }

    const entityId =
      key === "subtitle" && this.config.subtitle_entity
        ? this.config.subtitle_entity
        : this.config.entity;

    const entity = this.hass.states[entityId];

    if (!entity) {
      callback("");
      return;
    }

    if (Array.isArray(content)) {
      callback(this._renderContentArray(content, entity));
    } else {
      callback(this._renderContentItem(content, entity));
    }
  }

  private _unsubscribe(key: string): void {
    const unsubscribe = this._templateUnsubscribes.get(key);
    if (unsubscribe) {
      unsubscribe();
      this._templateUnsubscribes.delete(key);
    }
  }

  private _unsubscribeAllTemplates(): void {
    this._templateUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this._templateUnsubscribes.clear();
  }

  private _renderContentItem(
    item: EntityNameItem | SubtitleItem | string,
    entity: HaEntity,
  ): string {
    if (!entity) return "";

    if (typeof item === "string") {
      if (item === "name") {
        return entity.attributes?.friendly_name || entity.entity_id;
      }
      if (item === "state") {
        return this.hass.formatEntityState?.(entity) || entity.state;
      }
      if (item === "last_changed" || item === "last_updated") {
        return entity[item] || "";
      }
      const attrValue = entity.attributes?.[item];
      return attrValue !== undefined ? String(attrValue) : item;
    }

    const entityEntry = this.hass.entities?.[entity.entity_id];

    switch (item.type) {
      case "entity":
      case "name":
        return entity.attributes?.friendly_name || entity.entity_id;

      case "device":
        if (entityEntry?.device_id) {
          const device = this.hass.devices?.[entityEntry.device_id];
          return device?.name_by_user || device?.name || "";
        }
        return "";

      case "area":
        if (entityEntry?.area_id) {
          const area = this.hass.areas?.[entityEntry.area_id];
          return area?.name || "";
        }
        if (entityEntry?.device_id) {
          const device = this.hass.devices?.[entityEntry.device_id];
          if (device?.area_id) {
            const area = this.hass.areas?.[device.area_id];
            return area?.name || "";
          }
        }
        return "";

      case "state":
        if ("state" in item) {
          return this.hass.formatEntityState?.(entity) || entity.state;
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

  private _renderContentArray(
    items: (EntityNameItem | SubtitleItem | string)[],
    entity: HaEntity,
  ): string {
    if (!entity) return "";
    return items
      .map((item) => this._renderContentItem(item, entity))
      .filter((text) => text)
      .join(" ");
  }

  private _renderSubtitle() {
    const subtitle = this.config.subtitle;
    const subtitleEntity = this.config.subtitle_entity || this.config.entity;
    const entity = this.hass.states[subtitleEntity];

    // Handle timestamp sensors with state item
    if (entity && entity.attributes.device_class === "timestamp") {
      // Single state item - use timestamp display
      if (
        typeof subtitle === "object" &&
        !Array.isArray(subtitle) &&
        "type" in subtitle &&
        subtitle.type === "state"
      ) {
        return html`<hui-timestamp-display
          .hass=${this.hass}
          .ts=${new Date(entity.state)}
          format="relative"
          capitalize
        ></hui-timestamp-display>`;
      }

      // Array with state item - render mixed content with timestamp display
      if (Array.isArray(subtitle)) {
        const hasStateItem = subtitle.some((item) =>
          typeof item === "string"
            ? item === "state"
            : typeof item === "object" && "type" in item
              ? item.type === "state"
              : false,
        );

        if (hasStateItem) {
          // Render array with timestamp display for state items
          return html`${subtitle.map((item) => {
            // Handle string format "state"
            if (typeof item === "string" && item === "state") {
              return html`<hui-timestamp-display
                .hass=${this.hass}
                .ts=${new Date(entity.state)}
                format="relative"
                capitalize
              ></hui-timestamp-display>`;
            }
            // Handle object format {type: "state"}
            if (typeof item === "object" && "type" in item && item.type === "state") {
              return html`<hui-timestamp-display
                .hass=${this.hass}
                .ts=${new Date(entity.state)}
                format="relative"
                capitalize
              ></hui-timestamp-display>`;
            }
            const rendered = this._renderContentItem(item, entity);
            return rendered ? html`${rendered} ` : "";
          })}`;
        }
      }
    }

    // For non-timestamp entities, templates, or other content, use the rendered string
    return this.renderedSubtitle;
  }

  private _renderWeekTabs() {
    return html`
      <div class="week-tabs">
        ${this.weekDays.map(
          (day) => html`
            <button
              class="week-tab ${
                day.date.toDateString() === this.selectedDate.toDateString() ? "selected" : ""
              } ${day.isToday ? "today" : ""}"
              @click=${() => this._selectDay(day.date)}
            >
              ${day.label}
            </button>
          `,
        )}
      </div>
    `;
  }

  private _renderLegend() {
    if (this.config.show_legend === false) {
      return "";
    }
    const lang = this.hass?.locale?.language || this.hass?.language;
    return html`<div class="footer">
      <div class="legend">
        <div class="legend-item">
          <div class="legend-circle current"></div>
          <span>${localize("legend_current", lang)}</span>
        </div>
        <div class="legend-item">
          <div class="legend-circle powered"></div>
          <span>${localize("legend_powered", lang)}</span>
        </div>
        <div class="legend-item">
          <div class="legend-circle certain-outage"></div>
          <span>${localize("legend_certain_outage", lang)}</span>
        </div>
        <div class="legend-item">
          <div class="legend-circle possible-outage"></div>
          <span>${localize("legend_possible_outage", lang)}</span>
        </div>
      </div>
    </div>`;
  }

  render() {
    if (!this.outageData.hours.length) {
      return html`<div class="error">
        Entity not found: ${this.config?.entity || "unknown"}
      </div>`;
    }

    return html`
      <div class="container">
        <ha-card>
          <div class="header">
            <div class="title">${this.renderedTitle}</div>
            <div class="subtitle">${this._renderSubtitle()}</div>
          </div>
          ${this.config.show_weekly ? this._renderWeekTabs() : ""}
          <div class="content">
            <div class="hours-grid">
              ${this.outageData.hours.map(
                (hourData: HourData, hour) => html`
                  <div
                    class="hour-brick ${this.getStateClass(
                      hourData.state,
                      hourData.partType !== undefined,
                    )} ${hourData.isCurrent === true ? "current" : ""}"
                    title="${this.formatTime(hour)}"
                    style="${
                      hourData.partType !== undefined
                        ? this.getPartialHourStyle(
                            hourData.state,
                            hourData.partPercentage || 0,
                            hourData.partType || "start",
                          )
                        : ""
                    }"
                  >
                    <div
                      class="hour-label"
                      style="${
                        hourData.partType !== undefined
                          ? this.getPartialTextStyle(
                              hourData.state,
                              hourData.partPercentage || 0,
                              hourData.partType || "start",
                            )
                          : ""
                      }"
                    >
                      ${
                        hourData.partType === undefined
                          ? hourData.state === "certain_outage" ||
                            hourData.state === "possible_outage"
                            ? html`<ha-icon icon="mdi:flash-off"></ha-icon>`
                            : html`<ha-icon icon="mdi:flash"></ha-icon>`
                          : ""
                      }
                      ${String(hour).padStart(2, "0")}<span>:00</span>
                    </div>
                  </div>
                `,
              )}
            </div>
          </div>
          ${this._renderLegend()}
        </ha-card>
      </div>
    `;
  }

  private getPartialHourStyle(
    state: string,
    percentage: number,
    partType: "start" | "end",
  ): string {
    const color =
      state === "certain_outage" ? "var(--yasno-certain-color)" : "var(--yasno-outage-color)";

    if (partType === "start") {
      // Start of outage: powered (left) -> outage (right)
      return `background-image: linear-gradient(to right, var(--yasno-powered-color) 0%, var(--yasno-powered-color) ${
        100 - percentage
      }%, ${color} ${100 - percentage}%, ${color} 100%);`;
    }
    return `background-image: linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, var(--yasno-powered-color) ${percentage}%, var(--yasno-powered-color) 100%);`;
  }

  private getPartialTextStyle(
    state: string,
    percentage: number,
    partType: "start" | "end",
  ): string {
    const direction = partType === "end" ? "to right" : "to left";

    // Text color for outage portion
    const outageTextColor = state === "certain_outage" ? "white" : "var(--yasno-font-color)";

    return `background: linear-gradient(${direction}, ${outageTextColor} 0%, ${outageTextColor} ${percentage}%, var(--yasno-font-color) ${percentage}%, var(--yasno-font-color) 100%); -webkit-background-clip: text; background-clip: text; color: transparent;`;
  }

  static get styles() {
    return css`
      :host {
        /* Light theme (default) */
        --yasno-powered-color: var(
          --ha-card-background,
          var(--card-background-color, #fff)
        );
        --yasno-powered-icon-color: var(--amber-color);
        --yasno-outage-color: #888888ff;
        --yasno-certain-color: #1a2c4d;
        --yasno-border-color: var(--outline-color);
        --yasno-current-color: #2196f3;
        --yasno-font-color: var(--primary-text-color);
        --yasno-content-padding: var(--ha-space-2);
        --yasno-grid-gap: var(--ha-space-1);
        --yasno-title-font-size: var(--ha-font-size-m);
        --yasno-subtitle-font-size: var(--ha-font-size-s);
      }

      :host([dark-mode]) {
        /* Dark theme */
        --yasno-outage-color: #4a4a4a;
      }

      .container {
        container-type: inline-size;
        container-name: card;
        width: 100%;
        height: 100%;
      }

      ha-card {
        overflow: hidden;
        height: 100%;
        --yasno-tab-font-size: var(--ha-font-size-s);
        --yasno-tab-padding: var(--ha-space-2);
      }

      @container (width > 340px) {
        ha-card {
          --yasno-content-padding: var(--ha-space-4);
          --yasno-grid-gap: var(--ha-space-3);
          --yasno-title-font-size: var(--ha-font-size-l);
          --yasno-subtitle-font-size: var(--ha-font-size-m);
          --yasno-tab-padding: var(--ha-space-3);
        }
      }

      .header {
        padding: var(--ha-space-4);
        border-bottom: 1px solid var(--yasno-border-color);
        display: flex;
        flex-direction: column;
        gap: var(--ha-space-1);
      }

      .title {
        font-size: var(--yasno-title-font-size);
        font-weight: var(--ha-font-weight-medium);
      }

      .subtitle {
        font-size: var(--yasno-subtitle-font-size);
        font-weight: var(--ha-font-weight-normal);
        color: var(--secondary-text-color);
      }

      .week-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        padding: var(--ha-space-2) var(--yasno-content-padding);
        gap: var(--ha-space-2);
        border-bottom: 1px solid var(--yasno-border-color);
      }

      .week-tab {
        padding: var(--yasno-tab-padding);
        background: transparent;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: var(--yasno-tab-font-size);
        font-weight: var(--ha-font-weight-normal);
        color: var(--secondary-text-color);
        transition: all 0.2s ease;
        text-align: center;
      }

      .week-tab:hover {
        background: var(--secondary-background-color);
      }

      .week-tab.selected {
        background: var(--primary-color);
        color: var(--text-primary-color);
        font-weight: var(--ha-font-weight-medium);
      }

      :host([dark-mode]) .week-tab.selected {
        background: rgba(var(--rgb-primary-color), 0.16);
        color: var(--primary-color);
      }

      .week-tab.today:not(.selected) {
        color: var(--primary-color);
        font-weight: var(--ha-font-weight-medium);
      }

      .content {
        padding: var(--yasno-content-padding);

        container-type: inline-size;
        container-name: card-content;
      }

      .footer {
        padding: var(--ha-space-4);
        border-top: 1px solid var(--yasno-border-color);
      }

      .hours-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--yasno-grid-gap);
      }

      .hour-brick {
        aspect-ratio: 16/10;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        border: 2px solid var(--yasno-border-color);
        position: relative;
        background-origin: border-box;

        container-type: inline-size;
        container-name: hour-brick;
      }

      @container card-content (width < 185px) {
        .hour-brick {
          border-width: 1px;
          border-radius: 4px;
        }
      }

      /* Powered state */
      .hour-brick.powered {
        background-color: var(--yasno-powered-color);
      }

      .hour-brick.powered .hour-label {
        color: var(--yasno-font-color);
      }

      ha-icon[icon="mdi:flash"] {
        color: var(--yasno-powered-icon-color);
      }

      /* Certain outage - white icon for visibility on dark background */
      .hour-brick.certain-outage ha-icon[icon="mdi:flash-off"] {
        color: white;
      }

      /* Possible outage - use font color for contrast */
      .hour-brick.possible-outage ha-icon[icon="mdi:flash-off"] {
        color: var(--yasno-font-color);
      }

      /* Certain outage state */
      .hour-brick.certain-outage {
        &:not(.partial) {
          background-color: var(--yasno-certain-color);
        }
      }

      .hour-brick.certain-outage:not(.partial) .hour-label {
        color: white;
      }

      /* Possible outage state */
      .hour-brick.possible-outage {
        background-color: var(--yasno-outage-color);
      }

      .hour-brick.possible-outage .hour-label {
        color: var(--yasno-font-color);
      }

      .hour-brick.current {
        border-color: var(--yasno-current-color);
      }

      .hour-label {
        font-size: var(--ha-font-size-m);
        font-weight: var(--ha-font-weight-medium);
        display: flex;
        align-items: baseline;
        justify-content: center;
        flex-grow: 1;
      }

      .hour-label ha-icon {
        --mdc-icon-size: 1.2em;
        width: var(--mdc-icon-size);
        height: var(--mdc-icon-size);
        margin-left: calc(var(--mdc-icon-size) * -0.4);
        display: inline-block;
      }

      @container hour-brick (width < 75px) {
        .hour-label {
          ha-icon {
            height: 1em;
            width: 1em;
            margin-left: 0;
          }

          font-size: var(--ha-font-size-s);
          font-weight: var(--ha-font-weight-normal);
        }
      }

      @container hour-brick (width < 40px) {
        .hour-label {
          span {
            display: none;
          }

          font-size: var(--ha-font-size-s);
          font-weight: var(--ha-font-weight-normal);
        }
      }

      /* Legend */
      .legend {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9em;
      }

      .legend-circle {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        flex-shrink: 0;
        border: 1px solid var(--yasno-border-color);
      }

      .legend-circle.current {
        border-color: var(--yasno-current-color);
      }

      .legend-circle.powered {
        background-color: var(--yasno-powered-color);
      }

      .legend-circle.certain-outage {
        background-color: var(--yasno-certain-color);
      }

      .legend-circle.possible-outage {
        background-color: var(--yasno-outage-color);
      }

      .error {
        padding: var(--ha-space-4);
        color: var(--error-color);
        font-weight: 500;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "yasno-outages-card": YasnoOutagesCard;
  }
}
