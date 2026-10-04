# NexBus: Implementation Status

This replaces `NOT_IMPLEMENTED.md`. Every item from that list now has a status. Numbers refer to the original list.

## How it was verified

| Check | Result |
|-------|--------|
| Unit and API tests (`npm test`, no database) | 99 pass |
| Firestore security rules on the emulator (`npm run test:rules`) | 18 pass |
| End-to-end API flow (`npm run smoke`): sign-in per role, RBAC, GPS, ETA, booking race, forged and duplicate PayHere notification, audit log | 50 checks pass, on the real project (before its daily quota ran out) and on the emulators. Wait a minute between runs: the 20 per minute limit on sign-in and booking applies |
| Dashboard in a real browser (headless Edge): login, every page for operator and admin, forms, role redirects, reload, sign out | 42 checks pass |
| Mobile app in a real browser: login, nearest stop and next buses, booking, payment, cancel with refund, notifications, Plan Trip, map, driver trip with GPS sent and received | 27 checks pass |
| Mobile bundles | Web and Android bundles build; TypeScript clean for all changed files |

Not verified: a real PayHere sandbox payment (needs your merchant account), push notifications on a device, background GPS on a phone, iOS, the PayHere SDK screen (needs a development build), Firestore live listeners against the real project (rules are not deployed yet, see below).

## Needs your action

1. **Firestore daily quota is used up on the real project** (my testing; the free plan allows 50,000 reads a day). It resets at midnight Pacific time, about 12:30 PM Sri Lanka time tomorrow. Until then the app works against the local emulators (`npm run emulators`, needs Java). Afterwards run `npm run seed` once, then `npm start`; a one-time backfill of the new day fields runs automatically.
2. **Deploy the security rules, indexes and TTL policy**: `firebase deploy --only firestore` from `nexbus-backend`, then enable a TTL policy on `location_logs.expires_at` in the console. Until the rules are deployed, the live map and fleet monitor fall back to polling the API every 6 seconds (a real-time listener is faster and cheaper). The current project rules deny all client reads.
3. **PayHere sandbox**: put your merchant ID and secret in `nexbus-backend/.env` and give PayHere a public notify URL (Cloud Run or an ngrok tunnel). Until then use the built-in sandbox simulator (`PAYHERE_SIMULATE=true`), which sends a correctly signed notification through the same verification code.
4. **Development build** (EAS) for the PayHere SDK, background GPS and push notifications; add `google-services.json` for push, and a Google Maps API key for the native map.
5. **Deploy** the API: `Dockerfile` is ready for Cloud Run. Set `ENABLE_JOBS=false` and create a Cloud Scheduler job that calls `POST /internal/expire-holds` every minute with the `x-internal-token` header.

## Status of the original list

### Backend

| # | Item | Status |
|---|------|--------|
| 1 | Token verification middleware | Done (`middleware/auth.js`, revoked tokens rejected) |
| 2 | RBAC (driver, operator, admin) | Done (`middleware/rbac.js`, custom claims, denials audited) |
| 3 | PayHere checkout, notify, md5sig, payments | Done. Real sandbox payment not yet run |
| 4 | Seat booking in a transaction | Done. Ten parallel requests for the last seats never oversell |
| 5 | 10 minute hold, pending and expired states, expiry job | Done (built-in timer, or Cloud Scheduler endpoint) |
| 6 | Trips | Done |
| 7 | Stops, route stops, operators | Done |
| 8 | ETA engine | Done (`services/eta.service.js`, 99 tests include hand-calculated cases) |
| 9 | Delay detection | Done (10 minute threshold, alert sent once) |
| 10 | Recommendation engine | Done (server side, explained) |
| 11 | Push notifications and notifications collection | Done. Push needs a device token from a development build |
| 12 | Delay alerts | Done |
| 13 | Audit logging | Done |
| 14 | Validation, helmet, rate limits, error handler | Done (Joi on every write, 20/min on sign-in and booking, 300/min overall) |
| 15 | GPS validation | Done (Sri Lanka bounds, accuracy, driver and trip assignment) |
| 16 | Rules, indexes, TTL | Files done and tested. Deployment is yours (see above) |
| 17 | Operator endpoints | Done |
| 18 | Admin endpoints | Done |
| 19 | Layered structure | Done (routes, services, middleware, schemas; controllers are folded into the routes) |
| 20 | Deployment files | Dockerfile done. Cloud Run and Scheduler setup is yours |

### Mobile

| # | Item | Status |
|---|------|--------|
| 21 | Driver mode and background GPS | Done. Background sharing needs a development build; in the browser and Expo Go it shares while the screen is open |
| 22 | Role based navigation | Done (driver goes to driver mode; operators and admins are sent to the dashboard) |
| 23 | Booking flow | Done (route, trip, stops, 1 to 4 seats, hold countdown) |
| 24 | PayHere payment screen | Done. SDK in a development build; browser and Expo Go use the sandbox simulator |
| 25 | Live listeners for the map | Done, with automatic polling fallback |
| 26 | Bus status on the map | Done (on time, delayed, offline after 2 minutes) |
| 27 | Stop arrivals and nearest stop | Done |
| 28 | Seat availability per trip | Done |
| 29 | Cancellation returns seats | Done (and flags a refund for paid bookings) |
| 30 | Push registration | Done (development build) |
| 31 | Sinhala stop names | Done |
| 32 | Password reset | Done |

Also fixed along the way: React Native `Alert.alert` does nothing in the browser, so error messages and confirmations never appeared on the web version. It now maps to browser dialogs. "Remember me" now keeps the session across app restarts.

### Web dashboard

| # | Item | Status |
|---|------|--------|
| 33 to 39 | Fleet monitor, vehicles, drivers, trips, routes and stops editor with map, bookings and payments, daily reports, operators, users, audit logs, role guards | All done |

### Testing and tooling

| # | Item | Status |
|---|------|--------|
| 40 | Jest and Supertest tests | Done (99 plus 18 rules tests) |
| 41 | Emulator setup | Done (`firebase.json`, `npm run emulators`, `*:emu` scripts) |
| 42 | GPS simulator | Done (`npm run simulate`) |
| 43 | Postman collection and API documentation | Done ([API.md](nexbus-backend/API.md), [Postman collection](nexbus-backend/docs/NexBus.postman_collection.json)) |

## Differences from the thesis text (update Chapters 4 and 5 to match)

- Firestore fields are snake_case (`available_seats`), not camelCase as section 4.6.4 says. The vehicle status field is `status`, not `current_status`.
- Trips have `service_date`, bookings `created_day`, payments `created_day` and `paid_day`. Queries read one day at a time with equality filters; this keeps the pilot inside the free Firestore quota.
- Live results (`/buses`, `/vehicles/live`, arrivals) are cached for 3 seconds on the server and shared between clients.
- The scheduler endpoint is protected by a shared token (`x-internal-token`), not an OIDC token as Listing 5.17 and section 5.10 say.
- Passwords are checked with the Firebase Auth REST API through `POST /auth/login`. Section 4.7 says there is no login endpoint; the documentation should say the API has one (the token is still a Firebase ID token verified on every request).
- Location logs are removed by the `expires_at` TTL policy and by a purge job; the logs also carry the field the TTL policy needs.
- A sandbox payment simulator exists (disabled unless `PAYHERE_SIMULATE=true`). Mention it as a testing aid, not as a feature.
- Listings 5.2 to 5.17 and Appendix B are not the final code. Replace them with the real files (`app.js`, `middleware/auth.js`, `services/booking.service.js`, `services/payment.service.js`, `services/tracking.service.js`, `services/eta.service.js`, `services/recommend.service.js`, `services/notify.service.js`, `firestore.rules`, `scripts/gps-simulator.js`).

## Still not implemented (outside the thesis scope, listed as future work)

Crowd reporting, QR and NFC tickets, gateway refunds, numbered seat selection, a transport authority portal, machine-learning ETA, chatbot, voice input, offline mode, an iOS release.

## Thesis items that need your real data

Questionnaire, interview and observation results (3.5), development machine and phones (5.3), every empty cell in Tables 6.1 to 6.9 (fill them from `npm test`, `npm run smoke`, real trips for the ETA accuracy table, UAT forms), the objective status and research question answers in chapter 7, appendices C and D, and the abstract results. Do not report results that were not obtained.
