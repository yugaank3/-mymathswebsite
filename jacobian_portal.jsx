const { useState, useEffect, useRef, useCallback } = React;

// ── Default question bank ──────────────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  {
    id: 1,
    question:
      "Find the Jacobian J = ∂(u,v)/∂(x,y) where u = x² + y² and v = 2xy.",
    steps: [
      {
        expression: "∂u/∂x = 2x",
        hint: "Differentiate u = x² + y² with respect to x, treating y as a constant.",
        marks: 1,
      },
      {
        expression: "∂u/∂y = 2y",
        hint: "Differentiate u = x² + y² with respect to y, treating x as a constant.",
        marks: 1,
      },
      {
        expression: "∂v/∂x = 2y",
        hint: "Differentiate v = 2xy with respect to x, treating y as a constant.",
        marks: 1,
      },
      {
        expression: "∂v/∂y = 2x",
        hint: "Differentiate v = 2xy with respect to y, treating x as a constant.",
        marks: 1,
      },
      {
        expression: "J = 4x² - 4y²",
        hint: "J = (∂u/∂x)(∂v/∂y) − (∂u/∂y)(∂v/∂x) = (2x)(2x) − (2y)(2y).",
        marks: 1,
      },
    ],
    solution:
      "J = ∂(u,v)/∂(x,y) = |2x  2y; 2y  2x| = (2x)(2x) − (2y)(2y) = 4x² − 4y²",
  },
  {
    id: 2,
    question:
      "Find the Jacobian J = ∂(r,θ)/∂(x,y) for polar coordinates x = r cosθ, y = r sinθ.",
    steps: [
      {
        expression: "∂x/∂r = cosθ",
        hint: "Differentiate x = r cosθ with respect to r.",
        marks: 1,
      },
      {
        expression: "∂x/∂θ = -r sinθ",
        hint: "Differentiate x = r cosθ with respect to θ.",
        marks: 1,
      },
      {
        expression: "∂y/∂r = sinθ",
        hint: "Differentiate y = r sinθ with respect to r.",
        marks: 1,
      },
      {
        expression: "∂y/∂θ = r cosθ",
        hint: "Differentiate y = r sinθ with respect to θ.",
        marks: 1,
      },
      {
        expression: "J = r",
        hint: "J = (cosθ)(r cosθ) − (−r sinθ)(sinθ) = r cos²θ + r sin²θ = r.",
        marks: 1,
      },
    ],
    solution:
      "J = ∂(x,y)/∂(r,θ) = |cosθ  -r sinθ; sinθ  r cosθ| = r cos²θ + r sin²θ = r",
  },
];

// ── Utility: normalise answer strings for comparison ──────────────────────
// Strips all Unicode math symbols, spaces, and normalises common variants
// so students can type plain ASCII and still match.
const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/\s+/g, "")
    // Unicode minus / en-dash / em-dash → hyphen
    .replace(/[−–—]/g, "-")
    // caret exponents typed by students: x^2 → x2, x^3 → x3
    .replace(/\^2/g, "2").replace(/\^3/g, "3").replace(/\^1/g, "1")
    // Unicode superscripts
    .replace(/²/g, "2").replace(/³/g, "3").replace(/¹/g, "1")
    // multiplication
    .replace(/[×·]/g, "*")
    // strip partial symbol
    .replace(/∂/g, "d")
    // greek letters
    .replace(/θ/g, "theta").replace(/α/g, "alpha").replace(/β/g, "beta")
    .replace(/π/g, "pi").replace(/φ/g, "phi")
    // remove parentheses
    .replace(/[()[\]{}]/g, "")
    .replace(/\*+/g, "*")
    .trim();

// Extract just the right-hand side of an expression like "∂u/∂x = 2x" → "2x"
// If no "=" found, use the whole string.
const getRHS = (expr) => {
  const parts = expr.split("=");
  return parts.length > 1 ? parts.slice(1).join("=").trim() : expr.trim();
};

const answersMatch = (studentInput, expectedExpr) => {
  const normStudent = normalize(studentInput);
  // Try matching full expression first, then RHS only
  const normFull = normalize(expectedExpr);
  const normRHS  = normalize(getRHS(expectedExpr));
  return normStudent === normFull || normStudent === normRHS;
};

// ── Math rendering – CSS-only, no external lib ────────────────────────────
function MathDisplay({ expr, block = false }) {
  // Render a pretty fraction if pattern found: a/b
  const parts = expr.split(/(∂\([^)]+\)\/∂\([^)]+\)|∂[^/\s=]+\/∂[^/\s=]+)/g);
  return (
    <span
      className={block ? "math-block" : "math-inline"}
      style={{ fontFamily: "'STIX Two Math', 'Latin Modern Math', serif" }}
    >
      {expr}
    </span>
  );
}

// ── Matrix visual ─────────────────────────────────────────────────────────
function JacobianMatrix({ rows }) {
  return (
    <div className="matrix-wrapper">
      <span className="matrix-bracket left">⎡<br />⎢<br />⎣</span>
      <div className="matrix-body">
        {rows.map((row, i) => (
          <div key={i} className="matrix-row">
            {row.map((cell, j) => (
              <span key={j} className="matrix-cell">
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
      <span className="matrix-bracket right">⎤<br />⎥<br />⎦</span>
    </div>
  );
}

// ── Audio helper ──────────────────────────────────────────────────────────
function playSound(type) {
  try {
    const audio = new Audio(`/${type}.mp3`);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (_) {}
}

// ── Step indicator dots ───────────────────────────────────────────────────
function StepDots({ total, current, completed, onSelect, onReveal }) {
  return (
    <div className="step-dots">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          title={`Jump to Step ${i + 1}`}
          className={`step-dot ${
            completed.includes(i)
              ? "done"
              : i === current
              ? "active"
              : "pending"
          }`}
          onClick={() => onSelect(i)}
          style={{ cursor: "pointer" }}
        >
          {completed.includes(i) ? "✓" : i + 1}
        </div>
      ))}
      {/* Special final-answer dot */}
      <div
        title="View Final Answer (0 marks)"
        className={`step-dot final-dot ${current === "final" ? "active" : "pending"}`}
        onClick={onReveal}
        style={{ cursor: "pointer" }}
      >
        ∑
      </div>
    </div>
  );
}

// // ═══════════════════════════════════════════════════════════════════════════
// // TEACHER PANEL — AI auto-solve
// // ═══════════════════════════════════════════════════════════════════════════
// function TeacherPanel({ questions, onSave, onBack }) {
//   const [question, setQuestion] = useState("");
//   const [aiResult, setAiResult] = useState(null);   // parsed AI response
//   const [loading, setLoading]   = useState(false);
//   const [error, setError]       = useState("");
//   const [saved, setSaved]       = useState(false);

//   const solve = async () => {
//     if (!question.trim()) return;
//     setLoading(true);
//     setError("");
//     setAiResult(null);

//     const prompt = `You are a mathematics professor. Solve the following Jacobian problem step by step.

// Problem: ${question}

// Return ONLY a valid JSON object (no markdown, no backticks, no explanation outside the JSON) with this exact structure:
// {
//   "question": "<restate the question clearly>",
//   "solution": "<the final answer as a compact expression>",
//   "steps": [
//     {
//       "expression": "<LHS = RHS, e.g. du/dx = 2x>",
//       "hint": "<a one-sentence hint guiding the student to find this step without giving the answer>",
//       "marks": 1
//     }
//   ]
// }

// Rules:
// - Each step must be a single partial derivative computation or the final Jacobian determinant calculation.
// - The expression field must be in the form "LHS = RHS" using plain ASCII math (use ^ for powers, * for multiply, d for partial ∂).
// - Keep hints helpful but do NOT reveal the answer in the hint.
// - Break the solution into logical steps (typically 4-6 steps for a Jacobian problem).`;

//     try {
//       const response = await fetch("https://api.anthropic.com/v1/messages", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           model: "claude-sonnet-4-20250514",
//           max_tokens: 1000,
//           messages: [{ role: "user", content: prompt }],
//         }),
//       });

//       const data = await response.json();
//       const text = data.content
//         .filter((b) => b.type === "text")
//         .map((b) => b.text)
//         .join("");

//       // Strip any accidental markdown fences
//       const clean = text.replace(/```json|```/gi, "").trim();
//       const parsed = JSON.parse(clean);
//       setAiResult(parsed);
//     } catch (e) {
//       setError("Could not parse AI response. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleSave = () => {
//     if (!aiResult) return;
//     onSave({ ...aiResult, id: Date.now() });
//     setSaved(true);
//     setQuestion("");
//     setAiResult(null);
//     setTimeout(() => setSaved(false), 2500);
//   };

//   const updateStep = (idx, field, val) => {
//     setAiResult((r) => {
//       const steps = [...r.steps];
//       steps[idx] = { ...steps[idx], [field]: val };
//       return { ...r, steps };
//     });
//   };

//   return (
//     <div className="panel teacher-panel">
//       <div className="panel-header">
//         <button className="back-btn" onClick={onBack}>← Back</button>
//         <h2>Teacher Question Bank</h2>
//         <span className="badge">{questions.length} Questions</span>
//       </div>

//       <div className="teacher-grid">
//         {/* ── Left: existing questions ── */}
//         <div className="existing-list">
//           <h3>Existing Questions</h3>
//           {questions.length === 0 && <p className="muted">No questions yet.</p>}
//           {questions.map((q, i) => (
//             <div key={q.id} className="q-card">
//               <span className="q-num">Q{i + 1}</span>
//               <p>{q.question}</p>
//               <span className="step-count">{q.steps.length} steps</span>
//             </div>
//           ))}
//         </div>

//         {/* ── Right: AI solve form ── */}
//         <div className="add-form">
//           <h3>Add Question via AI</h3>

//           <label>Problem Statement</label>
//           <textarea
//             rows={3}
//             placeholder="e.g. Find the Jacobian of u = x² + y², v = 2xy with respect to x and y"
//             value={question}
//             onChange={(e) => setQuestion(e.target.value)}
//           />

//           <button
//             className="submit-btn ai-solve-btn"
//             onClick={solve}
//             disabled={loading || !question.trim()}
//           >
//             {loading ? (
//               <span className="spinner-row"><span className="spinner" />Solving…</span>
//             ) : (
//               "✦ Auto-Solve with AI"
//             )}
//           </button>

//           {error && <div className="wrong-notice">{error}</div>}

//           {/* ── AI result preview ── */}
//           {aiResult && (
//             <div className="ai-result">
//               <div className="ai-result-header">
//                 <span className="ai-badge">✦ AI Generated</span>
//                 <span className="muted" style={{fontSize:12}}>You can edit before saving</span>
//               </div>

//               <label>Question (editable)</label>
//               <textarea
//                 rows={2}
//                 value={aiResult.question}
//                 onChange={(e) => setAiResult((r) => ({ ...r, question: e.target.value }))}
//               />

//               <label>Final Solution (editable)</label>
//               <input
//                 value={aiResult.solution}
//                 onChange={(e) => setAiResult((r) => ({ ...r, solution: e.target.value }))}
//               />

//               <label style={{marginTop:8}}>Steps</label>
//               {aiResult.steps.map((step, idx) => (
//                 <div key={idx} className="step-form-card">
//                   <div className="step-form-head">
//                     <span>Step {idx + 1}</span>
//                   </div>
//                   <input
//                     placeholder="Expression (LHS = RHS)"
//                     value={step.expression}
//                     onChange={(e) => updateStep(idx, "expression", e.target.value)}
//                   />
//                   <input
//                     placeholder="Hint"
//                     value={step.hint}
//                     onChange={(e) => updateStep(idx, "hint", e.target.value)}
//                   />
//                 </div>
//               ))}

//               <button className="submit-btn" onClick={handleSave}>
//                 {saved ? "✓ Saved!" : "Save to Question Bank"}
//               </button>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// } The AI Version

// ═══════════════════════════════════════════════
// TEACHER PANEL — manual form
// ═══════════════════════════════════════════════
const EMPTY_STEP = { expression: "", hint: "" };

function TeacherPanel({ questions, onSave, onBack }) {
  const [form, setForm] = useState({
    question: "",
    solution: "",
    steps: [{ ...EMPTY_STEP }],
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const setField = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const updateStep = (idx, field, val) =>
    setForm(f => {
      const steps = [...f.steps];
      steps[idx] = { ...steps[idx], [field]: val };
      return { ...f, steps };
    });

  const addStep = () =>
    setForm(f => ({ ...f, steps: [...f.steps, { ...EMPTY_STEP }] }));

  const removeStep = (idx) =>
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));

  const handleSave = () => {
    if (!form.question.trim()) { setError("Please enter a question."); return; }
    if (!form.solution.trim()) { setError("Please enter the final solution."); return; }
    if (form.steps.some(s => !s.expression.trim())) { setError("All steps need an expression."); return; }
    setError("");
    onSave({ ...form, steps: form.steps.map(s => ({ ...s, marks: 1 })), id: Date.now() });
    setSaved(true);
    setForm({ question: "", solution: "", steps: [{ ...EMPTY_STEP }] });
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Teacher Question Bank</h2>
        <span className="badge">{questions.length} Questions</span>
      </div>

      <div className="teacher-grid">
        <div className="existing-list">
          <h3>Saved Questions</h3>
          {questions.length === 0 && <p className="muted">No questions yet.</p>}
          {questions.map((q, i) => (
            <div key={q.id} className="q-card">
              <span className="q-num">Q{i + 1}</span>
              <p>{q.question}</p>
              <span className="step-count">{q.steps.length} steps · {q.steps.reduce((a,s)=>a+s.marks,0)} marks</span>
            </div>
          ))}
        </div>

        <div className="add-form">
          <h3>Add New Question</h3>

          <div className="form-group">
            <label><span className="label-icon">❓</span> Problem Statement</label>
            <textarea rows={3}
              placeholder="e.g. Find the Jacobian J = ∂(u,v)/∂(x,y) where u = x² + y² and v = 2xy"
              value={form.question}
              onChange={e => setField("question", e.target.value)} />
          </div>

          <div className="form-group">
            <label><span className="label-icon">✅</span> Final Solution</label>
            <input
              placeholder="e.g.  J = 4x² − 4y²"
              value={form.solution}
              onChange={e => setField("solution", e.target.value)} />
            <span className="form-hint">Shown to students only after completion or when ∑ is clicked.</span>
          </div>

          <div className="steps-divider">
            <span>Steps</span>
            <span className="steps-divider-line"/>
            <button className="add-step-btn" onClick={addStep}>+ Add Step</button>
          </div>

          {form.steps.map((step, idx) => (
            <div key={idx} className="step-form-card">
              <div className="step-form-head">
                <span className="step-form-num">Step {idx + 1}</span>
                {form.steps.length > 1 && (
                  <button className="remove-step-btn" onClick={() => removeStep(idx)}>✕</button>
                )}
              </div>

              <div className="step-field">
                <label className="step-field-label"><span className="label-icon">∂</span> Expected Expression</label>
                <input
                  placeholder="e.g.  ∂u/∂x = 2x"
                  value={step.expression}
                  onChange={e => updateStep(idx, "expression", e.target.value)} />
                <span className="form-hint">Write as LHS = RHS. Students type only the RHS value.</span>
              </div>

              <div className="step-field">
                <label className="step-field-label"><span className="label-icon">💡</span> Hint</label>
                <input
                  placeholder="e.g.  Differentiate u = x² + y² with respect to x, treating y as constant."
                  value={step.hint}
                  onChange={e => updateStep(idx, "hint", e.target.value)} />
                <span className="form-hint">Guide the student without revealing the answer.</span>
              </div>
            </div>
          ))}

          {error && <div className="wrong-notice" style={{marginTop:4}}>{error}</div>}

          <button className="submit-btn save-btn" onClick={handleSave}>
            {saved ? "✓ Question Saved!" : "Save Question"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT PANEL
// ═══════════════════════════════════════════════════════════════════════════
function StudentPanel({ questions, onBack }) {
  const [qIndex, setQIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [answer, setAnswer] = useState("");
  const [totalScore, setTotalScore] = useState(0);
  const [stepScores, setStepScores] = useState([]);
  const [stepAnswers, setStepAnswers] = useState({}); // persisted typed answers per step index
  const [hintUsed, setHintUsed] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [feedback, setFeedback] = useState(null); // "correct" | "wrong" | null
  const [completed, setCompleted] = useState([]);
  const [finished, setFinished] = useState(false);
  const [finalRevealed, setFinalRevealed] = useState(false);
  const inputRef = useRef(null);

  const q = questions[qIndex];

  useEffect(() => {
    inputRef.current?.focus();
  }, [currentStep, qIndex]);

  const resetForQuestion = (idx) => {
    setQIndex(idx);
    setCurrentStep(0);
    setAnswer("");
    setTotalScore(0);
    setStepScores([]);
    setStepAnswers({});
    setHintUsed(false);
    setHintVisible(false);
    setFeedback(null);
    setCompleted([]);
    setFinished(false);
    setFinalRevealed(false);
  };

  const cycleQuestion = () => {
    const next = (qIndex + 1) % questions.length;
    resetForQuestion(next);
  };

  const showHint = () => {
    setHintUsed(true);
    setHintVisible(true);
  };

  const goToStep = (idx) => {
    if (feedback) return;
    if (idx === "final") {
      setFinalRevealed(true);
      setCurrentStep("final");
      setAnswer("");
      setHintUsed(false);
      setHintVisible(false);
      setFeedback(null);
      return;
    }
    setFinalRevealed(false);
    setCurrentStep(idx);
    setAnswer(stepAnswers[idx] ?? "");  // restore what they typed before
    setHintUsed(false);
    setHintVisible(false);
    setFeedback(null);
  };

  const revealFinalAnswer = () => {
    goToStep("final");
  };

  const submitAnswer = () => {
    if (!answer.trim() || currentStep === "final") return;
    const expected = q.steps[currentStep].expression;
    const isCorrect = answersMatch(answer, expected);

    playSound(isCorrect ? "correct" : "wrong");

    // Persist what the student typed for this step
    setStepAnswers((prev) => ({ ...prev, [currentStep]: answer }));

    const earned = isCorrect && !hintUsed ? q.steps[currentStep].marks : 0;
    const newScores = [...stepScores, earned];
    setStepScores(newScores);
    if (earned > 0) setTotalScore((s) => s + earned);
    if (isCorrect) setCompleted((c) => [...c, currentStep]);
    setFeedback(isCorrect ? "correct" : "wrong");

    const stepIdx = currentStep; // capture before async
    setTimeout(() => {
      setFeedback(null);
      setHintUsed(false);
      setHintVisible(false);
      const nextStep = stepIdx + 1;
      if (nextStep >= q.steps.length) {
        setFinished(true);
      } else {
        setCurrentStep(nextStep);
        // Correct → clear so next step feels fresh (restore if they visited it before)
        // Wrong   → keep current wrong answer visible, move step forward
        setAnswer(isCorrect ? "" : answer);
      }
    }, 1000);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") submitAnswer();
  };

  if (!q) {
    return (
      <div className="panel">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <p className="muted center">No questions available. Ask a teacher to add some.</p>
      </div>
    );
  }

  const totalPossible = q.steps.reduce((a, s) => a + s.marks, 0);

  // ── Finished screen ──
  if (finished) {
    return (
      <div className="panel student-panel">
        <div className="panel-header">
          <button className="back-btn" onClick={onBack}>← Back</button>
          <h2>Results</h2>
        </div>
        <div className="results-card">
          <div className="score-ring">
            <svg viewBox="0 0 100 100" width="120" height="120">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeDasharray={`${(totalScore / totalPossible) * 264} 264`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
              <text x="50" y="46" textAnchor="middle" fontSize="18" fill="var(--fg)" fontWeight="700">{totalScore}</text>
              <text x="50" y="60" textAnchor="middle" fontSize="10" fill="var(--muted)">/ {totalPossible}</text>
            </svg>
          </div>
          <h3>
            {totalScore === totalPossible
              ? "Perfect Score! 🎉"
              : totalScore >= totalPossible / 2
              ? "Good Work!"
              : "Keep Practising!"}
          </h3>

          <div className="step-review">
            <h4>Step-by-Step Review</h4>
            {q.steps.map((step, i) => (
              <div key={i} className={`review-row ${stepScores[i] > 0 ? "pass" : "hint-used"}`}>
                <span className="rev-step">Step {i + 1}</span>
                <span className="rev-expr">{step.expression}</span>
                <span className="rev-score">{stepScores[i] ?? 0}/{step.marks} mark</span>
              </div>
            ))}
          </div>

          <div className="solution-box">
            <h4>Full Solution</h4>
            <p>{q.solution}</p>
          </div>

          <div className="result-actions">
            <button className="submit-btn" onClick={() => resetForQuestion(qIndex)}>
              Retry Question
            </button>
            <button className="outline-btn" onClick={cycleQuestion}>
              Next Question
            </button>
          </div>
        </div>
      </div>
    );
  }

  const step = currentStep !== "final" ? q.steps[currentStep] : null;

  return (
    <div className="panel student-panel">
      <div className="panel-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2>Student Test</h2>
        <div className="score-chip">
          Score: <strong>{totalScore}</strong> / {totalPossible}
        </div>
      </div>

      {/* Question */}
      <div className="question-card">
        <div className="q-label">
          Question {qIndex + 1} of {questions.length}
        </div>
        <p className="q-text">{q.question}</p>

        {/* Jacobian matrix visual (decorative context) */}
        <div className="matrix-display">
          <span className="matrix-label">J =</span>
          <JacobianMatrix
            rows={[
              ["∂u/∂x", "∂u/∂y"],
              ["∂v/∂x", "∂v/∂y"],
            ]}
          />
        </div>

        <StepDots
          total={q.steps.length}
          current={currentStep}
          completed={completed}
          onSelect={goToStep}
          onReveal={revealFinalAnswer}
        />
      </div>

      {/* Final Answer Card */}
      {currentStep === "final" ? (
        <div className="step-card final-answer-card">
          <div className="step-tag final-tag">⚠ Final Answer Revealed · 0 marks awarded</div>
          <p className="step-prompt" style={{ color: "var(--muted)" }}>
            Here is the complete solution built from all steps:
          </p>

          <div className="final-steps-breakdown">
            {q.steps.map((s, i) => (
              <div key={i} className="final-step-row">
                <span className="final-step-num">Step {i + 1}</span>
                <span className="final-step-expr">{s.expression}</span>
                {stepScores[i] !== undefined && (
                  <span className={`final-step-score ${stepScores[i] > 0 ? "earned" : "zero"}`}>
                    {stepScores[i]}/{s.marks}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="solution-box" style={{ marginTop: 8 }}>
            <h4>Full Solution</h4>
            <p>{q.solution}</p>
          </div>

          <div className="step-actions" style={{ marginTop: 8 }}>
            <button className="submit-btn" onClick={() => resetForQuestion(qIndex)}>
              Retry Question
            </button>
            <button className="outline-btn" onClick={cycleQuestion}>
              ↻ Next Question
            </button>
          </div>
        </div>
      ) : (
      /* Step card */
      <div className={`step-card ${feedback ? `feedback-${feedback}` : ""}`}>
        <div className="step-tag">Step {currentStep + 1} · {step.marks} mark</div>

        {/* Background expression watermark */}
        <div className="step-expression-bg">
          <span className="step-expression-label">Evaluate this expression</span>
          <span className="step-expression-target">{step.expression.split("=")[0].trim()} = ?</span>
        </div>

        <p className="step-prompt">Type your answer below:</p>

        <div className="input-row">
          <input
            ref={inputRef}
            className="math-input"
            placeholder="Type your answer here…"
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setStepAnswers((prev) => ({ ...prev, [currentStep]: e.target.value }));
            }}
            onKeyDown={handleKey}
          />
          <button
            className={`submit-btn compact ${feedback === "correct" ? "correct" : feedback === "wrong" ? "wrong" : ""}`}
            onClick={submitAnswer}
          >
            {feedback === "correct" ? "✓" : feedback === "wrong" ? "✗" : "Submit"}
          </button>
        </div>

        {feedback === "wrong" && (
          <div className="wrong-notice">
            ✗ Incorrect — moving to next step. Your answer is kept above.
          </div>
        )}
        {feedback === "correct" && (
          <div className="correct-notice">
            ✓ Correct{hintUsed ? " (0 marks — hint was used)" : " — 1 mark earned!"}
          </div>
        )}

        {hintVisible && (
          <div className="hint-box">
            <span className="hint-label">💡 Hint</span>
            <p>{step.hint}</p>
          </div>
        )}

        <div className="step-actions">
          {!hintVisible && (
            <button className="hint-btn" onClick={showHint}>
              💡 Show Hint
            </button>
          )}
          <button
            className="outline-btn"
            onClick={() => goToStep(currentStep - 1)}
            disabled={currentStep === 0 || !!feedback}
          >
            ← Prev
          </button>
          <button
            className="outline-btn"
            onClick={() => goToStep(currentStep + 1)}
            disabled={currentStep >= q.steps.length - 1 || !!feedback}
          >
            Next →
          </button>
          <button className="outline-btn" onClick={cycleQuestion}>
            ↻ Change Question
          </button>
        </div>
      </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════
function Landing({ onStudent, onTeacher }) {
  return (
    <div className="landing">
      <div className="landing-inner">
        <div className="landing-icon">∂</div>
        <h1 className="landing-title">Jacobian Step-by-Step Evaluator</h1>
        <p className="landing-sub">
          An interactive portal for practising partial derivatives and Jacobian
          matrices — designed for PCCOE students.
        </p>

        <div className="landing-cards">
          <button className="mode-card student-card" onClick={onStudent}>
            <span className="mode-icon">📐</span>
            <strong>Student Test</strong>
            <p>Practice step-by-step Jacobian problems with hints and instant scoring.</p>
          </button>
          <button className="mode-card teacher-card" onClick={onTeacher}>
            <span className="mode-icon">📚</span>
            <strong>Teacher Question Bank</strong>
            <p>Add custom questions, expected steps, hints, and solutions.</p>
          </button>
        </div>

        {/* Mini matrix decoration */}
        <div className="deco-matrix">
          <JacobianMatrix
            rows={[
              ["∂u/∂x", "∂u/∂y"],
              ["∂v/∂x", "∂v/∂y"],
            ]}
          />
          <span className="deco-eq">= J</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [view, setView] = useState("landing"); // landing | student | teacher
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);

  const addQuestion = (q) => setQuestions((prev) => [...prev, q]);

  return (
    <>
      <style>{CSS}</style>
      <div className="app-shell">
        {/* ── Header ── */}
        <header className="app-header">
          <div className="header-logo">
            <div className="logo-placeholder">
              <span>PCCOE</span>
            </div>
          </div>
          <div className="header-title">
            <span className="header-sub">Pimpri-Chinchwad College of Engineering</span>
            <span className="header-main">Jacobian Step-by-Step Evaluator</span>
          </div>
          <div className="header-math">∂(u,v)/∂(x,y)</div>
        </header>

        {/* ── Main ── */}
        <main className="app-main">
          {view === "landing" && (
            <Landing
              onStudent={() => setView("student")}
              onTeacher={() => setView("teacher")}
            />
          )}
          {view === "student" && (
            <StudentPanel
              questions={questions}
              onBack={() => setView("landing")}
            />
          )}
          {view === "teacher" && (
            <TeacherPanel
              questions={questions}
              onSave={addQuestion}
              onBack={() => setView("landing")}
            />
          )}
        </main>

        {/* ── Footer ── */}
        <footer className="app-footer">
          <span>Guided by <strong>Sanjay Mapari</strong></span>
          <span className="footer-sep">·</span>
          <span>PCCOE Mathematics Portal</span>
          <span className="footer-sep">·</span>
          <span>Engineering Mathematics II</span>
        </footer>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════════════════
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0d1117;
    --surface:  #161b22;
    --surface2: #1c2330;
    --border:   #30363d;
    --accent:   #e6a817;
    --accent2:  #c47c0a;
    --green:    #3fb950;
    --red:      #f85149;
    --fg:       #e6edf3;
    --muted:    #8b949e;
    --student:  #1a7f64;
    --teacher:  #1f6feb;
    --radius:   10px;
    --shadow:   0 4px 24px rgba(0,0,0,0.5);
  }

  body {
    background: var(--bg);
    color: var(--fg);
    font-family: 'Source Serif 4', Georgia, serif;
    min-height: 100vh;
  }

  /* ── Shell ── */
  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(ellipse 80% 60% at 50% -20%, rgba(230,168,23,0.08) 0%, transparent 70%),
      var(--bg);
  }

  /* ── Header ── */
  .app-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 32px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
  }
  .logo-placeholder {
    width: 52px; height: 52px;
    border: 2px solid var(--accent);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Playfair Display', serif;
    font-size: 11px; font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.04em;
  }
  .header-title {
    flex: 1;
    display: flex; flex-direction: column;
  }
  .header-sub {
    font-size: 11px; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase;
  }
  .header-main {
    font-family: 'Playfair Display', serif;
    font-size: 18px; color: var(--fg);
  }
  .header-math {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px; color: var(--accent);
    opacity: 0.7;
  }

  /* ── Main ── */
  .app-main {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 32px 16px;
  }

  /* ── Footer ── */
  .app-footer {
    padding: 14px 32px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex; gap: 12px; align-items: center;
    font-size: 13px; color: var(--muted);
  }
  .footer-sep { color: var(--border); }
  .app-footer strong { color: var(--accent); }

  /* ── Landing ── */
  .landing {
    width: 100%; max-width: 780px;
  }
  .landing-inner {
    text-align: center;
    padding: 24px 0 40px;
  }
  .landing-icon {
    font-size: 72px;
    font-family: 'Playfair Display', serif;
    color: var(--accent);
    line-height: 1;
    margin-bottom: 16px;
    opacity: 0.9;
    text-shadow: 0 0 60px rgba(230,168,23,0.4);
    animation: pulse 3s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:.9} 50%{opacity:.6} }
  .landing-title {
    font-family: 'Playfair Display', serif;
    font-size: 30px; font-weight: 700;
    color: var(--fg);
    margin-bottom: 12px;
  }
  .landing-sub {
    color: var(--muted); font-size: 15px; max-width: 520px; margin: 0 auto 36px;
    line-height: 1.7;
  }
  .landing-cards {
    display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;
    margin-bottom: 40px;
  }
  .mode-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 28px 32px;
    width: 240px;
    text-align: left;
    cursor: pointer;
    transition: transform .2s, box-shadow .2s, border-color .2s;
    display: flex; flex-direction: column; gap: 8px;
    color: var(--fg);
  }
  .mode-card:hover { transform: translateY(-4px); box-shadow: var(--shadow); }
  .student-card:hover { border-color: var(--student); }
  .teacher-card:hover { border-color: var(--teacher); }
  .mode-icon { font-size: 28px; }
  .mode-card strong { font-family: 'Playfair Display', serif; font-size: 17px; }
  .mode-card p { color: var(--muted); font-size: 13px; line-height: 1.6; }

  .deco-matrix {
    display: inline-flex; align-items: center; gap: 12px;
    opacity: 0.25;
    font-size: 13px;
  }
  .deco-eq { font-family: 'JetBrains Mono', monospace; color: var(--accent); }

  /* ── Matrix ── */
  .matrix-wrapper {
    display: inline-flex; align-items: center; gap: 2px;
    vertical-align: middle;
  }
  .matrix-bracket {
    font-size: 22px; line-height: 1; color: var(--accent); opacity: 0.8;
    display: flex; flex-direction: column; align-items: center;
  }
  .matrix-body {
    display: flex; flex-direction: column; gap: 4px;
    padding: 0 6px;
  }
  .matrix-row { display: flex; gap: 18px; }
  .matrix-cell {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; color: var(--accent);
    min-width: 48px; text-align: center;
  }
  .matrix-display {
    display: flex; align-items: center; gap: 10px;
    justify-content: center;
    padding: 12px 0 8px;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin: 12px 0;
  }
  .matrix-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px; color: var(--muted);
  }

  /* ── Panel shared ── */
  .panel {
    width: 100%; max-width: 860px;
  }
  .panel-header {
    display: flex; align-items: center; gap: 14px;
    margin-bottom: 24px;
  }
  .panel-header h2 {
    font-family: 'Playfair Display', serif;
    font-size: 22px; flex: 1;
  }
  .badge {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3px 12px;
    font-size: 12px; color: var(--muted);
  }
  .back-btn {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--muted);
    padding: 7px 14px;
    cursor: pointer;
    font-family: inherit; font-size: 13px;
    transition: color .15s, border-color .15s;
  }
  .back-btn:hover { color: var(--fg); border-color: var(--accent); }

  /* ── Teacher panel ── */
  .teacher-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 24px;
  }
  @media (max-width: 700px) { .teacher-grid { grid-template-columns: 1fr; } }

  .existing-list h3, .add-form h3 {
    font-family: 'Playfair Display', serif;
    font-size: 15px; margin-bottom: 14px; color: var(--muted);
  }
  .q-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 10px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .q-num { font-size: 11px; color: var(--accent); font-family: 'JetBrains Mono', monospace; }
  .q-card p { font-size: 13px; line-height: 1.5; color: var(--fg); }
  .step-count { font-size: 11px; color: var(--muted); }

  .add-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .add-form label {
    font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em;
    color: var(--muted); margin-top: 4px;
  }
  .add-form textarea, .add-form input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--fg);
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    padding: 9px 12px;
    width: 100%; resize: vertical;
    outline: none;
    transition: border-color .2s;
  }
  .add-form textarea:focus, .add-form input:focus { border-color: var(--accent); }

  .steps-header { display: flex; align-items: center; justify-content: space-between; }
  .add-step-btn {
    background: transparent;
    border: 1px solid var(--teacher);
    border-radius: 6px;
    color: #58a6ff;
    padding: 5px 12px; font-size: 12px;
    cursor: pointer;
    transition: background .15s;
  }
  .add-step-btn:hover { background: rgba(31,111,235,0.15); }

 

  

  .step-form-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }

  .step-form-head { display: flex; justify-content: space-between; align-items: center; }

  .step-form-num { font-family: 'Playfair Display', serif; font-size: 13px; color: var(--accent); font-weight: 600; }
  .remove-step-btn { background: none; border: 1px solid var(--border); border-radius: 5px; color: var(--red); cursor: pointer; font-size: 12px; padding: 2px 7px; transition: background .15s; }
  .remove-step-btn:hover { background: rgba(248,81,73,0.1); }
  .step-field { display: flex; flex-direction: column; gap: 5px; }
  .step-field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); display: flex; align-items: center; gap: 5px; }
  .label-icon { font-style: normal; }
  .form-hint { font-size: 11px; color: var(--muted); line-height: 1.5; font-style: italic; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .steps-divider { display: flex; align-items: center; gap: 10px; margin: 4px 0; }
  .steps-divider span:first-child { font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); white-space: nowrap; }
  .steps-divider-line { flex: 1; height: 1px; background: var(--border); }
  .add-step-btn { background: transparent; border: 1px solid #1f6feb; border-radius: 6px; color: #58a6ff; padding: 5px 12px; font-size: 12px; cursor: pointer; transition: background .15s; white-space: nowrap; }
  .add-step-btn:hover { background: rgba(31,111,235,0.15); }
  .save-btn { align-self: stretch; text-align: center; margin-top: 4px; }

  
  .remove-btn {
    background: none; border: none; color: var(--red); cursor: pointer; font-size: 14px;
  }

  /* ── Buttons shared ── */
  .submit-btn {
    background: var(--accent);
    border: none; border-radius: 8px;
    color: #000; font-weight: 700;
    font-family: inherit; font-size: 14px;
    padding: 11px 24px; cursor: pointer;
    transition: background .15s, transform .1s;
    align-self: flex-start;
  }
  .submit-btn:hover { background: var(--accent2); }
  .submit-btn:active { transform: scale(0.97); }
  .submit-btn.compact { padding: 11px 18px; align-self: auto; white-space: nowrap; }
  .submit-btn.correct { background: var(--green); }
  .submit-btn.wrong   { background: var(--red);   }

  .outline-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px; color: var(--muted);
    font-family: inherit; font-size: 13px;
    padding: 9px 18px; cursor: pointer;
    transition: border-color .15s, color .15s;
  }
  .outline-btn:hover { border-color: var(--fg); color: var(--fg); }
  .outline-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .outline-btn:disabled:hover { border-color: var(--border); color: var(--muted); }

  .hint-btn {
    background: transparent;
    border: 1px solid #e6a81755;
    border-radius: 8px; color: var(--accent);
    font-family: inherit; font-size: 13px;
    padding: 9px 18px; cursor: pointer;
    transition: background .15s;
  }
  .hint-btn:hover { background: rgba(230,168,23,0.1); }

  /* ── Student panel ── */
  .score-chip {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 5px 16px;
    font-size: 13px; color: var(--muted);
  }
  .score-chip strong { color: var(--accent); }

  .question-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 22px 26px;
    margin-bottom: 18px;
  }
  .q-label {
    font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px;
  }
  .q-text {
    font-size: 16px; line-height: 1.7; color: var(--fg);
    font-family: 'Source Serif 4', serif;
  }

  .step-dots {
    display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;
  }
  .step-dot {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600;
    transition: all .3s;
  }
  .step-dot.final-dot {
    background: var(--surface2);
    border: 1px dashed var(--accent);
    color: var(--accent);
    font-size: 15px;
    font-family: 'Playfair Display', serif;
  }
  .step-dot.final-dot.active { background: var(--accent); color: #000; }

  .final-answer-card {
    border-color: var(--accent) !important;
    box-shadow: 0 0 24px rgba(230,168,23,0.15);
  }
  .final-tag { color: var(--accent) !important; }

  .final-steps-breakdown {
    display: flex; flex-direction: column; gap: 6px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
  }
  .final-step-row {
    display: flex; align-items: center; gap: 12px;
    font-size: 13px; padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }
  .final-step-row:last-child { border-bottom: none; }
  .final-step-num { color: var(--muted); min-width: 52px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
  .final-step-expr { flex: 1; font-family: 'JetBrains Mono', monospace; color: var(--fg); }
  .final-step-score { font-size: 12px; font-family: 'JetBrains Mono', monospace; }
  .final-step-score.earned { color: var(--green); }
  .final-step-score.zero   { color: var(--red);   }
  .step-dot.done    { background: var(--green); color: #fff; }
  .step-dot.pending { background: var(--surface2); border: 1px solid var(--border); color: var(--muted); }

  .step-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 22px 26px;
    transition: border-color .2s, box-shadow .2s;
    display: flex; flex-direction: column; gap: 14px;
  }
  .step-card.feedback-correct { border-color: var(--green); box-shadow: 0 0 20px rgba(63,185,80,0.2); }
  .step-card.feedback-wrong   { border-color: var(--red);   box-shadow: 0 0 20px rgba(248,81,73,0.2); }

  .step-tag {
    font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--accent);
  }
  .step-prompt { color: var(--muted); font-size: 14px; }

  .step-expression-bg {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(230,168,23,0.05) 0%, rgba(230,168,23,0.01) 100%);
    border: 1px dashed rgba(230,168,23,0.22);
    border-radius: 10px;
    padding: 20px 16px 16px;
    text-align: center;
  }
  .step-expression-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .step-expression-target {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    color: rgba(230,168,23,0.45);
    letter-spacing: 0.04em;
    font-weight: 500;
    line-height: 1.2;
  }
  .step-expression-hint-text {
    font-size: 12px;
    color: var(--muted);
    margin-top: 6px;
  }
  .step-expression-hint-text code {
    font-family: 'JetBrains Mono', monospace;
    background: rgba(230,168,23,0.1);
    border-radius: 4px;
    padding: 1px 6px;
    color: var(--accent);
  }

  .wrong-notice {
    background: rgba(248,81,73,0.10);
    border: 1px solid rgba(248,81,73,0.30);
    border-radius: 7px;
    padding: 9px 14px;
    font-size: 13px; color: var(--red);
  }
  .correct-notice {
    background: rgba(63,185,80,0.10);
    border: 1px solid rgba(63,185,80,0.30);
    border-radius: 7px;
    padding: 9px 14px;
    font-size: 13px; color: var(--green);
  }

  .input-row { display: flex; gap: 10px; align-items: stretch; }
  .math-input {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--fg);
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
    padding: 11px 14px;
    outline: none;
    transition: border-color .2s;
  }
  .math-input:focus { border-color: var(--accent); }

  .hint-warning {
    background: rgba(248,81,73,0.1);
    border: 1px solid rgba(248,81,73,0.3);
    border-radius: 7px;
    padding: 9px 14px;
    font-size: 13px; color: var(--red);
  }
  .hint-box {
    background: rgba(230,168,23,0.07);
    border: 1px solid rgba(230,168,23,0.25);
    border-radius: 8px;
    padding: 14px 16px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .hint-label { font-size: 12px; font-weight: 600; color: var(--accent); }
  .hint-box p { font-size: 14px; line-height: 1.6; color: var(--fg); }

  .step-actions { display: flex; gap: 10px; flex-wrap: wrap; }

  /* ── Results ── */
  .results-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 32px;
    display: flex; flex-direction: column; align-items: center; gap: 20px;
    max-width: 640px; margin: 0 auto;
  }
  .score-ring { margin-bottom: 4px; }
  .results-card h3 {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
  }
  .step-review {
    width: 100%;
  }
  .step-review h4, .solution-box h4 {
    font-size: 13px; text-transform: uppercase;
    letter-spacing: 0.07em; color: var(--muted);
    margin-bottom: 10px;
  }
  .review-row {
    display: flex; align-items: center; gap: 12px;
    padding: 9px 12px; border-radius: 7px;
    margin-bottom: 6px; font-size: 13px;
  }
  .review-row.pass      { background: rgba(63,185,80,0.08); }
  .review-row.hint-used { background: rgba(248,81,73,0.08); }
  .rev-step  { font-size: 11px; color: var(--muted); min-width: 48px; }
  .rev-expr  { flex: 1; font-family: 'JetBrains Mono', monospace; }
  .rev-score { font-size: 12px; color: var(--muted); }

  .solution-box {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }
  .solution-box p {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px; color: var(--fg); line-height: 1.7;
  }
  .result-actions { display: flex; gap: 12px; }

  .muted { color: var(--muted); font-size: 14px; }
  .center { text-align: center; padding: 40px; }
`;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />); // Replace 'App' with the name of your main function