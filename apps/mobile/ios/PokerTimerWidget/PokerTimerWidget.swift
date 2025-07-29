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
      PokerTimerLiveActivityView(context: context)
        .activityBackgroundTint(Color.green.opacity(0.1))
        .activitySystemActionForegroundColor(Color.green)
    } dynamicIsland: { context in
      DynamicIsland {
        // Expanded UI
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text("Current")
              .font(.caption)
              .foregroundColor(.secondary)
            Text(
              "\(context.state.currentSmallBlind)/\(context.state.currentBigBlind)"
            )
            .font(.title2)
            .bold()
          }
        }
                
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            Text("Next")
              .font(.caption)
              .foregroundColor(.secondary)
            Text(
              "\(context.state.nextSmallBlind)/\(context.state.nextBigBlind)"
            )
            .font(.title2)
            .bold()
          }
        }
                
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Image(
              systemName: context.state.paused ? "pause.circle.fill" : "timer"
            )
            .foregroundColor(.green)
                        
            if context.state.paused {
              Text("PAUSED")
                .font(.title3)
                .bold()
                .foregroundColor(.orange)
            } else {
              Text(
                timerInterval: Date()...context.state.endTime,
                countsDown: true
              )
              .font(.title3)
              .bold()
              .monospacedDigit()
            }
                        
            Spacer()
                        
            Text("Level \(context.state.currentBlindLevel)")
              .font(.caption)
              .foregroundColor(.secondary)
          }
        }
      } compactLeading: {
        Image(systemName: "suit.spade.fill")
          .foregroundColor(.green)
      } compactTrailing: {
        if context.state.paused {
          Image(systemName: "pause.circle.fill")
            .foregroundColor(.orange)
        } else {
          Text(timerInterval: Date()...context.state.endTime, countsDown: true)
            .font(.caption2)
            .bold()
            .monospacedDigit()
        }
      } minimal: {
        Image(systemName: context.state.paused ? "pause.circle.fill" : "timer")
          .foregroundColor(context.state.paused ? .orange : .green)
      }
    }
  }
}


struct PokerTimerLiveActivityView: View {
  let context: ActivityViewContext<PokerTimerWidgetAttributes>
    
  var body: some View {
    VStack(spacing: 12) {
      // Header
      HStack {
        Text(context.attributes.tournamentName)
          .font(.headline)
          .foregroundColor(.primary)
        Spacer()
        Text("Level \(context.state.currentBlindLevel)")
          .font(.subheadline)
          .foregroundColor(.secondary)
      }
            
      // Blinds or Paused state
      if context.state.paused {
        VStack(spacing: 4) {
          Text("TOURNAMENT PAUSED")
            .font(.title2)
            .bold()
            .foregroundColor(.orange)
          Text(
            "Current: \(context.state.currentSmallBlind)/\(context.state.currentBigBlind)"
          )
          .font(.subheadline)
          .foregroundColor(.secondary)
        }
      } else {
        HStack(spacing: 20) {
          VStack(alignment: .leading, spacing: 4) {
            Text("Current Blinds")
              .font(.caption)
              .foregroundColor(.secondary)
            Text(
              "\(context.state.currentSmallBlind)/\(context.state.currentBigBlind)"
            )
            .font(.title2)
            .bold()
            .foregroundColor(.primary)
          }
                    
          Spacer()
                    
          Image(systemName: "arrow.right")
            .foregroundColor(.secondary)
                    
          Spacer()
                    
          VStack(alignment: .trailing, spacing: 4) {
            Text("Next Blinds")
              .font(.caption)
              .foregroundColor(.secondary)
            Text(
              "\(context.state.nextSmallBlind)/\(context.state.nextBigBlind)"
            )
            .font(.title2)
            .bold()
            .foregroundColor(.primary)
          }
        }
      }
            
      // Timer section
      HStack(spacing: 8) {
        Image(systemName: context.state.paused ? "pause.circle.fill" : "timer")
          .foregroundColor(context.state.paused ? .orange : .green)
                
        if context.state.paused {
          Text("Timer Paused")
            .font(.subheadline)
            .foregroundColor(.orange)
        } else {
          Text(timerInterval: Date()...context.state.endTime, countsDown: true)
            .font(.subheadline)
            .bold()
            .monospacedDigit()
            .foregroundColor(.primary)
        }
                
        Spacer()
      }
    }
    .padding(16)
    .background(Color(UIColor.systemBackground))
  }
}


#Preview(
  "Live Activity",
  as: .content,
  using: PokerTimerWidgetAttributes.preview
) {
  PokerTimerWidget()
} contentStates: {
  PokerTimerWidgetAttributes.ContentState.sampleData
  PokerTimerWidgetAttributes.ContentState.pausedState
  PokerTimerWidgetAttributes.ContentState.lowTimeState
}



