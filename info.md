# Yasno Outages Card

Visualize your 24-hour power outage schedule with a beautiful, responsive card for Home Assistant.

<img src="https://raw.githubusercontent.com/klevytskyi/ha-yasno-outages-card/master/images/ha-yasno-outages-card-light.png" alt="Light Theme" width="400">
<img src="https://raw.githubusercontent.com/klevytskyi/ha-yasno-outages-card/master/images/ha-yasno-outages-card-dark.png" alt="Dark Theme" width="400">

## Features

✨ **24-Hour Grid View** - Each hour displayed as an individual brick for easy scanning

🎨 **Three Power States**:

- **Powered** (White/Light) - No outage expected
- **Certain Outage** (Dark Blue) - Confirmed power cut
- **Possible Outage** (Gray) - Potential power cut

⏱️ **Partial Hour Support** - Visual splits when outages start or end mid-hour with gradient effects

🎯 **Current Hour Indicator** - Highlighted border shows the current time

📝 **Versatile Configuration**:

- Plain text, templates, or rich content items for title and subtitle
- Support for entity names, device names, areas, states, and attributes
- Auto-updating timestamp displays for sensor states

🎨 **Visual Editor** - Chip-based configuration interface (same as Home Assistant's tile card)

📱 **Responsive Design** - Adapts to all screen sizes and container widths

🌓 **Dark Mode Support** - Automatically adapts to your Home Assistant theme

## Prerequisites

Requires the [ha-yasno-outages integration](https://github.com/denysdovhan/ha-yasno-outages) to be installed and configured.

## Quick Start

### Minimal Configuration

```yaml
type: custom:yasno-outages-card
entity: calendar.yasno_power_outages
```

### With Custom Title and Subtitle

```yaml
type: custom:yasno-outages-card
entity: calendar.yasno_power_outages
title: "Графік відключень"
subtitle: "Сьогодні"
```

### With Template Support

```yaml
type: custom:yasno-outages-card
entity: calendar.yasno_power_outages
title: "{{ state_attr('calendar.yasno_power_outages', 'friendly_name') }}"
subtitle: "{{ now().strftime('%A, %d %B %Y') }}"
```

### With Content Items

```yaml
type: custom:yasno-outages-card
entity: calendar.yasno_power_outages
title:
  - type: entity
  - type: text
    text: "-"
  - type: area
subtitle_entity: sensor.yasno_last_updated
subtitle:
  - type: text
    text: "Оновлено:"
  - type: state
```

## Visual Configuration

You can also configure the card using the visual editor:

1. Add card → Search for "Yasno Outages Card"
2. Select your calendar entity
3. Use the chip-based selectors to configure title and subtitle
4. Switch between template mode and content mode as needed

## Support

- 📖 [Full Documentation](https://github.com/klevytskyi/ha-yasno-outages-card)
- 🐛 [Report Issues](https://github.com/klevytskyi/ha-yasno-outages-card/issues)
- 💬 [Home Assistant Community](https://community.home-assistant.io/)

---

**Design inspired by "Київ Цифровий" app by "КП ГІОЦ"**
