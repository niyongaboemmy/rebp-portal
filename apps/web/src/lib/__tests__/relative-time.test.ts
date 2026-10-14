import { describe, expect, it } from "vitest";
import { relativeLabel } from "../relative-time";

const t = (key: string, values?: { count: number }) => (values ? `${key}:${values.count}` : key);
const date = () => "DATE";
const now = new Date("2026-10-14T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("relativeLabel", () => {
  it.each([
    [30_000, "justNow"],
    [5 * 60_000, "minutes:5"],
    [3 * 3_600_000, "hours:3"],
    [2 * 86_400_000, "days:2"],
    [8 * 86_400_000, "DATE"],
  ])("%i ms ago → %s", (ms, expected) => {
    expect(relativeLabel(ago(ms), now, t, date)).toBe(expected);
  });
});
