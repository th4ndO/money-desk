import { describe, expect, it } from "vitest";
import { PIN_RE, pinToPassword } from "./pin";

const pepper = "x".repeat(40);

describe("pinToPassword", () => {
  it("is stable for the same PIN and secret", () => {
    expect(pinToPassword("2471", pepper)).toBe(pinToPassword("2471", pepper));
    expect(pinToPassword("2471", pepper)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes with the PIN and with the secret", () => {
    expect(pinToPassword("2471", pepper)).not.toBe(pinToPassword("2472", pepper));
    expect(pinToPassword("2471", pepper)).not.toBe(pinToPassword("2471", "y".repeat(40)));
  });

  it("never contains the PIN itself", () => {
    expect(pinToPassword("2471", pepper)).not.toContain("2471");
  });

  it("rejects bad PINs and a short secret", () => {
    expect(() => pinToPassword("123", pepper)).toThrow();
    expect(() => pinToPassword("12a4", pepper)).toThrow();
    expect(() => pinToPassword("2471", "short")).toThrow();
    expect(PIN_RE.test("24718888")).toBe(true);
    expect(PIN_RE.test("247188889")).toBe(false);
  });
});
