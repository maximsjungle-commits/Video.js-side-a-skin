# SIDE A

A tape-deck skin for the [Video.js v10](https://videojs.org/) player, made for the Contra x Video.js skin challenge.

Clicky transport keys, a rotary volume knob, a CRT settings menu, and a brass-edged tray in fullscreen. Built from the standard Video.js v10 HTML components plus one small custom element (`src/main.js`).

## Run it

```bash
npm install
npm run build   # bundles src/main.js into site/assets/app.js
npm start       # http://localhost:4173
```

The `site` folder is the whole deployable site.

## Keyboard

| Key | Action |
| --- | --- |
| Space / K | Play / pause |
| Left / Right | Back / forward 10s |
| Up / Down | Volume (when the deck is focused) |
| M | Mute |
| F | Fullscreen |
| S | Settings |
| R | Retro screen effect on / off |
| 0-9 | Jump to 0-90% |
| Esc | Close menu / exit fullscreen |

## Changing the video

Replace `site/assets/side-a-ad.mp4` and `site/assets/side-a-ad-poster.jpg`, or point the `<video>` in `site/index.html` at another source. The bundled clip is a 30-second SIDE A ad cut from licensed Envato stock footage with an original soundtrack. The footage is licensed for this project only and is not covered by the Apache licence.

## License

Apache License 2.0. See `LICENSE`.
