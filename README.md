# 🎅 TurboSanta

> A live Santa sleigh tracker, fundraising platform, and Christmas Eve magic-maker — built by Beverley Round Table for charity Santa sleigh runs across the UK and Ireland.

TurboSanta lets families follow Santa's sleigh in real time, donate by card or cash, claim Gift Aid, snap an "Elf Cam" polaroid with Santa, and send the kids to bed believing the magic is just down the road. Behind the scenes it gives sleigh crews a driver console, gives organisers a God Mode admin dashboard, and rolls everything up into a Season Wrap Report for the AGM.

The platform has been rolled out for all tables across the UK and Ireland.

---

## 🏗️ How it works

TurboSanta is a **shared frontend, per-Table backend** platform:

- **This repo** is the single shared frontend, deployed once to Cloudflare Pages at [brt-23f.pages.dev](https://brt-23f.pages.dev). Every Round Table in the UK and Ireland uses the same hosted pages — there is no need to fork, clone, or self-host.
- **Each Round Table runs its own Google Apps Script web app** as their backend. This holds *their* spreadsheet, *their* config, *their* donations, *their* routes.
- The frontend is wired to a Table's backend via an `?api=` query string parameter. The Table's Apps Script auto-generates branded links pointing at this repo with their API URL baked in.

### Example

A tracker link for a specific Table looks like this:

```
https://brt-23f.pages.dev/tracker?api=<their-apps-script-url>&driver=1
```

The page reads the `api` parameter, calls *that* Apps Script for settings, branding, routes, messages, and donations, and renders accordingly. Same code, different data — every Table gets their own fully-branded experience without touching this repo.

This means:
- 🚫 Tables do **not** fork this repo
- 🚫 Tables do **not** maintain their own copy of the frontend
- ✅ Tables only configure their own Apps Script and spreadsheet
- ✅ Every improvement pushed here ships to every Table instantly

---

## ✨ Features

### For families and the public
- **Live tracker** — real-time Santa position on a Leaflet map with proximity snow effects, ETA, and a "pac-man" GPX eraser that reveals the route as Santa drives it
- **PWA install** — add to home screen on iOS and Android, works offline once cached
- **Elf Cam** — polaroid-style photo frame the kids can pose with
- **Sleigh Spotter Bingo** — printable bingo card to play while waiting
- **Letters to Santa, colouring pages, snowman builder** — keep the kids busy
- **Donations** — card payments with optional Gift Aid claim, plus cash logging
- **Reindeer adoption** — sponsor a reindeer for the season
- **QR posters, door hangers, route cards** — printable assets for each route
- **Live moderated messages** — wave to Santa, see your message appear on the tracker

### For sleigh crews
- **Driver/beacon mode** — phone-as-GPS-beacon pushing position to Firebase
- **PA system & kiosk mode** — sleigh-mounted display
- **Twitch integration** — live stream from the sleigh

### For organisers (God Mode)
- **Admin dashboard** — live map, GPX route overlay, donation totals, message moderation
- **Gift Aid R68 export** — HMRC-ready CSV for claiming Gift Aid back
- **Route planner** — OSRM road-snapping route builder with GPX export (replaces gpx.studio)
- **Incident log** — insurance-compliant event logging
- **Expenses & sponsors** — tracked in the master Google Sheet
- **Onboarding flow** — generates a Table's branded links automatically

### Post-season
- **Season Wrap Report** — year-on-year Chart.js comparisons across donations, miles, messages, spotters
- **Memory Book** — shareable highlights card
- **Santa's Journey Recap** — per-night summary

---

## 🛠️ Tech stack

| Layer | Tech |
|---|---|
| Hosting | Cloudflare Pages (single deployment, shared) |
| Frontend | Vanilla HTML / JS / CSS, Leaflet.js, Chart.js |
| Per-Table backend | Google Apps Script + Google Sheets |
| Realtime data | Firebase Realtime Database (GPS positions, messages) |
| PWA | Service worker (`sw.js`) |
| Routing engine | OSRM (road-snapped GPX generation) |
| Routing animation | Custom 8-direction Santa sprite over GPX path |
| Backend wiring | `?api=` query parameter on every page |

### Brand
- Gold `#FBAF33`
- Dark `#1D1D1A`
- Red `#D31C1C`
- Font: **Open Sans**

---

## 📂 Repo structure

```
.
├── .github/workflows/        # CI/CD for Cloudflare Pages deploy
├── AGM/                      # Annual General Meeting assets
├── GPX/                      # Route GPX files
├── TurboSanta-MP4-Renderer/  # Tooling for rendering recap videos
├── colouring/                # Colouring page assets
├── icons/                    # App icons, favicons, PWA icons
├── oldguides/                # Archived onboarding guides
├── routes-template/          # Templates for new route setup
├── sounds/                   # Sleigh bells, jingles, audio assets
│
├── TurboSanta.html           # Landing page
├── tracker.html              # Main public Santa tracker
├── god_mode.html             # Admin dashboard
├── beacon.html               # Driver/sleigh beacon (GPS broadcaster)
├── gpx_animation.html        # GPX route animation player
├── route_planner.html        # OSRM road-snapping route builder
├── route_card.html           # Per-route printable card
├── routes.html / routes.js   # Route listing
│
├── donations_v2.js           # Donations + Gift Aid flow
├── gift_aid.html             # Gift Aid declaration form
├── adopt_reindeer.html       # Reindeer adoption
├── thank_you.html            # Post-donation page
│
├── elf_cam.html              # Polaroid photo frame
├── bingo.html                # Sleigh Spotter Bingo generator
├── letter.html               # Letters to Santa
├── snowman.html              # Snowman builder
├── colouring_page.html       # Printable colouring
├── nice_list.html            # Nice List certificate
├── memory_book.html          # Shareable highlights card
├── season_wrap.html          # Season Wrap Report
│
├── spot_santa_form.html      # Spotter submission form
├── crew.html                 # Crew/volunteer info
├── volunteer_cert.html       # Volunteer certificate
├── onboarding.html           # New Round Table onboarding
├── suggest.html              # Suggestion box
├── national.html             # Multi-Round Table national view
│
├── embed.html / embed_generator.js  # Embeddable tracker for partner sites
├── qr_poster.html            # QR code poster generator
├── door_hanger.html          # Printable door hanger
├── address.html / address.js # Address lookup
├── carousel.html             # Image carousel
├── countdown.html            # Countdown to Christmas Eve
│
├── santa_frame.html          # Photo frame overlay
├── snowman_frame.html        # Snowman frame
│
├── sw.js                     # Service worker (PWA)
├── _redirects                # Cloudflare Pages redirects
└── tracker_old.html          # Legacy tracker (kept for reference)
```

---

## 🚀 Joining the platform (for other Round Tables)

If your Round Table wants to run a TurboSanta sleigh:

1. Visit [brt-23f.pages.dev](https://brt-23f.pages.dev) and follow the onboarding flow
2. Deploy your own Google Apps Script web app (template provided during onboarding)
3. The onboarding flow auto-generates your branded links with your API URL embedded
4. Share those links — your Table is live, no code required

You do **not** need a GitHub account, you do **not** need to deploy anything to Cloudflare, and you do **not** touch this repo. Your Apps Script holds everything specific to your Table.

---

## 🧑‍💻 Local development (for contributors to this repo)

This repo is plain static HTML — there's no build step.

```bash
git clone https://github.com/BeverleyRoundTable/BRT.git
cd BRT

# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8000
```

Then open a page with an `api` parameter pointing at a test Apps Script:

```
http://localhost:8000/tracker.html?api=<your-test-apps-script-url>
```

### Deploying
Pushes to `main` deploy automatically to Cloudflare Pages via the workflow in `.github/workflows/`. Because every Table points at this single deployment, **changes ship to every Table the moment they merge** — review carefully.

---

## 🤝 Contributing

PRs welcome from any Round Table using the platform. Bug reports and feature ideas can be raised in [Issues](https://github.com/BeverleyRoundTable/BRT/issues).

Because this repo is the live production frontend for every Table, please:
- Test against a sandbox Apps Script before opening a PR
- Keep changes backwards-compatible with existing Apps Script API responses
- Flag any breaking changes prominently

---

## 📜 Licence

© Beverley Round Table. All rights reserved.

The platform is freely available to all Round Tables in the UK and Ireland via the onboarding flow at [brt-23f.pages.dev](https://brt-23f.pages.dev). Please don't redeploy this code elsewhere — instead, get in touch and we'll get your Table onboarded.

---

## 🙏 Credits

Built by Beverley Round Table volunteers. Powered by far too many late nights, mince pies, and a stubborn belief that the magic of Christmas Eve is worth a few hundred lines of JavaScript.

🎅 ❤️ 🦌
