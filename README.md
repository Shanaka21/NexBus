# NexBus

Smart public transport tracking and passenger decision support system for Sri Lanka (final year project).

| Folder | What it is |
|--------|------------|
| [nexbus-backend](nexbus-backend) | REST API (Node.js, Express, Firebase). See [API.md](nexbus-backend/API.md) |
| [nexbus-mobile](nexbus-mobile) | Passenger and driver app (Expo, React Native). Runs on a phone and in the browser |
| [nexbus-web](nexbus-web) | Operator and administrator dashboard (React, Vite) |

[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) lists what is built, what was verified and what still needs your action.

## Quick start

1. **Backend**: `cd nexbus-backend`, `npm install`, copy `.env.example` to `.env` and fill it, `npm run seed`, `npm start` (port 5000).
   Without a Firebase quota or without internet use the local emulators instead: install Java, then `npm run emulators`, `npm run seed:emu`, `npm run start:emu`.
2. **Mobile**: `cd nexbus-mobile`, `npm install`, copy `.env.example` to `.env.local`, `npx expo start` (press `w` for the browser, or scan the QR code with Expo Go).
   The API address is chosen in [nexbus-mobile/lib/config.js](nexbus-mobile/lib/config.js): `localhost` in the browser, your PC's LAN address on a phone.
3. **Dashboard**: `cd nexbus-web`, `npm install`, copy `.env.example` to `.env.local`, `npm run dev`, open http://localhost:5173.

The Firebase web API key (Project settings, General) goes into the two `.env.local` files. It is not stored in the source code.

## Demo accounts (created by the seed)

| Role | Email | Password | Use it in |
|------|-------|----------|-----------|
| Passenger | demo@nexbus.lk | Demo@1234 | mobile app |
| Driver | driver@nexbus.lk | Driver@1234 | mobile app (driver mode) |
| Operator | operator@nexbus.lk | Operator@1234 | dashboard |
| Admin | admin@nexbus.lk | Admin@1234 | dashboard |

## Tests

`cd nexbus-backend`: `npm test` (99 unit and API tests), `npm run test:rules` (Firestore security rules, needs the emulators), `npm run smoke` (end-to-end flow against a running API).
