import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { LovelaceCardEditor } from "custom-card-helpers";
import type {
  HomeAssistant,
  YasnoOutageConfig,
  OutageData,
  HourData,
  EntityNameItem,
  SubtitleItem,
} from "./types";
import {
  isTemplate,
  findEntity,
  renderContentItem,
  renderContentArray,
} from "./utils";
import { localize } from "./localize";
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
  description:
    "Display 24-hour power outage schedule from Yasno calendar integration",
  preview: true,
});

@customElement("yasno-outages-card")
export class YasnoOutagesCard extends LitElement {
  @property({ attribute: false })
  hass!: HomeAssistant;

  @property({ attribute: false })
  config!: YasnoOutageConfig;

  /**
   * Template Subscription System
   *
   * Tracks active subscriptions to Home Assistant templates.
   * Templates can contain dynamic variables that change over time (e.g., states, now(), etc.)
   * Instead of polling, we subscribe to template updates and get notified of changes.
   *
   * Usage: this._subscribeTemplate("key", "{{ template }}", (result) => { ... })
   */
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
    return document.createElement(
      "yasno-outages-card-editor"
    ) as LovelaceCardEditor;
  }

  public static getStubConfig(
    hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[]
  ): YasnoOutageConfig {
    const includeDomains = ["calendar"];
    const maxEntities = 1;

    // Helper to find entities matching domain
    const findEntity = (
      entityList: string[],
      maxCount: number,
      preferredKeyword?: string
    ): string[] => {
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
        for (
          let i = 0;
          i < entityList.length && preferredFiltered.length < maxCount;
          i++
        ) {
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
      for (
        let i = 0;
        i < entityList.length && filtered.length < maxCount;
        i++
      ) {
        if (conditions.every((cond) => cond(entityList[i]))) {
          filtered.push(entityList[i]);
        }
      }
      return filtered;
    };

    let foundEntities = findEntity(entities, maxEntities, "yasno");
    if (foundEntities.length === 0) {
      foundEntities = findEntity(entitiesFallback, maxEntities, "yasno");
    }

    return {
      type: "custom:yasno-outages-card",
      entity: foundEntities[0] || "",
      title: "",
    };
  }

  private async getOutageData(): Promise<OutageData> {
    const entity = this.hass.states[this.config.entity];

    if (!entity) {
      return { hours: [] };
    }

    const hours: HourData[] = Array.from({ length: 24 }, () => ({
      state: "powered" as const,
    }));

    if (entity.entity_id.startsWith("calendar.")) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const response: any = await this.hass.callWS({
          type: "call_service",
          domain: "calendar",
          service: "get_events",
          service_data: {
            start_date_time: today.toISOString(),
            end_date_time: tomorrow.toISOString(),
          },
          target: {
            entity_id: this.config.entity,
          },
          return_response: true,
        });

        const events = response?.response?.[this.config.entity]?.events || [];
        if (events && Array.isArray(events)) {
          for (const event of events) {
            const start = new Date(event.start);
            const end = new Date(event.end);

            // Check event type from description field
            // Yasno integration sets description to "Definite" or "NotPlanned"
            const eventType = event.description || "";

            // Skip NotPlanned events - they're not actual outages
            if (eventType === "NotPlanned") {
              continue;
            }

            // Definite events are certain outages
            const outageType = "certain_outage";

            // Only process today's events
            if (start.toDateString() !== today.toDateString()) {
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
                state: outageType,
                partType,
                partPercentage,
              };
            }
          }
        }
      } catch (error) {
        console.error("Error fetching calendar events:", error);
      }
    }

    const nowH = new Date().getHours();
    hours[nowH].isCurrent = true;

    return { hours };
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

  private formatDate(): string {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "long",
    };
    return today.toLocaleDateString(
      this.hass?.locale?.language || "en",
      options
    );
  }

  @property({ attribute: false })
  private outageData: OutageData = { hours: [] };

  @property({ attribute: false })
  private renderedTitle: string = "";

  @property({ attribute: false })
  private renderedSubtitle: string = "";

  async connectedCallback() {
    super.connectedCallback();
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

    // Update dark mode attribute
    if (changedProperties.has("hass")) {
      const darkMode = this.hass?.themes?.darkMode ?? false;
      this.toggleAttribute("dark-mode", darkMode);
    }

    if (changedProperties.has("hass") || changedProperties.has("config")) {
      await this.fetchOutageData();

      // Re-subscribe to templates if config changed
      if (changedProperties.has("config")) {
        this._subscribeTemplate("title", this.config.title, (result) => {
          this.renderedTitle = result;
        });
        this._subscribeTemplate("subtitle", this.config.subtitle, (result) => {
          this.renderedSubtitle = result;
        });
      }

      // Update subtitle entity display when hass changes (state updates)
      if (changedProperties.has("hass") && this.config.subtitle_entity) {
        this._subscribeTemplate("subtitle", this.config.subtitle, (result) => {
          this.renderedSubtitle = result;
        });
      }
    }
  }

  private async fetchOutageData() {
    this.outageData = await this.getOutageData();
  }

  /**
   * Check if a value is a Jinja2 template string
   */
  private _isTemplate(value: any): boolean {
    return (
      typeof value === "string" &&
      (value.includes("{{") || value.includes("{%"))
    );
  }

  /**
   * Subscribe to a template or render content items
   * @param key Unique identifier for this subscription
   * @param content Template string, content item, or array of content items (supports both object and string format)
   * @param callback Function to call with rendered result
   */
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
    callback: (result: string) => void
  ): void {
    // Unsubscribe from previous subscription with this key
    this._unsubscribe(key);

    // Handle default cases first
    if (!content) {
      if (key === "title") {
        // Default title: Use entity's friendly_name or localized default
        const entity = this.hass.states[this.config.entity];
        const lang = this.hass?.locale?.language || this.hass?.language;
        const defaultTitle =
          entity?.attributes?.friendly_name || localize("default_title", lang);
        callback(defaultTitle);
        return;
      }
      if (key === "subtitle") {
        // Default subtitle: Show current date
        callback(this.formatDate());
        return;
      }
      callback("");
      return;
    }

    // Check if content is a string (template or plain text)
    if (typeof content === "string") {
      // Check if it's a template
      if (!this._isTemplate(content)) {
        // Plain text
        callback(content);
        return;
      }

      // Subscribe to template updates
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
          }
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

    // Handle content items (object or array)
    const entityId =
      key === "subtitle" && this.config.subtitle_entity
        ? this.config.subtitle_entity
        : this.config.entity;

    const entity = this.hass.states[entityId];

    if (!entity) {
      callback("");
      return;
    }

    // Render content items
    if (Array.isArray(content)) {
      callback(this._renderContentArray(content, entity));
    } else {
      callback(this._renderContentItem(content, entity));
    }
  }

  /**
   * Unsubscribe from a specific template
   */
  private _unsubscribe(key: string): void {
    const unsubscribe = this._templateUnsubscribes.get(key);
    if (unsubscribe) {
      unsubscribe();
      this._templateUnsubscribes.delete(key);
    }
  }

  /**
   * Unsubscribe from all templates
   */
  private _unsubscribeAllTemplates(): void {
    this._templateUnsubscribes.forEach((unsubscribe) => unsubscribe());
    this._templateUnsubscribes.clear();
  }

  /**
   * Render a single content item (entity name, device, area, state, attribute, or text)
   * Handles both object format {type: "state"} and string format "state" from ui_state_content
   */
  private _renderContentItem(
    item: EntityNameItem | SubtitleItem | string,
    entity: any
  ): string {
    if (!entity) return "";

    // Handle string format from ui_state_content selector
    if (typeof item === "string") {
      // Check if it's a standard type
      if (item === "name") {
        return entity.attributes?.friendly_name || entity.entity_id;
      }
      if (item === "state") {
        return (this.hass as any).formatEntityState?.(entity) || entity.state;
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
          return (this.hass as any).formatEntityState?.(entity) || entity.state;
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
  private _renderContentArray(
    items: (EntityNameItem | SubtitleItem | string)[],
    entity: any
  ): string {
    if (!entity) return "";
    return items
      .map((item) => this._renderContentItem(item, entity))
      .filter((text) => text) // Remove empty strings
      .join(" ");
  }

  /**
   * Render subtitle - handles timestamp sensors specially in arrays, otherwise uses rendered string
   */
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
            : false
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
            if (
              typeof item === "object" &&
              "type" in item &&
              item.type === "state"
            ) {
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
          <div class="content">
            <div class="hours-grid">
              ${this.outageData.hours.map(
                (hourData: HourData, hour) => html`
                  <div
                    class="hour-brick ${this.getStateClass(
                      hourData.state,
                      hourData.partType !== undefined
                    )} ${hourData.isCurrent == true ? "current" : ""}"
                    title="${this.formatTime(hour)}"
                    style="${hourData.partType !== undefined
                      ? this.getPartialHourStyle(
                          hourData.state,
                          hourData.partPercentage || 0,
                          hourData.partType || "start"
                        )
                      : ""}"
                  >
                    <div
                      class="hour-label"
                      style="${hourData.partType !== undefined
                        ? this.getPartialTextStyle(
                            hourData.state,
                            hourData.partPercentage || 0,
                            hourData.partType || "start"
                          )
                        : ""}"
                    >
                      ${hourData.partType === undefined
                        ? hourData.state === "certain_outage" ||
                          hourData.state === "possible_outage"
                          ? html`<ha-icon icon="mdi:flash-off"></ha-icon>`
                          : html`<ha-icon icon="mdi:flash"></ha-icon>`
                        : ""}
                      ${String(hour).padStart(2, "0")}:00
                    </div>
                  </div>
                `
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
    partType: "start" | "end"
  ): string {
    const color =
      state === "certain_outage"
        ? "var(--yasno-certain-color)"
        : "var(--yasno-outage-color)";

    if (partType === "start") {
      // Start of outage: powered (left) -> outage (right)
      return `background-image: linear-gradient(to right, var(--yasno-powered-color) 0%, var(--yasno-powered-color) ${
        100 - percentage
      }%, ${color} ${100 - percentage}%, ${color} 100%);`;
    } else {
      // End of outage: outage (left) -> powered (right)
      return `background-image: linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, var(--yasno-powered-color) ${percentage}%, var(--yasno-powered-color) 100%);`;
    }
  }

  private getPartialTextStyle(
    state: string,
    percentage: number,
    partType: "start" | "end"
  ): string {
    const direction = partType === "end" ? "to right" : "to left";

    // Text color for outage portion
    const outageTextColor =
      state === "certain_outage" ? "white" : "var(--yasno-font-color)";

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
      }

      @container (width > 340px) {
        ha-card {
          --yasno-content-padding: var(--ha-space-4);
          --yasno-grid-gap: var(--ha-space-3);
          --yasno-title-font-size: var(--ha-font-size-l);
          --yasno-subtitle-font-size: var(--ha-font-size-m);
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

      .content {
        padding: var(--yasno-content-padding);
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
