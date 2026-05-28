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