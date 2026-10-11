# Discord Pad: implementation plan

A Windows desktop wrapper around the Discord web app (discord.com/app) that can be driven entirely from an Xbox-style controller, for an HTPC running in the Xbox full-screen experience.

## Goals
1. Sign in once, then join servers, read and send messages, and take voice/video calls from the couch with only a controller.
2. TV-friendly: launches full screen, larger zoom, a clear focus highlight, no mouse needed.
3. Installs and launches like a normal Windows app so it can be pinned in the Xbox full-screen library.

## Architecture
- **Electron main process** (`src/main`)
  - One full-screen window loading `https://discord.com/app` in a persistent session (login survives restarts).
  - Chrome user agent, background throttling off (calls keep running), single-instance lock.
  - Permissions granted only to Discord origins: microphone, camera, notifications, screen share.
  - Navigation locked to Discord hosts; other links open in the default browser.
  - Small IPC surface for the preload: send a trusted key chord (allowlisted), insert text, toggle full screen, change zoom. Every message is validated.
  - Settings in `%APPDATA%/Discord Pad/settings.json` (zoom, full screen, button mapping).
- **Preload** (`src/preload`, bundled with esbuild, context-isolated, sandboxed)
  - **Gamepad loop**: polls the Gamepad API each frame, edge detection, auto-repeat for held D-pad/stick.
  - **Spatial navigation**: D-pad/left stick moves focus to the nearest visible control in that direction, scoped to the topmost open dialog. A drawn focus ring (outside Discord's DOM styles) shows where you are.
  - **On-screen keyboard**: opens when you activate a text box; controller-navigable QWERTY grid; text goes in via Electron's `insertText` so Discord's editor accepts it. A physical/Bluetooth keyboard still works.
  - **Call helper**: watches for an incoming-call prompt, announces it, and maps buttons to answer/decline; mute, deafen and hang up are always one button away.
  - **Help overlay**: button map on screen (View button).
- **Discord-specific selectors** live in one file (`src/preload/selectors.mjs`) because Discord's markup changes; that is the first place to look if a button stops working.

## Default controller map
| Button | Action |
|---|---|
| D-pad / left stick | Move focus |
| A | Select / click (opens keyboard on text boxes) |
| B | Back (Escape) |
| X | Toggle mute |
| Y | Toggle deafen |
| LB / RB | Previous / next server |
| LT / RT | Previous / next channel |
| Right stick | Scroll |
| Left stick click | Answer incoming call / join focused voice channel |
| Right stick click | Hang up / disconnect from voice |
| Menu | Quick switcher (Ctrl+K) to jump to any server, channel or DM |
| View | Show / hide the button map |
| View + Menu | Toggle full screen |

## Packaging and CI
- `electron-builder` produces an NSIS installer and a portable `.exe` for Windows x64.
- GitHub Actions: unit tests (spatial navigation, gamepad state machine, IPC validation) on Linux, and a Windows build that uploads the installer as an artifact.

## Setting it up on the HTPC (once built)
1. Install the `.exe`, sign in to Discord once (phone QR login works well from the couch).
2. Add it to the Xbox full-screen experience library (it appears as an installed app; otherwise add it as a non-Store game in the Xbox app).

## Known limits / risks
- Discord changes its class names often; selectors are heuristic (aria-labels first) and may need updates.
- Chromium only delivers gamepad input to the focused window, so the app must be in front to be controlled; incoming-call sound and Windows notifications still work in the background.
- Third-party clients are technically outside Discord's terms. This wrapper only loads the official web app and sends ordinary input (no automation or API scraping), which is how popular wrappers operate, but it is worth knowing.

## Steps
1. Scaffold project, main process, settings, IPC validation.
2. Gamepad loop + spatial navigation + focus ring.
3. On-screen keyboard.
4. Call controls + help overlay.
5. Tests, CI, Windows packaging.
6. Draft PR on a new GitHub repo, drive CI green.
