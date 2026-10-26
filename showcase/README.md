# Chrono showcase

Open **chrono-showcase.html** directly in a desktop browser. The presentation and native 3D forest growth effect work offline. Keep the `assets` and `screenshots` folders beside the HTML file.

Every slide stays on screen for **10 seconds**, including the opening. The current **13 pages** loop in **2 minutes 10 seconds**. The dashboard page includes the restored floating laptop and phone mockups.

## Pages

1. Chrono introduction
2. A clearer starting point
3. Dashboard with laptop and phone mockups
4. Tasks and projects
5. AI task generation and breakdown — animated brief, context, decision and proposal flow
6. Calendar and daily agenda
7. Scheduling suggestions
8. Full-screen Pomodoro scene
9. Planting and growth — animated seedling, growing and mature trees, with plant selection, Growth Points and planting in the 3D forest
10. Personal Forest — app tree models growing from seedling to mature, with XP gains
11. Mobile phone mockup
12. Dark and light themes
13. Website invitation

## Pomodoro design

The countdown sits in the center of a full-canvas landscape, with brief feature descriptions on the left and a softly rotating 3D tree on the right. A single clock counts down normally. At **40% of the Pomodoro slide duration** (4 seconds on this 10-second slide), the mode and clock switch to the break preview. The background, ring accent, bottom time bar and tree lighting follow with a **900 ms transition**. Subtle waves and slow scenic movement provide ambience. Reduced motion switches modes with no animated transition.

This is a staged focus-to-break preview, so the presentation changes modes without waiting 25 real minutes. It never displays two overlapping clocks. No Pomodoro screenshot is needed for this page. Play/Pause holds the presentation timeline and countdown. The separate motion control governs ambient animation.

## AI task flow

Slide 5 replaces the screenshot placeholder with editable SVG artwork. The prompt input, dark surfaces, subtle borders and teal accents match the website. A wider diagram and generous node padding keep the stages separate. The brief, local date/time zone and task rules feed the AI assistant. The chosen mode branches into task generation or breakdown, followed by field checks and an example CSIT321 lecture proposal for review, editing and saving. The proposal follows the Tasks table design, including its checkbox, header, due date, priority and status pills. The example follows the Generate tasks branch; breakdown remains visible as an alternative. The animation runs at twice the presentation clock's speed and finishes in about three seconds; Play/Pause controls it and revisiting the slide restarts it. Motion off and browser Print show the complete diagram. It is an illustrative flow and makes no AI requests.

## Controls

| Key                | Action                  |
| ------------------ | ----------------------- |
| Right / Left arrow | Next / previous slide   |
| Space              | Pause / resume playback |
| F                  | Toggle full screen      |
| M                  | Toggle motion           |
| O                  | Slide overview          |
| S                  | Screenshot checklist    |
| ? or H             | Help                    |
| Home / End         | First / last slide      |

Move the pointer to reveal the controls. Touch screens support horizontal swipes. Panels pause playback while open. The deck follows the system's reduced-motion preference and falls back to matching plant images if WebGL is unavailable. Browser Print includes every slide.

To start paused, open `chrono-showcase.html?paused=1`. To start at Pomodoro, use `chrono-showcase.html?slide=8`. Add `&paused=1` to hold that page.

## Screenshots

The supplied dashboard, task workspace and mobile captures are included. The calendar slide uses native HTML and CSS artwork inspired by the app's month grid, selected date, project colors and daily agenda; it does not display a screenshot. The updated mobile screenshot is shown inside both phone mockups, on slides 3 and 11. Adding an image replaces only that frame's screen content. The surrounding slide layout stays in place.

One app capture and one QR image are pending. Save PNGs to `showcase/screenshots/` using the exact filenames, then refresh.

| Slide | Filename | Capture |
| --- | --- | --- |
| 3 | `dashboard-desktop.png` | Ready: supplied desktop dashboard screenshot inside the laptop. |
| 4 | `task-workspace.png` | Ready: supplied desktop task list screenshot. |
| 7 | `scheduling-proposal.png` | Scheduling changes ready for review and confirmation. |
| 3, 11 | `dashboard-mobile.png` | Ready: supplied 373 x 812 mobile capture inside the phone frames. |
| 13 | `demo-qr.png` | A square QR pointing to the public website with a clear white margin. |

No screenshot is needed for the AI task flow, illustrated calendar, animated Pomodoro scene or 3D forest growth effect. Keep browser chrome, error overlays, loading states and sensitive data out of app captures.

## Website link

Set `demoUrl` in the `showcase-config` JSON near the bottom of the HTML to the public website URL, including `https://`. It stays blank until supplied. The presentation does not register or connect to an application route.

## Editing and rebuilding

- Slide text and order are ordinary HTML sections inside `#slides`.
- Each section's `data-seconds` controls its time on screen.
- Set `autoplay` to `false` for a manual presentation, or `motion` to `false` to start with motion disabled.
- Capture filenames and instructions are listed in the `captures` array.
- Move or share the whole `showcase` folder so relative asset paths remain intact.

The ready-to-use `assets/tree-motion.bundle.js` and `assets/forest-tree.bundle.js` embed Three.js and the three plant models. It requires no CDN, model fetch or application server. After editing `src/tree-motion.js` or the GLB files, rebuild from the repository root with `node showcase/build-tree.cjs` using the existing web dependencies. Normal presentation playback needs no build step.

## Content and assets

Feature descriptions follow the repository README and implemented frontend components. AI task proposals and calendar changes remain subject to review and confirmation. The deck makes no claim of measured productivity gains. External AI availability depends on the application's provider configuration.

Chrono artwork, logo, plant images, landscapes and device frames are copied from the application's existing public assets. Poppins Latin font files come from the project's local font bundle and use the SIL Open Font License 1.1 in `assets/fonts/OFL.txt`. Font source: https://github.com/google/fonts/tree/main/ofl/poppins.

The bundled Three.js 0.185.1 dependency uses the MIT license in `assets/THREE-LICENSE.txt`. Source plant models are copied from `frontend/web/public/models/plants/chrono/`.

## Forest growth effect

The Personal Forest media panel is replaced by a local 3D scene using the application's Chrono seedling, growing and mature GLB models. Over seven seconds, the tree increases in size, transitions between stages and earns an illustrative 150 XP with floating +25 XP bursts. The Growing indicator, progress bar, counter and model follow deck playback and reset on each visit. Reduced motion shows the mature stage. The matching application PNGs remain available if WebGL fails. No video, remote thumbnail or forest screenshot is required.
