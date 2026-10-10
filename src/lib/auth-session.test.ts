import { describe, expect, it } from "vitest";
import { parseDurationToSeconds, sessionMaxAgeForRemember } from "@/lib/auth-session";

describe("parseDurationToSeconds", () => {
  it("parses hours and days", () => {
    expect(parseDurationToSeconds("8h", 0)).toBe(8 * 60 * 60);
    expect(parseDurationToSeconds("30d", 0)).toBe(30 * 24 * 60 * 60);
    expect(parseDurationToSeconds("15m", 0)).toBe(15 * 60);
  });

  it("falls back on invalid input", () => {
    expect(parseDurationToSeconds("", 3600)).toBe(3600);
    expect(parseDurationToSeconds("nope", 7200)).toBe(7200);
    expect(parseDurationToSeconds(undefined, 9000)).toBe(9000);
  });
});

describe("sessionMaxAgeForRemember", () => {
  it("uses remember max when checked", () => {
    const short = sessionMaxAgeForRemember(false);
    const long = sessionMaxAgeForRemember(true);
    expect(long).toBeGreaterThan(short);
  });
});
