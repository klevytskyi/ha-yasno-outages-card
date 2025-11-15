# Yasno Outages Card - AI Coding Agent Instructions

## Project Context

Custom Home Assistant Lovelace card visualizing 24-hour power outage schedules caused by russian invasion of Ukraine. Built with Lit 3.x + TypeScript, bundled with esbuild for HACS distribution.

## 🇺🇦 Critical: Language & Localization Policy

- **NEVER suggest or add russian language translations** - this is a Ukrainian project standing with Ukraine
- Supported languages: Ukrainian (primary), English (fallback)
- Add translations: create `src/locales/{iso-code}.json`, import in `src/localize.ts`
- See `src/localize.ts` header comment for explicit policy statement

## Architecture (Modular Lit Components)

```
src/
├── yasno-outages-card.ts    # Main card component (LitElement)
├── editor.ts                 # Visual config editor (chip-based)
├── types.ts                  # Shared TypeScript interfaces
├── utils.ts                  # Pure helper functions
├── localize.ts              # i18n system (JSON imports)
└── locales/                 # Translation JSON files
    ├── en.json
    └── uk.json
```

**Key Pattern**: Modular separation - types, utils, and localization are extracted for reusability. Main card and editor are separate custom elements.

## Data Flow: Calendar → Events → Hour Bricks

1. **Source**: Home Assistant calendar entity from [ha-yasno-outages integration](https://github.com/denysdovhan/ha-yasno-outages)
2. **Fetch**: `getOutageData()` calls `hass.callWS()` to get calendar events for today (00:00 - 23:59)
3. **Transform**: Events → 24-element `HourData[]` array with states: `powered | certain_outage | possible_outage`
4. **Render**: Grid of hour bricks with CSS variables for theming

**Partial Hours**: Events with `start_minute`/`end_minute` trigger gradient backgrounds (see `getPartialHourStyle()` and `getPartialTextStyle()`)

## Critical Development Patterns

### Template Subscription System

```typescript
// In yasno-outages-card.ts - DON'T poll, subscribe for reactive updates
this._subscribeTemplate("title", config.title, (result) => {
  this.renderedTitle = result;
});
```

Templates (`{{ ... }}` or `{% ... %}`) use `hass.connection.subscribeMessage()` for real-time updates without polling.

### Content vs Template Mode

- **Template mode**: String with Jinja2 syntax → subscribe to updates
- **Content mode**: Array of `EntityNameItem[]` or `SubtitleItem[]` → render with `renderContentArray()`
- Editor toggles between modes; normalization happens in `utils.normalizeEntityNameValue()`

### Dark Mode Detection

```typescript
// Set via updated() lifecycle - hass.themes.darkMode
this.toggleAttribute("dark-mode", darkMode);
```

CSS uses `:host([dark-mode])` selector, not media queries.

## Build & Development Workflow

```bash
npm run dev      # Watch mode - auto-rebuild on save
npm run build    # Production build (minified)
npm run format   # Biome formatter
npm run lint     # Biome linter
```

**Build Output**: Single `dist/yasno-outages-card.js` (39-40kb minified) - this is the HACS distribution file.

**After Build**:

- Commit changes
- Update version in `package.json`
- Create git tag: `git tag v1.x.x`
- Push with tags: `git push origin main --tags`
- GitHub release: `gh release create v1.x.x dist/yasno-outages-card.js --title "..." --notes "..."`

## TypeScript Conventions

- **Decorators**: `@customElement`, `@property`, `@state` from Lit
- **Config**: `tsconfig.json` has `experimentalDecorators: true` and `useDefineForClassFields: false` (required for Lit)
- **JSON imports**: Enabled via `resolveJsonModule: true` for locales
- **Avoid `any`**: Known linter warnings exist but build works - prefer fixing with proper types

## Integration Points

### Home Assistant APIs

```typescript
// Calendar events
this.hass.callWS({
  type: "call_service",
  domain: "calendar",
  service: "get_events",
  // ...
});

// Template rendering
hass.connection.subscribeMessage(callback, {
  type: "render_template",
  template: "{{ ... }}",
});
```

### Custom Card Helpers

- Import from `custom-card-helpers` package
- Used for entity selectors in editor (see `editor.ts`)

## HACS Distribution

- **File**: `hacs.json` defines distribution (filename: `yasno-outages-card.js`, no content in root)
- **manifest.json**: NOT needed for Lovelace cards (deleted - it's for Python integrations)
- **Release**: Must include compiled `dist/yasno-outages-card.js` as GitHub release asset

## Testing in Home Assistant

```bash
# Development setup
npm run dev &
scp dist/* root@homeassistant.local:homeassistant/www/
# Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
```

## Design Constraints

- **Inspiration**: "Київ Цифровий" app by "КП ГІОЦ" - visual grid with hour bricks
- **Container Queries**: Uses CSS `@container` for responsive sizing (not media queries)
- **CSS Variables**: All colors/spacing via `--yasno-*` custom properties for theme compatibility

## Common Gotchas

1. **Lit lifecycle**: Don't forget `super.connectedCallback()` and `super.updated()`
2. **Template detection**: Check `isTemplate()` before deciding content vs template mode
3. **Partial hours**: Gradients require both background style (`getPartialHourStyle`) AND text style (`getPartialTextStyle`)
4. **Localization**: Always use `localize(key, hass.locale?.language)`, never hardcode strings
5. **Entity states**: Access via `this.hass.states[entityId]`, check existence before use

## Reference Files

- `src/yasno-outages-card.ts` (lines 140-180): `getStubConfig()` shows entity finding pattern
- `src/utils.ts`: Pure functions demonstrate content item rendering logic
- `examples/`: YAML config samples for testing
- `BUILD.md`: Full build/release workflow documentation

## Authoritative Sources

When implementing features or troubleshooting, consult these official resources:

- **[Home Assistant Custom Card Documentation](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card)** - Official guide for custom card development
- **[Home Assistant Frontend Repository](https://github.com/home-assistant/frontend)** - Source of truth for frontend patterns and APIs
