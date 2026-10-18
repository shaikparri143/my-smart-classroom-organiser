import { useState } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  FileText,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { apiRequest } from "../../services/api";
import { askAI } from "../../services/ai";
import { getAccessToken } from "../../services/auth";

const cards = [
  {
    id: "chat",
    title: "Ask AI",
    description: "Explore a topic and ask follow-up questions.",
    icon: MessageCircle,
  },
  {
    id: "quiz",
    title: "Generate Quiz",
    description: "Practice with questions and instant explanations.",
    icon: ClipboardList,
  },
  {
    id: "plan",
    title: "My Study Plan",
    description: "Plan study sessions around your real schedule.",
    icon: BookOpen,
  },
  {
    id: "teacher",
    title: "Teacher Tools",
    description: "Draft lesson plans, quizzes and assignments.",
    icon: WandSparkles,
    teachersOnly: true,
  },
];

const teacherKinds = {
  lesson_plan: "teacher_lesson_plan",
  quiz: "teacher_quiz",
  assignment_suggestions: "teacher_assignment_suggestions",
};

function ErrorMessage({ children }) {
  if (!children) return null;
  return <p className="ai-error" role="alert">{children}</p>;
}

export default function AIAssistantPage({ role = "student" }) {
  const isTeacher = role === "teacher";
  const [activeTool, setActiveTool] = useState("chat");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [quizForm, setQuizForm] = useState({
    subject: "",
    topic: "",
    question_count: 5,
    difficulty: "intermediate",
  });
  const [quiz, setQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [planForm, setPlanForm] = useState({
    horizon_days: 7,
    hours_per_day: 2,
    focus_topics: "",
  });
  const [studyPlan, setStudyPlan] = useState(null);
  const [teacherForm, setTeacherForm] = useState({
    kind: "lesson_plan",
    subject: "",
    topic: "",
    target_group: "",
    details: "",
  });
  const [teacherDraft, setTeacherDraft] = useState(null);
  const [teacherTitle, setTeacherTitle] = useState("");
  const [savedMaterials, setSavedMaterials] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);

  const openTool = (toolId) => {
    setActiveTool(toolId);
    setError("");
    if (!isTeacher || toolId !== "teacher") return;
    setSavedLoading(true);
    apiRequest("/api/ai/teacher/materials", { token: getAccessToken() })
      .then((items) => {
        setSavedMaterials(items ?? []);
      })
      .catch((requestError) => {
        setError(requestError.message || "Unable to load saved drafts.");
      })
      .finally(() => {
        setSavedLoading(false);
      });
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || busy) return;
    const updatedMessages = [...messages, { role: "user", content }];
    setMessages(updatedMessages);
    setChatInput("");
    setError("");
    setBusy(true);
    const conversation = updatedMessages.slice(-11);
    if (conversation[0]?.role === "assistant") conversation.shift();
    try {
      const response = await askAI(conversation);
      setMessages((current) => [...current, { role: "assistant", content: response.response }]);
    } catch (requestError) {
      setError(requestError.message || "Unable to get an AI response.");
      setMessages((current) => current.filter((message, index) => (
        index !== current.length - 1 || message.role !== "user" || message.content !== content
      )));
      setChatInput(content);
    } finally {
      setBusy(false);
    }
  };

  const generateQuiz = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setQuiz(null);
    setQuizResult(null);
    try {
      const response = await apiRequest("/api/ai/quiz", {
        method: "POST",
        token: getAccessToken(),
        body: {
          ...quizForm,
          question_count: Number(quizForm.question_count),
        },
      });
      setQuiz(response);
      setQuizAnswers(Array(response.questions.length).fill(""));
    } catch (requestError) {
      setError(requestError.message || "Unable to generate a quiz.");
    } finally {
      setBusy(false);
    }
  };

  const submitQuiz = async (event) => {
    event.preventDefault();
    if (!quiz) return;
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest(`/api/ai/quiz/${quiz.id}/submit`, {
        method: "POST",
        token: getAccessToken(),
        body: { answers: quizAnswers.map((answer) => ({ answer })) },
      });
      setQuizResult(result);
    } catch (requestError) {
      setError(requestError.message || "Unable to score your answers.");
    } finally {
      setBusy(false);
    }
  };

  const generatePlan = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStudyPlan(null);
    try {
      const response = await apiRequest("/api/ai/study-plan", {
        method: "POST",
        token: getAccessToken(),
        body: {
          ...planForm,
          horizon_days: Number(planForm.horizon_days),
          hours_per_day: Number(planForm.hours_per_day),
        },
      });
      setStudyPlan(response);
    } catch (requestError) {
      setError(requestError.message || "Unable to generate a study plan.");
    } finally {
      setBusy(false);
    }
  };

  const generateTeacherDraft = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setTeacherDraft(null);
    try {
      const response = await apiRequest("/api/ai/teacher/generate", {
        method: "POST",
        token: getAccessToken(),
        body: teacherForm,
      });
      setTeacherDraft(response);
      setTeacherTitle(response.title);
    } catch (requestError) {
      setError(requestError.message || "Unable to generate a draft.");
    } finally {
      setBusy(false);
    }
  };

  const saveTeacherDraft = async () => {
    if (!teacherDraft) return;
    setBusy(true);
    setError("");
    try {
      const saved = await apiRequest("/api/ai/teacher/materials", {
        method: "POST",
        token: getAccessToken(),
        body: {
          generation_type: teacherKinds[teacherDraft.kind],
          title: teacherTitle.trim() || teacherDraft.title,
          prompt: teacherDraft.prompt,
          result_text: teacherDraft.draft,
        },
      });
      setSavedMaterials((current) => [
        {
          id: saved.id,
          generation_type: saved.generation_type,
          title: teacherTitle.trim() || teacherDraft.title,
          prompt: teacherDraft.prompt,
          result_text: teacherDraft.draft,
          created_at: saved.created_at,
        },
        ...current,
      ]);
    } catch (requestError) {
      setError(requestError.message || "Unable to save this draft.");
    } finally {
      setBusy(false);
    }
  };

  const visibleCards = cards.filter((card) => !card.teachersOnly || isTeacher);

  return (
    <section className="ai-assistant">
      <div className="ai-tool-grid" aria-label="AI assistant tools">
        {visibleCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              className={`ai-tool-card ${activeTool === card.id ? "ai-tool-card-active" : ""}`}
              type="button"
              key={card.id}
              onClick={() => openTool(card.id)}
            >
              <span className="ai-tool-icon"><Icon size={18} /></span>
              <span className="ai-tool-copy">
                <strong>{card.title}</strong>
                <small>{card.description}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          );
        })}
      </div>

      <div className="panel ai-tool-panel">
        <div className="ai-panel-heading">
          <div>
            <span className="ai-panel-kicker"><Sparkles size={13} /> CLASS PILOT AI</span>
            <h2>{visibleCards.find((card) => card.id === activeTool)?.title}</h2>
          </div>
          <span className="ai-privacy-note">Your chat stays private to your account</span>
        </div>
        <ErrorMessage>{error}</ErrorMessage>

        {activeTool === "chat" && (
          <div className="ai-chat">
            <div className="ai-chat-messages" aria-live="polite">
              {messages.length === 0 && (
                <div className="ai-empty-state">
                  <MessageCircle size={22} />
                  <strong>What are you learning today?</strong>
                  <span>Ask for an explanation, an example, or a different way to understand a concept.</span>
                </div>
              )}
              {messages.map((message, index) => (
                <article className={`ai-chat-message ai-chat-${message.role}`} key={`${index}-${message.role}`}>
                  <strong>{message.role === "user" ? "You" : "Study Assistant"}</strong>
                  <p>{message.content}</p>
                </article>
              ))}
              {busy && <div className="ai-loading" role="status"><LoaderCircle size={16} className="ai-spinner" /> Thinking through this with you…</div>}
            </div>
            <form className="ai-chat-form" onSubmit={sendMessage}>
              <label className="sr-only" htmlFor="ai-chat-input">Message the study assistant</label>
              <textarea
                id="ai-chat-input"
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask a question or follow up…"
                maxLength={4000}
                rows={2}
                required
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form.requestSubmit();
                  }
                }}
              />
              <button className="button-primary" type="submit" disabled={busy || !chatInput.trim()} aria-label="Send message">
                {busy ? <LoaderCircle size={16} className="ai-spinner" /> : <Send size={16} />}
                <span>Send</span>
              </button>
            </form>
            <small className="ai-footnote">AI can make mistakes. Check important facts with your course materials.</small>
          </div>
        )}

        {activeTool === "quiz" && (
          <div className="ai-workspace">
            <form className="ai-form-grid" onSubmit={generateQuiz}>
              <label>Subject<input value={quizForm.subject} onChange={(event) => setQuizForm({ ...quizForm, subject: event.target.value })} maxLength={120} required placeholder="e.g. Biology" /></label>
              <label>Topic<input value={quizForm.topic} onChange={(event) => setQuizForm({ ...quizForm, topic: event.target.value })} maxLength={240} required placeholder="e.g. Cell division" /></label>
              <label>Questions<select value={quizForm.question_count} onChange={(event) => setQuizForm({ ...quizForm, question_count: event.target.value })}>{[2, 3, 5, 8, 10].map((count) => <option key={count} value={count}>{count} questions</option>)}</select></label>
              <label>Difficulty<select value={quizForm.difficulty} onChange={(event) => setQuizForm({ ...quizForm, difficulty: event.target.value })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
              <button className="button-primary ai-form-submit" disabled={busy} type="submit">{busy ? <LoaderCircle size={16} className="ai-spinner" /> : <Sparkles size={16} />} Generate practice</button>
            </form>
            {busy && !quiz && <div className="ai-loading" role="status"><LoaderCircle size={16} className="ai-spinner" /> Building your practice quiz…</div>}
            {quiz && (
              <form className="ai-quiz-list" onSubmit={submitQuiz}>
                {quiz.questions.map((question, index) => (
                  <fieldset className="ai-question" key={`${quiz.id}-${index}`}>
                    <legend><span>Question {index + 1}</span>{question.question}</legend>
                    {question.type === "mcq" ? question.options.map((option) => (
                      <label className="ai-answer-option" key={option}>
                        <input type="radio" name={`question-${index}`} value={option} checked={quizAnswers[index] === option} onChange={() => setQuizAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? option : answer))} disabled={Boolean(quizResult)} />
                        {option}
                      </label>
                    )) : (
                      <label className="ai-short-answer">Your answer<input value={quizAnswers[index] ?? ""} maxLength={500} onChange={(event) => setQuizAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} disabled={Boolean(quizResult)} /></label>
                    )}
                    {quizResult && <div className={`ai-explanation ${quizResult.results[index].correct ? "ai-answer-correct" : "ai-answer-incorrect"}`}>
                      <strong>{quizResult.results[index].correct ? "Correct" : `Answer: ${quizResult.results[index].correct_answer}`}</strong>
                      <span>{quizResult.results[index].explanation}</span>
                    </div>}
                  </fieldset>
                ))}
                {quizResult ? (
                  <div className="ai-score" role="status"><Check size={18} /> You scored {quizResult.score} of {quizResult.total} ({quizResult.percentage}%).</div>
                ) : (
                  <button className="button-primary" type="submit" disabled={busy || quizAnswers.some((answer) => !answer.trim())}>{busy ? "Checking…" : "Check answers"}</button>
                )}
              </form>
            )}
          </div>
        )}

        {activeTool === "plan" && (
          <div className="ai-workspace">
            <form className="ai-form-grid" onSubmit={generatePlan}>
              <label>Plan length (days)<input type="number" min="1" max="30" value={planForm.horizon_days} onChange={(event) => setPlanForm({ ...planForm, horizon_days: event.target.value })} required /></label>
              <label>Study time per day (hours)<input type="number" min="0.5" max="8" step="0.5" value={planForm.hours_per_day} onChange={(event) => setPlanForm({ ...planForm, hours_per_day: event.target.value })} required /></label>
              <label className="ai-form-wide">Topics you want to focus on<textarea value={planForm.focus_topics} onChange={(event) => setPlanForm({ ...planForm, focus_topics: event.target.value })} maxLength={2000} rows={3} placeholder="Add topics, or leave blank to focus on your upcoming work." /></label>
              <button className="button-primary ai-form-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="ai-spinner" /> : <Sparkles size={16} />} Build my plan</button>
            </form>
            {busy && <div className="ai-loading" role="status"><LoaderCircle size={16} className="ai-spinner" /> Reviewing your schedule and deadlines…</div>}
            {studyPlan && (
              <div className="ai-plan-result">
                {!studyPlan.timetable_configured && <p className="ai-info-note">You haven’t configured a personal timetable yet. This is a flexible manual plan based on the topics and study time you provided; no timetable has been assumed.</p>}
                {studyPlan.timetable_configured && studyPlan.timetable_entries_used === 0 && <p className="ai-info-note">No active timetable entries were found, so the plan uses your available deadlines and study-time preference without inventing a schedule.</p>}
                <label>Editable study plan<textarea value={studyPlan.plan} onChange={(event) => setStudyPlan({ ...studyPlan, plan: event.target.value })} rows={13} /></label>
                <small>Used {studyPlan.timetable_entries_used} timetable entries, {studyPlan.deadlines_used} assigned deadlines and {studyPlan.exam_events_used} exam events.</small>
              </div>
            )}
          </div>
        )}

        {activeTool === "teacher" && isTeacher && (
          <div className="ai-workspace">
            <form className="ai-form-grid" onSubmit={generateTeacherDraft}>
              <label>Draft type<select value={teacherForm.kind} onChange={(event) => setTeacherForm({ ...teacherForm, kind: event.target.value })}><option value="lesson_plan">Lesson plan</option><option value="quiz">Quiz with answer key</option><option value="assignment_suggestions">Assignment questions & objectives</option></select></label>
              <label>Subject<input value={teacherForm.subject} onChange={(event) => setTeacherForm({ ...teacherForm, subject: event.target.value })} maxLength={120} required placeholder="e.g. Chemistry" /></label>
              <label>Topic<input value={teacherForm.topic} onChange={(event) => setTeacherForm({ ...teacherForm, topic: event.target.value })} maxLength={240} required placeholder="e.g. Chemical bonding" /></label>
              <label>Class / level<input value={teacherForm.target_group} onChange={(event) => setTeacherForm({ ...teacherForm, target_group: event.target.value })} maxLength={120} placeholder="Optional" /></label>
              <label className="ai-form-wide">Teaching guidance<textarea value={teacherForm.details} onChange={(event) => setTeacherForm({ ...teacherForm, details: event.target.value })} maxLength={2000} rows={3} placeholder="Goals, duration, or constraints to account for…" /></label>
              <button className="button-primary ai-form-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="ai-spinner" /> : <Sparkles size={16} />} Generate draft</button>
            </form>
            {busy && <div className="ai-loading" role="status"><LoaderCircle size={16} className="ai-spinner" /> Preparing an editable draft…</div>}
            {teacherDraft && (
              <div className="ai-plan-result">
                <label>Draft title<input value={teacherTitle} onChange={(event) => setTeacherTitle(event.target.value)} maxLength={200} /></label>
                <label>Review and edit before saving or using<textarea value={teacherDraft.draft} onChange={(event) => setTeacherDraft({ ...teacherDraft, draft: event.target.value })} rows={16} maxLength={20000} /></label>
                <button className="button-primary" type="button" onClick={saveTeacherDraft} disabled={busy || !teacherDraft.draft.trim()}><Check size={16} /> Save reviewed draft</button>
              </div>
            )}
            <div className="ai-saved-materials">
              <h3><FileText size={16} /> Saved drafts</h3>
              {savedLoading ? <p className="ai-muted">Loading saved drafts…</p> : savedMaterials.length === 0 ? <p className="ai-muted">Your reviewed drafts will appear here after you save them.</p> : savedMaterials.map((item) => (
                <button className="ai-saved-item" type="button" key={item.id} onClick={() => {
                  const kind = Object.keys(teacherKinds).find((key) => teacherKinds[key] === item.generation_type) ?? "lesson_plan";
                  setTeacherDraft({ kind, title: item.title, prompt: item.prompt, draft: item.result_text });
                  setTeacherForm((current) => ({ ...current, kind }));
                  setTeacherTitle(item.title);
                }}>
                  <span>{item.generation_type.replace("teacher_", "").replaceAll("_", " ")}</span>
                  <small>{item.title}</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}