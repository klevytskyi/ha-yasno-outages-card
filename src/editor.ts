import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { LovelaceCardEditor } from "custom-card-helpers";
import type { HomeAssistant, YasnoOutageConfig } from "./types";
import { isTemplate, normalizeEntityNameValue } from "./utils";

@customElement("yasno-outages-card-editor")
export class YasnoOutagesCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: YasnoOutageConfig;
  @state() private _titleMode: "template" | "content" = "content";
  @state() private _subtitleMode: "template" | "content" = "content";

  setConfig(config: YasnoOutageConfig): void {
    this._config = config;
  }

  private _valueChanged(ev: CustomEvent): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target as any;
    const value = ev.detail.value;

    if (target.configValue) {
      // Check if value is empty, null, undefined, or an empty array
      const isEmpty =
        value === "" ||
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0);

      if (isEmpty) {
        // Delete the field from config
        const newConfig = { ...this._config };
        delete newConfig[target.configValue as keyof YasnoOutageConfig];
        this._config = newConfig;
      } else {
        // For title/subtitle in content mode, always ensure it's an array
        const isContentField = target.configValue === "title" || target.configValue === "subtitle";
        const isContentMode =
          (target.configValue === "title" && this._titleMode === "content") ||
          (target.configValue === "subtitle" && this._subtitleMode === "content");

        let finalValue = value;
        if (isContentField && isContentMode) {
          // Ensure value is an array
          if (!Array.isArray(finalValue)) {
            finalValue = [finalValue];
          }

          // Normalize plain strings to {type: "text", text: "..."} format
          if (target.configValue === "title") {
            finalValue = normalizeEntityNameValue(finalValue);
          }
        }

        this._config = {
          ...this._config,
          [target.configValue]: finalValue,
        };
      }
    }

    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  private _modeChanged(ev: CustomEvent, field: "title" | "subtitle"): void {
    const mode = ev.detail.value as "template" | "content";
    if (field === "title") {
      this._titleMode = mode;
    } else {
      this._subtitleMode = mode;
    }
  }

  private _fireConfigChanged(): void {
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    return html`
      <div class="card-config">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ entity: { domain: "calendar" } }}
          .value=${this._config.entity}
          .label=${"Calendar Entity (Required)"}
          .required=${true}
          @value-changed=${this._valueChanged}
          .configValue=${"entity"}
        ></ha-selector>

        <div class="switch-container">
          <label>Use Template for Title</label>
          <ha-switch
            .checked=${this._titleMode === "template"}
            @change=${(ev: Event) => {
              const target = ev.target as HTMLInputElement;
              this._modeChanged(
                new CustomEvent("value-changed", {
                  detail: { value: target.checked ? "template" : "content" },
                }),
                "title",
              );
            }}
          ></ha-switch>
        </div>

        ${
          this._titleMode === "template"
            ? html`
              <ha-selector
                .hass=${this.hass}
                .selector=${{ template: {} }}
                .value=${
                  isTemplate(this._config.title) || typeof this._config.title === "string"
                    ? this._config.title
                    : ""
                }
                .label=${"Title (Jinja2 Template)"}
                @value-changed=${this._valueChanged}
                .configValue=${"title"}
              ></ha-selector>
            `
            : html`
              <ha-selector
                .hass=${this.hass}
                .selector=${{ entity_name: {} }}
                .value=${this._config.title}
                .label=${"Title"}
                .helper=${"Select entity names or enter custom text. Note: Custom text will show as invalid but will work correctly."}
                .context=${{ entity: this._config.entity }}
                @value-changed=${this._valueChanged}
                .configValue=${"title"}
              ></ha-selector>
            `
        }

        <ha-selector
          .hass=${this.hass}
          .selector=${{ entity: {} }}
          .value=${this._config.subtitle_entity || ""}
          .label=${"Subtitle Entity (Optional)"}
          @value-changed=${this._valueChanged}
          .configValue=${"subtitle_entity"}
        ></ha-selector>

        <div class="switch-container">
          <label>Use Template for Subtitle</label>
          <ha-switch
            .checked=${this._subtitleMode === "template"}
            @change=${(ev: Event) => {
              const target = ev.target as HTMLInputElement;
              this._modeChanged(
                new CustomEvent("value-changed", {
                  detail: { value: target.checked ? "template" : "content" },
                }),
                "subtitle",
              );
            }}
          ></ha-switch>
        </div>

        ${
          this._subtitleMode === "template"
            ? html`
              <ha-selector
                .hass=${this.hass}
                .selector=${{ template: {} }}
                .value=${isTemplate(this._config.subtitle) ? this._config.subtitle : ""}
                .label=${"Subtitle (Jinja2 Template)"}
                @value-changed=${this._valueChanged}
                .configValue=${"subtitle"}
              ></ha-selector>
            `
            : html`
              <ha-selector
                .hass=${this.hass}
                .selector=${{ ui_state_content: { allow_name: true } }}
                .value=${this._config.subtitle}
                .label=${"Subtitle"}
                .helper=${"Select entity state/attributes or enter custom text. Note: Custom text will show as invalid but will work correctly."}
                .context=${{
                  filter_entity: this._config.subtitle_entity || this._config.entity,
                }}
                @value-changed=${this._valueChanged}
                .configValue=${"subtitle"}
              ></ha-selector>
            `
        }
        <div class="switch-container">
          <label>Show legend</label>
          <ha-switch
            .checked=${this._config.show_legend !== false}
            @change=${(ev: Event) => {
              const target = ev.target as HTMLInputElement;
              this._config = {
                ...this._config,
                show_legend: target.checked,
              };
              this._fireConfigChanged();
            }}
          ></ha-switch>
        </div>
      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .switch-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
      }

      .switch-container label {
        font-size: var(--ha-font-size-s);
        font-weight: var(--ha-font-weight-medium);
        color: var(--primary-text-color);
      }

      .helper-text {
        font-size: var(--ha-font-size-s);
        color: var(--secondary-text-color);
        margin-top: -8px;
        line-height: 1.4;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "yasno-outages-card-editor": YasnoOutagesCardEditor;
  }
}
