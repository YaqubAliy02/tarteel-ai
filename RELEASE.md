# Releasing Hujra as a standalone .apk

The APK contains the whole UI and works without Metro/Expo Go. But recitation
checking, accounts, and progress live on the **backend** (FastAPI + Whisper +
Postgres). For other users to use the app "fully", the backend must run on a
server that is always reachable — not your dev PC's hotspot IP.

Read (Quran.com) and Listen (Alafasy CDN) work from anywhere regardless.

## Step 1 — Host the backend (pick one)

### Option A: small VPS (recommended, always-on, ~$5-15/mo)
Any Ubuntu VPS (Hetzner, DigitalOcean, etc.) with 4GB+ RAM:

```bash
git clone <your-repo> && cd tarteel-ai
export JWT_SECRET=$(openssl rand -base64 48)
docker compose up -d --build          # backend + Postgres, one command
# HTTPS in front (required for a production app; simplest is Caddy):
sudo apt install caddy
caddy reverse-proxy --from api.YOURDOMAIN.com --to localhost:8000
```

First boot downloads the ASR model (~150MB), then it's cached in a volume.
CPU is fine: analysis takes the same few seconds it takes on the dev PC.

### Option B: keep it on your PC + stable tunnel (free, PC must stay on)
Run the backend as today, then expose it with a **static** URL:
- ngrok (1 free static domain): `ngrok http --domain=YOURNAME.ngrok-free.app 8000`
- or Cloudflare Tunnel with a free Cloudflare-managed domain.

The APK must be built against a URL that never changes — hotspot LAN IPs
(10.x.x.x) change on every reconnect and will brick the released app.

## Step 2 — Build the .apk with EAS (no Android SDK needed locally)

One-time setup:
1. Create a free account at https://expo.dev
2. `cd app`
3. `npx eas-cli@latest login`

Every release:
1. Edit `app/eas.json` → set `EXPO_PUBLIC_API_URL` in the `preview` profile to
   your real server URL (https).
2. `npx eas-cli@latest build --platform android --profile preview`
   - First run asks to generate an Android keystore — say yes (EAS stores it).
   - The build runs in Expo's cloud (~10-20 min) and prints a link.
3. Download the `.apk` from the link (or https://expo.dev → your project →
   Builds) and share the file. Users enable "install from unknown sources"
   and tap it.

## Step 3 — Sanity checklist before sharing

- [ ] `https://YOUR-URL/health` answers `{"status":"ok"}` from mobile data
      (not just your Wi-Fi).
- [ ] Register a fresh account in the built APK, recite Al-Fatihah 1:1,
      confirm the report arrives and Review/Progress fill in.
- [ ] Postgres is backed up if you care about user data
      (`docker compose exec db pg_dump -U postgres postgres > backup.sql`).

## Notes

- `preview` profile builds an installable `.apk`; the `production` profile
  builds an `.aab` (only needed if you later go to Play Market).
- Bumping a release: change nothing but the API URL? Just rebuild. App code
  changes: rebuild. Server changes: `docker compose up -d --build` — released
  APKs keep working as long as the API stays compatible.
- The JWT secret on the server must stay stable across restarts, or all
  users get logged out.
