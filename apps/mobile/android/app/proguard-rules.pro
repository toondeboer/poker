# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Google's UMP consent SDK (the ad consent form), as react-native-google-mobile-ads
# asks for. Without it a minified release build can strip the form's classes.
-keep class com.google.android.gms.internal.consent_sdk.** { *; }

# Add any project specific keep options here:
