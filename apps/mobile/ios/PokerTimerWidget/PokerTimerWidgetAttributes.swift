//
//  PokerTimerAttributes.swift
//  PokerTimer
//
//  Created by Toon de Boer on 22/07/2025.
//

import Foundation
import ActivityKit

struct PokerTimerWidgetAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var currentBlindLevel: Int
    var currentSmallBlind: Int
    var currentBigBlind: Int
    var nextSmallBlind: Int
    var nextBigBlind: Int
    var endTime: Date
    var paused: Bool
        
    // Remove timeLeft as it's redundant with endTime
    var timeRemaining: TimeInterval {
      return endTime.timeIntervalSinceNow
    }
  }
    
  var tournamentName: String
}

// MARK: - Preview Support
extension PokerTimerWidgetAttributes {
  static var preview: PokerTimerWidgetAttributes {
    PokerTimerWidgetAttributes(tournamentName: "Friday Night Poker")
  }
}

extension PokerTimerWidgetAttributes.ContentState {
  static var sampleData: PokerTimerWidgetAttributes.ContentState {
    PokerTimerWidgetAttributes.ContentState(
      currentBlindLevel: 3,
      currentSmallBlind: 100,
      currentBigBlind: 200,
      nextSmallBlind: 150,
      nextBigBlind: 300,
      endTime: Date().addingTimeInterval(3600),
      paused: false
    )
  }
    
  static var pausedState: PokerTimerWidgetAttributes.ContentState {
    PokerTimerWidgetAttributes.ContentState(
      currentBlindLevel: 5,
      currentSmallBlind: 300,
      currentBigBlind: 600,
      nextSmallBlind: 400,
      nextBigBlind: 800,
      endTime: Date().addingTimeInterval(800),
      paused: true
    )
  }
    
  static var lowTimeState: PokerTimerWidgetAttributes.ContentState {
    PokerTimerWidgetAttributes.ContentState(
      currentBlindLevel: 8,
      currentSmallBlind: 1000,
      currentBigBlind: 2000,
      nextSmallBlind: 1500,
      nextBigBlind: 3000,
      endTime: Date().addingTimeInterval(45),
      paused: false
    )
  }
}



