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
          VStack(spacing: 8) {
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

            TimerActionButtons(paused: context.state.paused || context.state.isExpired)
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

// Rewritten to be meaningfully more compact than the original read-only-display design: the
// Lock Screen presentation has a real (if not precisely documented) height budget, and stacking
// a full header row, a full timer row, a full blinds row, the action buttons, AND the force-quit
// caption as five independent rows overflowed it, clipping content at the top and bottom.
// Timer + blinds are now one row instead of two, redundant labels ("Current Blinds", "Next",
// "Time Remaining") are gone in favor of visual hierarchy (size/weight/color) doing that job, and
// the caption lost its icon and its own row's worth of top padding.
struct PokerTimerLiveActivityView: View {
  let context: ActivityViewContext<PokerTimerWidgetAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      // Header: tournament name + level, single thin line.
      HStack {
        Text(context.attributes.tournamentName)
          .font(.caption2)
          .foregroundColor(.secondary)
          .lineLimit(1)
        Spacer()
        Text("Level \(context.state.currentBlindLevel)")
          .font(.caption2)
          .foregroundColor(.secondary)
      }

      // Timer + blinds, one row instead of two.
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        HStack(spacing: 6) {
          Image(systemName: context.state.paused ? "pause.circle.fill" : "timer")
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

        VStack(alignment: .trailing, spacing: 0) {
          Text("\(context.state.currentSmallBlind)/\(context.state.currentBigBlind)")
            .font(.subheadline)
            .bold()
            .foregroundColor(.primary)
          Text("→ \(context.state.nextSmallBlind)/\(context.state.nextBigBlind)")
            .font(.caption2)
            .foregroundColor(.secondary)
        }
      }

      TimerActionButtons(paused: context.state.paused || context.state.isExpired)

      // iOS stops running any of the app's App Intents — including these buttons — once the
      // user force-quits the app from the app switcher, until they manually reopen it. There's
      // no API to detect that a tap was attempted and blocked, so this is a permanent, always-on
      // notice rather than a one-time/conditional one.
      Text("Force quitting the app may stop these buttons from responding.")
        .font(.caption2)
        .foregroundColor(.secondary)
        .lineLimit(2)
    }
    .padding(12)
    .background(Color(UIColor.systemBackground))
  }
}

// Pause/Resume + Stop row shared between the lock-screen view and the Dynamic Island's
// expanded UI. Each button drives a `LiveActivityIntent` (see TimerActionIntents.swift), which
// updates the Activity directly without opening the app.
struct TimerActionButtons: View {
  let paused: Bool

  var body: some View {
    HStack(spacing: 12) {
      Button(intent: TogglePauseTimerIntent(shouldPause: !paused)) {
        Label(paused ? "Resume" : "Pause", systemImage: paused ? "play.fill" : "pause.fill")
      }

      Button(intent: StopTimerIntent()) {
        Label("Stop", systemImage: "stop.fill")
      }
      .tint(.red)
    }
    .buttonStyle(.bordered)
    .controlSize(.small)
    .labelStyle(.titleAndIcon)
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
