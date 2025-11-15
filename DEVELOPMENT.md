# Development Guide

## Project Structure

```
ha-yasno-outages-card/
├── src/
│   └── yasno-outages-card.ts    # Main card component
├── dist/
│   └── yasno-outages-card.js    # Compiled card (generated)
├── examples/
│   ├── config.yaml              # Example YAML config
│   └── dashboard-config.json    # Example dashboard config
├── package.json
├── tsconfig.json
├── manifest.json
├── README.md
├── LICENSE
└── .gitignore
```

## Setup

1. **Clone the repository**:

```bash
git clone https://github.com/klevytskyi/ha-yasno-outages-card
cd ha-yasno-outages-card
```

2. **Install dependencies**:

```bash
npm install
```

## Development

### Building

**Development mode** (with watch):

```bash
npm run dev
```

**Production build** (minified):

```bash
npm run build
```

### Code Quality

**Format code**:

```bash
npm run format
```

**Lint code**:

```bash
npm run lint
```

## Card Features

### State System

The card displays three power states:

1. **Powered** (White/Light): Normal power supply
2. **Certain Outage** (Dark Navy): Scheduled power cut
3. **Possible Outage** (Yellow): Potential power cut

### Partial Hours

When outages start or end mid-hour, the brick shows a **vertical split design**:

- Left side shows the powered/outage ratio based on when the transition happens
- Vertical line divides the brick at the percentage matching the transition time
- Example: Outage starting at 12:45 = 75% powered (left) + 25% outage (right)

### Data Structure

The card expects the entity to provide outage data in this format:

```javascript
{
  outages: [
    {
      start_hour: 10, // Hour when outage starts (0-23)
      end_hour: 11, // Hour when outage ends (0-23)
      is_certain: true, // true for certain, false for possible
      start_minute: 30, // Optional: minute when outage starts
      end_minute: 45, // Optional: minute when outage ends
    },
  ];
}
```

## Configuration

### Entity Selection

Specify the entity providing outage data:

```yaml
- type: custom:yasno-outages-card
  entity: sensor.yasno_outages
```

### Optional Title

Add a custom title to the card:

```yaml
- type: custom:yasno-outages-card
  entity: sensor.yasno_outages
  title: Power Outage Schedule
```

## Styling

The card uses CSS custom properties for theming:

```css
--yasno-powered-color: #f5f5f5           /* Powered state color */
--yasno-outage-color: #ffc107            /* Possible outage color */
--yasno-certain-color: #1a2c4d           /* Certain outage color */
--yasno-border-color: #e0e0e0            /* Border color */
--yasno-partial-opacity: 0.6             /* Opacity for partial hours */
```

These can be overridden in your Home Assistant theme.

## Compatibility

- **Home Assistant**: 2025.10+
- **Browser**: Modern browsers with ES2020 support
- **Integration**: [ha-yasno-outages](https://github.com/denysdovhan/ha-yasno-outages)

## Release Process

1. Update version in `package.json`
2. Build the project: `npm run build`
3. Create a git tag: `git tag v1.0.0`
4. Push to GitHub: `git push origin --tags`
5. Create a release on GitHub with the compiled `dist/yasno-outages-card.js`

## Future Enhancements

- [ ] Configurable colors UI
- [ ] Entity selector in card config UI
- [ ] Support for multiple days
- [ ] Schedule export functionality
- [ ] Customizable legend
- [ ] Timezone support

## Troubleshooting

### Card Not Showing

1. Ensure dependencies are installed: `npm install`
2. Build the card: `npm run build`
3. Check that the card is properly referenced in your configuration
4. Check browser console for errors

### Data Not Updating

1. Verify the entity exists in Home Assistant
2. Check that the entity has the expected `outages` attribute
3. Restart Home Assistant if you've recently updated the integration

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Format code: `npm run format`
5. Lint: `npm run lint`
6. Create a pull request

## License

MIT License - See LICENSE file for details
