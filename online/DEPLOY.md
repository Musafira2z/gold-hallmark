# Putting the website online (Plan 23 / S7)

The real setup: **Hostinger** runs the website (Node.js web app), **MongoDB Atlas** holds the online copy, and **Cloudflare** has the DNS for `sylhethallmark.com`.
Do the steps in order. After each one, do its check before going on.

Secrets (`MONGO_URI` password, `SYNC_KEY`) go **only** into Hostinger's settings and the shop PC's `settings.json`. Never into git, chat or screenshots.

## 1. Atlas (online database)
1. Create an account at cloud.mongodb.com (your own email and password).
2. **Create cluster:** M0 (free), provider AWS, region **Mumbai (ap-south-1)**, name `gold-hallmark`.
3. **Database Access → Add user:**
   - name `gold-online`, a long random password (Atlas's "Autogenerate");
   - role: *Specific privileges* → `readWrite` on database `goldhallmark_online` only.
4. **Network Access:** add Hostinger's outgoing address (step 2.5 shows it). Until then, nothing can connect, which is fine.
5. **Connect → Drivers:** copy the address and add the database name:
   `mongodb+srv://gold-online:<password>@gold-hallmark.xxxxx.mongodb.net/goldhallmark_online?retryWrites=true&w=majority`

**Check:** the cluster shows "Active".

## 2. Hostinger (the website)
1. hPanel → **Websites → Add website → Node.js app**, domain `sylhethallmark.com`.
2. Source: **upload** the `online/` folder as a zip (made by `git archive HEAD:online -o online.zip`), or connect the GitHub repository with root folder `online`.
3. Settings:
   - Node.js version **20** (or newer), start command `npm start` (entry `server.js`), install `npm install --omit=dev`.
   - Environment variables:

     | Name | Value |
     |---|---|
     | `MONGO_URI` | from step 1.5 |
     | `SYNC_KEY` | new, 48 random characters: `openssl rand -base64 36` |
     | `TRUST_PROXY` | `1` |
     | `DESKTOP_DIR` | an absolute folder outside the app, e.g. `/home/<user>/desktop-releases` |
     | `PORT` | only if Hostinger asks for it |
4. Turn on **SSL** for the domain (Hostinger makes a free certificate once DNS points to it, step 3).
5. Find the website's **outgoing IP address** (hPanel → hosting details, or over SSH: `curl -s https://api.ipify.org`). Add it in Atlas → Network Access.
6. **SSH access** (hPanel → Advanced → SSH): add the test server's public key, for `publish-desktop.sh`. Note the user, address and port (usually 65002).

**Check:** the app's log says `Online DB connected.` and `Online app on port …`.

## 3. Cloudflare (the address)
1. Cloudflare → `sylhethallmark.com` → **DNS**. Add the records Hostinger shows for the domain (an `A` record for `@`, and `www` as `CNAME` to `sylhethallmark.com` or its own `A`).
2. Set them to **DNS only (grey cloud)**, so Hostinger's certificate is used directly.
3. Wait for Hostinger to show the SSL certificate as active (minutes to an hour).

**Check (from the test server):**
```
scripts/smoke-online.sh https://sylhethallmark.com
```
Before an update is published, add `SMOKE_NO_DESKTOP=1`. Everything must pass.

## 4. Desktop updates (`/desktop/`)
After a Windows build on the test server (see `desktop/README.md`):
```
PUBLISH_SSH_PORT=65002 scripts/publish-desktop.sh <user>@<address> desktop-releases
```
It checks our signature first, and switches `latest.yml` last.
**Check:** `scripts/smoke-online.sh https://sylhethallmark.com` shows "update offered".

## 5. The shop PC (install day, S8)
In `C:\SylhetGold\settings.json`:
```
"syncUrl": "https://sylhethallmark.com",
"syncKey": "<the same SYNC_KEY as on Hostinger>"
```
Close and open the app.
**Check:**
- `C:\SylhetGold\logs\server.log` shows sync sending;
- the owner's phone app shows "PC last seen: just now";
- a new memo's QR opens its report.

## If something goes wrong
| What you see | Likely cause |
|---|---|
| `Online app could not start: ... ECONNREFUSED / timed out` | Atlas Network Access doesn't have Hostinger's address |
| `bad auth` | Wrong user or password in `MONGO_URI` |
| Browser says "too many redirects" | Cloudflare proxy is on (orange cloud). Set "DNS only" |
| Sync log says `401` | `SYNC_KEY` differs between Hostinger and the shop PC |
| `/desktop/latest.yml` is 404 | `DESKTOP_DIR` not set, or not the folder `publish-desktop.sh` wrote to |
