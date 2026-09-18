import { describe, expect, it } from "vitest";
import { LessonBody, lessonStarterTemplate } from "./blocks";

describe("lesson body schema", () => {
  it("accepts the starter template", () => {
    expect(LessonBody.safeParse(lessonStarterTemplate()).success).toBe(true);
  });

  it("rejects duplicate block ids so reports can anchor precisely", () => {
    const body = lessonStarterTemplate();
    body.blocks.push({ type: "explanation", id: "intro", text: "again" });
    expect(LessonBody.safeParse(body).success).toBe(false);
  });
});
