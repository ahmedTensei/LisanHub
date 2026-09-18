import { describe, expect, it } from "vitest";
import { FEATURE_MODES, PLATFORM_SETTING_DEFAULTS, SETTING_FIELDS, isAllowedMode, parseSettingValue } from "./settings";

describe("platform settings catalogue", () => {
  it("describes every default setting so administration never edits raw keys", () => {
    expect(Object.keys(SETTING_FIELDS).sort()).toEqual(Object.keys(PLATFORM_SETTING_DEFAULTS).sort());
  });

  it("accepts only the listed choices, booleans and a well-formed optional email", () => {
    expect(parseSettingValue("moderation.escalation_open_reports", "5")).toBe(5);
    expect(parseSettingValue("moderation.escalation_open_reports", "4")).toBeNull();
    expect(parseSettingValue("quality.community_trusted_min_average", "3.5")).toBe(3.5);
    expect(parseSettingValue("founding.window_open", "false")).toBe(false);
    expect(parseSettingValue("founding.window_open", "yes")).toBeNull();
    expect(parseSettingValue("support.email", "")).toBe("");
    expect(parseSettingValue("support.email", "help@lisanhub.example")).toBe("help@lisanhub.example");
    expect(parseSettingValue("support.email", "not an email")).toBeNull();
  });

  it("offers only the modes that make sense for each feature switch", () => {
    expect(FEATURE_MODES.maintenance_mode).toEqual(["disabled", "enabled"]);
    expect(isAllowedMode("maintenance_mode", "read_only")).toBe(false);
    expect(isAllowedMode("community_chat", "read_only")).toBe(true);
    expect(isAllowedMode("registration", "create_disabled")).toBe(false);
  });
});
