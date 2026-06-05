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
      print("Live Activities are not enabled")
      return nil
    }
        
    // Parse endTime properly
    let endTime: Date
    if let endTimeValue = data["endTime"] as? Double {
      endTime = Date(timeIntervalSince1970: endTimeValue)
    } else if let timeLeft = data["timeLeft"] as? Double {
      endTime = Date().addingTimeInterval(timeLeft)
    } else {
      endTime = Date().addingTimeInterval(900) // Default 15 minutes
    }
        
    let attributes = PokerTimerWidgetAttributes(
      tournamentName: data["tournamentName"] as? String ?? "Poker Tournament"
    )
        
    let contentState = PokerTimerWidgetAttributes.ContentState(
      currentBlindLevel: data["currentBlindLevel"] as? Int ?? 1,
      currentSmallBlind: data["currentSmallBlind"] as? Int ?? 25,
      currentBigBlind: data["currentBigBlind"] as? Int ?? 50,
      nextSmallBlind: data["nextSmallBlind"] as? Int ?? 50,
      nextBigBlind: data["nextBigBlind"] as? Int ?? 100,
      endTime: endTime,
      paused: data["paused"] as? Bool ?? false,
      timeLeft: data["timeLeft"] as? Double ?? 0
    )
        
    do {
      let activity = try Activity<PokerTimerWidgetAttributes>.request(
        attributes: attributes,
        content: ActivityContent(state: contentState, staleDate: nil),
        pushType: nil
      )
      print("Live Activity started with ID: \(activity.id)")
      return activity.id
    } catch {
      print("Error starting Live Activity: \(error.localizedDescription)")
      return nil
    }
  }
    
  @objc public static func updateActivity(id: String, data: [String: Any]) {
    // Parse endTime properly
    let endTime: Date
    if let endTimeValue = data["endTime"] as? Double {
      endTime = Date(timeIntervalSince1970: endTimeValue)
    } else if let timeLeft = data["timeLeft"] as? Double {
      endTime = Date().addingTimeInterval(timeLeft)
    } else {
      print("Warning: No valid endTime or timeLeft provided for update")
      endTime = Date().addingTimeInterval(900) // Default 15 minutes
    }
        
    let contentState = PokerTimerWidgetAttributes.ContentState(
      currentBlindLevel: data["currentBlindLevel"] as? Int ?? 1,
      currentSmallBlind: data["currentSmallBlind"] as? Int ?? 25,
      currentBigBlind: data["currentBigBlind"] as? Int ?? 50,
      nextSmallBlind: data["nextSmallBlind"] as? Int ?? 50,
      nextBigBlind: data["nextBigBlind"] as? Int ?? 100,
      endTime: endTime,
      paused: data["paused"] as? Bool ?? false,
      timeLeft: data["timeLeft"] as? Double ?? 0
    )
        
    Task {
      do {
        let activities = Activity<PokerTimerWidgetAttributes>.activities
        guard let activity = activities.first(where: { $0.id == id }) else {
          print("No active Live Activity found with ID: \(id)")
          return
        }
                
        let content = ActivityContent(state: contentState, staleDate: nil)
        await activity.update(content)
        print("Live Activity updated successfully")
      } catch {
        print("Error updating Live Activity: \(error.localizedDescription)")
      }
    }
  }
    
  @objc public static func endActivity(id: String) {
    Task {
      do {
        let activities = Activity<PokerTimerWidgetAttributes>.activities
        guard let activity = activities.first(where: { $0.id == id }) else {
          print("No active Live Activity found with ID: \(id)")
          return
        }
                
        await activity.end(
          ActivityContent(
            state: activity.content.state,
            staleDate: Date()
          ),
          dismissalPolicy: .immediate
        )
        print("Live Activity ended successfully")
      } catch {
        print("Error ending Live Activity: \(error.localizedDescription)")
      }
    }
  }
    
  @objc public static func areActivitiesEnabled() -> Bool {
    return ActivityAuthorizationInfo().areActivitiesEnabled
  }
    
  @objc public static func getActiveActivities() -> [String] {
    let activities = Activity<PokerTimerWidgetAttributes>.activities
    return activities.map { $0.id }
  }
}



