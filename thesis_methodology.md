# Chapter 3: Methodology and System Design

## 3.1 Introduction

This chapter presents the methodology adopted for the design and development of NexBus — a real-time bus tracking and booking system for Sri Lanka. It covers the software development approach, system architecture, technology selection rationale, database design, API design, and user interface design decisions. The chapter demonstrates how each design choice was made to satisfy the functional and non-functional requirements identified in the previous chapter.

---

## 3.2 Development Methodology

### 3.2.1 Agile Iterative Approach

NexBus was developed using an **Agile iterative methodology**, where the system was built in a series of short development cycles (sprints), each delivering a working increment of the application. This approach was selected for the following reasons:

- **Flexibility:** Requirements for a real-time tracking system are inherently dynamic; the iterative model accommodates changes without disrupting the overall project.
- **Early feedback:** Each sprint produced a testable version of the system, allowing functional validation before moving to the next feature set.
- **Risk reduction:** Core infrastructure (Firebase, backend API) was established first, reducing integration risks in later stages.

### 3.2.2 Development Phases

The project was organised into four sequential phases:

| Phase | Focus | Deliverable |
|-------|-------|-------------|
| 1 – Foundation | Project setup, Firebase configuration, backend scaffolding | Running Express server, authenticated Firebase project |
| 2 – Mobile App | All eight screens designed and navigable | Complete React Native UI with Expo Router |
| 3 – Web Dashboard | Operator dashboard with Leaflet map integration | Interactive web dashboard |
| 4 – Integration | Backend API endpoints, Firestore/RTDB live data | Fully connected end-to-end system |

---

## 3.3 System Architecture

NexBus adopts a **three-tier client-server architecture** separating presentation, business logic, and data storage concerns.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT TIER                              │
│                                                                 │
│   ┌──────────────────────┐    ┌──────────────────────────────┐  │
│   │   Mobile App         │    │   Web Dashboard              │  │
│   │   React Native       │    │   React + Vite               │  │
│   │   Expo Router        │    │   Leaflet Maps               │  │
│   │   (Passenger)        │    │   (Operator)                 │  │
│   └──────────┬───────────┘    └──────────────┬───────────────┘  │
└──────────────┼──────────────────────────────-┼──────────────────┘
               │ HTTP REST (port 5000)          │ Firestore SDK
┌──────────────▼───────────────────────────────┼──────────────────┐
│                   BUSINESS LOGIC TIER         │                  │
│                                               │                  │
│   ┌───────────────────────────────────────┐   │                  │
│   │   Node.js + Express Backend           │   │                  │
│   │   - Authentication routes             │   │                  │
│   │   - Bus / Fleet routes                │   │                  │
│   │   - Booking management routes         │   │                  │
│   │   Firebase Admin SDK                  │   │                  │
│   └──────────────────┬────────────────────┘   │                  │
└─────────────────────-┼────────────────────────┼──────────────────┘
                       │                        │
┌──────────────────────▼────────────────────────▼──────────────────┐
│                      DATA TIER (Firebase)                         │
│                                                                   │
│   ┌─────────────────────────┐   ┌─────────────────────────────┐  │
│   │  Cloud Firestore        │   │  Realtime Database          │  │
│   │  - users                │   │  - locations/{bus_id}       │  │
│   │  - vehicles             │   │    { lat, lng, status }     │  │
│   │  - routes               │   │                             │  │
│   │  - bookings             │   │                             │  │
│   └─────────────────────────┘   └─────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### 3.3.1 Architectural Decisions

**Separation of mobile and web clients:** The passenger-facing mobile application and the operator-facing web dashboard serve distinct user roles with different interaction patterns. Separating them allows independent deployment and targeted feature sets.

**Dual Firebase database strategy:** Cloud Firestore was selected for structured, queryable entity data (users, bookings, vehicles). Firebase Realtime Database was selected exclusively for GPS location data, where low-latency streaming updates are critical and complex querying is not required.

**Backend as a middleware layer:** Although Firebase SDKs support direct client-side access, a Node.js/Express backend was introduced to centralise business logic, enforce server-side validation, and provide a consistent REST API consumed by the mobile application.

---

## 3.4 Technology Selection and Justification

### 3.4.1 Mobile: React Native with Expo

React Native was selected as the mobile development framework for the following reasons:

- **Cross-platform:** A single codebase targets both iOS and Android, reducing development effort.
- **JavaScript/TypeScript ecosystem:** Shared language with the web frontend and backend reduces context-switching.
- **Expo managed workflow:** Expo abstracts native build configurations and provides a rapid testing environment via Expo Go, which is suitable for a time-constrained academic project.
- **Expo Router:** File-based routing (similar to Next.js) provides a clean, scalable navigation architecture without manual stack configuration.

TypeScript was used throughout the mobile codebase to catch type errors at compile time and improve code maintainability.

### 3.4.2 Web Dashboard: React + Vite

React was chosen for the operator dashboard because:

- It is the industry-standard UI library, directly relevant to the target employment context (eBEYONDS Pvt Ltd).
- The component model enables reusable UI elements (bus cards, status badges).
- Vite provides a fast development server and optimised production builds.

**Leaflet (react-leaflet)** was used for map rendering rather than Google Maps because it is open-source, requires no API key for basic tile usage, and is straightforward to integrate in a Vite/React project.

### 3.4.3 Backend: Node.js + Express

Node.js was selected for the backend because:

- JavaScript on the server eliminates the need to learn a second programming language.
- Express is minimal and un-opinionated, allowing rapid endpoint creation without framework overhead.
- The Firebase Admin SDK for Node.js provides full Firestore and Realtime Database access with elevated privileges, suitable for server-side operations such as user creation and booking management.

### 3.4.4 Firebase Platform

Firebase was selected as the primary data and authentication platform because:

| Requirement | Firebase Feature |
|-------------|-----------------|
| User authentication | Firebase Authentication (email/password) |
| Structured data storage | Cloud Firestore |
| Real-time GPS updates | Firebase Realtime Database |
| No server management | Fully managed, serverless infrastructure |
| Free tier for development | Spark plan covers development scale |

---

## 3.5 Database Design

### 3.5.1 Cloud Firestore Schema

Firestore organises data into **collections** of **documents**. The following collections were designed:

#### `users` Collection
Stores passenger account information created during registration.

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Full name of the passenger |
| `email` | String | Email address (unique identifier) |
| `role` | String | Fixed value: `"passenger"` |

#### `vehicles` Collection
Represents each physical bus in the fleet.

| Field | Type | Description |
|-------|------|-------------|
| `bus_number` | String | Vehicle registration (e.g., `"ND-8645"`) |
| `route_number` | String | Route code (e.g., `"138"`) |
| `route_id` | String | Foreign key to the `routes` collection |
| `status` | String | `"active"`, `"delayed"`, `"emergency"`, or `"offline"` |
| `capacity` | Number | Total passenger capacity |
| `booked_seats` | Number | Number of seats currently booked |

#### `routes` Collection
Stores route metadata for each bus line.

| Field | Type | Description |
|-------|------|-------------|
| `route_name` | String | Descriptive name (e.g., `"Fort - Maharagama"`) |
| `start_point` | String | Origin stop name |
| `end_point` | String | Destination stop name |

#### `bookings` Collection
Records each booking made through the mobile application.

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | String | UID of the booking passenger |
| `route_number` | String | Route code |
| `from` | String | Departure stop |
| `to` | String | Arrival stop |
| `time` | String | Departure time slot (e.g., `"08:00 AM"`) |
| `seats` | Number | Number of seats booked |
| `fare` | String | Total fare (e.g., `"LKR 120"`) |
| `status` | String | `"confirmed"`, `"completed"`, or `"cancelled"` |
| `created_at` | Number | Unix timestamp of booking creation |

### 3.5.2 Firebase Realtime Database Schema

The Realtime Database stores GPS coordinates indexed by vehicle ID for low-latency streaming:

```
locations/
  bus_ND8645/
    lat: 6.8785
    lng: 79.8667
    status: "on_route"
    updated_at: 1745400000000
  bus_ND1234/
    lat: 6.9022
    lng: 79.8612
    status: "on_route"
    updated_at: 1745400012000
```

The key `bus_ND8645` is derived from the vehicle registration `"ND-8645"` by removing the hyphen, ensuring consistent lookup across the backend and web dashboard.

### 3.5.3 Entity Relationship Overview

```
users ──────────< bookings >────────── vehicles
                                           │
                                       routes
```

- A **user** can have many **bookings** (one-to-many).
- Each **booking** references one **vehicle** via `route_number`.
- Each **vehicle** references one **route** via `route_id`.

---

## 3.6 API Design

The backend exposes a RESTful API consumed by the mobile application. All endpoints accept and return JSON.

### Base URL
`http://<server_ip>:5000`

### 3.6.1 Authentication Endpoints (`/auth`)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| POST | `/auth/register` | Create new passenger account | `{ name, email, password }` |
| POST | `/auth/login` | Authenticate passenger | `{ email }` → returns `{ uid }` |

### 3.6.2 Bus Endpoints (`/buses`)

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/buses` | Fetch all vehicles joined with route data | Array of vehicle objects |
| POST | `/buses/location` | Update a vehicle's GPS position | `{ bus_id, lat, lng }` |

The `GET /buses` endpoint performs a server-side join between the `vehicles` and `routes` Firestore collections, returning enriched objects containing `start_point`, `end_point`, and `route_name` alongside vehicle data.

### 3.6.3 Booking Endpoints (`/bookings`)

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| GET | `/bookings?user_id={uid}` | Fetch all bookings for a passenger | — |
| POST | `/bookings` | Create a new booking | `{ user_id, route_number, from, to, time, seats, fare }` |
| PUT | `/bookings/:id/cancel` | Cancel an existing booking | — |

---

## 3.7 Mobile Application Design

### 3.7.1 Screen Architecture

The mobile application consists of eight screens managed by Expo Router's file-based navigation system:

| Screen | File | Purpose |
|--------|------|---------|
| Splash | `index.tsx` | Animated entry screen, navigates to Login |
| Login | `login.tsx` | Email/password authentication |
| Sign Up | `signup.tsx` | New passenger registration |
| Home | `home.tsx` | Dashboard with nearest stop, next arrival, recent routes |
| Routes | `routes.tsx` | Live list of active buses fetched from backend |
| Live Map | `map.tsx` | Real-time bus position map (react-native-maps) |
| Bookings | `bookings.tsx` | Booking history with cancel and stats |
| New Booking | `newbooking.tsx` | Route/time/seat selection and booking submission |

### 3.7.2 Navigation Flow

```
Splash → Login ──→ Home ──→ Routes
              └─→ Signup     ├──→ Live Map
                             └──→ Bookings → New Booking
```

### 3.7.3 UI Design System

A consistent visual language was applied across all screens:

- **Primary colour:** `#1a3cff` (NexBus blue)
- **Dark heading colour:** `#1a1a4e` (deep navy)
- **Background:** `#f0f0f5` (light grey-blue)
- **Gradient (branded headers):** `['#4f86f7', '#1a3cff', '#0d1b6e']`
- **Status colours:** Green `#4caf50` (on time), Orange `#ff9800` (delayed), Red `#f44336` (emergency)
- **Typography:** System font at weights 400/600/bold
- **Corner radius:** 12–20px on cards, 30px on pill elements
- **Bottom navigation:** Fixed four-tab bar (Home, Routes, Live Map, Bookings)

### 3.7.4 State Management

Global session state (authenticated user ID) is managed via a lightweight singleton module (`userSession.js`). This avoids introducing an external state management library (Redux, Zustand) for what is effectively a single piece of shared state, keeping the codebase simple and appropriate for the project's scale.

Screen-local state is managed with React's `useState` and `useEffect` hooks. The Bookings screen uses `useFocusEffect` from Expo Router to refetch data every time the screen comes into focus, ensuring booking counts update immediately after a new booking is created.

---

## 3.8 Web Dashboard Design

### 3.8.1 Dashboard Layout

The operator web dashboard follows a standard enterprise dashboard layout:

```
┌─────────────────────────────────────────────────────┐
│  Navbar: Logo | Nav tabs | Search | Action buttons  │
├───┬─────────────────────────────────────┬───────────┤
│ S │                                     │  Fleet    │
│ i │         Leaflet Map                 │  Cards    │
│ d │         (live bus markers)          │           │
│ e │                                     │  Status   │
│ b │                                     │  Table    │
│ a │                                     │           │
│ r ├─────────────────────────────────────┤  Report   │
│   │  Stats: Active | Schedule | Delay   │  Button   │
└───┴─────────────────────────────────────┴───────────┘
```

### 3.8.2 Real-Time Data Binding

The dashboard uses two Firebase SDK listeners mounted in `useEffect` hooks:

1. **`onSnapshot` (Firestore)** — subscribes to the `vehicles` collection. Any document update in Firestore (e.g., a bus status change) is pushed to the dashboard without polling, updating the fleet cards, table, and stats bar immediately.

2. **`onValue` (Realtime Database)** — subscribes to the `locations/` node. When a bus's GPS position is updated via `POST /buses/location`, the map marker moves automatically.

Both listeners are cleaned up on component unmount, preventing memory leaks.

### 3.8.3 Map Implementation

Leaflet was integrated via `react-leaflet`. Each active vehicle with a known GPS position is rendered as a custom SVG-based circular marker colour-coded by status (green/orange/red). Clicking a marker opens a popup with the vehicle's bus number and route. Selecting a bus in the right panel highlights the corresponding map marker and table row via shared `selectedBus` state.

---

## 3.9 Security Considerations

The following security measures are applied within the scope of this project:

| Concern | Measure |
|---------|---------|
| Firebase credentials | Service account key (`serviceAccountKey.json`) excluded from version control via `.gitignore` |
| API authentication | Backend login endpoint validates email existence via Firebase Admin before returning a UID |
| CORS | Express CORS middleware restricts cross-origin access |
| Input validation | Required fields checked server-side before Firestore writes |
| No plain-text passwords | Passwords are managed entirely by Firebase Authentication; the backend never stores or transmits passwords |

---

## 3.10 Summary

This chapter described the complete design of the NexBus system. An Agile iterative methodology was applied to deliver working increments throughout development. The system is structured across three tiers: a React Native mobile app and React web dashboard at the client tier; a Node.js/Express server at the business logic tier; and Firebase (Firestore + Realtime Database) at the data tier. Technology choices were justified based on project requirements, development speed, and industry relevance. The database schema, REST API, and UI design system were documented to establish a clear foundation for the implementation described in the following chapter.
