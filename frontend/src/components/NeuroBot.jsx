/**
 * NeuroBot — NeuroAid's assistive AI chatbot
 * Floating widget, available on every page after login.
 * Uses the RAG /api/chat endpoint for educational answers.
 * Falls back to built-in responses if the backend is unavailable.
 */
import { useState, useRef, useEffect } from "react";
import { T } from "../utils/theme";
import { submitChat } from "../services/api";

// ── Built-in fallback answers (no backend needed) ────────────────────────────
const FALLBACKS = [
  {
    triggers: ["memory", "recall", "forget", "remember"],
    answer:
      "Memory scores reflect how accurately and quickly you recalled words or patterns during the test. Scores naturally vary day-to-day based on sleep, stress, and hydration. A single low score is rarely meaningful — trends over multiple sessions matter most.",
  },
  {
    triggers: ["reaction", "speed", "slow", "fast", "click"],
    answer:
      "Reaction time measures how quickly your brain processes a visual signal and sends a response. Normal web-based reaction times range from 250–700ms. Older adults naturally have slower baseline RTs — the scoring adjusts for age. Caffeine, fatigue, and distraction all affect this score.",
  },
  {
    triggers: ["stroop", "executive", "color", "interference"],
    answer:
      "The Stroop test measures executive function — your brain's ability to suppress an automatic response (reading the word) in favour of a controlled one (naming the ink color). It's sensitive to attention and cognitive flexibility. First-time takers often score lower as the task is unfamiliar.",
  },
  {
    triggers: ["tap", "motor", "rhythm", "tapping"],
    answer:
      "The tapping test measures rhythmic motor consistency. High variability in tap intervals can reflect hand fatigue, distraction, or in some cases motor timing changes. Parkinson's research shows that rhythm irregularity is an early motor signal worth monitoring.",
  },
  {
    triggers: ["speech", "wpm", "pause", "fluency", "word"],
    answer:
      "Speech analysis tracks your words per minute, pause frequency, and rhythm variability. Word-finding pauses and reduced speech speed can be early indicators of cognitive load. However, accent, language background, and reading speed all significantly affect this score.",
  },
  {
    triggers: ["alzheimer", "dementia", "diagnosis", "disease", "diagnose"],
    answer:
      "NeuroBot cannot provide a diagnosis. NeuroAid identifies cognitive performance indicators only — it is not a clinical diagnostic tool. For any concerns about Alzheimer's or dementia, please consult a qualified neurologist. The Alzheimer's Association helpline is available at 1-800-272-3900.",
  },
  {
    triggers: ["medicine", "medication", "drug", "pill", "treat", "cure"],
    answer:
      "NeuroBot cannot recommend medications or treatments. Only a licensed physician or neurologist can advise on medical treatment after a proper clinical evaluation.",
  },
  {
    triggers: ["score", "result", "number", "mean", "what does"],
    answer:
      "Scores range from 0–100 where higher is healthier. Tiers: 70–100 = Healthy Range, 50–69 = Within Normal Variation, 0–49 = Worth Monitoring. Individual scores fluctuate — focus on trends across multiple assessments rather than a single session.",
  },
  {
    triggers: ["retake", "often", "frequency", "when", "again"],
    answer:
      "We recommend retaking the full assessment monthly for the most meaningful trend data. Avoid testing immediately after poor sleep or illness — those conditions temporarily lower scores and don't reflect your true baseline.",
  },
  {
    triggers: ["hi", "hello", "hey", "help", "start", "what can"],
    answer:
      "Hi! I'm NeuroBot 🧠, NeuroAid's cognitive wellness guide. I can explain your test scores, describe what each cognitive domain measures, or answer questions about brain health. Just ask — for example: \"What does my reaction score mean?\" or \"Why is memory important?\"",
  },
];

function getFallback(question) {
  const q = question.toLowerCase();
  for (const f of FALLBACKS) {
    if (f.triggers.some(t => q.includes(t))) return f.answer;
  }
  return (
    "That's a great question! For the most accurate answer, make sure your backend is running so I can access the full knowledge base. In the meantime, feel free to ask about your specific test scores, what each domain measures, or general brain health tips."
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isBot = msg.role === "bot";
  return (
    <div style={{
      display: "flex",
      justifyContent: isBot ? "flex-start" : "flex-end",
      marginBottom: 12,
      gap: 8,
      alignItems: "flex-end",
    }}>
      {isBot && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "linear-gradient(135deg, #e84040, #a78bfa)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>🧠</div>
      )}
      <div style={{
        maxWidth: "78%",
        padding: "10px 14px",
        borderRadius: isBot ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
        background: isBot ? "#1e1e1e" : "linear-gradient(135deg, #e84040cc, #a78bfacc)",
        border: isBot ? "1px solid rgba(255,255,255,0.07)" : "none",
        color: "#f0ece3",
        fontSize: 13,
        lineHeight: 1.65,
        wordBreak: "break-word",
      }}>
        {msg.text}
        {msg.sources?.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: 10, color: "rgba(240,236,227,0.4)" }}>
            📚 Sources: {msg.sources.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #e84040, #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🧠</div>
      <div style={{ padding: "10px 16px", background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "4px 16px 16px 16px", display: "flex", gap: 4, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: "rgba(240,236,227,0.4)",
            animation: "blink 1.2s ease infinite",
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Quick suggestion chips ────────────────────────────────────────────────────
const SUGGESTIONS = [
  "What does my memory score mean?",
  "Explain the Stroop test",
  "How often should I retest?",
  "Why did I get a low reaction score?",
];

// ── Main NeuroBot component ───────────────────────────────────────────────────
export default function NeuroBot({ user }) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi! I'm NeuroBot 🧠 — your cognitive wellness guide. Ask me anything about your scores, the tests, or brain health in general.",
      sources: [],
    },
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function sendMessage(text) {
    const question = (text || input).trim();
    if (!question) return;

    setInput("");
    setMessages(m => [...m, { role: "user", text: question }]);
    setLoading(true);

    try {
      const res = await submitChat(question, { user_name: user?.name });
      setMessages(m => [...m, {
        role: "bot",
        text: res.answer,
        sources: res.sources || [],
      }]);
    } catch {
      // Backend unavailable — use built-in fallback
      setMessages(m => [...m, {
        role: "bot",
        text: getFallback(question),
        sources: [],
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function toggleOpen() {
    setOpen(o => !o);
    setHasNew(false);
  }

  return (
    <>
      {/* ── Floating chat window ── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 96, right: 24, zIndex: 1000,
          width: 360, height: 520,
          background: "#0f0f0f",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(232,64,64,0.1)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          animation: "slideUp 0.2s ease",
        }}>

          {/* Header */}
          <div style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, rgba(232,64,64,0.15), rgba(167,139,250,0.1))",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #e84040, #a78bfa)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
                boxShadow: "0 0 16px rgba(232,64,64,0.4)",
              }}>🧠</div>
              <div>
                <div style={{ fontWeight: 700, color: "#f0ece3", fontSize: 14 }}>NeuroBot</div>
                <div style={{ fontSize: 11, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "blink 2s ease infinite" }} />
                  Online · Educational assistant
                </div>
              </div>
            </div>
            <button
              onClick={toggleOpen}
              style={{ background: "none", border: "none", color: "rgba(240,236,227,0.4)", cursor: "pointer", fontSize: 20, lineHeight: 1 }}
            >×</button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "16px 14px",
            display: "flex", flexDirection: "column",
          }}>
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions (only show at start) */}
          {messages.length <= 1 && !loading && (
            <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: "5px 12px", borderRadius: 20,
                    border: "1px solid rgba(232,64,64,0.3)",
                    background: "rgba(232,64,64,0.06)",
                    color: "rgba(240,236,227,0.7)", fontSize: 11,
                    cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(232,64,64,0.15)"; e.currentTarget.style.color = "#f0ece3"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(232,64,64,0.06)"; e.currentTarget.style.color = "rgba(240,236,227,0.7)"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Disclaimer strip */}
          <div style={{
            padding: "6px 14px",
            background: "rgba(245,158,11,0.06)",
            borderTop: "1px solid rgba(245,158,11,0.1)",
            fontSize: 10, color: "rgba(240,236,227,0.3)", lineHeight: 1.5,
            flexShrink: 0,
          }}>
            ⚠️ Educational only — not a diagnosis. Always consult a neurologist for medical decisions.
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            display: "flex", gap: 8, flexShrink: 0,
            background: "#0f0f0f",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask NeuroBot anything…"
              disabled={loading}
              style={{
                flex: 1, padding: "10px 14px",
                borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
                background: "#1a1a1a", color: "#f0ece3", fontSize: 13,
                fontFamily: "'DM Sans',sans-serif", outline: "none",
                opacity: loading ? 0.6 : 1,
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: input.trim() && !loading
                  ? "linear-gradient(135deg, #e84040, #a78bfa)"
                  : "rgba(255,255,255,0.06)",
                border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                color: "#fff", fontSize: 16, display: "flex",
                alignItems: "center", justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              {loading ? "⏳" : "↑"}
            </button>
          </div>
        </div>
      )}

      {/* ── FAB toggle button ── */}
      <button
        onClick={toggleOpen}
        style={{
          position: "fixed", bottom: 28, right: 24, zIndex: 1001,
          width: 56, height: 56, borderRadius: "50%",
          background: open
            ? "rgba(255,255,255,0.1)"
            : "linear-gradient(135deg, #e84040, #a78bfa)",
          border: open ? "1px solid rgba(255,255,255,0.15)" : "none",
          cursor: "pointer",
          boxShadow: open ? "none" : "0 8px 32px rgba(232,64,64,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, transition: "all 0.25s",
          color: "#fff",
        }}
        title="NeuroBot — cognitive wellness assistant"
      >
        {open ? "×" : "🧠"}
        {hasNew && !open && (
          <div style={{
            position: "absolute", top: 4, right: 4,
            width: 10, height: 10, borderRadius: "50%",
            background: "#4ade80", border: "2px solid #0a0a0a",
          }} />
        )}
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </>
  );
}