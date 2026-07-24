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
import os

// A single toggle intent, not two separate Pause/Resume intent types (WidgetKit's interactive
// buttons can lose their binding when a button swaps between two *different* intent types across
// re-renders — the branch that only appears after the first state change stops responding).
//
// `shouldPause` is a *parameter*, supplied by the button at the exact moment it's rendered (see
// `TimerActionButtons` in PokerTimerWidget.swift), rather than re-derived from a fresh
// `Activity.activities.first!.content.state.paused` read inside `perform()`. Lock Screen Live
// Activity content can render slightly behind the true underlying state, so a fresh read could
// disagree with what the user actually saw and tapped; tying the intent to the same `paused`
// value that decided the button's label guarantees perform() always does what was displayed,
// with a same-state tap degrading to a harmless no-op instead of firing the wrong direction.
struct TogglePauseTimerIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Toggle Timer Pause"

  @Parameter(title: "Pause")
  var shouldPause: Bool

  init() {
    self.shouldPause = true
  }

  init(shouldPause: Bool) {
    self.shouldPause = shouldPause
  }

  func perform() async throws -> some IntentResult {
    Logger.liveActivity.log("TogglePauseTimerIntent.perform() shouldPause=\(shouldPause)")
    guard let activity = Activity<PokerTimerWidgetAttributes>.activities.first else {
      Logger.liveActivity.error("TogglePauseTimerIntent.perform() — no active Activity found")
      LiveActivityActionBridge.postAction(shouldPause ? "pause" : "resume")
      return .result()
    }
    var state = activity.content.state
    Logger.liveActivity.log(
      "before: paused=\(state.paused) timeLeft=\(state.timeLeft) endTime=\(state.endTime.timeIntervalSince1970) timerDuration=\(state.timerDuration)"
    )
    if shouldPause {
      state.timeLeft = max(0, state.timeRemaining)
      state.paused = true
    } else {
      // Resume. Mirror the JS timer state machine's own `startTimer` fallback: resuming from
      // an already-expired/zero timeLeft restarts a full round rather than an
      // instantly-expired one.
      let remaining = state.timeLeft > 0 ? state.timeLeft : state.timerDuration
      state.endTime = Date().addingTimeInterval(remaining)
      state.paused = false
    }
    Logger.liveActivity.log(
      "after: paused=\(state.paused) timeLeft=\(state.timeLeft) endTime=\(state.endTime.timeIntervalSince1970)"
    )
    await activity.update(ActivityContent(state: state, staleDate: nil))
    Logger.liveActivity.log("activity.update() awaited/returned")
    LiveActivityActionBridge.postAction(shouldPause ? "pause" : "resume")
    return .result()
  }
}

struct StopTimerIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Timer"

  func perform() async throws -> some IntentResult {
    Logger.liveActivity.log("StopTimerIntent.perform()")
    if let activity = Activity<PokerTimerWidgetAttributes>.activities.first {
      // Same call shape as `LiveActivityManager.endActivity`, so JS-driven stop and
      // button-driven stop look identical.
      await activity.end(
        ActivityContent(state: activity.content.state, staleDate: Date()),
        dismissalPolicy: .immediate
      )
    } else {
      Logger.liveActivity.error("StopTimerIntent.perform() — no active Activity found")
    }
    LiveActivityActionBridge.postAction("stop")
    return .result()
  }
}
