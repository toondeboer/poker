// android/app/src/main/java/com/toondeboer/pokerkit/MainActivity.kt
package com.toondeboer.pokerkit

import expo.modules.splashscreen.SplashScreenManager

import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.content.Intent
import android.content.pm.ActivityInfo
import android.util.Log

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Set the theme to AppTheme BEFORE onCreate to support
        // coloring the background, status bar, and navigation bar.
        // This is required for expo-splash-screen.
        // setTheme(R.style.AppTheme);
        // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
        SplashScreenManager.registerOnActivity(this)
        // @generated end expo-splashscreen
        super.onCreate(null)

        // Phones: portrait-only, no exceptions (product decision — see git
        // history on fix/android-large-screen-orientation). Tablets get
        // SCREEN_ORIENTATION_UNSPECIFIED instead of a manifest-level fixed
        // orientation: Android 12L+ letterboxes activities with a *declared*
        // fixed orientation on large screens rather than ignoring it, so the
        // manifest has no android:screenOrientation at all and this runtime
        // check locks phones only, leaving tablets free to use the sensor
        // orientation (and the whole screen) without the OS letterboxing them.
        requestedOrientation = if (isLargeScreen()) {
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        } else {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        }
    }

    private fun isLargeScreen(): Boolean {
        return resources.configuration.smallestScreenWidthDp >= 600
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)

        // Handle intents from foreground service notification
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {
        // Check if this intent came from the foreground service notification
        val fromService = intent.getBooleanExtra("from_foreground_service", false)

        if (fromService) {
            println("App opened from foreground service - preserving state")
            // Don't reset any state - just bring app to foreground
            // The React Native side will handle state restoration
        }
    }

    // Guards against a react-native crash (NullPointerException in
    // ReactActivityDelegate, e.g. onUserLeaveHint/onPause/onResume/onDestroy/
    // onActivityResult/onWindowFocusChanged/onConfigurationChanged) that fires when
    // the activity is paused/resumed/reconfigured before the JS bridge has finished
    // attaching (e.g. backgrounded within the first second of a cold, dev-client
    // launch). Android's own Activity-level handling for each of these already runs
    // (synchronously, first) inside super.<method>() before react-native's own call
    // that can throw, so catching here only skips react-native's bookkeeping for an
    // instance that was never attached — it does not skip any real Android lifecycle
    // work. See ReactActivity.java in react-native, which ships as a prebuilt AAR
    // (com.facebook.react:react-android) rather than being compiled from source here,
    // so this can't be patched at the vendored-source level (e.g. via patch-package).
    private inline fun guardReactLifecycle(name: String, block: () -> Unit) {
        try {
            block()
        } catch (e: NullPointerException) {
            Log.w("MainActivity", "Ignoring pre-ready react-native lifecycle exception in $name", e)
        }
    }

    override fun onUserLeaveHint() {
        guardReactLifecycle("onUserLeaveHint") { super.onUserLeaveHint() }
    }

    override fun onPause() {
        guardReactLifecycle("onPause") { super.onPause() }
    }

    override fun onResume() {
        guardReactLifecycle("onResume") { super.onResume() }
    }

    override fun onDestroy() {
        guardReactLifecycle("onDestroy") { super.onDestroy() }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        guardReactLifecycle("onActivityResult") { super.onActivityResult(requestCode, resultCode, data) }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        guardReactLifecycle("onWindowFocusChanged") { super.onWindowFocusChanged(hasFocus) }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        guardReactLifecycle("onConfigurationChanged") { super.onConfigurationChanged(newConfig) }
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "main"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            object : DefaultReactActivityDelegate(
                this,
                mainComponentName,
                fabricEnabled
            ) {})
    }

    /**
     * Align the back button behavior with Android S
     * where moving root activities to background instead of finishing activities.
     * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
     */
    override fun invokeDefaultOnBackPressed() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
            if (!moveTaskToBack(false)) {
                // For non-root activities, use the default implementation to finish them.
                super.invokeDefaultOnBackPressed()
            }
            return
        }

        // Use the default back button implementation on Android S
        // because it's doing more than [Activity.moveTaskToBack] in fact.
        super.invokeDefaultOnBackPressed()
    }
}



