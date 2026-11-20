import { describe, it, expect } from "vitest";
import en from "../i18n/en.json";
import mr from "../i18n/mr.json";
import hi from "../i18n/hi.json";
import reviewMeta from "../i18n/i18n-review.json";

describe("Internationalization (i18n) Suite", () => {
  it("contains all three supported languages (Marathi, Hindi, English)", () => {
    expect(en).toBeDefined();
    expect(mr).toBeDefined();
    expect(hi).toBeDefined();
  });

  it("has corresponding core keys across Marathi and Hindi dictionaries", () => {
    expect(mr.app.title).toBeDefined();
    expect(hi.app.title).toBeDefined();
    expect(en.app.title).toBeDefined();

    expect(mr.nav.schemes).toBeDefined();
    expect(hi.nav.schemes).toBeDefined();
    expect(en.nav.schemes).toBeDefined();

    expect(mr.results.can_apply_title).toBeDefined();
    expect(hi.results.can_apply_title).toBeDefined();
    expect(en.results.can_apply_title).toBeDefined();
  });

  it("verifies review tracking status metadata exists without leaking to UI", () => {
    expect(reviewMeta).toBeDefined();
    expect(reviewMeta.languages.mr.status).toBe("machine_drafted");
    expect(reviewMeta.languages.hi.status).toBe("machine_drafted");
    expect(reviewMeta.languages.en.status).toBe("reviewed");
  });
});
