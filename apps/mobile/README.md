# Poker Kit

This is a poker timer app built with Expo Router, React Native, and TypeScript. It is designed to help
run poker tournaments — track blind levels and time each round.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo run:ios
   ```
   ```bash
   npx expo run:android
   ```

## Deploy to iOS

To deploy your app to iOS, you need to create a development build. Follow these steps:

1. Build your app for iOS
   ```bash
   eas build --platform ios --profile production
   ```
2. Deploy your app to the App Store
   ```bash
   eas submit -p ios --latest  
   ```

## Local development

### Regenerating native projects

This is a bare Expo workflow — the `ios/` and `android/` projects are committed. After you add or
upgrade a native dependency, or bump the Expo SDK, regenerate them so the native projects match the
installed packages. Run these from the `apps/mobile` directory:

```bash
cd apps/mobile           # the ios/ and android/ projects live here
npx expo prebuild        # add --clean to regenerate from scratch (e.g. after an SDK bump)
cd ios && pod install && cd ..
```

Then rebuild with `npx expo run:ios` / `npx expo run:android`. `--clean` wipes any hand-edited
native code that isn't expressed as a config plugin, so review the diff afterwards and re-apply
anything important.

### Android
Create a new `local.properties` file in the `android` directory with the following content:

```properties
sdk.dir=/Users/your-username/Library/Android/sdk