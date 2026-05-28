# Rental App — Firebase Build (Option 2)

Static web app + Firestore. **Spark plan (free, no credit card)** — all logic
runs in the browser; notifications use WhatsApp click-to-send. Implements the
shared data model in `../04-shared-data-model.md`.

## Files

```
rental-firebase/
├── public/
│   ├── index.html      # Customer booking page (no login)
│   ├── customer.js     # Form logic for index.html
│   ├── admin.html      # Owner/Staff dashboard (Google login)
│   ├── admin.js        # Live list + approve/cancel/complete + WhatsApp
│   ├── booking.js      # Race-safe createBooking() transaction (the core)
│   ├── firebase.js     # Config — PASTE YOUR KEYS HERE
│   └── styles.css      # Mobile-first styling
├── firestore.rules         # Security rules (public can only create Pending)
├── firestore.indexes.json  # Composite indexes for the queries
├── firebase.json           # Hosting + Firestore config
└── seed.js                 # One-time dummy data loader
```

## Setup (one time, ~30 min)

1. **Create a project** at <https://console.firebase.google.com> (free).
2. **Enable Firestore** → start in **test mode** (so seeding works).
3. **Enable Authentication** → Sign-in method → **Google**.
4. **Get your config:** Project Settings → "Your apps" → Web app → SDK config.
   Paste the values into **both** `public/firebase.js` and `seed.js`.
5. **Seed dummy data** (while still in test mode):
   ```bash
   npm install firebase
   node seed.js
   ```
   ⚠️ The dummy `staff` emails (`owner@example.com`, …) are placeholders.
   Edit `seed.js` to use **the real Google emails** of people who will log in,
   or you won't be able to sign into the dashboard.
6. **Lock down the database** — deploy the real rules + indexes:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase init hosting        # choose existing project; public dir = "public"; no SPA rewrite
   firebase deploy --only firestore:rules,firestore:indexes
   ```
7. **Deploy the site:**
   ```bash
   firebase deploy --only hosting
   ```
   You get a free URL: `https://YOUR_PROJECT.web.app`

## Daily use

- **Customer URL** (`/index.html` = the root): share on WhatsApp / Google Business.
- **Staff dashboard** (`/admin.html`): bookmark on your phone. Sign in with a
  Google account whose email is in the `staff` collection.

## How the core pieces work

- **Double-booking prevention** — `booking.js` runs a Firestore transaction.
  Half the overlap test (`start < end`) is in the query; the other half
  (`end > start`) is checked in JS inside the transaction, so two simultaneous
  bookings can't both succeed.
- **Roles** — read from `staff/{email}`. Owners approve/cancel and see revenue;
  staff create and complete. Enforced by `firestore.rules`, not just the UI.
- **Notifications** — the dashboard's **WhatsApp** button opens a pre-filled
  `wa.me` message. No server / Cloud Function needed.

## Known limitation

The public can create Pending bookings with no login, so a malicious user could
spam-create them (no rate limit). Fine for a small local business; add a
captcha/honeypot later if it ever becomes a problem.

## Local preview (optional)

```bash
firebase emulators:start    # or: npx serve public
```
Note: Google sign-in popups need the deployed/authorised domain; `localhost` is
allowed by default in Firebase Auth settings.
