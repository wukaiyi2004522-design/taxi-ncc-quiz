import { z } from "zod";
const text = z.string().trim().min(1);
export const choice = z.enum(["A", "B", "C"]);
const paperSchema = z.object({
  id: text,
  year: z.number().int().min(2015).max(2024),
  title: text,
  source: text,
});
const questionSchema = z
  .object({
    id: text,
    paperId: text,
    number: z.number().int().min(1).max(30),
    textIt: text,
    options: z.object({ A: text, B: text, C: text }),
    originalAnswer: choice.nullable(),
    answerSource: z.string(),
    explanationZh: z.string(),
    source: text,
  })
  .superRefine((q, c) => {
    if (q.originalAnswer && !q.answerSource.trim())
      c.addIssue({ code: "custom", message: "标准答案必须附来源" });
  });
const erratumSchema = z.object({
  id: text,
  questionId: text,
  answer: choice,
  reasonZh: text,
  source: text,
  recordedAt: z.string().datetime(),
});
export const bankSchema = z
  .object({
    schemaVersion: z.literal(1),
    papers: z.array(paperSchema).max(21),
    questions: z.array(questionSchema).max(630),
    errata: z.array(erratumSchema),
  })
  .superRefine((b, c) => {
    const check = (ok: boolean, message: string) => {
      if (!ok) c.addIssue({ code: "custom", message });
    };
    for (const key of ["papers", "questions", "errata"] as const)
      check(
        new Set(b[key].map((x) => x.id)).size === b[key].length,
        `${key} ID 重复`,
      );
    check(
      new Set(b.questions.map((q) => `${q.paperId}:${q.number}`)).size ===
        b.questions.length,
      "同卷题号重复",
    );
    b.questions.forEach((q) =>
      check(
        b.papers.some((p) => p.id === q.paperId),
        `题目 ${q.id} 引用了不存在的试卷`,
      ),
    );
    b.errata.forEach((e) =>
      check(
        b.questions.some((q) => q.id === e.questionId),
        `勘误 ${e.id} 引用了不存在的题目`,
      ),
    );
    check(
      new Set(b.errata.map((e) => `${e.questionId}:${e.recordedAt}`)).size ===
        b.errata.length,
      "同题勘误时间不能相同",
    );
  });
export type Bank = z.infer<typeof bankSchema>;
export type Question = Bank["questions"][number];
export type Choice = z.infer<typeof choice>;
export function parseBank(input: unknown): Bank {
  return bankSchema.parse(input);
}
export function mergeBank(current: Bank, incoming: Bank): Bank {
  const merge = <T extends { id: string }>(a: T[], b: T[]) => {
    const m = new Map(a.map((x) => [x.id, x]));
    b.forEach((x) => m.set(x.id, x));
    return [...m.values()];
  };
  // Original questions/keys and audit records are immutable: corrections belong in errata.
  for (const key of ["questions", "errata"] as const)
    for (const x of incoming[key]) {
      const old = current[key].find((y) => y.id === x.id);
      if (old && JSON.stringify(old) !== JSON.stringify(x))
        throw Error(
          `${key} ${x.id} 已存在且内容不同；答案修正请新增勘误，勿覆盖原记录。`,
        );
    }
  return parseBank({
    schemaVersion: 1,
    papers: merge(current.papers, incoming.papers),
    questions: merge(current.questions, incoming.questions),
    errata: merge(current.errata, incoming.errata),
  });
}
export function effective(q: Question, b: Bank) {
  const correction = b.errata
    .filter((e) => e.questionId === q.id)
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0];
  return { answer: correction?.answer ?? q.originalAnswer, correction };
}
export function readyPaper(id: string, b: Bank) {
  const qs = b.questions.filter((q) => q.paperId === id);
  return qs.length === 30 && qs.every((q) => effective(q, b).answer !== null);
}
export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export type Item = {
  question: Question;
  answer: Choice;
  correction?: Bank["errata"][number];
};
export type Session = {
  id: string;
  title: string;
  mode: "exam" | "practice" | "mistakes";
  startedAt: string;
  items: Item[];
  answers: Record<string, Choice>;
  index: number;
};
export type Result = Session & { finishedAt: string; score: number };
export function startSession(
  title: string,
  mode: Session["mode"],
  qs: Question[],
  b: Bank,
): Session {
  if (!qs.length || (mode === "exam" && qs.length !== 30))
    throw Error("模拟考试必须包含 30 题，练习不能为空");
  const items = qs.map((question) => {
    const { answer, correction } = effective(question, b);
    if (!answer) throw Error("尚无可用答案");
    return { question, answer, correction };
  });
  return {
    id: crypto.randomUUID(),
    title,
    mode,
    startedAt: new Date().toISOString(),
    items,
    answers: {},
    index: 0,
  };
}
export function grade(session: Session): Result {
  return {
    ...session,
    finishedAt: new Date().toISOString(),
    score: session.items.filter(
      (i) => session.answers[i.question.id] === i.answer,
    ).length,
  };
}
export function latestOutcomes(history: Result[]) {
  const outcomes = new Map<string, boolean>();
  [...history]
    .sort((a, b) => Date.parse(a.finishedAt) - Date.parse(b.finishedAt))
    .forEach((r) =>
      r.items.forEach((i) =>
        outcomes.set(i.question.id, r.answers[i.question.id] === i.answer),
      ),
    );
  return outcomes;
}
