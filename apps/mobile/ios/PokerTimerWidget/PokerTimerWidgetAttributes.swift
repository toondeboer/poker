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
        var endTime: Double
        var isBreak: Bool
        var breakName: String?
    }

    var tournamentName: String
}

// MARK: - Preview Support
extension PokerTimerWidgetAttributes {
    // Static preview data for the attributes (non-changing data)
    static var preview: PokerTimerWidgetAttributes {
        PokerTimerWidgetAttributes(tournamentName: "Friday Night Poker")
    }
}

extension PokerTimerWidgetAttributes.ContentState {
    // Sample data for different states
    static var sampleData: PokerTimerWidgetAttributes.ContentState {
        PokerTimerWidgetAttributes.ContentState(
            currentBlindLevel: 3,
            currentSmallBlind: 100,
            currentBigBlind: 200,
            nextSmallBlind: 150,
            nextBigBlind: 300,
            endTime: Date().timeIntervalSince1970 + 3600,
            isBreak: false,
            breakName: nil
        )
    }
    
    // Additional sample states for testing
    static var breakState: PokerTimerWidgetAttributes.ContentState {
        PokerTimerWidgetAttributes.ContentState(
            currentBlindLevel: 5,
            currentSmallBlind: 300,
            currentBigBlind: 600,
            nextSmallBlind: 400,
            nextBigBlind: 800,
            endTime: Date().timeIntervalSince1970 + 900,
            isBreak: true,
            breakName: "15 Minute Break"
        )
    }
    
    static var lowTimeState: PokerTimerWidgetAttributes.ContentState {
        PokerTimerWidgetAttributes.ContentState(
            currentBlindLevel: 8,
            currentSmallBlind: 1000,
            currentBigBlind: 2000,
            nextSmallBlind: 1500,
            nextBigBlind: 3000,
            endTime: Date().timeIntervalSince1970 + 45,
            isBreak: false,
            breakName: nil
        )
    }
}


