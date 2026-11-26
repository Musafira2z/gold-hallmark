# Online app (mirror)

The shop PC is the real system. This small app gets a **copy** of the data from it
(one way: shop → online) and shows it on the website.

What it does now (Plan 14 / S1):
- `/r/<token>`: the test report the QR on a memo opens. It's public, with no phone, bill or dues.
- `/report`: find a report by memo number plus the 4-character code printed on the memo.
  After 10 wrong tries in 15 minutes from the same address, the lookup is blocked.
- `POST /api/sync/orders`: the shop PC sends orders here with `SYNC_KEY`.

Also: karigor / shop owner login (S4), the owner's phone app (S5), and the desktop app's updates at `/desktop/` (S7).

**Putting it online:** see [DEPLOY.md](DEPLOY.md). **Checking a live site:** `scripts/smoke-online.sh https://sylhethallmark.com`.

## Settings (`.env`)

| Name | What |
|---|---|
| `MONGO_URI` | Online database (MongoDB Atlas) |
| `SYNC_KEY` | Long random secret, at least 24 characters. It must be the same on the shop PC |
| `PORT` | Default 8080 |
| `TRUST_PROXY` | `1` when running behind Hostinger's proxy. It also sends `http://` visits to `https://` |
| `DESKTOP_DIR` | Folder with the desktop app's updates, served at `/desktop/` (Plan 23) |

On the shop PC (server `.env`):
- `SYNC_URL`: this site's address.
- `SYNC_KEY`: the same key as above.
- `REPORT_BASE_URL`: the address printed in the memo QR.

## Run

```
npm install
npm start
```

## Test

Use a throwaway database for the tests:

```
MONGO_URI=mongodb://localhost:27017/online_test npm test
```
