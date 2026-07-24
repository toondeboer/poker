//
//  TimerActionIntents.swift
//  PokerTimerWidget
//
//  Live Activity / Dynamic Island button actions. `LiveActivityIntent` (iOS 17+) runs its
//  `perform()` in the widget extension's own process, without launching the host app — so each
//  intent updates the Activity directly (instant UI feedback, mirroring the Android foreground
//  service's local-update approach) and separately tells the main app what happened via
//  `LiveActivityActionBridge` (App Group + Darwin notification), since the two processes can't
//  talk to each other any other way.
//

import ActivityKit
import AppIntents

// A single toggle intent, not two separate Pause/Resume intent types. WidgetKit's interactive
// buttons can lose their binding when a button swaps between two *different* intent types across
// re-renders (the branch that only appears after the first state change — Resume, here — stops
// responding); a single intent type whose `perform()` reads the activity's own current `paused`
// state and flips it avoids that entirely, matching the in-app UI's own `togglePause()`.
struct TogglePauseTimerIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Toggle Timer Pause"

  func perform() async throws -> some IntentResult {
    if let activity = Activity<PokerTimerWidgetAttributes>.activities.first {
      var state = activity.content.state
      if state.paused {
        // Resume. Mirror the JS timer state machine's own `startTimer` fallback: resuming from
        // an already-expired/zero timeLeft restarts a full round rather than an
        // instantly-expired one.
        let remaining = state.timeLeft > 0 ? state.timeLeft : state.timerDuration
        state.endTime = Date().addingTimeInterval(remaining)
        state.paused = false
      } else {
        state.timeLeft = max(0, state.timeRemaining)
        state.paused = true
      }
      await activity.update(ActivityContent(state: state, staleDate: nil))
      LiveActivityActionBridge.postAction(state.paused ? "pause" : "resume")
    }
    return .result()
  }
}

struct StopTimerIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Timer"

  func perform() async throws -> some IntentResult {
    if let activity = Activity<PokerTimerWidgetAttributes>.activities.first {
      // Same call shape as `LiveActivityManager.endActivity`, so JS-driven stop and
      // button-driven stop look identical.
      await activity.end(
        ActivityContent(state: activity.content.state, staleDate: Date()),
        dismissalPolicy: .immediate
      )
    }
    LiveActivityActionBridge.postAction("stop")
    return .result()
  }
}
