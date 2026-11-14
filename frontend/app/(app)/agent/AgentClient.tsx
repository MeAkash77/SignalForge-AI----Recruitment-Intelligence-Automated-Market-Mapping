
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Terminal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/auth";
import { ByokModal } from "@/components/ByokModal";

type LogStatus = "pending" | "active" | "done" | "error";

type AgentLog = {
  text: string;
  status: LogStatus;
};

export default function AgentPage() {
  const router = useRouter();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);

  const [showByok, setShowByok] = useState(false);
  const [hasCheckedByok, setHasCheckedByok] = useState(false);
  const [byokLoading, setByokLoading] = useState(false);

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

  const logsEndRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the progress animation timer.
  const clearProgressTimer = () => {
    if (animationRef.current) {
      clearTimeout(animationRef.current);
      animationRef.current = null;
    }
  };

  // Scroll logs to the latest entry.
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Clean up timer when the component unmounts.
  useEffect(() => {
    return () => {
      clearProgressTimer();
    };
  }, []);

  // Check BYOK status on mount.
  useEffect(() => {
    let cancelled = false;

    const checkByokStatus = async () => {
      if (localStorage.getItem("hasGeminiKey") === "true") {
        if (!cancelled) {
          setHasCheckedByok(true);
        }
        return;
      }

      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const res = await fetch(
          `${API_URL}/api/user/gemini-key/status`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!cancelled && res.ok) {
          const data = await res.json();

          if (!data.hasKey) {
            setShowByok(true);
          } else {
            localStorage.setItem("hasGeminiKey", "true");
          }
        }
      } catch (err) {
        console.error("BYOK check failed:", err);
      } finally {
        if (!cancelled) {
          setHasCheckedByok(true);
        }
      }
    };

    checkByokStatus();

    return () => {
      cancelled = true;
    };
  }, [API_URL]);

  // Clear BYOK key on window close.
  useEffect(() => {
    const handleUnload = () => {
      const token = localStorage.getItem("access_token");

      if (token) {
        fetch(`${API_URL}/api/user/gemini-key`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          keepalive: true,
        }).catch(() => {});
      }

      localStorage.removeItem("hasGeminiKey");
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [API_URL]);

  // Update the active log safely.
  const updateActiveLog = (status: LogStatus) => {
    setLogs((prev) => {
      const activeIndex = prev.findIndex(
        (log) => log.status === "active"
      );

      if (activeIndex === -1) {
        return prev;
      }

      return prev.map((log, index) =>
        index === activeIndex
          ? { ...log, status }
          : log
      );
    });
  };

  // Add an error message to the logs.
  const addErrorLog = (message: string) => {
    setLogs((prev) => [
      ...prev.map((log) =>
        log.status === "active"
          ? { ...log, status: "error" as const }
          : log
      ),
      {
        text: message,
        status: "error",
      },
    ]);
  };

  const startResearch = async () => {
    const query = input.trim();

    if (!query || loading) return;

    clearProgressTimer();
    setLoading(true);

    const initialSteps: AgentLog[] = [
      {
        text: "Initializing Market Intelligence Engine...",
        status: "done",
      },
      {
        text: `Intercepting query: "${query.toUpperCase()}"`,
        status: "done",
      },
      {
        text: "Resolving natural language query to official ticker symbol...",
        status: "active",
      },
      {
        text: "Establishing secure connection to global market data feeds...",
        status: "pending",
      },
      {
        text: "Analyzing 90-day historical price action and volume...",
        status: "pending",
      },
      {
        text: "Scraping real-time market news and sentiment...",
        status: "pending",
      },
      {
        text: "Synthesizing executive briefing via generative AI...",
        status: "pending",
      },
      {
        text: "Finalizing report formatting...",
        status: "pending",
      },
    ];

    setLogs(initialSteps);

    // Simulate progress while the API is processing.
    let currentStepIndex = 2;

    const progressLogs = () => {
      if (currentStepIndex >= initialSteps.length) {
        return;
      }

      setLogs((prev) => {
        return prev.map((log, index) => {
          if (index === currentStepIndex - 1) {
            return { ...log, status: "done" };
          }

          if (index === currentStepIndex) {
            return { ...log, status: "active" };
          }

          return log;
        });
      });

      currentStepIndex++;

      const nextDelay = Math.floor(Math.random() * 1500) + 800;

      animationRef.current = setTimeout(
        progressLogs,
        nextDelay
      );
    };

    animationRef.current = setTimeout(progressLogs, 1200);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Authentication failed. Please log in again.");
      }

      const res = await fetch(`${API_URL}/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });

      clearProgressTimer();

      // Gemini API key is missing or invalid.
      if (res.status === 428) {
        localStorage.removeItem("hasGeminiKey");
        setShowByok(true);

        addErrorLog(
          "⚠️ Bring Your Own Key (BYOK) Required or Invalid."
        );

        setLoading(false);
        return;
      }

      // Daily usage limit reached.
      if (res.status === 429) {
        addErrorLog(
          "🛑 Daily Limit Exceeded: You have reached your 3 Agent generations per day."
        );

        setLoading(false);
        return;
      }

      // Invalid query or company not identified.
      if (res.status === 400) {
        let errorMessage =
          "Could not identify a publicly traded company.";

        try {
          const errorData = await res.json();

          errorMessage =
            typeof errorData.detail === "string"
              ? errorData.detail
              : errorMessage;
        } catch {
          // Keep the default error message.
        }

        addErrorLog(`❌ Error: ${errorMessage}`);

        setLoading(false);
        return;
      }

      // Successful analysis.
      if (res.ok) {
        const data = await res.json();

        setLogs((prev) => [
          ...prev.map((log) => ({
            ...log,
            status:
              log.status === "error"
                ? ("error" as const)
                : ("done" as const),
          })),
          {
            text: "✨ Report Synthesized successfully! Redirecting...",
            status: "done",
          },
        ]);

        setTimeout(() => {
          router.push(`/reports/${data.id}`);
        }, 800);

        return;
      }

      // Other API errors.
      let serverMessage = "Analysis failed.";

      try {
        const errorData = await res.json();

        if (typeof errorData.detail === "string") {
          serverMessage = errorData.detail;
        }
      } catch {
        // Keep the default message.
      }

      addErrorLog(`❌ Error: ${serverMessage}`);
      setLoading(false);
    } catch (error) {
      clearProgressTimer();

      console.error("Agent research failed:", error);

      const message =
        error instanceof Error
          ? error.message
          : "Connection failed.";

      addErrorLog(`❌ Error: ${message}`);
      setLoading(false);
    }
  };

  // Save the user's Gemini API key.
  const handleByokSubmit = async (key: string) => {
    setByokLoading(true);

    try {
      const token = await getToken();

      if (!token) {
        alert("Authentication failed. Please log in again.");
        return;
      }

      const res = await fetch(
        `${API_URL}/api/user/gemini-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            api_key: key,
          }),
        }
      );

      if (res.ok) {
        localStorage.setItem("hasGeminiKey", "true");
        setShowByok(false);
      } else {
        alert("Failed to save key. Please try again.");
      }
    } catch (error) {
      console.error("BYOK submission failed:", error);
      alert("Network error saving key.");
    } finally {
      setByokLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* INPUT AREA */}
      {!loading && (
        <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-8 text-center animate-fade-in">
          <div className="space-y-4">
            <div className="h-16 w-16 mx-auto bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-700 shadow-xl">
              <Terminal className="h-8 w-8 text-emerald-400" />
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-white">
              Market Intelligence Agent
            </h1>

            <p className="text-zinc-400 max-w-lg mx-auto text-lg">
              Enter a stock ticker (e.g., AAPL, TSLA, NVDA).
              The agent will autonomously gather data, analyze
              sentiment, and generate a briefing.
            </p>
          </div>

          {hasCheckedByok && !showByok ? (
            <div className="flex w-full max-w-md items-center space-x-2 animate-slide-up">
              <Input
                placeholder="e.g. AAPL, TSLA..."
                className="h-14 text-lg bg-zinc-900 border-zinc-700 focus-visible:ring-emerald-500/50"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    startResearch();
                  }
                }}
              />

              <Button
                size="lg"
                className="h-14 px-8 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-lg"
                onClick={startResearch}
                disabled={!input.trim()}
              >
                <ArrowRight className="h-6 w-6" />
              </Button>
            </div>
          ) : (
            <div className="flex w-full max-w-md flex-col items-center justify-center p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
              <div className="h-10 w-10 bg-zinc-950 rounded-full flex items-center justify-center border border-zinc-800">
                <span className="text-zinc-500 text-xl">🔒</span>
              </div>

              <p className="text-zinc-400 font-medium">
                Authentication Required
              </p>

              <p className="text-sm text-zinc-500 text-center">
                Please provide your Gemini API Key in the popup
                to unlock the intelligence engine.
              </p>
            </div>
          )}
        </div>
      )}

      {/* LOADING / LOG AREA */}
      {loading && (
        <div className="max-w-2xl mx-auto mt-20">
          <div className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden shadow-2xl font-mono text-sm">
            <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
              </div>

              <span className="text-zinc-500 ml-2">
                agent_process.exe
              </span>
            </div>

            <div className="p-6 space-y-3 h-64 overflow-y-auto">
              {logs
                .filter((log) => log.status !== "pending")
                .map((log, index) => (
                  <div
                    key={index}
                    className="flex gap-3 text-zinc-300 transition-all duration-300 ease-in-out"
                  >
                    <span className="text-zinc-600 select-none">
                      {">"}
                    </span>

                    <span
                      className={`flex-1 ${
                        log.status === "error"
                          ? "text-red-400 font-semibold"
                          : log.status === "active"
                            ? "text-emerald-400"
                            : "text-emerald-500/60"
                      }`}
                    >
                      {log.text}

                      {log.status === "active" && (
                        <span className="ml-0.5 inline-block w-2.5 h-4 bg-emerald-400 animate-pulse relative top-0.5" />
                      )}
                    </span>
                  </div>
                ))}

              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      <ByokModal
        isOpen={showByok}
        loading={byokLoading}
        onSubmit={handleByokSubmit}
      />
    </div>
  );
}
