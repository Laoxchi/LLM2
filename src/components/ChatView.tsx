import React, { useState, useEffect, useRef } from "react";
import { Message, RequestLog } from "../types";
import { Plus, Trash2, Send, HelpCircle, Bot, User, Clock, ShieldCheck, Cpu } from "lucide-react";

interface ChatSession {
  id: string;
  title: string;
  personality: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  messages: Message[];
}

interface ChatViewProps {
  onLogRequest: (log: RequestLog) => void;
  apiKeyConfigured: boolean;
}

const PERSONALITIES = [
  {
    name: "General Smart Assistant",
    systemPrompt: "You are a highly versatile, helpful artificial intelligence helper. Answer code, design, and math accurately, concisely, and with structured markdown formatting.",
    icon: "✨",
    promptPlaceholder: "What would you like to build or solve today?"
  },
  {
    name: "Tough Senior Code Reviewer",
    systemPrompt: "You are a strict, veteran programmer who points out code quality issues, security vulnerabilities, and bad patterns. Be constructive, highly technical, and critical. Focus on clean architecture, performance, security, and edge-handling.",
    icon: "💻",
    promptPlaceholder: "Paste your code snippet here for strict architectural audit..."
  },
  {
    name: "Copywriter & SEO Expert",
    systemPrompt: "You are an elite creative copywriter and SEO optimization strategist. Make sentences punchy, engaging, and persuasive. Integrate keywords naturally, optimize headlines, and craft compelling marketing or blog materials.",
    icon: "✍️",
    promptPlaceholder: "Write pitch ideas, tagline queries, or copy topics..."
  },
  {
    name: "Business Strategy Explainer",
    systemPrompt: "You are a business consultant focused on simplifying complex operations. Structure breakdowns in clean, visual tables, bento lists, or business SWOT grids.",
    icon: "📈",
    promptPlaceholder: "Pitch a business model, pricing structure, or strategy query..."
  }
];

export default function ChatView({ onLogRequest, apiKeyConfigured }: ChatViewProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("llm_hub_chats");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
          return;
        }
      } catch (e) {
        console.error("Local storage corrupt:", e);
      }
    }
    
    // Create direct initial session
    const initialSession: ChatSession = {
      id: "session_1",
      title: "New Smart Chat",
      personality: "General Smart Assistant",
      model: "gemini-3.5-flash",
      systemPrompt: PERSONALITIES[0].systemPrompt,
      temperature: 0.7,
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: "Hello! I am initialized as a General Smart Assistant. Type a command to get started.",
          timestamp: new Date().toLocaleTimeString()
        }
      ]
    };
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
  }, []);

  // Save to local storage
  const saveSessions = (updated: ChatSession[]) => {
    setSessions(updated);
    localStorage.setItem("llm_hub_chats", JSON.stringify(updated));
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  const createNewSession = () => {
    const id = crypto.randomUUID();
    const newSession: ChatSession = {
      id,
      title: `Conversation ${sessions.length + 1}`,
      personality: "General Smart Assistant",
      model: "gemini-3.5-flash",
      systemPrompt: PERSONALITIES[0].systemPrompt,
      temperature: 0.7,
      messages: [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Hello! What can I support you with today?",
          timestamp: new Date().toLocaleTimeString()
        }
      ]
    };
    const updated = [...sessions, newSession];
    saveSessions(updated);
    setActiveSessionId(id);
  };

  const deleteSession = (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    if (sessions.length <= 1) return; // Prevent deleting everything
    const filtered = sessions.filter(s => s.id !== idToDelete);
    saveSessions(filtered);
    if (activeSessionId === idToDelete) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const updateSessionConfig = (key: keyof ChatSession, val: any) => {
    const updated = sessions.map(s => {
      if (s.id === activeSessionId) {
        const item: any = { ...s, [key]: val };
        // Sync system prompt if personality changed
        if (key === "personality") {
          const personalityObj = PERSONALITIES.find(p => p.name === val);
          if (personalityObj) {
            item.systemPrompt = personalityObj.systemPrompt;
          }
        }
        return item as ChatSession;
      }
      return s;
    });
    saveSessions(updated);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !activeSession) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: inputMessage,
      timestamp: new Date().toLocaleTimeString()
    };

    const nextMessages = [...activeSession.messages, userMsg];
    
    // Optimistic UI update
    const updatedSessionsOptimistic = sessions.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: nextMessages,
          // Update title if it's the first real question
          title: s.title.startsWith("Conversation") || s.title === "New Smart Chat" ? inputMessage.slice(0, 24) + (inputMessage.length > 24 ? "..." : "") : s.title
        };
      }
      return s;
    });
    saveSessions(updatedSessionsOptimistic);
    setInputMessage("");
    setIsLoading(true);

    const startTime = Date.now();
    const requestPayload = {
      model: activeSession.model,
      // Pass the last 15 messages to prevent token bloat
      messages: nextMessages.slice(-15).map(m => ({
        role: m.role,
        content: m.content
      })),
      systemInstruction: activeSession.systemPrompt || undefined,
      temperature: activeSession.temperature
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      const responseData = await res.json();
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (!res.ok) {
        throw new Error(responseData.error || "Failed to generate chat message");
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: responseData.text,
        timestamp: new Date().toLocaleTimeString()
      };

      const finalSessionsList = sessions.map(s => {
        if (s.id === activeSessionId) {
          // Re-fetch current state to avoid race conditions with other sessions
          return {
            ...s,
            messages: [...nextMessages, assistantMsg]
          };
        }
        return s;
      });
      saveSessions(finalSessionsList);

      // Log request
      const logEntry: RequestLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        type: "chat",
        endpoint: "/api/chat",
        payload: requestPayload,
        response: responseData,
        duration,
        success: true
      };
      onLogRequest(logEntry);

    } catch (err: any) {
      console.error(err);
      const errAssistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `⚠️ Failed to get a response: ${err.message}`,
        timestamp: new Date().toLocaleTimeString()
      };
      
      const finalSessionsList = sessions.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...nextMessages, errAssistantMsg]
          };
        }
        return s;
      });
      saveSessions(finalSessionsList);

      const logEntry: RequestLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        type: "chat",
        endpoint: "/api/chat",
        payload: requestPayload,
        response: { error: err.message },
        duration: Date.now() - startTime,
        success: false
      };
      onLogRequest(logEntry);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const activePlaceholder = PERSONALITIES.find(p => p.name === activeSession?.personality)?.promptPlaceholder || "Type an instruction...";

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[calc(100vh-140px)]">
      
      {/* Sessions list sidebar */}
      <div className="md:col-span-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-4">
        <button 
          onClick={createNewSession}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer transition shadow-md shadow-blue-500/10"
        >
          <Plus className="w-4 h-4" />
          New Conversational Studio
        </button>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase block px-2 mb-2">History Conversations</label>
          {sessions.map((s) => (
            <div 
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition ${activeSessionId === s.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <div className="flex items-center gap-2 max-w-[80%]">
                <span className="text-base">
                  {PERSONALITIES.find(p => p.name === s.personality)?.icon || "✨"}
                </span>
                <span className="truncate">{s.title}</span>
              </div>
              <button 
                onClick={(e) => deleteSession(e, s.id)}
                disabled={sessions.length <= 1}
                className="opacity-0 group-hover:opacity-100 disabled:opacity-0 hover:text-red-500 transition px-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[11px] text-gray-550 space-y-1">
          <p className="font-bold flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Stateless Arena</p>
          <p>This panel uses standard stateless array history wrappers for multi-turn chats. Stored completely in local cache.</p>
        </div>
      </div>

      {/* Main chat window */}
      <div className="md:col-span-9 flex flex-col bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden min-h-[500px]">
        {activeSession && (
          <>
            {/* Header / Config Bar */}
            <div className="bg-gray-50 border-b border-gray-100 p-4 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-800">{activeSession.title}</span>
                <span className="text-[10px] bg-gray-200/80 px-2 py-0.5 rounded font-mono text-gray-600">
                  {activeSession.model}
                </span>
              </div>

              {/* Dynamic configs */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Preset Persona</span>
                  <select 
                    value={activeSession.personality}
                    onChange={(e) => updateSessionConfig("personality", e.target.value)}
                    className="bg-white border rounded-lg p-1 text-xs text-gray-750 font-medium outline-none"
                  >
                    {PERSONALITIES.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Model</span>
                  <select 
                    value={activeSession.model}
                    onChange={(e) => updateSessionConfig("model", e.target.value)}
                    className="bg-white border rounded-lg p-1 text-xs text-gray-750 font-medium outline-none"
                  >
                    <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Temp</span>
                  <select 
                    value={activeSession.temperature}
                    onChange={(e) => updateSessionConfig("temperature", parseFloat(e.target.value))}
                    className="bg-white border rounded-lg p-1 text-xs text-gray-750 font-medium outline-none"
                  >
                    <option value="0.2">0.2 Precise</option>
                    <option value="0.7">0.7 Balanced</option>
                    <option value="1.2">1.2 Creative</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Chat list */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[420px]">
              {activeSession.messages.map((m) => (
                <div 
                  key={m.id}
                  className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${m.role === "user" ? "bg-blue-100 border-blue-200 text-blue-700" : "bg-white border-gray-200"}`}>
                    {m.role === "user" ? <User className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5 text-blue-600" />}
                  </div>

                  <div className="space-y-1">
                    <div className={`p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-gray-100 text-gray-800 rounded-tl-none border border-gray-150"}`}>
                      {m.content}
                    </div>
                    <div className={`flex items-center gap-2 text-[10px] text-gray-400 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <Clock className="w-3 h-3" />
                      <span>{m.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 mr-auto max-w-[85%]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-white border-gray-200">
                    <Bot className="w-4.5 h-4.5 text-blue-600 animate-pulse" />
                  </div>
                  <div className="bg-gray-100 border border-gray-150 rounded-2xl rounded-tl-none p-4 text-xs font-semibold text-gray-500 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    <span>Gemini is analyzing conversation state...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-2">
              <textarea 
                rows={2}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activePlaceholder}
                className="flex-1 bg-white border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition"
                disabled={isLoading}
              />
              <button 
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-40 shrink-0 cursor-pointer flex items-center justify-center transition shadow-md shadow-blue-500/10"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
