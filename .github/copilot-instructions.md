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

## Data Flow: Calendar → Cache → Render

1. **Source**: Home Assistant calendar entity from [ha-yasno-outages integration](https://github.com/denysdovhan/ha-yasno-outages)
2. **Fetch**: `fetchBothDaysData()` calls `hass.callWS()` once to get events for today + tomorrow (00:00 - 48:00)
3. **Cache**: `_processEventsForDay()` transforms events → two `OutageData` objects stored in `outageDataCache`
4. **Display**: `_updateDisplayedData()` switches between cached days instantly (no refetch)
5. **Render**: Grid of 24 hour bricks with CSS variables for theming

**Partial Hours**: Events with mid-hour start/end → gradient backgrounds via `getPartialHourStyle()` + `getPartialTextStyle()`

**Weekly Tabs**: When `show_weekly: true`, renders today/tomorrow tabs. Tab switching uses cached data for instant response.

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
- **Content mode**: Array of `EntityNameItem[]` or `SubtitleItem[]` → render with `_renderContentArray()`
- **Important**: Rendering functions (`_renderContentItem`, `_renderContentArray`) stay in component (need `this.hass` access)
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
npm run check    # Biome check & auto-fix
```

**Build Output**: Single `dist/yasno-outages-card.js` (~43.7kb minified) - this is the HACS distribution file.

**Version Injection**: `__VERSION__` is replaced at build time via esbuild `--define` flag from `package.json` version.

**Git Hooks (Husky + Lint-staged)**:

- **Pre-commit**: Automatically runs `biome check --write` and `biome format --write` on staged `.ts` files
- **Commit-msg**: Validates commit messages follow Conventional Commits format
- Configure in `package.json` → `lint-staged` section

**Release Workflow**:

1. Update version in `package.json`
2. Build: `npm run build`
3. Commit: `git commit -m "build: release v1.x.x"`
4. Tag: `git tag v1.x.x`
5. Push: `git push origin master --tags`
6. GitHub Actions auto-creates release with compiled JS

## TypeScript Conventions

- **Decorators**: `@customElement`, `@property`, `@state` from Lit
- **Config**: `tsconfig.json` has `experimentalDecorators: true` and `useDefineForClassFields: false` (required for Lit)
- **JSON imports**: Enabled via `resolveJsonModule: true` for locales
- **Code Quality**: Biome enforces strict rules - no `any`, no `==`, no `forEach` (use `for...of`)

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
# Development setup - outputs yasno-outages-card-dev.js with custom:yasno-outages-card-dev type
npm run dev &
scp dist/yasno-outages-card-dev.js root@homeassistant.local:homeassistant/www/
# Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

# Add resource in HA: /local/yasno-outages-card-dev.js
# Use card type: custom:yasno-outages-card-dev
```

**Dev mode benefits**: Separate custom element name allows testing alongside HACS-installed production version without conflicts.

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
6. **Data caching**: Weekly tabs use cached data - don't refetch on tab switch
7. **Rendering functions**: Keep component-dependent renders in card class, not utils (need `this.hass`)

## Reference Files

- `src/yasno-outages-card.ts` (~1027 lines): Main component with caching, rendering, template subscription
- `src/editor.ts`: Visual config editor with template/content mode switching
- `src/utils.ts`: Pure helpers (findEntity, isTemplate, normalizeEntityNameValue)
- `src/types.ts`: TypeScript interfaces (clean, no inline comments)
- `src/localize.ts`: i18n system with explicit language policy
- `examples/`: YAML config samples for testing
- `BUILD.md` & `DEVELOPMENT.md`: Build/release workflow documentation
- `commitlint.config.js` + `.husky/`: Git hooks configuration

## Authoritative Sources

When implementing features or troubleshooting, consult these official resources:

- **[Home Assistant Custom Card Documentation](https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card)** - Official guide for custom card development
- **[Home Assistant Frontend Repository](https://github.com/home-assistant/frontend)** - Source of truth for frontend patterns and APIs
