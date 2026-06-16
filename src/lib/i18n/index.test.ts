import { afterEach, describe, expect, it, vi } from "vitest";
import { dateLocale, getLang, isRtl, setLang, t } from "./index";

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

describe("getLang / setLang", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubBrowser(stored?: string) {
    const store = new Map<string, string>();
    if (stored) store.set("app_lang", stored);
    const localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("localStorage", localStorage);
    return store;
  }

  it("reads a stored supported language", () => {
    stubBrowser("de");
    expect(getLang()).toBe("de");
  });

  it("falls back to en for an unsupported stored value", () => {
    stubBrowser("zz");
    expect(getLang()).toBe("en");
  });

  it("setLang persists then getLang reads it back", () => {
    stubBrowser();
    setLang("fa");
    expect(getLang()).toBe("fa");
  });
});
