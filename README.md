# Discord Pad

Discord for the couch: a Windows wrapper around the Discord web app that you can drive entirely with an Xbox controller. Built for an HTPC running the Xbox full-screen experience, so you can join servers, chat and take calls without a mouse or keyboard.

See [docs/PLAN.md](docs/PLAN.md) for the design.

## Controller

| Button | Action |
|---|---|
| D-pad / left stick | Move the focus ring |
| A | Select (opens the on-screen keyboard on text boxes) |
| B | Back / close / decline call |
| X | Mute / unmute |
| Y | Deafen / undeafen |
| LB / RB | Previous / next server |
| LT / RT | Previous / next channel |
| Right stick | Scroll |
| Left stick click | Answer call, or join the focused voice channel |
| Right stick click | Hang up / leave voice |
| Menu | Quick switcher (jump to any server, channel or DM) |
| View | Button help |
| View + Menu, or F11 | Toggle full screen |

On-screen keyboard: A types, X deletes, Y space, LT shift, Menu sends, B closes.

Button mapping, zoom and full screen live in `%APPDATA%\Discord Pad\settings.json`.

## Develop

```sh
npm install
npm start        # build the preload and run the app
npm test         # unit tests
npm run dist     # Windows installer + portable exe in release/
```

Discord-specific selectors are all in `src/preload/selectors.mjs`; if a button stops working after a Discord update, start there.

## Install on the HTPC

1. Download the installer from the latest CI run (Actions → `discord-pad-windows` artifact) and run it.
2. Sign in once (the QR code login with the Discord phone app is easiest from the couch).
3. Add Discord Pad to the Xbox app library ("Add a game from your PC") so it shows in the full-screen experience.
