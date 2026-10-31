# Carribu Admin App

A React-based admin dashboard for the Carribu school transport system. Can be deployed as a web app (Railway) or packaged as a native Android APK using Capacitor.

## Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **Android Studio** (for APK builds)
- **Android SDK** with API level 33+
- **Java JDK** 17+

## Setup

```bash
# Clone the repository
git clone https://github.com/Ahmedsebit/carribu_admin_app.git
cd carribu_admin_app

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env and add your Google Maps API key
```

## Local Development (Web)

```bash
# Start the development server
npm run dev

# App runs at http://localhost:3000
```

## Production Build (Web)

```bash
# Build the React app
npm run build

# Serve the production build locally
npm start

# App runs at http://localhost:3000
```

## Trip lifecycle and notification diagnostics

Trip details display the server's frozen itinerary, current stop and trip phase.
Afternoon students must be explicitly boarded at school or marked absent;
drop-offs begin only when boarding is resolved. No role can complete a trip
with unresolved or onboard students. Routes cannot be edited/deactivated during
an active trip, and drivers/vehicles cannot serve overlapping active trips.

The trip's **Parent notification delivery** panel refreshes every 15 seconds and
distinguishes queued, retrying, unregistered, receipt-waiting, accepted, failed
and cancelled events. Accepted means the push provider accepted the alert, not
that a parent received or read it. Stale GPS positions are labeled last known
rather than presented as fresh tracking.

Deploy backend migration `0016` before these clients; it supplies the authoritative
plan/state fields and delivery diagnostics endpoint.

## GPS tracker links

Vehicle cards and details show the assigned tracker identifier read-only.
Only the **super-admin app** can add, change, or unlink trackers under
**Schools > school details > Vehicles**. School admins and coordinators cannot
change tracker assignments, including through the vehicle API.

Open **Vehicles > vehicle details** to view the **Active trip location** map.
It checks for updates every 10 seconds, shows the GPS fix timestamp, and links
to the active trip. Linked vehicles show only Traccar positions; there is no
phone-GPS fallback. Unlinked vehicles continue using driver-phone GPS.
No map is shown outside active trips. If no trip point exists yet, the latest
known Traccar snapshot is shown with its original fix timestamp and an explicit
warning if it predates the trip. It is not counted as a new trip-history point.
If Traccar has provided no valid timestamped position, the map remains empty.
Location request failures are displayed explicitly, and stale points are
identified by their last GPS fix time rather than labelled as live.

**Trips > Live** and active trip details use the same source-aware location map, scoped to the selected
trip. Linked vehicles wait for Traccar, not driver-phone sharing. When a trip
ends, the modal stops displaying its location and cannot switch to another
trip on the same vehicle. Location and student-log request errors are shown
separately. Closing the modal cancels pending requests and polling.
Active trip details render this same location card rather than the historical
GPS panel. The trip-details API also includes the shared last-known fallback;
completed trips continue to show only their original recorded locations.

The map reads the backend's ingested positions; it does not call Traccar
directly or expose its credentials. The backend polls Traccar every 60 seconds
and also receives live updates. Polling cannot create a new GPS fix: older
fixes remain explicitly labelled as last-known, not fresh trip locations.
The backend must apply migration `0015-add-vehicle-tracker-positions` before
deploying this snapshot fallback. Snapshots update on the next backend poll
or live position message while the trip and vehicle are active.

## Deployment (Railway)

The app is configured for Railway deployment:
- Railway runs `npm run build` followed by `npm start`
- The `serve` package serves the static build on the Railway-provided `PORT`
- No additional configuration needed — just connect the GitHub repo to Railway

## Android APK Build (Capacitor)

### Initial Setup

```bash
# Install dependencies (already included in package.json)
npm install

# Build the React app first
npm run build

# Sync web assets to Android project
npx cap sync android
```

### Building the Debug APK

```bash
# Navigate to Android directory
cd android

# Build debug APK
./gradlew assembleDebug

# APK output location:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Building the Release APK

```bash
cd android

# Build release APK (unsigned)
./gradlew assembleRelease

# APK output location:
# android/app/build/outputs/apk/release/app-release-unsigned.apk
```

### Opening in Android Studio

```bash
npx cap open android
```

This opens the project in Android Studio where you can run on an emulator, connected device, or generate a signed APK/AAB for Play Store publishing.

### Updating the App After Code Changes

```bash
# Rebuild the React app
npm run build

# Sync changes to the Android project
npx cap sync android

# Then rebuild the APK
cd android && ./gradlew assembleDebug
```

## Project Structure

```
carribu_admin_app/
├── public/          # Static assets
├── src/             # React source code
├── build/           # Production build output (generated)
├── android/         # Capacitor Android project
├── server.js        # Production server (used by Railway)
├── capacitor.config.ts  # Capacitor configuration
├── package.json     # Dependencies and scripts
└── .env             # Environment variables (not committed)
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `REACT_APP_GOOGLE_MAPS_KEY` | Google Maps JavaScript API key for route maps |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build production bundle |
| `npm start` | Serve production build (for deployment) |