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

@objc(LiveActivityActionBridge)
public final class LiveActivityActionBridge: NSObject {
  private static let appGroupId = "group.com.toondeboer.pokerkit"
  private static let darwinNotificationName: CFString = "com.toondeboer.pokerkit.liveActivityAction" as CFString
  private static let pendingActionKey = "pendingLiveActivityAction"
  private static let pendingTimestampKey = "pendingLiveActivityActionTimestamp"

  /// Re-posted (as a regular `NotificationCenter` notification, safe for capturing observers)
  /// once the raw Darwin notification arrives — see `startObservingIfNeeded()`.
  public static let actionReceivedNotification = Notification.Name(
    "LiveActivityActionBridge.actionReceived")

  private static var sharedDefaults: UserDefaults? {
    UserDefaults(suiteName: appGroupId)
  }

  /// Called from the widget extension process when a Live Activity/Dynamic Island button is
  /// tapped (see `TimerActionIntents.swift`). The intent itself already updated/ended the
  /// Activity directly for instant UI feedback; this just tells the main app what happened.
  @objc public static func postAction(_ action: String) {
    sharedDefaults?.set(action, forKey: pendingActionKey)
    sharedDefaults?.set(Date().timeIntervalSince1970, forKey: pendingTimestampKey)
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName(darwinNotificationName),
      nil, nil, true
    )
  }

  /// Reads and clears the pending action, if any. Safe to call from either process/target.
  @objc public static func consumePendingAction() -> String? {
    guard let action = sharedDefaults?.string(forKey: pendingActionKey) else { return nil }
    sharedDefaults?.removeObject(forKey: pendingActionKey)
    sharedDefaults?.removeObject(forKey: pendingTimestampKey)
    return action
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
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      nil,
      { _, _, _, _, _ in
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
