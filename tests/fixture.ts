// Synthetic plumbing fixture ONLY. This file is never imported by the production app.
import { type Bank } from "../src/domain";
export const fixture: Bank = {
  schemaVersion: 1,
  papers: [
    {
      id: "test-only",
      year: 2024,
      title: "自动化测试专用（非真题）",
      source: "synthetic test fixture",
    },
  ],
  questions: Array.from({ length: 30 }, (_, i) => ({
    id: `test-${i + 1}`,
    paperId: "test-only",
    number: i + 1,
    textIt: `TEST ONLY — domanda tecnica ${i + 1}`,
    options: { A: "TEST A", B: "TEST B", C: "TEST C" },
    originalAnswer: "A" as const,
    answerSource: "synthetic test fixture",
    explanationZh: "仅用于验证软件流程，不是真实考题解析。",
    source: "synthetic test fixture",
  })),
  errata: [],
};
