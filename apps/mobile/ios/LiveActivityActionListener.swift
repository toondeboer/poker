//
//  LiveActivityActionListener.swift
//  PokerTimer
//
//  Forwards a Live Activity/Dynamic Island button tap (relayed via `LiveActivityActionBridge`'s
//  Darwin notification) into a JS event on `RNLiveActivity`, while the main app is alive to
//  receive it. Started once from `AppDelegate`.
//

import Foundation
import os

@objc(LiveActivityActionListener)
public final class LiveActivityActionListener: NSObject {
  @objc public static let shared = LiveActivityActionListener()

  private override init() {
    super.init()
  }

  @objc public func start() {
    Logger.liveActivity.log("LiveActivityActionListener.start() called")
    LiveActivityActionBridge.startObservingIfNeeded()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleActionReceived),
      name: LiveActivityActionBridge.actionReceivedNotification,
      object: nil
    )
  }

  @objc private func handleActionReceived() {
    guard let pending = LiveActivityActionBridge.consumePendingAction() else {
      Logger.liveActivity.log("handleActionReceived() — consumePendingAction returned nil, nothing to emit")
      return
    }
    Logger.liveActivity.log("handleActionReceived() — emitting \(pending) to JS")
    RNLiveActivity.emitAction(pending)
  }
}
