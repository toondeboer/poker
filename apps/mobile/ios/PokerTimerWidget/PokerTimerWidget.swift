//
//  PokerTimerWidget.swift
//  PokerTimerWidget
//
//  Created by Toon de Boer on 22/07/2025.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct PokerTimerWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: PokerTimerWidgetAttributes.self) { context in
      // Lock screen/banner UI
      PokerTimerLiveActivityView(
        context: context
      )
      .activityBackgroundTint(Color.green.opacity(0.1))
      .activitySystemActionForegroundColor(Color.green)
    } dynamicIsland: { context in
      DynamicIsland {
        // Expanded UI
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading) {
            Text("Current")
            Text("\(context.state.currentSmallBlind)/\(context.state.currentBigBlind)")
              .font(.title2)
              .bold()
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing) {
            Text("Next")
            Text("\(context.state.nextSmallBlind)/\(context.state.nextBigBlind)")
              .font(.title2)
              .bold()
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Image(systemName: "timer")
            Text(timerInterval: Date()...Date(timeIntervalSince1970: context.state.endTime / 1000.0), countsDown: true)
              .font(.title3)
              .bold()
              .monospacedDigit()
            Spacer()
            Text("Level \(context.state.currentBlindLevel)")
          }
        }
      } compactLeading: {
        Image(systemName: "suit.spade.fill")
          .foregroundColor(.green)
      } compactTrailing: {
        Text(timerInterval: Date()...Date(timeIntervalSince1970: context.state.endTime / 1000.0), countsDown: true)
          .font(.caption2)
          .bold()
          .monospacedDigit()
      } minimal: {
        Image(systemName: "timer")
          .foregroundColor(.green)
      }
    }
  }
}

struct PokerTimerLiveActivityView: View {
  let context: ActivityViewContext<PokerTimerWidgetAttributes>
  
  var body: some View {
    VStack(spacing: 8) {
      HStack {
        Text(context.attributes.tournamentName)
          .font(.headline)
        Spacer()
        Text("Level \(context.state.currentBlindLevel)")
          .font(.subheadline)
          .foregroundColor(.secondary)
      }
      
      if context.state.isBreak {
        Text(context.state.breakName ?? "Break")
          .font(.title2)
          .bold()
      } else {
        HStack {
          VStack(alignment: .leading) {
            Text("Current Blinds")
              .font(.caption)
              .foregroundColor(.secondary)
            Text("\(context.state.currentSmallBlind)/\(context.state.currentBigBlind)")
              .font(.title2)
              .bold()
          }
          
          Spacer()
          
          VStack(alignment: .trailing) {
            Text("Next Blinds")
              .font(.caption)
              .foregroundColor(.secondary)
            Text("\(context.state.nextSmallBlind)/\(context.state.nextBigBlind)")
              .font(.title2)
              .bold()
          }
        }
      }
      
      HStack {
        Image(systemName: "timer")
          .foregroundColor(.green)
        (
        Text("Time Remaining: ") +
        Text(timerInterval: Date()...Date(timeIntervalSince1970: context.state.endTime / 1000.0), countsDown: true)
        )
          .font(.title3)
          .bold()
          .monospacedDigit()
        Spacer()
      }
    }
    .padding()
  }
}

#Preview("Live Activity", as: .content, using: PokerTimerWidgetAttributes.preview) {
  PokerTimerWidget()
} contentStates: {
  PokerTimerWidgetAttributes.ContentState.sampleData
}


