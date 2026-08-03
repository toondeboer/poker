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

            TimerActionButtons(paused: context.state.paused || context.state.isExpired)
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

      TimerActionButtons(paused: context.state.paused || context.state.isExpired)
        .padding(.top, 6)

      // iOS stops running any of the app's App Intents — including these buttons — once the
      // user force-quits the app from the app switcher, until they manually reopen it. There's
      // no API to detect that a tap was attempted and blocked, so this is a permanent, always-on
      // notice rather than a one-time/conditional one. Slightly dimmed beyond the standard
      // .secondary color so it reads as fine print, not a peer of the buttons it's describing.
      Text("Force quitting the app may stop these buttons from responding.")
        .font(.caption2)
        .foregroundColor(.secondary)
        .opacity(0.85)
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
      // Green when tapping it will resume (a "go" action); amber when tapping it will pause (a
      // caution color — gray read as dull/washed-out against the Live Activity's dark-mode
      // background, and this also matches Android's own Pause pill now).
      Button(intent: TogglePauseTimerIntent(shouldPause: !paused)) {
        Label(paused ? "Resume" : "Pause", systemImage: paused ? "play.fill" : "pause.fill")
      }
      .tint(paused ? .pokerGreen : .pokerAmber)

      Button(intent: StopTimerIntent()) {
        Label("Stop", systemImage: "stop.fill")
      }
      .tint(.pokerRed)
    }
    // Previously plain `.bordered` with no `.tint()` on Pause/Resume at all, so it rendered in
    // the system's default blue — clashing with the green/amber/red palette used everywhere
    // else in the app and the Live Activity itself.
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
