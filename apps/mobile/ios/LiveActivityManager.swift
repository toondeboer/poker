//
//  LiveActivityManager.swift
//  PokerTimer
//
//  Created by Toon de Boer on 22/07/2025.
//

import Foundation
import ActivityKit

@objc public class LiveActivityManager: NSObject {
  
  @objc public static func startActivity(data: [String: Any]) -> String? {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      return nil
    }
    
    let attributes = PokerTimerWidgetAttributes(tournamentName: data["tournamentName"] as? String ?? "Poker Timer")
    let contentState = PokerTimerWidgetAttributes.ContentState(
      currentBlindLevel: data["currentBlindLevel"] as? Int ?? 0,
      currentSmallBlind: data["currentSmallBlind"] as? Int ?? 0,
      currentBigBlind: data["currentBigBlind"] as? Int ?? 0,
      nextSmallBlind: data["nextSmallBlind"] as? Int ?? 0,
      nextBigBlind: data["nextBigBlind"] as? Int ?? 0,
      endTime: data["endTime"] as? Double ?? Date().timeIntervalSinceNow,
      isBreak: false,
      breakName: "Break"
    )
    
    do {
      let activity = try Activity<PokerTimerWidgetAttributes>.request(
        attributes: attributes,
        contentState: contentState
      )
      return activity.id
    } catch {
      print("Error starting Live Activity: \(error)")
      return nil
    }
  }
  
  @objc public static func updateActivity(id: String, data: [String: Any]) {
    let contentState = PokerTimerWidgetAttributes.ContentState(
      currentBlindLevel: data["currentBlindLevel"] as? Int ?? 0,
      currentSmallBlind: data["currentSmallBlind"] as? Int ?? 0,
      currentBigBlind: data["currentBigBlind"] as? Int ?? 0,
      nextSmallBlind: data["nextSmallBlind"] as? Int ?? 0,
      nextBigBlind: data["nextBigBlind"] as? Int ?? 0,
      endTime: data["endTime"] as? Double ?? Date().timeIntervalSinceNow,
      isBreak: false,
      breakName: "Break"
    )
    
    Task {
      let activities = Activity<PokerTimerWidgetAttributes>.activities
      if let activity = activities.first(where: { $0.id == id }) {
        await activity.update(using: contentState)
      }
    }
  }
  
  @objc public static func endActivity(id: String) {
    Task {
      let activities = Activity<PokerTimerWidgetAttributes>.activities
      if let activity = activities.first(where: { $0.id == id }) {
        await activity.end(dismissalPolicy: .immediate)
      }
    }
  }
  
  @objc public static func areActivitiesEnabled() -> Bool {
    return ActivityAuthorizationInfo().areActivitiesEnabled
  }
}



