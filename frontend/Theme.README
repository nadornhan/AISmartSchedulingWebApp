1. Typography
Font family
font-family: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

Use Geist for the entire interface. Avoid mixing it with another font because the dashboard already contains many data points and labels.

Desktop typography
Element	Size	Weight	Line height
Main page title	30–32px	700	1.2
Greeting/title	28–30px	700	1.2
Section title	18–20px	600	1.3
Card title	16–18px	600	1.35
Task title	15–16px	600	1.4
Large stat value	26–30px	650–700	1.1
Standard body	14px	400	1.5
Navigation text	14px	500	1.3
Input text	14–15px	400	1.4
Label	12–13px	500	1.3
Helper text	12px	400	1.45
Badge text	11–12px	500–600	1
Mobile typography
Element	Size	Weight
Mobile page title	28px	700
Section title	18px	600
Card title	16px	600
Stat value	26–30px	700
Task title	15–16px	600
Body	14px	400
Bottom navigation label	12px	500
Badge	11px	600
Letter spacing
--tracking-heading: -0.025em;
--tracking-body: -0.01em;
--tracking-label: 0;

Use slight negative letter spacing only for headings and large numbers.

2. Main colors
:root {
  /* Backgrounds */
  --bg-page: #040C14;
  --bg-sidebar: #050E16;
  --bg-surface: #0A151E;
  --bg-surface-raised: #0D1A24;
  --bg-surface-hover: #11222C;
  --bg-input: #0A141D;

  /* Borders */
  --border-subtle: #172630;
  --border-default: #1C2D37;
  --border-strong: #29404B;

  /* Text */
  --text-primary: #F4F7F6;
  --text-secondary: #A3ADB2;
  --text-muted: #6E7D84;
  --text-disabled: #46545B;

  /* Accent */
  --accent: #35E3B5;
  --accent-hover: #4EEBC1;
  --accent-pressed: #20C99D;
  --accent-dark: #148B70;
  --accent-soft: rgba(53, 227, 181, 0.12);
  --accent-border: rgba(53, 227, 181, 0.28);
}
3. Background hierarchy
Main page
background: #040C14;

Optional subtle lighting:

background:
  radial-gradient(
    circle at 65% 15%,
    rgba(53, 227, 181, 0.045),
    transparent 34%
  ),
  #040C14;
Sidebar
background: #050E16;
border-right: 1px solid #172630;

The sidebar should be only slightly different from the page background.

Cards
background: #0A151E;
border: 1px solid #172630;

Raised or important card:

background: #0D1A24;
border: 1px solid #1C2D37;
Inputs
background: #0A141D;
border: 1px solid #1C2D37;
color: #F4F7F6;

Focused input:

border-color: #35E3B5;
box-shadow: 0 0 0 3px rgba(53, 227, 181, 0.10);
4. Text colors
--text-primary: #F4F7F6;
--text-secondary: #A3ADB2;
--text-muted: #6E7D84;
--text-placeholder: #627179;
--text-disabled: #46545B;

Use them as follows:

Primary: page titles, card headings, task names, large values
Secondary: descriptions, dates, helper copy
Muted: metadata, inactive labels, empty states
Disabled: unavailable buttons, disabled inputs

Avoid using pure white #FFFFFF everywhere. #F4F7F6 feels softer and more premium.

5. Accent green

Primary accent:

--accent: #35E3B5;

Supporting green shades:

--green-300: #65EBC9;
--green-400: #35E3B5;
--green-500: #20CFA2;
--green-600: #149A79;
--green-700: #0E654F;
Accent usage

Use #35E3B5 for:

Main buttons
Active navigation
Completed tasks
Focus progress
Positive statistics
Links
Selected controls
Progress bars

Do not use it for large background areas. Use transparent variants:

--green-bg-soft: rgba(53, 227, 181, 0.10);
--green-bg-medium: rgba(53, 227, 181, 0.16);
--green-border: rgba(53, 227, 181, 0.28);
6. Supporting semantic colors
Purple — focus and goals
--purple: #9767F4;
--purple-light: #B18AFF;
--purple-dark: #6742C5;
--purple-soft: rgba(151, 103, 244, 0.13);
--purple-border: rgba(151, 103, 244, 0.28);

Use for:

Focus Goal
Deep work
Personal projects
AI or analytical features
Selected focus presets
Orange — streak and medium priority
--orange: #F5A019;
--orange-light: #FFB648;
--orange-dark: #B96F08;
--orange-soft: rgba(245, 160, 25, 0.13);
--orange-border: rgba(245, 160, 25, 0.28);

Use for:

Current streak
Medium priority
Attention states that are not errors
Study category
Red — overdue and destructive
--red: #F04C55;
--red-light: #FF6972;
--red-dark: #B92E37;
--red-soft: rgba(240, 76, 85, 0.13);
--red-border: rgba(240, 76, 85, 0.28);

Use for:

Overdue tasks
Delete buttons
Error messages
High priority
Failed states
Blue — low priority and information
--blue: #4E8EFF;
--blue-light: #78AAFF;
--blue-dark: #2860C5;
--blue-soft: rgba(78, 142, 255, 0.13);
--blue-border: rgba(78, 142, 255, 0.28);

Use for:

Low priority
Office projects
Informational statuses
Calendar events
Yellow
--yellow: #FFC229;
--yellow-soft: rgba(255, 194, 41, 0.13);

Use for:

Quick Wins
Small alerts
Recommendations
Study labels
7. Stat cards

Base card:

.stat-card {
  background: #0A151E;
  border: 1px solid #172630;
  border-radius: 16px;
}

Recommended icon circle:

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

Examples:

.stat-progress .stat-icon {
  color: #35E3B5;
  background: rgba(53, 227, 181, 0.13);
}

.stat-focus .stat-icon {
  color: #9767F4;
  background: rgba(151, 103, 244, 0.13);
}

.stat-streak .stat-icon {
  color: #F5A019;
  background: rgba(245, 160, 25, 0.13);
}

.stat-overdue .stat-icon {
  color: #F04C55;
  background: rgba(240, 76, 85, 0.13);
}

Progress track:

background: #1B2932;

Progress fill:

/* Today progress */
#35E3B5

/* Focus */
#9767F4

/* Streak */
#F5A019

/* Overdue */
#F04C55
8. Buttons
Primary button
.primary-button {
  color: #04110D;
  background: linear-gradient(135deg, #35E3B5, #21CFA2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  font-weight: 600;
}

Hover:

background: linear-gradient(135deg, #4EEBC1, #2BD9AA);

Pressed:

background: #20C99D;
Secondary button
.secondary-button {
  color: #F4F7F6;
  background: #0D1A24;
  border: 1px solid #243741;
}
Ghost button
.ghost-button {
  color: #A3ADB2;
  background: transparent;
  border: 1px solid transparent;
}

Hover:

background: rgba(255, 255, 255, 0.04);
color: #F4F7F6;
Destructive button
.destructive-button {
  color: #FF6972;
  background: rgba(240, 76, 85, 0.12);
  border: 1px solid rgba(240, 76, 85, 0.22);
}
9. Status and priority badges

Base badge:

.badge {
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

High:

color: #FF6972;
background: rgba(240, 76, 85, 0.13);

Medium:

color: #FFB648;
background: rgba(245, 160, 25, 0.13);

Low:

color: #78AAFF;
background: rgba(78, 142, 255, 0.13);

Completed:

color: #35E3B5;
background: rgba(53, 227, 181, 0.13);

Pending:

color: #FFC229;
background: rgba(255, 194, 41, 0.12);

In progress:

color: #78AAFF;
background: rgba(78, 142, 255, 0.13);
10. Navigation
Desktop sidebar
.sidebar {
  width: 220px;
  background: #050E16;
  border-right: 1px solid #172630;
}

Inactive item:

color: #A3ADB2;
background: transparent;

Hover:

background: rgba(255, 255, 255, 0.035);
color: #F4F7F6;

Active:

color: #35E3B5;
background: rgba(53, 227, 181, 0.11);
border-left: 2px solid #35E3B5;
Mobile bottom navigation
.mobile-nav {
  background: rgba(7, 17, 24, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(18px);
  border-radius: 24px;
}

Inactive icons:

color: #89969C;

Active:

color: #35E3B5;

Focus button:

background: linear-gradient(145deg, #198366, #105743);
11. Icons

Recommended library: Lucide Icons

Desktop:

size={18}
strokeWidth={1.8}

Mobile:

size={22}
strokeWidth={1.8}

Large stat icon:

size={24}
strokeWidth={2}

Icon colors should follow the component meaning rather than all using green.

12. Borders and shadows
Borders
--border-subtle: rgba(255, 255, 255, 0.055);
--border-default: rgba(255, 255, 255, 0.085);
--border-active: rgba(53, 227, 181, 0.35);
Shadows

Card shadow:

box-shadow:
  0 12px 30px rgba(0, 0, 0, 0.18),
  inset 0 1px 0 rgba(255, 255, 255, 0.015);

Modal shadow:

box-shadow:
  0 30px 80px rgba(0, 0, 0, 0.55),
  0 0 0 1px rgba(255, 255, 255, 0.04);

Accent glow should be subtle:

box-shadow: 0 0 24px rgba(53, 227, 181, 0.10);
13. Border radius
--radius-xs: 6px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 20px;
--radius-pill: 999px;

Recommended usage:

Inputs: 10px
Buttons: 10px
Dashboard cards: 14–16px
Mobile cards: 16–18px
Modals: 18px
Badges: 999px
14. Spacing

Use a 4px base system:

--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;

Desktop card padding:

padding: 20px;

Large card:

padding: 24px;

Mobile card:

padding: 18px;

Grid gap:

gap: 16px;
15. Input dimensions
--input-height-desktop: 44px;
--input-height-mobile: 48px;

Input styles:

.form-input {
  height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  background: #0A141D;
  border: 1px solid #1C2D37;
  color: #F4F7F6;
  font-size: 14px;
}

Textarea:

min-height: 96px;
padding: 14px;
16. Modal system
.modal-overlay {
  background: rgba(1, 7, 12, 0.76);
  backdrop-filter: blur(6px);
}
.modal {
  width: 560px;
  background: #0B1720;
  border: 1px solid #263842;
  border-radius: 18px;
  padding: 28px;
}

Modal title:

font-size: 24px;
font-weight: 700;
letter-spacing: -0.02em;
17. Recommended complete CSS token set
:root {
  --font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

  --bg-page: #040C14;
  --bg-sidebar: #050E16;
  --bg-surface: #0A151E;
  --bg-surface-raised: #0D1A24;
  --bg-surface-hover: #11222C;
  --bg-input: #0A141D;

  --border-subtle: #172630;
  --border-default: #1C2D37;
  --border-strong: #29404B;

  --text-primary: #F4F7F6;
  --text-secondary: #A3ADB2;
  --text-muted: #6E7D84;
  --text-disabled: #46545B;

  --accent: #35E3B5;
  --accent-hover: #4EEBC1;
  --accent-pressed: #20C99D;
  --accent-dark: #148B70;
  --accent-soft: rgba(53, 227, 181, 0.12);

  --purple: #9767F4;
  --purple-soft: rgba(151, 103, 244, 0.13);

  --orange: #F5A019;
  --orange-soft: rgba(245, 160, 25, 0.13);

  --red: #F04C55;
  --red-soft: rgba(240, 76, 85, 0.13);

  --blue: #4E8EFF;
  --blue-soft: rgba(78, 142, 255, 0.13);

  --yellow: #FFC229;
  --yellow-soft: rgba(255, 194, 41, 0.13);

  --progress-track: #1B2932;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
}

The most important consistency rule is: keep every structural surface neutral and use semantic colors only for icons, badges, progress, statuses, and actions.
