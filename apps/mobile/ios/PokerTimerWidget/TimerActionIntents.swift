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

struct PauseTimerIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Pause Timer"

  func perform() async throws -> some IntentResult {
    if let activity = Activity<PokerTimerWidgetAttributes>.activities.first {
      var state = activity.content.state
      state.timeLeft = max(0, state.timeRemaining)
      state.paused = true
      await activity.update(ActivityContent(state: state, staleDate: nil))
    }
    LiveActivityActionBridge.postAction("pause")
    return .result()
  }
}

struct ResumeTimerIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Resume Timer"

  func perform() async throws -> some IntentResult {
    if let activity = Activity<PokerTimerWidgetAttributes>.activities.first {
      var state = activity.content.state
      // Mirror the JS timer state machine's own `startTimer` fallback: resuming from an
      // already-expired/zero timeLeft restarts a full round rather than an instantly-expired one.
      let remaining = state.timeLeft > 0 ? state.timeLeft : state.timerDuration
      state.endTime = Date().addingTimeInterval(remaining)
      state.paused = false
      await activity.update(ActivityContent(state: state, staleDate: nil))
    }
    LiveActivityActionBridge.postAction("resume")
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
