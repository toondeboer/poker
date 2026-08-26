import { describe, expect, it } from "vitest";
import {
  PLAYER_NAMESPACE,
  TABLE_NAMESPACE,
  playerChannel,
  playerFromChannel,
  tableChannel,
} from "./channels";

describe("channel paths", () => {
  it("puts the shared view in the table namespace", () => {
    expect(tableChannel("t1")).toBe("/table/t1");
    expect(tableChannel("t1").split("/")[1]).toBe(TABLE_NAMESPACE);
  });

  it("puts a private view in its own namespace, not the table's", () => {
    // The bug this module exists for. `/table/{id}/player/{sub}` reads better
    // and is unguardable: AppSync takes the first segment as the namespace, so
    // it lands under the shared rules and the private guard never runs.
    const channel = playerChannel("u9", "t1");
    expect(channel).toBe("/player/u9/table/t1");
    expect(channel.split("/")[1]).toBe(PLAYER_NAMESPACE);
  });

  it("puts the player id where a guard can find it without parsing the rest", () => {
    expect(playerChannel("u9", "t1").split("/")[2]).toBe("u9");
  });

  it("reads back the player a private channel belongs to", () => {
    expect(playerFromChannel(playerChannel("u9", "t1"))).toBe("u9");
  });

  it("round-trips any ids", () => {
    const failures: string[] = [];
    for (const playerId of ["u9", "a", "0", "long-uuid-ish-1234"]) {
      for (const tableId of ["t1", "x", "table-42"]) {
        const back = playerFromChannel(playerChannel(playerId, tableId));
        if (back !== playerId) {
          failures.push(`${playerId}/${tableId} -> ${back}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("refuses anything that is not a private channel", () => {
    // Every one of these must fail closed: a guard that returns a player id for
    // a path it does not understand is a guard that lets the wrong person in.
    const notPrivate = [
      tableChannel("t1"),
      "/player/u9",
      "/player/u9/table",
      "/player/u9/table/t1/extra",
      "/player//table/t1",
      "/player/u9/table/",
      "/table/t1/player/u9",
      "/other/u9/table/t1",
      "/player/u9/other/t1",
      "",
      "player/u9/table/t1",
    ];
    const leaked = notPrivate.filter(
      (channel) => playerFromChannel(channel) !== null,
    );
    expect(leaked).toEqual([]);
  });
});
