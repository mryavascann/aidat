# PRU Blockchain × Team1 Türkiye: Agentic Hackathon community partner video

A 25-second motion-design announcement in two formats:

| File | Use | Size |
| --- | --- | --- |
| `PRU-Agentic-Hackathon-Partner-X-16x9.mp4` | X / LinkedIn post | 1920×1080, 30 fps, H.264 + AAC |
| `PRU-Agentic-Hackathon-Partner-Story-9x16.mp4` | Instagram story / Reels | 1080×1920, 30 fps, H.264 + AAC |

Facts on screen come from the Team1 Türkiye announcement (25 Sep 2026) and its video:
Agentic Hackathon by OKX TR × Team1 Türkiye, 17 October, Ankara, THK & Orion Tekmer,
$3,000 prize pool, `agentichackathon.team1.network`.

## Storyboard

| Time | Scene |
| --- | --- |
| 0.0–3.6 | A violet door of light, a lone builder. "PRU BLOCKCHAIN COMMUNITY / IS JOINING" decodes in. |
| 3.6–7.6 | Hall flanked by two figures: OKX TR \| team1 türkiye lockup, "Agentic Hackathon". |
| 7.6–11.2 | PRU violet and Team1 red beams converge: "AS A COMMUNITY PARTNER". |
| 11.2–14.6 | The PRU Blockchain anchor logo powers on like neon, then glitches out. |
| 14.6–17.8 | A 24-tick clock fills: "ONE DAY. ONE WORKING AI AGENT." |
| 17.8–20.6 | Red Avalanche delta: "OCTOBER 17", Ankara, THK & Orion Tekmer, $3,000 prize pool. |
| 20.6–25.0 | PRU × team1 türkiye lockup, "COMMUNITY PARTNER", apply URL. |

The 9:16 cut has its own layout: line breaks, type sizes, and the final lockup stack. The
story's key content stays clear of Instagram's top and bottom UI.

## Tweet

> Demir aldık, rota Ankara! ⚓
>
> @Team1TUR × @OKXTurkiye Agentic Hackathon'una community partner olarak katılıyoruz 💜🔺
>
> Bir gün, tek hedef: çalışan bir AI agent.
>
> 📅 17 Ekim · THK & Orion Tekmer
> 💰 $3,000 ödül havuzu
>
> Detaylar ve başvuru 👉 agentichackathon.team1.network

Alternatives and the Instagram story notes are in `tweet.md`.

## Rebuilding

Everything is generated from code; no stock footage or licensed music is used.

```bash
# soundtrack (numpy/scipy)
python3 audio/soundtrack.py build/soundtrack.wav
# frames → video (Playwright + headless Chromium/SwiftShader, ffmpeg)
node render.mjs stills --format h --times 1.2,5.5,9      # quick previews
node render.mjs video --format h --workers 3 --out build/video-h.mp4
node render.mjs video --format v --workers 3 --out build/video-v.mp4
# picture + sound → delivery files (H.264 High, AAC, -14 LUFS)
./finalize.sh build
```

- `scene/index.html` holds the whole film: a WebGL fragment shader for the haze, light, floor
  reflections and silhouettes, plus DOM typography driven per frame by `renderAt(t)`.
  `renderAt` is deterministic, so any frame can be re-rendered on its own.
- `audio/soundtrack.py` uses the same timeline. Hits land on 3.6, 7.6, 11.2, 14.6, 17.8 and 20.6 s.
- `assets/` contains `pru-logo.jpg`, supplied by PRU Blockchain. The OKX TR and team1 türkiye
  marks were vector-traced from frames of Team1 Türkiye's own hackathon video.
  Replace them with the official SVGs if Team1 shares a brand kit. Fonts: Inter Tight and
  JetBrains Mono (SIL OFL).
