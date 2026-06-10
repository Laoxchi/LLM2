import React, { useState, useEffect } from "react";
import PlaygroundView from "./components/PlaygroundView";
import ChatView from "./components/ChatView";
import VisionView from "./components/VisionView";
import { RequestLog } from "./types";
import { Cpu, Layers, MessageSquare, Eye, Terminal, Key, ShieldCheck, HelpCircle, Activity, Info, Trash2, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"playground" | "chat" | "vision" | "logs">("playground");
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean>(true);
  const [checkedHandshake, setCheckedHandshake] = useState<boolean>(false);
  const [latencyHistory, setLatencyHistory] = useState<number[]>([]);

  // Handshake with backend config
  useEffect(() => {
    async function fetchHandshake() {
      try {
        const res = await fetch("/api/config");
        const data = await res.json();
        setApiKeyConfigured(data.apiKeyConfigured);
      } catch (e) {
        console.error("Config fetch failure, default state fallback active.", e);
        setApiKeyConfigured(false);
      } finally {
        setCheckedHandshake(true);
      }
    }
    fetchHandshake();
  }, []);

  const handleLogRequest = (log: RequestLog) => {
    setLogs((prev) => [log, ...prev]);
    if (log.success && log.duration) {
      setLatencyHistory((prev) => [...prev, log.duration].slice(-10));
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setLatencyHistory([]);
  };

  // Math metrics
  const avgLatency = latencyHistory.length > 0 
    ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) 
    : 0;

  const successRate = logs.length > 0
    ? Math.round((logs.filter(l => l.success).length / logs.length) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col text-gray-800 font-sans selection:bg-blue-100 antialiased">
      
      {/* Upper Status strip if API Key is missing */}
      {checkedHandshake && !apiKeyConfigured && (
        <div className="bg-gradient-to-r from-amber-550 to-orange-600 bg-amber-650 text-white text-xs py-2 px-4 flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2 mx-auto text-center font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
            <span>
              <strong>Attention Needed:</strong> GEMINI_API_KEY environment variable is currently not configured. Open <strong>Secrets Manager</strong> in AI Studio UI to save your Gemini credential.
            </span>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-gray-200 bg-white shadow-xs sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Logo & Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-gray-900 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent">
                  Gemini LLM Studio
                </h1>
                <span className="text-[10px] uppercase tracking-wider bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-100">
                  Built-in Sandbox
                </span>
              </div>
              <p className="text-xs text-gray-550 font-medium">
                High-fidelity pipeline testbed & multi-turn preview arena
              </p>
            </div>
          </div>

          {/* Quick Metrics & Handshake details */}
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs font-semibold">
            {/* Quick API Key indicator */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border ${apiKeyConfigured ? "bg-emerald-50 text-emerald-700 border-emerald-150" : "bg-amber-50 text-amber-700 border-amber-150"}`}>
              <Key className="w-3.5 h-3.5" />
              <span>{apiKeyConfigured ? "API Key Connected" : "Local Mock Simulation"}</span>
            </div>

            {/* Quick latency metric */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-gray-50 border-gray-200 text-gray-700">
              <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
              <span>Avg Latency: <span className="font-mono">{avgLatency ? `${avgLatency}ms` : "N/A"}</span></span>
            </div>

            {/* Stats count badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-gray-50 border-gray-200 text-gray-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Success Rate: <span className="font-mono">{successRate}%</span></span>
            </div>
          </div>

        </div>
      </header>

      {/* Primary Subnavigation Shell */}
      <div className="bg-white border-b border-gray-200/80 shadow-xs sticky top-[73px] md:top-[73px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto gap-1 py-2 scrollbar-none">
            <button
              onClick={() => setActiveTab("playground")}
              className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeTab === "playground" ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:bg-gray-100/80"}`}
            >
              <Layers className="w-4 h-4" />
              Playground & Schema Extractor
            </button>

            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeTab === "chat" ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:bg-gray-100/80"}`}
            >
              <MessageSquare className="w-4 h-4" />
              Multi-Turn Conversation Arena
            </button>

            <button
              onClick={() => setActiveTab("vision")}
              className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeTab === "vision" ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:bg-gray-100/80"}`}
            >
              <Eye className="w-4 h-4" />
              Heuristic Vision Audit
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer relative ${activeTab === "logs" ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:bg-gray-100/80"}`}
            >
              <Terminal className="w-4 h-4" />
              Console Logs
              {logs.length > 0 && (
                <span className="bg-red-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.2 rounded-full absolute -top-1 -right-1">
                  {logs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Dynamic Inner view */}
        <div className="transition-all duration-200">
          {activeTab === "playground" && (
            <PlaygroundView 
              onLogRequest={handleLogRequest} 
              apiKeyConfigured={apiKeyConfigured} 
            />
          )}

          {activeTab === "chat" && (
            <ChatView 
              onLogRequest={handleLogRequest} 
              apiKeyConfigured={apiKeyConfigured} 
            />
          )}

          {activeTab === "vision" && (
            <VisionView 
              onLogRequest={handleLogRequest} 
              apiKeyConfigured={apiKeyConfigured} 
            />
          )}

          {activeTab === "logs" && (
            <div className="space-y-6">
              {/* Header metrics */}
              <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 tracking-tight">Active API Console Activity (Local session storage only)</h3>
                  <p className="text-xs text-gray-500">A detailed inspector log of raw payloads for each completed inference transaction.</p>
                </div>
                <button 
                  onClick={clearLogs}
                  disabled={logs.length === 0}
                  className="bg-red-550 bg-red-50 text-red-700 hover:bg-red-100 py-1.5 px-3.5 rounded-xl text-xs font-bold cursor-pointer transition disabled:opacity-40 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Session History
                </button>
              </div>

              {/* Console logs timeline */}
              {logs.length > 0 ? (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div 
                      key={log.id} 
                      className={`border bg-white rounded-2xl overflow-hidden shadow-xs ${log.success ? "border-gray-150" : "border-red-200 bg-red-50/10"}`}
                    >
                      {/* Top status header */}
                      <div className="bg-gray-50 px-5 py-3 flex flex-wrap items-center justify-between text-xs font-mono text-gray-550 border-b border-gray-150">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${log.success ? "bg-emerald-500" : "bg-red-500 animate-pulse"}`} />
                          <span className="font-bold text-gray-700 uppercase">{log.type} Transaction</span>
                          <span>•</span>
                          <span className="bg-gray-200 px-1.5 rounded text-[10px]">{log.endpoint}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[11px]"><Clock className="w-3 h-3" /> {log.timestamp}</span>
                          <span className="bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10.5px]">
                            {log.duration}ms
                          </span>
                        </div>
                      </div>

                      {/* Payload detailed data */}
                      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 font-mono text-[11px]">
                        {/* Request parameters */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Payload Input</span>
                          <pre className="bg-gray-950 text-blue-300 p-3.5 rounded-xl max-h-[220px] overflow-auto border border-gray-800">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </div>

                        {/* Response payload */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Raw Response</span>
                          <pre className={`p-3.5 rounded-xl max-h-[220px] overflow-auto border ${log.success ? "bg-gray-950 text-emerald-300 border-gray-800" : "bg-red-950 text-red-200 border-red-900"}`}>
                            {JSON.stringify(log.response, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-gray-150/80 rounded-2xl p-12 text-center text-gray-400 font-medium flex flex-col items-center justify-center gap-2 border-dashed">
                  <Terminal className="w-10 h-10 text-gray-300 animate-pulse" />
                  <p className="text-sm">CONSOLE LOGS EMPTY</p>
                  <p className="text-xs text-center font-normal text-gray-400 max-w-xs">Run prompt tests, vision audits, or multi-turn chat questions to inspect raw API responses and pipeline parameters.</p>
                </div>
              )}
            </div>
          )}
        </div>

      </main>

      {/* Humble Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>© 2026 Gemini LLM Studio playground. All systems operational.</p>
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <span>Secured Server Proxy active. Direct secrets are never exposed to browser context.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
