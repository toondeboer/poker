# Poker Kit

This is a poker timer app built with Expo Router, TypeScript, and Tailwind CSS. It is designed to help teams manage
their poker sessions efficiently.

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
