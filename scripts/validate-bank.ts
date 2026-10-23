import { readFileSync } from "node:fs";
import { parseBank, readyPaper } from "../src/domain";
try {
  const bank = parseBank(
    JSON.parse(readFileSync(process.argv[2] || "src/bank.json", "utf8")),
  );
  console.log(
    `校验通过：${bank.papers.length}/21 套，${bank.questions.length}/630 题，${bank.papers.filter((p) => readyPaper(p.id, bank)).length} 套可考试，${bank.errata.length} 条勘误。`,
  );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
