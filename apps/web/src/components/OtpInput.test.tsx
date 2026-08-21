// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { OtpInput } from "./OtpInput.js";

afterEach(cleanup);

function Harness({ onComplete }: { onComplete?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <>
      <OtpInput value={value} onChange={setValue} onComplete={onComplete} />
      <output data-testid="val">{value}</output>
    </>
  );
}

const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];
const val = () => screen.getByTestId("val").textContent;

describe("OtpInput", () => {
  it("renders one box per digit", () => {
    render(<Harness />);
    expect(boxes()).toHaveLength(6);
  });

  it("builds the value as you type each digit", () => {
    render(<Harness />);
    const b = boxes();
    fireEvent.change(b[0], { target: { value: "1" } });
    fireEvent.change(b[1], { target: { value: "2" } });
    fireEvent.change(b[2], { target: { value: "3" } });
    expect(val()).toBe("123");
  });

  it("ignores non-numeric input", () => {
    render(<Harness />);
    fireEvent.change(boxes()[0], { target: { value: "a" } });
    expect(val()).toBe("");
  });

  it("removes the previous digit on backspace from an empty box", () => {
    render(<Harness />);
    const b = boxes();
    fireEvent.change(b[0], { target: { value: "1" } });
    fireEvent.change(b[1], { target: { value: "2" } });
    fireEvent.keyDown(b[2], { key: "Backspace" });
    expect(val()).toBe("1");
  });

  it("fills every box from a paste and fires onComplete", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    fireEvent.paste(boxes()[0], { clipboardData: { getData: () => "123456" } });
    expect(val()).toBe("123456");
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("fires onComplete when the last digit is typed", () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    const b = boxes();
    "123456".split("").forEach((d, i) => fireEvent.change(b[i], { target: { value: d } }));
    expect(onComplete).toHaveBeenCalledWith("123456");
  });
});
