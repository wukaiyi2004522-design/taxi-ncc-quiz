import { z } from "zod";
import {
  bankSchema,
  choice,
  type Bank,
  type Session,
  type Result,
} from "./domain";
import initial from "./bank.json";
const item = z.object({
  question: bankSchema.innerType().shape.questions.element,
  answer: choice,
  correction: bankSchema.innerType().shape.errata.element.optional(),
});
const session = z
  .object({
    id: z.string(),
    title: z.string(),
    mode: z.enum(["exam", "practice", "mistakes"]),
    startedAt: z.string().datetime(),
    items: z.array(item).min(1).max(630),
    answers: z.record(choice),
    index: z.number().int().nonnegative(),
  })
  .refine(
    (s) =>
      s.index < s.items.length &&
      (s.mode !== "exam" || s.items.length === 30) &&
      new Set(s.items.map((i) => i.question.id)).size === s.items.length &&
      Object.keys(s.answers).every((id) =>
        s.items.some((i) => i.question.id === id),
      ),
    "无效考试进度",
  );
const result = z
  .intersection(
    session,
    z.object({
      finishedAt: z.string().datetime(),
      score: z.number().int().min(0).max(630),
    }),
  )
  .refine(
    (r) =>
      r.score ===
      r.items.filter((i) => r.answers[i.question.id] === i.answer).length,
    "记录分数与作答不一致",
  );
export const stateSchema = z.object({
  version: z.literal(1),
  bank: bankSchema,
  active: session.nullable(),
  history: z.array(result),
});
export type State = {
  version: 1;
  bank: Bank;
  active: Session | null;
  history: Result[];
};
export const KEY = "taxi-ncc-state-v1";
export function fresh(): State {
  return {
    version: 1,
    bank: bankSchema.parse(initial),
    active: null,
    history: [],
  };
}
export function load(): { state: State; error: string } {
  try {
    const raw = localStorage.getItem(KEY);
    return {
      state: raw ? stateSchema.parse(JSON.parse(raw)) : fresh(),
      error: "",
    };
  } catch {
    return {
      state: fresh(),
      error:
        "本机数据无法读取。原数据未覆盖，请先导出原始备份，再恢复有效备份。",
    };
  }
}
export function save(state: State) {
  localStorage.setItem(KEY, JSON.stringify(state));
}
export function download(name: string, data: unknown) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
