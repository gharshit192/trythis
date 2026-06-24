# Wanna Try Mobile App

This folder is now the source for the Capacitor mobile shell. It wraps the
existing `frontend-app` React UI, so the current mobile web experience ships as
the native Android/iOS app without duplicating screens in React Native.

## Native Build Source

- App name: `Wanna Try`
- App id: `com.trythis.app`
- Web source: `frontend-app/src`
- Native web bundle: `frontend-app/build`
- Backend used by native builds: `https://trythis-am0j.onrender.com`

Override the backend for a build with:

```bash
REACT_APP_API_URL=https://your-api.example.com npm run cap:sync
```

## Android

From `frontend-app`:

```bash
npm run cap:sync
npm run cap:open:android
```

Then run from Android Studio on an emulator or a USB device.

Direct CLI run:

```bash
npm run cap:android
```

## iOS

iOS cannot be built on this Linux machine. You need macOS with Xcode.

On a Mac:

```bash
cd frontend-app
npm install
npm run cap:sync
cd ios/App
pod install
open App.xcworkspace
```

In Xcode:

1. Select the `App` target.
2. Set your Apple team under Signing & Capabilities.
3. Connect your iPhone and select it as the run destination.
4. Press Run.

If the app opens but API calls fail, confirm the native build was created with
the deployed API URL, not `localhost`.

## After Web Changes

Every time the React UI changes:

```bash
npm run cap:sync
```

This rebuilds the web bundle and copies it into `android/` and `ios/`.

## Notes

- Capacitor v7 is used because this repo currently runs on Node 20.
- Capacitor v8 requires Node 22.
- Expo Go is not involved in this path.
- This is intentionally a wrapper around the existing app. The later clean
  architecture can still be an Expo/React Native Web rewrite when the product
  surface stabilizes.
