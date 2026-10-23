import { describe, it, expect } from "vitest";
import { fixture } from "./fixture";
import {
  parseBank,
  mergeBank,
  effective,
  readyPaper,
  startSession,
  grade,
  latestOutcomes,
  shuffle,
} from "../src/domain";
import { stateSchema } from "../src/storage";
describe("bank integrity", () => {
  it("accepts an empty production bank", () =>
    expect(
      parseBank({ schemaVersion: 1, papers: [], questions: [], errata: [] })
        .questions,
    ).toHaveLength(0));
  it("rejects duplicate IDs, duplicate numbers, orphan questions, invalid year and missing answer provenance", () => {
    const variants = [
      { ...fixture, questions: [...fixture.questions, fixture.questions[0]] },
      {
        ...fixture,
        questions: fixture.questions.map((q, i) => ({
          ...q,
          number: i === 1 ? 1 : q.number,
        })),
      },
      { ...fixture, papers: [] },
      { ...fixture, papers: [{ ...fixture.papers[0], year: 2025 }] },
      {
        ...fixture,
        questions: [{ ...fixture.questions[0], answerSource: "" }],
      },
    ];
    variants.forEach((v) => expect(() => parseBank(v)).toThrow());
  });
  it("requires exactly 30 scorable questions", () => {
    expect(readyPaper("test-only", fixture)).toBe(true);
    expect(
      readyPaper("test-only", {
        ...fixture,
        questions: fixture.questions.slice(1),
      }),
    ).toBe(false);
    expect(
      readyPaper("test-only", {
        ...fixture,
        questions: fixture.questions.map((q) => ({
          ...q,
          originalAnswer: null,
        })),
      }),
    ).toBe(false);
  });
  it("uses latest erratum without mutating original or old attempt", () => {
    const s = startSession("test", "exam", fixture.questions, fixture);
    const b = parseBank({
      ...fixture,
      errata: [
        {
          id: "e1",
          questionId: "test-1",
          answer: "B",
          reasonZh: "test",
          source: "fixture",
          recordedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "e2",
          questionId: "test-1",
          answer: "C",
          reasonZh: "test",
          source: "fixture",
          recordedAt: "2024-02-01T00:00:00Z",
        },
      ],
    });
    expect(effective(b.questions[0], b).answer).toBe("C");
    expect(b.questions[0].originalAnswer).toBe("A");
    expect(s.items[0].answer).toBe("A");
  });
  it("rejects overwriting originals and merges incremental errata", () => {
    expect(() =>
      mergeBank(fixture, {
        ...fixture,
        questions: [{ ...fixture.questions[0], originalAnswer: "B" }],
      }),
    ).toThrow();
    expect(mergeBank(fixture, fixture).questions).toHaveLength(30);
  });
  it("scores only selected correct answers and tracks latest outcome", () => {
    const s = startSession("test", "exam", fixture.questions, fixture);
    s.answers = { "test-1": "A", "test-2": "B" };
    const r = grade(s);
    expect(r.score).toBe(1);
    expect(latestOutcomes([r]).get("test-3")).toBe(false);
    const next = {
      ...grade({ ...s, answers: { "test-2": "A" } }),
      finishedAt: "2099-01-01T00:00:00Z",
    };
    expect(latestOutcomes([next, r]).get("test-2")).toBe(true);
  });
  it("does not sample duplicates or mutate source", () => {
    const out = shuffle(fixture.questions);
    expect(new Set(out.map((q) => q.id)).size).toBe(30);
    expect(fixture.questions[0].id).toBe("test-1");
  });
  it("rejects malformed backups and invalid resume index", () => {
    expect(() => stateSchema.parse({ version: 2 })).toThrow();
    expect(() =>
      stateSchema.parse({
        version: 1,
        bank: fixture,
        history: [],
        active: {
          ...startSession("test", "exam", fixture.questions, fixture),
          index: 30,
        },
      }),
    ).toThrow();
  });
});
