//
//  PokerTimerWidget.swift
//  PokerTimerWidget
//
//  Created by Toon de Boer on 22/07/2025.
//
import ActivityKit
import WidgetKit
import SwiftUI

// Brand palette, matching the exact hex values the app itself already uses for this timer's
// countdown states (PokerTimer.tsx's getGradientColors/getProgressBarColor) and Android's
// PokerTimerService#getStatusColor — kept in one place here instead of the system semantic
// colors (.green/.orange) the widget used previously, which didn't line up with either.
extension Color {
  static let pokerGreen = Color(red: 0x10 / 255, green: 0xB9 / 255, blue: 0x81 / 255)  // #10B981
  static let pokerAmber = Color(red: 0xF5 / 255, green: 0x9E / 255, blue: 0x0B / 255)  // #F59E0B
  static let pokerRed = Color(red: 0xDC / 255, green: 0x26 / 255, blue: 0x26 / 255)  // #DC2626
}

// Single source of truth for the color/icon a given ContentState should render as, shared by
// the Lock Screen view, the Dynamic Island's expanded/compact/minimal presentations. Previously
// each of those four spots duplicated its own `paused ? .orange : .green` ternary and none of
// them distinguished an expired round (red) or a low-time warning (amber) at all.
enum TimerVisualState: Equatable {
  case active, lowTime, paused, expired

  init(_ state: PokerTimerWidgetAttributes.ContentState) {
    if state.isExpired {
      self = .expired
    } else if state.paused {
      self = .paused
    } else if state.isLowTime {
      self = .lowTime
    } else {
      self = .active
    }
  }

  var color: Color {
    switch self {
    case .active: return .pokerGreen
    case .lowTime, .paused: return .pokerAmber
    case .expired: return .pokerRed
    }
  }

  var systemImage: String {
    switch self {
    case .paused: return "pause.circle.fill"
    case .expired: return "alarm.fill"
    case .lowTime, .active: return "timer"
    }
  }
}

struct PokerTimerWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: PokerTimerWidgetAttributes.self) { context in
      // Lock screen/banner UI
      PokerTimerLiveActivityView(context: context)
        .activityBackgroundTint(Color.pokerGreen.opacity(0.1))
        .activitySystemActionForegroundColor(Color.pokerGreen)
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
          let visualState = TimerVisualState(context.state)
          VStack(spacing: 8) {
            HStack {
              // Timer - most prominent element
              HStack(spacing: 4) {
                Image(systemName: visualState.systemImage)
                  .foregroundColor(visualState.color)

                if context.state.paused {
                  Text(formatTime(context.state.timeLeft))
                    .font(.title2)
                    .bold()
                    .monospacedDigit()
                    .foregroundColor(visualState.color)
                } else {
                  Text(
                    timerInterval: Date()...context.state.endTime,
                    countsDown: true
                  )
                  .font(.title2)
                  .bold()
                  .monospacedDigit()
                  .foregroundColor(visualState == .active ? .primary : visualState.color)
                }
              }

              Spacer()

              Text("Level \(context.state.currentBlindLevel)")
                .font(.caption)
                .foregroundColor(.secondary)
            }

          }
        }
      } compactLeading: {
        Image(systemName: "suit.spade.fill")
          .foregroundColor(.pokerGreen)
      } compactTrailing: {
        let visualState = TimerVisualState(context.state)
        if context.state.paused {
          Text(formatTime(context.state.timeLeft))
            .font(.caption2)
            .bold()
            .monospacedDigit()
            .foregroundColor(visualState.color)
        } else {
          Text(timerInterval: Date()...context.state.endTime, countsDown: true)
            .font(.caption2)
            .bold()
            .monospacedDigit()
            .foregroundColor(visualState == .active ? .primary : visualState.color)
        }
      } minimal: {
        let visualState = TimerVisualState(context.state)
        Image(systemName: visualState.systemImage)
          .foregroundColor(visualState.color)
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
    let visualState = TimerVisualState(context.state)
    // Tight, uniform 4pt rhythm groups header+timer/blinds as one "info" block and
    // buttons+caption as one "controls" block (the caption is specifically about the buttons
    // above it, so keeping them close reads as one unit) — the extra .padding(.top, 6) on the
    // buttons below is what actually separates the two blocks from each other.
    VStack(alignment: .leading, spacing: 4) {
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
          Image(systemName: visualState.systemImage)
            .foregroundColor(visualState.color)

          if context.state.paused {
            Text(formatTime(context.state.timeLeft))
              .font(.title2)
              .bold()
              .monospacedDigit()
              .foregroundColor(visualState.color)
          } else {
            Text(
              timerInterval: Date()...context.state.endTime,
              countsDown: true
            )
            .font(.title2)
            .bold()
            .monospacedDigit()
            .foregroundColor(visualState == .active ? .primary : visualState.color)
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

      // Deliberately unconditional, not shown only once expired. WidgetKit does not re-render
      // this view as the countdown runs — `Text(timerInterval:)` above animates without one —
      // so anything keyed on `isExpired` would be evaluated at whatever moment the system last
      // rendered, i.e. usually while the round was still running, and would never appear at the
      // one time it mattered. A standing line is always true instead: the app is what advances
      // the blinds, because nothing of ours executes out here while it's backgrounded.
      Text("Open the app at the buzzer to start the next level.")
        .font(.caption2)
        .foregroundColor(.secondary)
        .opacity(0.85)
        .lineLimit(2)
        .padding(.top, 6)
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
