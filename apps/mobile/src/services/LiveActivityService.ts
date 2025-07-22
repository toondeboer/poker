import { PokerTimerAttributes, PokerTimerState } from "../types/LiveActivity";
import { LiveActivity } from "../modules/LiveActivityModule";

class LiveActivityService {
  private activityId: string | null = null;

  async startActivity(
    tournamentName: string,
    initialState: PokerTimerState,
  ): Promise<void> {
    try {
      const attributes: PokerTimerAttributes = {
        tournamentName,
      };

      this.activityId = await LiveActivity.startActivity(initialState);

      console.log("Live Activity started:", this.activityId);
    } catch (error) {
      console.error("Failed to start Live Activity:", error);
    }
  }

  async updateActivity(newState: PokerTimerState): Promise<void> {
    if (!this.activityId) return;

    try {
      await LiveActivity.updateActivity(this.activityId, newState);
    } catch (error) {
      console.error("Failed to update Live Activity:", error);
    }
  }

  async endActivity(): Promise<void> {
    if (!this.activityId) return;

    try {
      await LiveActivity.endActivity(this.activityId);
      this.activityId = null;
    } catch (error) {
      console.error("Failed to end Live Activity:", error);
    }
  }

  isActive(): boolean {
    return this.activityId !== null;
  }
}

export const liveActivityService = new LiveActivityService();
