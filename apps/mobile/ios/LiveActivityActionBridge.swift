//
//  LiveActivityActionBridge.swift
//  PokerTimer / PokerTimerWidget
//
//  Shared between the main app target and the widget extension target. A Live Activity
//  button's `LiveActivityIntent.perform()` runs in the widget extension's own process, not the
//  main app's — this is the only channel between the two. Pause/Resume/Stop write here (App
//  Group `UserDefaults` + a Darwin notification); the main app either reacts live (if it's
//  running) or reads the persisted flag on next launch/foreground.
//

import Foundation
import os

/// Shared, filterable logging for the whole Live Activity action pipeline. View live in
/// Console.app: connect the device, select it in the sidebar, and filter by subsystem
/// `com.toondeboer.pokerkit` (category `LiveActivity`) — this shows logs from *both* the main
/// app process and the widget extension process, which is what makes it possible to see where
/// in the chain (widget tap -> App Group write -> Darwin notification -> main app -> JS) an
/// action actually stops.
extension Logger {
  static let liveActivity = Logger(subsystem: "com.toondeboer.pokerkit", category: "LiveActivity")
}

@objc(LiveActivityActionBridge)
public final class LiveActivityActionBridge: NSObject {
  private static let appGroupId = "group.com.toondeboer.pokerkit"
  private static let darwinNotificationName: CFString = "com.toondeboer.pokerkit.liveActivityAction" as CFString
  private static let pendingActionKey = "pendingLiveActivityAction"
  private static let pendingTimestampKey = "pendingLiveActivityActionTimestamp"
  private static let pendingPausedKey = "pendingLiveActivityPaused"
  private static let pendingTimeLeftKey = "pendingLiveActivityTimeLeft"
  private static let pendingEndTimeKey = "pendingLiveActivityEndTime"
  // Set only on a "resume" action tapped while the round had already expired — lets JS tell this
  // apart from an ordinary mid-round pause/resume, since only the app knows about blind levels
  // (the widget extension doesn't) and needs to advance to the next one instead of restarting
  // the same round.
  private static let pendingWasExpiredKey = "pendingLiveActivityWasExpired"

  /// Re-posted (as a regular `NotificationCenter` notification, safe for capturing observers)
  /// once the raw Darwin notification arrives — see `startObservingIfNeeded()`.
  public static let actionReceivedNotification = Notification.Name(
    "LiveActivityActionBridge.actionReceived")

  private static var sharedDefaults: UserDefaults? {
    let defaults = UserDefaults(suiteName: appGroupId)
    if defaults == nil {
      Logger.liveActivity.error(
        "App Group UserDefaults(suiteName: \(appGroupId, privacy: .public)) is nil — the App Group entitlement isn't actually working for this process. Nothing written here will ever be readable by the other process."
      )
    }
    return defaults
  }

  /// Called from the widget extension process when a Live Activity/Dynamic Island button is
  /// tapped (see `TimerActionIntents.swift`). The intent itself already updated/ended the
  /// Activity directly for instant UI feedback; this tells the main app what happened — carrying
  /// the *exact* resulting paused/timeLeft/endTime, not just the action name. Without this, a JS
  /// instance that wasn't alive to receive this live event would instead reconcile later via
  /// `consumePendingAction()` by re-deriving `timeLeft` from AsyncStorage's stale, pre-pause
  /// `endTime` continuing to count down all the way to "now" (whenever the app happens to
  /// reopen) — pausing/resuming at the wrong instant instead of the one actually tapped.
  @objc public static func postAction(
    _ action: String, paused: Bool, timeLeft: Double, endTime: Double, wasExpired: Bool = false
  ) {
    guard let defaults = sharedDefaults else {
      Logger.liveActivity.error("postAction(\(action, privacy: .public)) — no shared defaults, action NOT persisted")
      return
    }
    defaults.set(action, forKey: pendingActionKey)
    defaults.set(Date().timeIntervalSince1970, forKey: pendingTimestampKey)
    defaults.set(paused, forKey: pendingPausedKey)
    defaults.set(timeLeft, forKey: pendingTimeLeftKey)
    defaults.set(endTime, forKey: pendingEndTimeKey)
    defaults.set(wasExpired, forKey: pendingWasExpiredKey)
    defaults.synchronize()
    // Read back immediately as a sanity check — confirms the write actually landed in the
    // shared container, not just an in-memory UserDefaults instance.
    let readBack = defaults.string(forKey: pendingActionKey)
    Logger.liveActivity.log(
      "postAction(\(action, privacy: .public)) written, read-back=\(readBack ?? "nil", privacy: .public); posting Darwin notification"
    )
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName(darwinNotificationName),
      nil, nil, true
    )
  }

  /// Reads and clears the pending action (with its snapshot), if any. Safe to call from either
  /// process/target. Returns a plain dictionary rather than a typed struct so it bridges
  /// cleanly to Objective-C (`RNLiveActivity.m`) and, from there, straight into a JS object.
  @objc public static func consumePendingAction() -> [String: Any]? {
    guard let defaults = sharedDefaults else {
      Logger.liveActivity.error("consumePendingAction() — no shared defaults, returning nil")
      return nil
    }
    guard let action = defaults.string(forKey: pendingActionKey) else {
      Logger.liveActivity.log("consumePendingAction() — nothing pending")
      return nil
    }
    let result: [String: Any] = [
      "action": action,
      "paused": defaults.bool(forKey: pendingPausedKey),
      "timeLeft": defaults.double(forKey: pendingTimeLeftKey),
      "endTime": defaults.double(forKey: pendingEndTimeKey),
      "wasExpired": defaults.bool(forKey: pendingWasExpiredKey),
    ]
    defaults.removeObject(forKey: pendingActionKey)
    defaults.removeObject(forKey: pendingTimestampKey)
    defaults.removeObject(forKey: pendingPausedKey)
    defaults.removeObject(forKey: pendingTimeLeftKey)
    defaults.removeObject(forKey: pendingEndTimeKey)
    defaults.removeObject(forKey: pendingWasExpiredKey)
    Logger.liveActivity.log("consumePendingAction() — consumed \(action, privacy: .public)")
    return result
  }

  private static var isObserving = false

  /// Registers a Darwin-notification observer (main app process only — the widget extension
  /// only ever posts). The C callback captures nothing and does the minimum possible work
  /// (hop to main queue, re-post as a normal `NotificationCenter` notification) so listeners
  /// like `LiveActivityActionListener` can use ordinary capturing closures/selectors instead of
  /// dealing with `CFNotificationCenter`'s C-function-pointer API themselves. Idempotent.
  @objc public static func startObservingIfNeeded() {
    guard !isObserving else { return }
    isObserving = true
    Logger.liveActivity.log("startObservingIfNeeded() — Darwin observer registered")
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      nil,
      { _, _, _, _, _ in
        Logger.liveActivity.log("Darwin notification received")
        DispatchQueue.main.async {
          NotificationCenter.default.post(
            name: LiveActivityActionBridge.actionReceivedNotification, object: nil)
        }
      },
      darwinNotificationName,
      nil,
      .deliverImmediately
    )
  }
}
