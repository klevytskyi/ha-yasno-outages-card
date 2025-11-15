# Build & Deployment Guide

## Prerequisites

- Node.js 18+ (or 20 recommended)
- npm 8+
- Git

## First-Time Setup

```bash
# 1. Clone the repository
git clone https://github.com/klevytskyi/ha-yasno-outages-card.git
cd ha-yasno-outages-card

# 2. Install dependencies
npm install

# 3. Verify installation
npm run lint
```

## Development Workflow

### Starting Development

```bash
# Watch mode - automatic rebuild on changes
npm run dev
```

This command:

- Watches `src/` for changes
- Rebuilds to `dist/yasno-outages-card.js` automatically
- Outputs minified production-ready code
- Great for rapid iteration

### Code Quality

Before committing:

```bash
# Format code
npm run format

# Check for linting issues
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

## Building for Production

```bash
# Create production build
npm run build
```

Output: `dist/yasno-outages-card.js` (minified, ready for deployment)

## Installation in Home Assistant

### Method 1: Manual Installation

```bash
# Build the card
npm run build

# Copy to Home Assistant www folder
cp dist/yasno-outages-card.js /path/to/homeassistant/www/

# Alternatively, if developing locally:
cp dist/yasno-outages-card.js ~/.homeassistant/www/
```

Then in `configuration.yaml`:

```yaml
lovelace:
  resources:
    - url: /local/yasno-outages-card.js
      type: module
```

Restart Home Assistant.

### Method 2: Symlink for Development

Create a symlink for live testing during development:

```bash
# MacOS/Linux
ln -s "$(pwd)/dist/yasno-outages-card.js" ~/.homeassistant/www/yasno-outages-card.js

# Then use npm run dev in one terminal
npm run dev
```

Now changes rebuild automatically and are immediately available in Home Assistant!

## Git Workflow

### Creating a Release

```bash
# 1. Update version in package.json
# 2. Build the card
npm run build

# 3. Commit changes
git add .
git commit -m "Release v1.0.0"

# 4. Create a tag
git tag v1.0.0

# 5. Push changes and tags
git push origin main
git push origin --tags
```

GitHub Actions will automatically:

- Build the release
- Create a GitHub release
- Upload `yasno-outages-card.js` as an asset

### Pull Request Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# ... edit files ...

# 3. Format and lint
npm run format
npm run lint

# 4. Commit
git add .
git commit -m "Add my feature"

# 5. Push to GitHub
git push origin feature/my-feature

# 6. Create pull request on GitHub
```

## File Structure After Build

```
dist/
├── yasno-outages-card.js       ← Ready for deployment
└── yasno-outages-card.js.map   ← Source map (optional)

src/
├── yasno-outages-card.ts       ← Source TypeScript

Generated files are .gitignored
```

## Troubleshooting Build Issues

### `npm install` fails

```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install
```

### Build produces empty/small file

```bash
# Verify esbuild is installed
npm list esbuild

# Reinstall if needed
npm install --save-dev esbuild
```

### TypeScript compilation errors

```bash
# Check tsconfig.json is valid
npx tsc --noEmit

# Fix issues and rebuild
npm run build
```

### Card not updating in Home Assistant

1. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
2. Check browser console for errors (F12)
3. Verify `configuration.yaml` resource path is correct
4. Restart Home Assistant

## Performance Optimization

The build is already optimized with:

- ✅ Minification via esbuild
- ✅ Tree-shaking (unused code removal)
- ✅ ES2020 module format
- ✅ No external dependencies bundled (uses HA's lit)

Output file size: ~15-20 KB (minified)

## Testing Before Release

### Local Testing

```bash
# 1. Build
npm run build

# 2. Copy to Home Assistant www
cp dist/yasno-outages-card.js ~/.homeassistant/www/

# 3. Edit dashboard in Home Assistant UI
# Add card type: custom:yasno-outages-card

# 4. Test with various scenarios:
# - Card loads correctly
# - Shows correct hour grid
# - Legend displays properly
# - Hover effects work
# - All three states display correctly
# - Partial hours show correctly
```

### Automation Testing

```bash
# Run linters
npm run lint

# Format check
npm run format -- --check
```

## GitHub Actions CI/CD

### Available Workflows

1. **build-release.yml**

   - Triggers on git tags (v\*)
   - Builds and creates GitHub release
   - Uploads JS file as release asset

2. **lint.yml**
   - Runs on push to main/develop
   - Runs on pull requests
   - Checks code formatting and linting

### Viewing Build Logs

Go to: `https://github.com/klevytskyi/ha-yasno-outages-card/actions`

## Version Management

Update `package.json` version following semantic versioning:

- **PATCH** (1.0.1): Bug fixes
- **MINOR** (1.1.0): New features, backward compatible
- **MAJOR** (2.0.0): Breaking changes

Example:

```json
{
  "version": "1.0.0"
}
```

## Distribution

### npm Registry (Optional Future)

When ready to publish to npm:

```bash
# Login to npm
npm login

# Publish
npm publish
```

### GitHub Releases (Current)

Releases are manually created or auto-created by GitHub Actions.

Users can download from: `https://github.com/klevytskyi/ha-yasno-outages-card/releases`

### HACS (Community Driven)

Users can add this repository to HACS:

1. In HACS, add custom repository
2. URL: `https://github.com/klevytskyi/ha-yasno-outages-card`
3. Category: Lovelace

## Quick Commands Reference

```bash
# Development
npm run dev          # Start watch mode

# Production
npm run build        # Build for production

# Code Quality
npm run format       # Format code
npm run lint         # Check for issues
npm run lint --fix   # Auto-fix issues

# Git
git tag v1.0.0       # Create release tag
git push --tags      # Push tags to GitHub
```

## Getting Help

- Check `DEVELOPMENT.md` for architecture details
- See `README.md` for feature overview and usage
- Review source code comments in `src/` directory for implementation details

---

**You're all set!** Start developing with `npm run dev`
