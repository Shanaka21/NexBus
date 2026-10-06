# NexBus API

REST API (Node.js, Express 5) backed by Postgres (Neon) with self-issued JWT authentication.
Every path is available at `/` (used by the existing mobile app) and under `/api` (as written in the thesis).
A Postman collection with example requests is in [docs/NexBus.postman_collection.json](docs/NexBus.postman_collection.json).

## Running it

`npm install`, fill `.env` (see `.env.example`), `npm run migrate` (applies `migrations/*.sql`), `npm run seed`, `npm start`.

Other scripts: `npm test` (runs against the same Postgres database, truncating tables between test files — don't run it against data you want to keep), `npm run smoke` (end-to-end checks against a running API), `npm run simulate -- --trip <tripId> --start` (replays a bus journey as a driver phone would).

### Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string (Neon or any Postgres), e.g. `postgresql://user:pass@host/db?sslmode=require` |
| `JWT_SECRET` | Secret used to sign access tokens and hash refresh/reset tokens |
| `APP_URL` | Public URL of the web dashboard; used to build the (currently console-logged) password reset link |
| `GOOGLE_CLIENT_ID` | OAuth client id(s) (comma separated) accepted when verifying Google sign-in id tokens from the mobile app |
| `NVIDIA_API_KEY`, `NVIDIA_MODEL` | Key (and optional model, default `openai/gpt-oss-20b`) for the Plan Trip assistant. Server side only |
| `DASHBOARD_ORIGIN` | Allowed browser origin(s) for the dashboard, comma separated. Open when empty (development) |
| `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_SANDBOX` | PayHere credentials. The secret never leaves the server |
| `PAYHERE_SIMULATE` | `true` enables `POST /payments/simulate`, which completes a payment without a public notify URL. Keep `false` in production |
| `API_BASE_URL` | Public HTTPS address of this API. PayHere posts to `API_BASE_URL/payments/notify` |
| `INTERNAL_JOB_TOKEN` | Shared secret for Cloud Scheduler calls to `/internal/*` |
| `ENABLE_JOBS` | `false` on Cloud Run: use Cloud Scheduler instead of the built-in timers |
| `LIVE_CACHE_TTL_MS` | How long live results are shared between clients (default 5000) |

## Authentication and roles

Sign in with `POST /auth/login`. It returns an access token (`idToken`, valid 30 minutes) and a refresh token.
Send the access token as `Authorization: Bearer <token>`. Renew it with `POST /auth/refresh` (rotates the refresh token).
Google sign-in (mobile) posts a Google ID token to `POST /auth/google` and gets back the same token pair.
Roles: `passenger`, `driver`, `operator` (one company), `admin`. The role is embedded in the access token at issuance.

## Endpoints

| Method and path | Roles | Description |
|-----------------|-------|-------------|
| POST `/auth/register` | public | Create a passenger account |
| POST `/auth/login` | public | Email and password sign-in |
| POST `/auth/refresh` | public | New ID token from a refresh token |
| POST `/auth/forgot-password` | public | Request a password reset link (logged to the server console) |
| POST `/auth/reset-password` | public | Set a new password from a reset token |
| POST `/auth/google` | public | Sign in with a verified Google id token (mobile) |
| GET, PATCH `/users/me` | all | Own profile (name, phone, language, push token) |
| GET `/routes`, `/routes/:id` | all | Routes with ordered stops |
| POST `/routes`, PUT `/routes/:id` | operator, admin | Create or update a route (distances are calculated from the stops) |
| DELETE `/routes/:id` | admin | Deactivate a route |
| GET `/stops` (`?near=lat,lng&limit=`) | all | Stops, or the nearest ones |
| POST `/stops` | operator, admin | Create a stop |
| GET `/stops/:id/arrivals` | all | Upcoming buses with ETA |
| GET `/buses`, `/buses/:id` | all | Public bus list for the live map |
| PUT `/buses/:id/status` | operator | Mark a bus active, emergency or inactive |
| GET `/vehicles`, `/vehicles/live` | operator, admin | Fleet (own company for operators), and a cached live snapshot |
| POST `/vehicles`, PUT `/vehicles/:id` | operator | Register or update a vehicle |
| GET `/trips` (`?route_id=&date=&status=`) | all | Trips. Drivers and operators see their own |
| POST `/trips` | operator | Schedule a trip (vehicle and driver) |
| GET `/trips/:id/availability`, `/trips/:id/live` | all | Seats and fare; live status with next stops |
| GET `/trips/:id/seats` | all | Seat map: `reservable_seats` and which seat numbers are taken |
| GET `/trips/:id/summary` | driver, operator, admin | Distance/duration/passengers from recorded GPS fixes |
| PATCH `/trips/:id/status` | driver, operator | Start, complete or cancel a trip |
| POST `/location` | driver | One GPS fix of a running trip (sent every 3 s) |
| POST `/bookings` | passenger | Book 1 to 4 specific seats (`seat_numbers`, 1..`reservable_seats`), held for 10 minutes |
| GET `/bookings/me` | passenger | Own bookings |
| GET `/bookings/:id` | passenger, operator | One booking |
| PATCH `/bookings/:id/cancel` | passenger | Cancel (PUT also accepted) |
| POST `/payments/checkout` | passenger | PayHere payment object for a pending booking |
| POST `/payments/notify` | PayHere | Signed server notification (md5sig, merchant, amount, currency verified) |
| POST `/payments/simulate` | passenger | Sandbox only, see `PAYHERE_SIMULATE` |
| GET `/recommendations` | passenger | Ranked options (`from_stop_id`, `to_stop_id`, `need_seat`) |
| POST `/recommendations/ask` | passenger | Free-text trip question (`query`, optional `lat`/`lng`): a language model picks the stops, then the same ranking runs |
| GET `/notifications/me`, PATCH `/notifications/:id/read`, `/notifications/read-all` | all | In-app notifications |
| GET `/operator/drivers`, POST `/operator/drivers` | operator | Driver accounts of the company |
| GET `/operator/bookings` (`?date=&status=`) | operator | Bookings and payment status |
| GET `/operator/reports` (`?date=`) | operator | Daily trips, delays, bookings and revenue |
| GET `/stats` | operator, admin | Overview numbers |
| GET, POST `/admin/operators` | admin | Operator companies |
| GET, POST `/admin/users`, PATCH `/admin/users/:id/status` | admin | Accounts, enable or disable |
| GET `/admin/logs` | admin | Audit log search |
| POST `/internal/expire-holds`, `/internal/purge-logs` | scheduler token | Release unpaid seat holds; delete old location logs |

## Errors

Every error is JSON: `{ "error": "<message>", "code": "<CODE>", "details": [...] }`. Common codes:
`TOKEN_MISSING`, `TOKEN_INVALID`, `FORBIDDEN` (401/403), `VALIDATION_ERROR`, `INVALID_STOP_ORDER`, `OUT_OF_BOUNDS` (400),
`LOW_ACCURACY` (422), `SEATS_UNAVAILABLE`, `TRIP_CLOSED`, `BOARDING_PASSED`, `BOOKING_NOT_PAYABLE` (409),
`INVALID_SIGNATURE`, `AMOUNT_MISMATCH` (400), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500, no internals revealed).

## Data model (Postgres tables, see `migrations/`)

`users`, `operators`, `bus_stops`, `routes`, `route_stops` (a route's ordered stops), `vehicles`, `trips`, `bookings`,
`payments`, `notifications`, `location_logs` (30 day retention), `system_logs` (audit), `refresh_tokens`, `password_resets`.
Field names are snake_case. Timestamps the app treats as raw epoch-ms numbers (`created_at`, `scheduled_departure`,
`hold_expires_at`, ...) are stored as `bigint`; `trips.service_date` stays a `YYYY-MM-DD` Sri Lanka date string.
