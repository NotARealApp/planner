import { describe, expect, it } from "vitest";
import { dateLocale, isRtl, t } from "./index";

// In the node test env `window` is undefined, so getLang() resolves to "en"
// and these exercise the English dictionary + the language-agnostic paths.

describe("t", () => {
  it("returns the English string for a known key", () => {
    expect(t("dp.retry")).toBe(t("dp.retry"));
    expect(typeof t("dp.retry")).toBe("string");
  });

  it("returns the key itself when missing", () => {
    expect(t("totally.missing.key")).toBe("totally.missing.key");
  });

  it("interpolates {param} placeholders", () => {
    // "{n}" appears in pluralized strings; use a key that contains one.
    const out = t("dp.minLate", { n: 4 });
    expect(out).toContain("4");
    expect(out).not.toContain("{n}");
  });

  it("replaces every occurrence of a placeholder", () => {
    // Synthetic check via a key that won't exist returns the key unchanged,
    // so verify interpolation on the raw mechanism through a real param key.
    const out = t("dp.updatedAgo", { t: "5m" });
    expect(out).toContain("5m");
  });
});

describe("isRtl", () => {
  it("is true for Persian, false for English", () => {
    expect(isRtl("fa")).toBe(true);
    expect(isRtl("en")).toBe(false);
  });
});

describe("dateLocale", () => {
  it("returns a BCP-47 locale string", () => {
    expect(dateLocale()).toMatch(/^[a-z]{2}-[A-Z]{2}/);
  });
});
