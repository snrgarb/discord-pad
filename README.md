# Discord Pad

Discord for the couch: a Windows wrapper around the Discord web app that you can drive entirely with an Xbox controller. Built for an HTPC running the Xbox full-screen experience, so you can join servers, chat and take calls without a mouse or keyboard.

See [docs/PLAN.md](docs/PLAN.md) for the design.

## Controller

| Button | Action |
|---|---|
| D-pad / left stick | Move the focus ring. Left/right jump between the three columns (servers, channels/DMs, main); up/down move within a column |
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
| View + Y | Settings menu |
| View + Menu, or F11 | Toggle full screen |

Landing on any text field (message box, search, quick switcher) shows a hint; press A to open the on-screen keyboard. On-screen keyboard: A types, X deletes, Y space, LT shift, Menu sends, B closes.

Hold View and press Y for the settings menu: full screen, zoom, cursor hiding, call rumble, which Discord elements to hide, and what every button does. Changes apply immediately and are saved to `%APPDATA%\Discord Pad\settings.json`, which you can still edit by hand.

## Couch UI

On by default (toggle it in the settings menu). It retints Discord with a dark TV palette, widens the server rail (88px) and channel/DM list (340px), makes channel and DM rows 56px tall, enlarges chat text and the message box, and shows the open channel as a filled row with an accent bar so it never looks like the controller focus ring. It restyles Discord's own elements, found by `src/preload/adapter.mjs` and marked with `data-dp-*` attributes that `src/main/couch.css` styles; nothing is moved or replaced. Your `custom.css` loads after it, so you can override any of it. Design: [docs/design/couch](docs/design/couch/design.md).

## Hiding Discord elements

Two layers of CSS overrides are applied on top of Discord:

**Presets**, toggled in the settings menu (or the `hide` section of `settings.json`):

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
