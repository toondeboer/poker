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
            .font(.title)
            .bold()
            .foregroundColor(.primary)
          }
        }
                
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            Text("Next")
              .font(.caption2)
              .foregroundColor(Color.secondary.opacity(0.7))
            Text(
              "\(context.state.nextSmallBlind)/\(context.state.nextBigBlind)"
            )
            .font(.subheadline)
            .foregroundColor(.secondary)
          }
        }
                
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            // Timer - most prominent element
            HStack(spacing: 4) {
              Image(
                systemName: context.state.paused ? "pause.circle.fill" : "timer"
              )
              .foregroundColor(context.state.paused ? .orange : .green)
              
              if context.state.paused {
                Text(formatTime(context.state.timeLeft))
                  .font(.title2)
                  .bold()
                  .monospacedDigit()
                  .foregroundColor(.orange)
              } else {
                Text(
                  timerInterval: Date()...context.state.endTime,
                  countsDown: true
                )
                .font(.title2)
                .bold()
                .monospacedDigit()
                .foregroundColor(.primary)
              }
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
          Text(formatTime(context.state.timeLeft))
            .font(.caption2)
            .bold()
            .monospacedDigit()
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
    VStack(spacing: 8) {
      // Header with tournament name and level
      HStack {
        Text(context.attributes.tournamentName)
          .font(.subheadline)
          .foregroundColor(.primary)
        Spacer()
        Text("Level \(context.state.currentBlindLevel)")
          .font(.caption)
          .foregroundColor(.secondary)
      }
      
      // Main timer section - most prominent
      HStack(spacing: 8) {
        Image(systemName: context.state.paused ? "pause.circle.fill" : "timer")
          .font(.headline)
          .foregroundColor(context.state.paused ? .orange : .green)
        
        if context.state.paused {
          VStack(alignment: .leading, spacing: 1) {
            Text("PAUSED")
              .font(.headline)
              .bold()
              .foregroundColor(.orange)
            Text("Time left: \(formatTime(context.state.timeLeft))")
              .font(.title2)
              .bold()
              .monospacedDigit()
              .foregroundColor(.primary)
          }
        } else {
          VStack(alignment: .leading, spacing: 1) {
            Text("Time Remaining")
              .font(.caption2)
              .foregroundColor(.secondary)
            Text(
              timerInterval: Date()...context.state.endTime,
              countsDown: true
            )
            .font(.title)
            .bold()
            .monospacedDigit()
            .foregroundColor(.primary)
          }
        }
        
        Spacer()
      }
      
      // Blinds section - current more prominent than next
      HStack(spacing: 12) {
        // Current blinds - larger and more prominent
        VStack(alignment: .leading, spacing: 2) {
          Text("Current Blinds")
            .font(.caption)
            .bold()
            .foregroundColor(.primary)
          Text(
            "\(context.state.currentSmallBlind)/\(context.state.currentBigBlind)"
          )
          .font(.headline)
          .bold()
          .foregroundColor(.primary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        
        // Arrow
        Image(systemName: "arrow.right")
          .font(.subheadline)
          .foregroundColor(.secondary)
        
        // Next blinds - smaller and less prominent
        VStack(alignment: .trailing, spacing: 2) {
          Text("Next")
            .font(.caption2)
            .foregroundColor(Color.secondary.opacity(0.7))
          Text("\(context.state.nextSmallBlind)/\(context.state.nextBigBlind)")
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
      }
    }
    .padding(12)
    .background(Color(UIColor.systemBackground))
  }
}

// Helper function to format time
func formatTime(_ timeInterval: TimeInterval) -> String {
  let minutes = Int(timeInterval) / 60
  let seconds = Int(timeInterval) % 60
  return String(format: "%d:%02d", minutes, seconds)
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
