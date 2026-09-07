import { describe, expect, it } from "vitest";
import { handleEnterSubmitKeyDown } from "@/lib/ui/enter-submit";
import type { KeyboardEvent } from "react";

function makeKeyEvent(
  key: string,
  opts?: { shiftKey?: boolean; isComposing?: boolean },
): KeyboardEvent<HTMLTextAreaElement> {
  const prevented = { current: false };
  return {
    key,
    shiftKey: opts?.shiftKey ?? false,
    nativeEvent: { isComposing: opts?.isComposing ?? false },
    preventDefault: () => {
      prevented.current = true;
    },
    get defaultPrevented() {
      return prevented.current;
    },
  } as unknown as KeyboardEvent<HTMLTextAreaElement>;
}

describe("handleEnterSubmitKeyDown", () => {
  it("submits on Enter without Shift", () => {
    const submitted: string[] = [];
    const event = makeKeyEvent("Enter");
    handleEnterSubmitKeyDown(event, () => submitted.push("ok"));
    expect(submitted).toEqual(["ok"]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not submit on Shift+Enter", () => {
    const submitted: string[] = [];
    const event = makeKeyEvent("Enter", { shiftKey: true });
    handleEnterSubmitKeyDown(event, () => submitted.push("ok"));
    expect(submitted).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("ignores when disabled or missing callback", () => {
    const submitted: string[] = [];
    handleEnterSubmitKeyDown(makeKeyEvent("Enter"), () => submitted.push("ok"), {
      disabled: true,
    });
    handleEnterSubmitKeyDown(makeKeyEvent("Enter"), undefined);
    expect(submitted).toEqual([]);
  });

  it("ignores IME composition Enter", () => {
    const submitted: string[] = [];
    handleEnterSubmitKeyDown(makeKeyEvent("Enter", { isComposing: true }), () =>
      submitted.push("ok"),
    );
    expect(submitted).toEqual([]);
  });
});
