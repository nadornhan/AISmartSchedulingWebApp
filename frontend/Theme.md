# AI Smart Scheduling Theme Guide

This document defines the visual language for the AI Smart Scheduling interface. Keep structural surfaces neutral, and reserve semantic colors for icons, badges, progress indicators, statuses, and actions.

## Table of contents

1. [Typography](#1-typography)
2. [Main colors](#2-main-colors)
3. [Background hierarchy](#3-background-hierarchy)
4. [Text colors](#4-text-colors)
5. [Accent green](#5-accent-green)
6. [Supporting semantic colors](#6-supporting-semantic-colors)
7. [Stat cards](#7-stat-cards)
8. [Buttons](#8-buttons)
9. [Status and priority badges](#9-status-and-priority-badges)
10. [Navigation](#10-navigation)
11. [Icons](#11-icons)
12. [Borders and shadows](#12-borders-and-shadows)
13. [Border radius](#13-border-radius)
14. [Spacing](#14-spacing)
15. [Input dimensions](#15-input-dimensions)
16. [Modal system](#16-modal-system)
17. [Complete CSS token set](#17-complete-css-token-set)

## 1. Typography

### Font family

```css
font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Use Geist throughout the interface. Avoid mixing it with another font because the dashboard already contains many data points and labels.

### Desktop typography

| Element | Size | Weight | Line height |
| --- | --- | --- | --- |
| Main page title | 30–32px | 700 | 1.2 |
| Greeting/title | 28–30px | 700 | 1.2 |
| Section title | 18–20px | 600 | 1.3 |
| Card title | 16–18px | 600 | 1.35 |
| Task title | 15–16px | 600 | 1.4 |
| Large stat value | 26–30px | 650–700 | 1.1 |
| Standard body | 14px | 400 | 1.5 |
| Navigation text | 14px | 500 | 1.3 |
| Input text | 14–15px | 400 | 1.4 |
| Label | 12–13px | 500 | 1.3 |
| Helper text | 12px | 400 | 1.45 |
| Badge text | 11–12px | 500–600 | 1 |

### Mobile typography

| Element | Size | Weight |
| --- | --- | --- |
| Mobile page title | 28px | 700 |
| Section title | 18px | 600 |
| Card title | 16px | 600 |
| Stat value | 26–30px | 700 |
| Task title | 15–16px | 600 |
| Body | 14px | 400 |
| Bottom navigation label | 12px | 500 |
| Badge | 11px | 600 |

### Letter spacing

```css
--tracking-heading: -0.025em;
--tracking-body: -0.01em;
--tracking-label: 0;
```

Use slight negative letter spacing only for headings and large numbers.

## 2. Main colors

```css
:root {
  /* Backgrounds */
  --bg-page: #040c14;
  --bg-sidebar: #050e16;
  --bg-surface: #0a151e;
  --bg-surface-raised: #0d1a24;
  --bg-surface-hover: #11222c;
  --bg-input: #0a141d;

  /* Borders */
  --border-subtle: #172630;
  --border-default: #1c2d37;
  --border-strong: #29404b;

  /* Text */
  --text-primary: #f4f7f6;
  --text-secondary: #a3adb2;
  --text-muted: #6e7d84;
  --text-disabled: #46545b;

  /* Accent */
  --accent: #35e3b5;
  --accent-hover: #4eebc1;
  --accent-pressed: #20c99d;
  --accent-dark: #148b70;
  --accent-soft: rgba(53, 227, 181, 0.12);
  --accent-border: rgba(53, 227, 181, 0.28);
}
```

## 3. Background hierarchy

### Main page

```css
background: #040c14;
```

Optional subtle lighting:

```css
background:
  radial-gradient(
    circle at 65% 15%,
    rgba(53, 227, 181, 0.045),
    transparent 34%
  ),
  #040c14;
```

### Sidebar

```css
background: #050e16;
border-right: 1px solid #172630;
```

The sidebar should be only slightly different from the page background.

### Cards

```css
background: #0a151e;
border: 1px solid #172630;
```

For a raised or important card:

```css
background: #0d1a24;
border: 1px solid #1c2d37;
```

### Inputs

```css
background: #0a141d;
border: 1px solid #1c2d37;
color: #f4f7f6;
```

Focused input:

```css
border-color: #35e3b5;
box-shadow: 0 0 0 3px rgba(53, 227, 181, 0.1);
```

## 4. Text colors

```css
--text-primary: #f4f7f6;
--text-secondary: #a3adb2;
--text-muted: #6e7d84;
--text-placeholder: #627179;
--text-disabled: #46545b;
```

| Token | Usage |
| --- | --- |
| Primary | Page titles, card headings, task names, and large values |
| Secondary | Descriptions, dates, and helper copy |
| Muted | Metadata, inactive labels, and empty states |
| Disabled | Unavailable buttons and disabled inputs |

Avoid using pure white (`#ffffff`) everywhere. `#f4f7f6` feels softer and more premium.

## 5. Accent green

### Primary accent

```css
--accent: #35e3b5;
```

### Supporting shades

```css
--green-300: #65ebc9;
--green-400: #35e3b5;
--green-500: #20cfa2;
--green-600: #149a79;
--green-700: #0e654f;
```

Use `#35e3b5` for:

- Main buttons
- Active navigation
- Completed tasks
- Focus progress
- Positive statistics
- Links
- Selected controls
- Progress bars

Do not use the accent for large background areas. Use transparent variants instead:

```css
--green-bg-soft: rgba(53, 227, 181, 0.1);
--green-bg-medium: rgba(53, 227, 181, 0.16);
--green-border: rgba(53, 227, 181, 0.28);
```

## 6. Supporting semantic colors

### Purple — focus and goals

```css
--purple: #9767f4;
--purple-light: #b18aff;
--purple-dark: #6742c5;
--purple-soft: rgba(151, 103, 244, 0.13);
--purple-border: rgba(151, 103, 244, 0.28);
```

Use for focus goals, deep work, personal projects, AI or analytical features, and selected focus presets.

### Orange — streak and medium priority

```css
--orange: #f5a019;
--orange-light: #ffb648;
--orange-dark: #b96f08;
--orange-soft: rgba(245, 160, 25, 0.13);
--orange-border: rgba(245, 160, 25, 0.28);
```

Use for current streaks, medium-priority items, non-error attention states, and the study category.

### Red — overdue and destructive

```css
--red: #f04c55;
--red-light: #ff6972;
--red-dark: #b92e37;
--red-soft: rgba(240, 76, 85, 0.13);
--red-border: rgba(240, 76, 85, 0.28);
```

Use for overdue tasks, delete buttons, error messages, high-priority items, and failed states.

### Blue — low priority and information

```css
--blue: #4e8eff;
--blue-light: #78aaff;
--blue-dark: #2860c5;
--blue-soft: rgba(78, 142, 255, 0.13);
--blue-border: rgba(78, 142, 255, 0.28);
```

Use for low-priority items, office projects, informational statuses, and calendar events.

### Yellow — quick wins and recommendations

```css
--yellow: #ffc229;
--yellow-soft: rgba(255, 194, 41, 0.13);
```

Use for quick wins, small alerts, recommendations, and study labels.

## 7. Stat cards

### Base card

```css
.stat-card {
  background: #0a151e;
  border: 1px solid #172630;
  border-radius: 16px;
}
```

### Icon circle

```css
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.stat-progress .stat-icon {
  color: #35e3b5;
  background: rgba(53, 227, 181, 0.13);
}

.stat-focus .stat-icon {
  color: #9767f4;
  background: rgba(151, 103, 244, 0.13);
}

.stat-streak .stat-icon {
  color: #f5a019;
  background: rgba(245, 160, 25, 0.13);
}

.stat-overdue .stat-icon {
  color: #f04c55;
  background: rgba(240, 76, 85, 0.13);
}
```

### Progress colors

| Indicator | Color |
| --- | --- |
| Track | `#1b2932` |
| Today’s progress | `#35e3b5` |
| Focus | `#9767f4` |
| Streak | `#f5a019` |
| Overdue | `#f04c55` |

## 8. Buttons

### Primary button

```css
.primary-button {
  color: #04110d;
  background: linear-gradient(135deg, #35e3b5, #21cfa2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  font-weight: 600;
}

.primary-button:hover {
  background: linear-gradient(135deg, #4eebc1, #2bd9aa);
}

.primary-button:active {
  background: #20c99d;
}
```

### Secondary button

```css
.secondary-button {
  color: #f4f7f6;
  background: #0d1a24;
  border: 1px solid #243741;
}
```

### Ghost button

```css
.ghost-button {
  color: #a3adb2;
  background: transparent;
  border: 1px solid transparent;
}

.ghost-button:hover {
  color: #f4f7f6;
  background: rgba(255, 255, 255, 0.04);
}
```

### Destructive button

```css
.destructive-button {
  color: #ff6972;
  background: rgba(240, 76, 85, 0.12);
  border: 1px solid rgba(240, 76, 85, 0.22);
}
```

## 9. Status and priority badges

### Base badge

```css
.badge {
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
```

| Badge | Text color | Background |
| --- | --- | --- |
| High | `#ff6972` | `rgba(240, 76, 85, 0.13)` |
| Medium | `#ffb648` | `rgba(245, 160, 25, 0.13)` |
| Low | `#78aaff` | `rgba(78, 142, 255, 0.13)` |
| Completed | `#35e3b5` | `rgba(53, 227, 181, 0.13)` |
| Pending | `#ffc229` | `rgba(255, 194, 41, 0.12)` |
| In progress | `#78aaff` | `rgba(78, 142, 255, 0.13)` |

## 10. Navigation

### Desktop sidebar

```css
.sidebar {
  width: 220px;
  background: #050e16;
  border-right: 1px solid #172630;
}

.sidebar-item {
  color: #a3adb2;
  background: transparent;
}

.sidebar-item:hover {
  color: #f4f7f6;
  background: rgba(255, 255, 255, 0.035);
}

.sidebar-item.active {
  color: #35e3b5;
  background: rgba(53, 227, 181, 0.11);
  border-left: 2px solid #35e3b5;
}
```

### Mobile bottom navigation

```css
.mobile-nav {
  background: rgba(7, 17, 24, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(18px);
  border-radius: 24px;
}

.mobile-nav-item {
  color: #89969c;
}

.mobile-nav-item.active {
  color: #35e3b5;
}

.mobile-nav-focus {
  background: linear-gradient(145deg, #198366, #105743);
}
```

## 11. Icons

Recommended library: [Lucide Icons](https://lucide.dev/).

```jsx
// Desktop
<Icon size={18} strokeWidth={1.8} />

// Mobile
<Icon size={22} strokeWidth={1.8} />

// Large stat icon
<Icon size={24} strokeWidth={2} />
```

Icon colors should follow the component’s meaning rather than all using green.

## 12. Borders and shadows

### Borders

```css
--border-subtle: rgba(255, 255, 255, 0.055);
--border-default: rgba(255, 255, 255, 0.085);
--border-active: rgba(53, 227, 181, 0.35);
```

### Shadows

```css
/* Card */
box-shadow:
  0 12px 30px rgba(0, 0, 0, 0.18),
  inset 0 1px 0 rgba(255, 255, 255, 0.015);

/* Modal */
box-shadow:
  0 30px 80px rgba(0, 0, 0, 0.55),
  0 0 0 1px rgba(255, 255, 255, 0.04);

/* Subtle accent glow */
box-shadow: 0 0 24px rgba(53, 227, 181, 0.1);
```

## 13. Border radius

```css
--radius-xs: 6px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-pill: 999px;
```

| Component | Radius |
| --- | --- |
| Inputs | 10px |
| Buttons | 10px |
| Dashboard cards | 14–16px |
| Mobile cards | 16–18px |
| Modals | 18px |
| Badges | 999px |

## 14. Spacing

Use a 4px base system:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
```

| Context | Value |
| --- | --- |
| Desktop card padding | 20px |
| Large card padding | 24px |
| Mobile card padding | 18px |
| Grid gap | 16px |

## 15. Input dimensions

```css
--input-height-desktop: 44px;
--input-height-mobile: 48px;

.form-input {
  height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  background: #0a141d;
  border: 1px solid #1c2d37;
  color: #f4f7f6;
  font-size: 14px;
}

textarea.form-input {
  min-height: 96px;
  padding: 14px;
}
```

## 16. Modal system

```css
.modal-overlay {
  background: rgba(1, 7, 12, 0.76);
  backdrop-filter: blur(6px);
}

.modal {
  width: 560px;
  padding: 28px;
  background: #0b1720;
  border: 1px solid #263842;
  border-radius: 18px;
}

.modal-title {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
```

## 17. Complete CSS token set

```css
:root {
  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --bg-page: #040c14;
  --bg-sidebar: #050e16;
  --bg-surface: #0a151e;
  --bg-surface-raised: #0d1a24;
  --bg-surface-hover: #11222c;
  --bg-input: #0a141d;

  --border-subtle: #172630;
  --border-default: #1c2d37;
  --border-strong: #29404b;

  --text-primary: #f4f7f6;
  --text-secondary: #a3adb2;
  --text-muted: #6e7d84;
  --text-disabled: #46545b;

  --accent: #35e3b5;
  --accent-hover: #4eebc1;
  --accent-pressed: #20c99d;
  --accent-dark: #148b70;
  --accent-soft: rgba(53, 227, 181, 0.12);

  --purple: #9767f4;
  --purple-soft: rgba(151, 103, 244, 0.13);

  --orange: #f5a019;
  --orange-soft: rgba(245, 160, 25, 0.13);

  --red: #f04c55;
  --red-soft: rgba(240, 76, 85, 0.13);

  --blue: #4e8eff;
  --blue-soft: rgba(78, 142, 255, 0.13);

  --yellow: #ffc229;
  --yellow-soft: rgba(255, 194, 41, 0.13);

  --progress-track: #1b2932;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}
```

> **Consistency rule:** Keep every structural surface neutral. Use semantic colors only for icons, badges, progress indicators, statuses, and actions.
