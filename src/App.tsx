import { useState, useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  LayoutDashboard,
  BookOpen,
  Shuffle,
  Bookmark,
  History,
  Database,
  ArrowUpRight,
  ArrowRight,
  CarFront,
  Check,
  WifiOff,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  parseBank,
  mergeBank,
  effective,
  readyPaper,
  shuffle,
  startSession,
  grade,
  latestOutcomes,
  type Result,
  type Question,
  type Choice,
} from "./domain";
import { load, save, download, stateSchema, KEY, type State } from "./storage";
const tabs = [
  ["home", "学习概览", LayoutDashboard],
  ["papers", "历年真题", BookOpen],
  ["practice", "随机练习", Shuffle],
  ["mistakes", "错题本", Bookmark],
  ["history", "考试记录", History],
  ["data", "题库与设置", Database],
] as const;
export default function App() {
  const [loaded] = useState(load);
  const [state, setState] = useState<State>(loaded.state);
  const [error, setError] = useState(loaded.error);
  const [tab, setTab] = useState("home");
  const [year, setYear] = useState("all");
  const [result, setResult] = useState<Result | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [count, setCount] = useState(10);
  const [message, setMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const locked = useRef(!!loaded.error);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => setMessage("离线缓存注册失败，请检查网络并刷新。"),
  });
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, []);
  useEffect(() => {
    if (!state.active) return;
    const tick = () =>
      setElapsed(
        Math.max(
          0,
          Math.floor((Date.now() - Date.parse(state.active!.startedAt)) / 1000),
        ),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [state.active?.id]);
  function commit(next: State) {
    if (locked.current) {
      setError("请先恢复有效备份，避免覆盖原始损坏数据。");
      return false;
    }
    try {
      save(next);
      setState(next);
      setError("");
      return true;
    } catch {
      setError(
        "保存失败：本机存储不可用或空间不足。操作未保存，请导出备份后释放空间。",
      );
      return false;
    }
  }
  const b = state.bank;
  const outcomes = latestOutcomes(state.history);
  const known = b.questions.filter((q) => effective(q, b).answer);
  const wrong = known.filter((q) => outcomes.get(q.id) === false);
  const mastered = b.questions.filter(
    (q) => outcomes.get(q.id) === true,
  ).length;
  const completed = b.papers.filter((p) => readyPaper(p.id, b)).length;
  function go(t: string) {
    setTab(t);
    setResult(null);
    setConfirm(false);
  }
  function start(
    qs: Question[],
    mode: "exam" | "practice" | "mistakes",
    title: string,
  ) {
    try {
      if (state.active) {
        setMessage("已有未交卷的学习，请先继续并交卷。");
        return;
      }
      if (commit({ ...state, active: startSession(title, mode, qs, b) })) {
        setResult(null);
        setTab("session");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function submit() {
    if (!state.active) return;
    const r = grade(state.active);
    if (commit({ ...state, active: null, history: [r, ...state.history] })) {
      setResult(r);
      setConfirm(false);
      setTab("history");
    }
  }
  async function importFile(file: File | undefined, backup = false) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw Error("文件不能超过 10 MB");
      const data = JSON.parse(await file.text());
      if (backup) {
        const restored = stateSchema.parse(data);
        save(restored);
        locked.current = false;
        setState(restored);
        setError("");
        setResult(null);
        setConfirm(false);
      } else {
        if (!commit({ ...state, bank: mergeBank(b, parseBank(data)) })) return;
      }
      setMessage(backup ? "备份已恢复。" : "导入成功，原有记录已保留。");
    } catch (e) {
      setError(`导入失败：${(e as Error).message}`);
    }
  }
  const active = tab === "session" ? state.active : null;
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => go("home")}>
          <span className="logo">
            <CarFront size={24} />
          </span>
          <span>
            TAXI <b>/ NCC</b>
            <small>意大利考试学习助手</small>
          </span>
        </a>
        <div className="nav-label">你的学习空间</div>
        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "nav active" : "nav"}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "mistakes" && wrong.length > 0 && <em>{wrong.length}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="italy">● ● ●</span>
          <strong>每一次练习，都更进一步。</strong>
          <p>
            保留意大利语原题
            <br />
            配合中文解析，安心备考。
          </p>
          <small>2015 — 2024 · 真题档案</small>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            学习空间 <span className="slash">/</span>{" "}
            {tabs.find((t) => t[0] === tab)?.[1] || "答题中"}
          </span>
          <span className="status">
            {online ? <span className="dot" /> : <WifiOff size={14} />}{" "}
            {online ? "本机保存" : "离线模式"}
          </span>
        </header>
        <main>
          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
              <button aria-label="关闭提示" onClick={() => setMessage("")}>
                ×
              </button>
            </div>
          )}
          {needRefresh && (
            <div className="notice">
              新版本已就绪。
              {state.active ? (
                "交卷后可更新。"
              ) : (
                <button onClick={() => updateServiceWorker(true)}>
                  更新应用
                </button>
              )}
            </div>
          )}
          {state.active && !active && (
            <div className="resume">
              <div>
                <strong>
                  有一份未完成的
                  {state.active.mode === "exam" ? "模拟考试" : "练习"}
                </strong>
                <p>
                  {state.active.title} · 已答{" "}
                  {Object.keys(state.active.answers).length} /{" "}
                  {state.active.items.length}
                </p>
              </div>
              <button
                className="primary"
                onClick={() => {
                  setResult(null);
                  setTab("session");
                }}
              >
                继续答题 <ArrowRight size={16} />
              </button>
            </div>
          )}
          {tab === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">BUON VIAGGIO · 学习之旅</p>
                  <h1>下一站，从容应考。</h1>
                  <p>一点一滴积累，掌握 Taxi / NCC 考试知识。</p>
                </div>
                <span className="date-tag">2015 — 2024</span>
              </div>
              <section className="hero">
                <div>
                  <span className="pill">IL TUO PERCORSO · 你的备考路线</span>
                  <h2>
                    认真练习，
                    <br />
                    让每一程更有把握。
                  </h2>
                  <p>历年意大利语真题 · 中文解析 · 离线随时学</p>
                  <button className="light" onClick={() => go("papers")}>
                    浏览历年真题 <ArrowUpRight size={18} />
                  </button>
                </div>
                <div className="route-art" aria-hidden="true">
                  <div className="route-line" />
                  <span className="route-start">PARTENZA</span>
                  <div className="taxi-sign">TAXI</div>
                  <span className="route-end">
                    下一站：准备就绪 <span>↗</span>
                  </span>
                </div>
              </section>
              <section className="stats">
                <Stat
                  label="真题已收录"
                  value={b.questions.length}
                  suffix="/ 630 题"
                />
                <Stat label="可用完整试卷" value={completed} suffix="/ 21 套" />
                <Stat label="已掌握题目" value={mastered} suffix="题" />
                <Stat label="待复习错题" value={wrong.length} suffix="题" />
              </section>
              <div className="section-heading">
                <h2>选择你的学习方式</h2>
                <span>按自己的节奏，稳步向前</span>
              </div>
              <div className="mode-grid">
                {[
                  [
                    "papers",
                    BookOpen,
                    "历年真题",
                    "按年份系统学习，熟悉原始试卷。",
                    "查看试卷",
                  ],
                  [
                    "practice",
                    Shuffle,
                    "随机练习",
                    "打散题目顺序，巩固每一个知识点。",
                    "开始练习",
                  ],
                  [
                    "mistakes",
                    Bookmark,
                    "错题复习",
                    "重新理解易错题，让薄弱点更扎实。",
                    "查看错题",
                  ],
                ].map(([id, Icon, title, desc, action]) => {
                  const I = Icon as typeof BookOpen;
                  return (
                    <button
                      className="mode-card"
                      key={id as string}
                      onClick={() => go(id as string)}
                    >
                      <span className="icon-box">
                        <I size={22} />
                      </span>
                      <h3>{title as string}</h3>
                      <p>{desc as string}</p>
                      <span className="card-link">
                        {action as string}
                        <ArrowRight size={16} />
                      </span>
                    </button>
                  );
                })}
              </div>
              <section className="bottom-grid">
                <div className="panel">
                  <div className="section-heading">
                    <h3>学习进度</h3>
                    <span>
                      {b.questions.length
                        ? Math.round((mastered / b.questions.length) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="progress">
                    <i
                      style={{
                        width: `${b.questions.length ? (mastered / b.questions.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p>
                    已掌握 {mastered} / {b.questions.length} 道已收录题目
                  </p>
                  <small>完成练习后，进度会自动保存在这台设备上。</small>
                </div>
                <div className="panel warm">
                  <h3>题库正在整理中</h3>
                  <p>
                    原始考题尚未全部转录。未收录内容不会显示为真题，也不会生成虚构答案。
                  </p>
                  <button className="text-button" onClick={() => go("data")}>
                    了解题库与导入 <ArrowUpRight size={15} />
                  </button>
                </div>
              </section>
            </>
          )}
          {tab === "papers" && (
            <>
              <Heading
                title="历年真题"
                sub="2015–2024 · 目标 21 套，每套 30 题。按真实资料逐步收录。"
              />
              <div className="filters">
                {[
                  "all",
                  ...Array.from({ length: 10 }, (_, i) => String(2024 - i)),
                ].map((y) => (
                  <button
                    className={year === y ? "selected" : ""}
                    onClick={() => setYear(y)}
                    key={y}
                  >
                    {y === "all" ? "全部年份" : y}
                  </button>
                ))}
              </div>
              <div className="paper-grid">
                {b.papers
                  .filter((p) => year === "all" || String(p.year) === year)
                  .map((p) => {
                    const qs = b.questions
                      .filter((q) => q.paperId === p.id)
                      .sort((a, b) => a.number - b.number);
                    return (
                      <article className="panel" key={p.id}>
                        <span className="eyebrow">{p.year} · ARCHIVIO</span>
                        <h3>{p.title}</h3>
                        <p>
                          已转录 {qs.length}/30 题 · 可评分{" "}
                          {qs.filter((q) => effective(q, b).answer).length} 题
                        </p>
                        <small>来源：{p.source}</small>
                        <div className="actions">
                          <button
                            className="primary"
                            disabled={!readyPaper(p.id, b)}
                            onClick={() => start(qs, "exam", p.title)}
                          >
                            模拟考试
                          </button>
                          <button
                            disabled={!qs.some((q) => effective(q, b).answer)}
                            onClick={() =>
                              start(
                                qs.filter((q) => effective(q, b).answer),
                                "practice",
                                p.title,
                              )
                            }
                          >
                            练习
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
              {!b.papers.some(
                (p) => year === "all" || String(p.year) === year,
              ) && (
                <Empty
                  title="这一段旅程，等待真题加入"
                  text="尚未导入该年份的真实试卷。导入经核验的原始资料后，即可开始练习。"
                  action={() => go("data")}
                  label="导入题库"
                />
              )}
              <div className="notice">
                模拟考试中不显示答案；交卷后统一评分。未答题按错误计入，不预设未经确认的官方及格线或时限。
              </div>
            </>
          )}
          {(tab === "practice" || tab === "mistakes") && (
            <>
              <Heading
                title={tab === "practice" ? "随机练习" : "错题本"}
                sub={
                  tab === "practice"
                    ? "从已收录且有答案的真题中随机抽取，完成后查看中文解析。"
                    : "根据最近一次作答自动整理；复习答对后，该题会移出错题本。"
                }
              />
              <section className="panel practice-panel">
                <span className="icon-box">
                  {tab === "practice" ? <Shuffle /> : <Bookmark />}
                </span>
                <h2>
                  {tab === "practice" ? known.length : wrong.length} 道
                  {tab === "practice" ? "可练习题目" : "待复习错题"}
                </h2>
                <p>答题进度自动保存，可随时回来继续。</p>
                <label>
                  本次题数{" "}
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                  >
                    {[5, 10, 20, 30].map((n) => (
                      <option key={n} value={n}>
                        {n} 题
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  <button
                    className="primary"
                    disabled={!(tab === "practice" ? known : wrong).length}
                    onClick={() =>
                      start(
                        shuffle(tab === "practice" ? known : wrong).slice(
                          0,
                          count,
                        ),
                        tab === "practice" ? "practice" : "mistakes",
                        tab === "practice" ? "随机练习" : "错题复习",
                      )
                    }
                  >
                    开始{tab === "practice" ? "练习" : "复习"}{" "}
                    <ArrowRight size={16} />
                  </button>
                </p>
                <small>可用题数不足时使用全部可用题目，不重复抽题。</small>
              </section>
              {tab === "mistakes" &&
                wrong.map((q) => (
                  <div className="panel" key={q.id}>
                    <small>
                      {b.papers.find((p) => p.id === q.paperId)?.title} · 第{" "}
                      {q.number} 题
                    </small>
                    <p lang="it">{q.textIt}</p>
                  </div>
                ))}
            </>
          )}
          {active && (
            <>
              <Heading
                title={active.title}
                sub={
                  active.mode === "exam"
                    ? "模拟考试 · 交卷后统一显示答案与解析"
                    : "练习模式 · 完成后查看答案与中文解析"
                }
              />
              <div className="exam-meta">
                <span>
                  已答 {Object.keys(active.answers).length} /{" "}
                  {active.items.length}
                </span>
                <span>
                  用时 {Math.floor(elapsed / 60)}:
                  {String(elapsed % 60).padStart(2, "0")}
                </span>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${(Object.keys(active.answers).length / active.items.length) * 100}%`,
                  }}
                />
              </div>
              <section className="panel question">
                <span className="eyebrow">
                  DOMANDA {active.index + 1} / {active.items.length}
                </span>
                <h2 lang="it">{active.items[active.index].question.textIt}</h2>
                <div className="options">
                  {(["A", "B", "C"] as Choice[]).map((c) => (
                    <button
                      key={c}
                      aria-pressed={
                        active.answers[
                          active.items[active.index].question.id
                        ] === c
                      }
                      className={
                        active.answers[
                          active.items[active.index].question.id
                        ] === c
                          ? "option chosen"
                          : "option"
                      }
                      onClick={() =>
                        commit({
                          ...state,
                          active: {
                            ...active,
                            answers: {
                              ...active.answers,
                              [active.items[active.index].question.id]: c,
                            },
                          },
                        })
                      }
                    >
                      <b>{c}</b>
                      <span lang="it">
                        {active.items[active.index].question.options[c]}
                      </span>
                      {active.answers[
                        active.items[active.index].question.id
                      ] === c && <Check size={18} />}
                    </button>
                  ))}
                </div>
                <div className="actions spread">
                  <button
                    disabled={active.index === 0}
                    onClick={() =>
                      commit({
                        ...state,
                        active: { ...active, index: active.index - 1 },
                      })
                    }
                  >
                    <ChevronLeft size={16} />
                    上一题
                  </button>
                  {active.index < active.items.length - 1 ? (
                    <button
                      className="primary"
                      onClick={() =>
                        commit({
                          ...state,
                          active: { ...active, index: active.index + 1 },
                        })
                      }
                    >
                      下一题
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      className="primary"
                      onClick={() => setConfirm(true)}
                    >
                      交卷评分
                    </button>
                  )}
                </div>
              </section>
              <section className="panel">
                <h3>答题卡</h3>
                <div className="answer-grid">
                  {active.items.map((i, n) => (
                    <button
                      key={i.question.id}
                      aria-label={`第 ${n + 1} 题${active.answers[i.question.id] ? "，已答" : ""}`}
                      aria-current={active.index === n ? "step" : undefined}
                      className={`${active.answers[i.question.id] ? "answered" : ""} ${active.index === n ? "current" : ""}`}
                      onClick={() =>
                        commit({ ...state, active: { ...active, index: n } })
                      }
                    >
                      {n + 1}
                    </button>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={() => setConfirm(true)}
                >
                  结束并交卷
                </button>
              </section>
              {confirm && (
                <div className="modal-backdrop">
                  <section
                    className="panel modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="submit-title"
                  >
                    <h2 id="submit-title">确认交卷？</h2>
                    <p>
                      还有{" "}
                      {active.items.length - Object.keys(active.answers).length}{" "}
                      题未作答。未答题按错误计入，交卷后不能修改本次答案。
                    </p>
                    <div className="actions">
                      <button autoFocus onClick={() => setConfirm(false)}>
                        继续答题
                      </button>
                      <button className="primary" onClick={submit}>
                        确认交卷
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
          {tab === "history" && !result && (
            <>
              <Heading
                title="考试记录"
                sub="每次努力都有迹可循。记录保留当时使用的题目、答案与勘误版本。"
              />
              {state.history.length ? (
                state.history.map((r) => (
                  <button
                    className="history-row panel"
                    key={r.id}
                    onClick={() => setResult(r)}
                  >
                    <div>
                      <h3>{r.title}</h3>
                      <p>
                        {new Date(r.finishedAt).toLocaleString("zh-CN")} ·{" "}
                        {r.mode === "exam" ? "模拟考试" : "练习"}
                      </p>
                    </div>
                    <strong>
                      {r.score}
                      <small> / {r.items.length}</small>
                    </strong>
                    <ArrowUpRight />
                  </button>
                ))
              ) : (
                <Empty
                  title="还没有考试记录"
                  text="完成第一份考试或练习后，在这里回顾成绩和解析。"
                />
              )}
            </>
          )}
          {result && (
            <>
              <button className="text-button" onClick={() => setResult(null)}>
                <ChevronLeft size={16} />
                返回记录
              </button>
              <Heading title="这一程，已完成。" sub={result.title} />
              <section className="result-banner">
                <div>
                  <span>本次得分</span>
                  <h2>
                    {result.score}
                    <small> / {result.items.length}</small>
                  </h2>
                </div>
                <p>
                  正确率{" "}
                  {Math.round((result.score / result.items.length) * 100)}%
                  <br />
                  错答 / 未答 {result.items.length - result.score} 题
                </p>
              </section>
              <h2>答案与中文解析</h2>
              {result.items.map((i, n) => (
                <section className="panel review" key={i.question.id}>
                  <span
                    className={
                      result.answers[i.question.id] === i.answer
                        ? "good"
                        : "bad"
                    }
                  >
                    {n + 1}.{" "}
                    {result.answers[i.question.id] === i.answer
                      ? "回答正确"
                      : "需复习"}
                  </span>
                  <h3 lang="it">{i.question.textIt}</h3>
                  {(["A", "B", "C"] as Choice[]).map((c) => (
                    <p
                      lang="it"
                      className={c === i.answer ? "correct-answer" : ""}
                      key={c}
                    >
                      {c}. {i.question.options[c]} {c === i.answer ? "✓" : ""}
                    </p>
                  ))}
                  <div className="explanation">
                    <strong>
                      你的答案：{result.answers[i.question.id] || "未作答"} ·
                      正确答案：{i.answer}
                    </strong>
                    <p>
                      {i.question.explanationZh ||
                        "中文解析待补充，请以核验后的原始资料为准。"}
                    </p>
                    <small>
                      原始标准答案：{i.question.originalAnswer || "待核验"} ·
                      来源：{i.question.answerSource || i.question.source}
                    </small>
                    {i.correction && (
                      <p className="erratum">
                        已应用勘误：{i.correction.reasonZh}
                        <br />
                        依据：{i.correction.source} · {i.correction.recordedAt}
                      </p>
                    )}
                  </div>
                </section>
              ))}
            </>
          )}
          {tab === "data" && (
            <>
              <Heading
                title="题库与设置"
                sub="真实资料，可追溯答案。你的学习数据保存在当前浏览器中。"
              />
              <div className="bottom-grid">
                <section className="panel">
                  <h3>导入真实题库</h3>
                  <p>
                    支持 JSON 增量导入、中文解析及独立答案勘误。同 ID
                    原题不可覆盖。
                  </p>
                  <p>
                    {b.papers.length} 套 / {b.questions.length} 题 /{" "}
                    {b.errata.length} 条勘误
                  </p>
                  <label className="file-button">
                    选择题库 JSON
                    <input
                      aria-label="导入题库"
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        void importFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="actions">
                    <button onClick={() => download("taxi-bank.json", b)}>
                      导出题库
                    </button>
                    <button
                      onClick={() =>
                        download("bank-template.json", {
                          schemaVersion: 1,
                          papers: [],
                          questions: [],
                          errata: [],
                        })
                      }
                    >
                      空白模板
                    </button>
                  </div>
                  <small>
                    具体字段与导入规则见仓库
                    docs/IMPORT.md。无真实资料时保留空题库。
                  </small>
                </section>
                <section className="panel">
                  <h3>备份与恢复</h3>
                  <p>
                    备份包含题库、未完成答题和历史记录。iPhone 与 Mac
                    可通过备份文件手动迁移。
                  </p>
                  <button onClick={() => download("taxi-backup.json", state)}>
                    <Download size={16} />
                    导出学习备份
                  </button>
                  {loaded.error && (
                    <p>
                      <button
                        onClick={() => {
                          const raw = localStorage.getItem(KEY);
                          download("taxi-raw-backup.json", { raw });
                        }}
                      >
                        导出原始损坏数据
                      </button>
                    </p>
                  )}
                  <p>恢复会替换此设备现有学习数据，请先导出备份。</p>
                  <label className="file-button">
                    选择并恢复备份
                    <input
                      aria-label="恢复备份"
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        void importFile(e.target.files?.[0], true);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </section>
              </div>
              <section className="panel">
                <h3>安装与离线使用</h3>
                <p>
                  {offlineReady
                    ? "离线资源已缓存，可断网使用。"
                    : "首次联网打开后会缓存应用。请等待缓存完成再离线使用。"}
                </p>
                <p>
                  iPhone：使用 Safari 打开 → 分享 → 添加到主屏幕。
                  <br />
                  Mac：Safari「文件 → 添加到程序坞」（支持的系统），或 Chrome
                  地址栏的安装按钮。
                </p>
                <small>
                  安装需要 HTTPS（本地 localhost
                  除外）。清除网站数据会删除本机学习记录，请定期备份。
                </small>
              </section>
              <section className="panel">
                <h3>答案勘误记录</h3>
                {b.errata.length ? (
                  b.errata.map((e) => (
                    <div className="erratum" key={e.id}>
                      <strong>
                        {e.questionId} → {e.answer}
                      </strong>
                      <p>{e.reasonZh}</p>
                      <small>
                        {e.source} · {e.recordedAt}
                      </small>
                    </div>
                  ))
                ) : (
                  <p>
                    暂无勘误。新增勘误需包含题目
                    ID、修正答案、中文原因、依据和记录时间；同题采用最新记录。
                  </p>
                )}
              </section>
            </>
          )}
          <footer>
            <span>
              TAXI / NCC <span className="slash">·</span> 一程一程，学有所成。
            </span>
            <span>原题保留 · 本机存储 · 离线学习</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">TAXI / NCC · STUDIO</p>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
    </div>
  );
}
function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
    </div>
  );
}
function Empty({
  title,
  text,
  action,
  label,
}: {
  title: string;
  text: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <section className="empty panel">
      <BookOpen size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="primary" onClick={action}>
          {label}
          <ArrowRight size={16} />
        </button>
      )}
    </section>
  );
}
