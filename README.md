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

## Hiding Discord elements

Two layers of CSS overrides are applied on top of Discord:

**Presets**, toggled in the `hide` section of `settings.json` (restart the app after changing them):

| Preset | Hides | Default |
|---|---|---|
| `nitroUpsells` | Nitro and Shop links and upsell banners | on |
| `quests` | Quests link in the direct messages list | on |
| `downloadApps` | "Download Apps" button in the server list | on |
| `giftButton` | Gift button in the message box | on |
| `helpButton` | Help (?) button in the header | on |
| `stickerGifButtons` | Sticker, GIF and Apps buttons in the message box | off |
| `memberList` | Member list on the right of servers | off |
| `activityFeed` | "Active Now" panel on the Friends page | off |

**Your own CSS** in `%APPDATA%\Discord Pad\custom.css`, created on first launch. It loads after the presets and re-applies as soon as you save the file, so you can tweak it live. Discord's class names are hashed, so match on fragments (`[class*="bannerImage"]`) or aria-labels (`[aria-label="Inbox"]`). Hidden elements are skipped by controller navigation automatically.

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
