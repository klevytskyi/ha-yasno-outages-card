/**
 * Localization system for Yasno Outages Card
 *
 * Translations are stored in JSON files in src/locales/ directory.
 *
 * To add a new language:
 * 1. Create src/locales/{language-code}.json with all translation keys
 * 2. Import it below
 * 3. Add it to the translations object
 *
 * NOTE: This project does NOT support russian language translations.
 * 🇺🇦 Stand with Ukraine.
 */

import en from "./locales/en.json";
import uk from "./locales/uk.json";

export interface Translations {
  legend_current: string;
  legend_powered: string;
  legend_certain_outage: string;
  legend_possible_outage: string;
  default_title: string;
  schedule_applies: string;
  waiting_for_schedule: string;
}

const translations: Record<string, Translations> = {
  en,
  uk,
};

/**
 * Get translation for a given key
 * Uses Home Assistant's configured language with fallback to English
 */
export function localize(key: keyof Translations, language?: string): string {
  const lang = language?.split("-")[0] || "en";
  const strings = translations[lang] || translations.en;
  return strings[key] || translations.en[key];
}
