import React, { useState, useEffect, useRef } from "react";
import { Preset, SchemaDefinition, RequestLog, SchemaPropertyType } from "../types";
import { PRESETS } from "../presets";
import { Play, Sparkles, Code, Settings2, HelpCircle, FileJson, Layers, Clipboard, Check, RefreshCw } from "lucide-react";

interface PlaygroundViewProps {
  onLogRequest: (log: RequestLog) => void;
  apiKeyConfigured: boolean;
}

const DEFAULT_SCHEMA: SchemaDefinition = {
  type: "OBJECT",
  description: "Structure to extract",
  properties: {
    title: { type: "STRING", description: "Inferred headline" },
    sentiment: { type: "STRING", description: "Vibe of the text" },
    key_points: { 
      type: "ARRAY", 
      description: "Bullet lists",
      items: { type: "STRING" }
    }
  },
  required: ["title"]
};

export default function PlaygroundView({ onLogRequest, apiKeyConfigured }: PlaygroundViewProps) {
  // Preset Selection
  const [selectedPresetId, setSelectedPresetId] = useState<string>("sql_gen");
  
  // Model Parameters
  const [model, setModel] = useState<string>("gemini-3.5-flash");
  const [systemPrompt, setSystemPrompt] = useState<string>("You are an expert SQL engineer.");
  const [userPrompt, setUserPrompt] = useState<string>("Show me the top 5 customers in the year 2025 who spent more than $500 in total. Include their id, fullName, and the exact count of individual orders they performed.");
  const [temperature, setTemperature] = useState<number>(0.2);
  const [topP, setTopP] = useState<number>(0.95);
  const [topK, setTopK] = useState<number>(40);
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  
  // Structured Output state
  const [useSchema, setUseSchema] = useState<boolean>(false);
  const [jsonSchema, setJsonSchema] = useState<SchemaDefinition>(DEFAULT_SCHEMA);
  
  // UI states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [completion, setCompletion] = useState<string>("");
  const [metaInfo, setMetaInfo] = useState<{ duration?: number; promptTokens?: number; completionTokens?: number }>({});
  const [lastApiLog, setLastApiLog] = useState<{ request?: any; response?: any } | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [isCountingTokens, setIsCountingTokens] = useState<boolean>(false);

  // Schema Editor Temp state for editing
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState<SchemaPropertyType>("STRING");
  const [newPropDesc, setNewPropDesc] = useState("");

  // Load a preset
  const loadPreset = (preset: Preset) => {
    setModel(preset.model);
    setSystemPrompt(preset.systemInstruction || "");
    setUserPrompt(preset.prompt);
    setTemperature(preset.temperature);
    if (preset.jsonSchema) {
      setJsonSchema(preset.jsonSchema);
      setUseSchema(true);
    } else {
      setUseSchema(false);
    }
  };

  useEffect(() => {
    const preset = PRESETS.find(p => p.id === selectedPresetId);
    if (preset) {
      loadPreset(preset);
    }
  }, [selectedPresetId]);

  // Debounced token counter
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!userPrompt.trim()) {
        setTokenCount(0);
        return;
      }
      setIsCountingTokens(true);
      try {
        const response = await fetch("/api/tokenize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, text: `${systemPrompt}\n${userPrompt}` }),
        });
        const data = await response.json();
        setTokenCount(data.tokenCount);
      } catch (e) {
        // Fallback length based
        setTokenCount(Math.ceil((systemPrompt.length + userPrompt.length) / 4));
      } finally {
        setIsCountingTokens(false);
      }
    }, 850);

    return () => clearTimeout(timer);
  }, [userPrompt, systemPrompt, model]);

  // Handle schema edits
  const addProperty = () => {
    if (!newPropName.trim()) return;
    const key = newPropName.replace(/\s+/g, "_").toLowerCase();
    
    // Support basic structure
    const updatedProps = { ...(jsonSchema.properties || {}) };
    if (newPropType === "ARRAY") {
      updatedProps[key] = {
        type: "ARRAY",
        description: newPropDesc || `List of ${key}`,
        items: { type: "STRING", description: "Array item value" }
      };
    } else {
      updatedProps[key] = {
        type: newPropType,
        description: newPropDesc || `Extracted ${key}`
      };
    }

    setJsonSchema({
      ...jsonSchema,
      properties: updatedProps,
      required: [...(jsonSchema.required || []), key]
    });

    setNewPropName("");
    setNewPropDesc("");
  };

  const removeProperty = (keyName: string) => {
    const updatedProps = { ...(jsonSchema.properties || {}) };
    delete updatedProps[keyName];
    setJsonSchema({
      ...jsonSchema,
      properties: updatedProps,
      required: (jsonSchema.required || []).filter(k => k !== keyName)
    });
  };

  const executePrompt = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setCompletion("");
    setMetaInfo({});
    
    const requestPayload = {
      model,
      prompt: userPrompt,
      systemInstruction: systemPrompt || undefined,
      temperature,
      topP,
      topK,
      maxOutputTokens: maxTokens,
      jsonSchema: useSchema ? jsonSchema : undefined
    };

    const startTime = Date.now();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      const responseData = await res.json();
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (!res.ok) {
        throw new Error(responseData.error || "Generation failed");
      }

      setCompletion(responseData.text);
      setMetaInfo({
        duration,
        promptTokens: responseData.usage?.promptTokenCount,
        completionTokens: responseData.usage?.candidatesTokenCount
      });

      // Update interactive log inspector
      const logEntry: RequestLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        type: "generate",
        endpoint: "/api/generate",
        payload: requestPayload,
        response: responseData,
        duration,
        success: true
      };
      
      setLastApiLog({ request: requestPayload, response: responseData });
      onLogRequest(logEntry);

    } catch (err: any) {
      console.error(err);
      setCompletion(`⚠️ Error: ${err.message}`);
      
      const logEntry: RequestLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        type: "generate",
        endpoint: "/api/generate",
        payload: requestPayload,
        response: { error: err.message },
        duration: Date.now() - startTime,
        success: false
      };
      setLastApiLog({ request: requestPayload, response: { error: err.message } });
      onLogRequest(logEntry);
    } finally {
      setIsLoading(false);
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(completion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-140px)]">
      
      {/* Parameters panel */}
      <div className="lg:col-span-4 space-y-5 bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
          <Settings2 className="w-5 h-5 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Control Panel</h2>
        </div>

        {/* Model Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-500 uppercase">Load Master Presets</label>
          <select 
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            className="w-full bg-slate-55 bg-gray-50 border border-gray-200 outline-none text-sm rounded-xl py-2 px-3 text-gray-700 font-medium focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {PRESETS.find(p => p.id === selectedPresetId)?.description}
          </p>
        </div>

        {/* Selected Model */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Target Model</label>
          <select 
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 outline-none text-sm rounded-xl py-2 px-3 text-gray-700 font-semibold focus:ring-2 focus:ring-blue-100"
          >
            <option value="gemini-3.5-flash">gemini-3.5-flash (Standard / Quick)</option>
            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Expert Reasoning)</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Lite / Low Latency)</option>
          </select>
          {model === "gemini-3.1-pro-preview" && (
            <div className="bg-amber-50 text-amber-700 p-2 rounded-lg text-xs border border-amber-100 mt-1">
              Note: This is an advanced model that requires a paid tier API secret.
            </div>
          )}
        </div>

        {/* Temperature */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs font-medium text-gray-600">
            <span className="flex items-center gap-1">
              Temperature
              <span className="text-[10px] bg-gray-150 px-1 rounded font-mono">{temperature.toFixed(1)}</span>
            </span>
            <span className="text-gray-400">Creative vs Precise</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="0.1" 
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full Accent-blue h-1 bg-gray-150 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 font-mono">
            <span>0.0 (Deterministic)</span>
            <span>2.0 (High Chaos)</span>
          </div>
        </div>

        {/* Top P */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-gray-600">
            <span>Top P (Nucleus Sampling)</span>
            <span className="font-mono text-xs">{topP}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.05" 
            value={topP}
            onChange={(e) => setTopP(parseFloat(e.target.value))}
            className="w-full Accent-blue h-1 bg-gray-150 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Max Output Tokens */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-gray-600">
            <span>Max Length limit</span>
            <span className="font-mono text-xs">{maxTokens} tokens</span>
          </div>
          <input 
            type="range" 
            min="100" 
            max="8192" 
            step="100" 
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full Accent-blue h-1 bg-gray-150 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Structured JSON Output toggle */}
        <div className="pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold text-gray-700 uppercase">Structured JSON Mode</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={useSchema} 
                onChange={(e) => setUseSchema(e.target.checked)} 
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {useSchema && (
            <div className="bg-gray-50 border border-gray-150 rounded-xl p-3 text-xs space-y-3">
              <span className="font-semibold text-gray-600 block">Edit Extraction Schema Schema:</span>
              
              {/* Properties list */}
              <div className="space-y-2">
                {Object.entries(jsonSchema.properties || {}).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex justify-between items-center bg-white border border-gray-200 p-2 rounded-lg">
                    <div>
                      <span className="font-mono font-bold text-gray-700">{key}</span>
                      <span className="text-[9px] bg-gray-100 text-gray-500 ml-2 px-1 rounded">{value.type}</span>
                      <p className="text-[10px] text-gray-400 truncate max-w-[180px]">{value.description}</p>
                    </div>
                    <button 
                      onClick={() => removeProperty(key)}
                      className="text-red-500 hover:text-red-700 font-mono text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Add property form */}
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="property_name" 
                    value={newPropName}
                    onChange={(e) => setNewPropName(e.target.value)}
                    className="bg-white border text-[11px] p-1.5 rounded-lg w-full outline-none focus:border-blue-400"
                  />
                  <select 
                    value={newPropType}
                    onChange={(e) => setNewPropType(e.target.value as SchemaPropertyType)}
                    className="bg-white border text-[11px] p-1.5 rounded-lg w-full outline-none"
                  >
                    <option value="STRING">STRING</option>
                    <option value="NUMBER">NUMBER</option>
                    <option value="INTEGER">INTEGER</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="ARRAY">ARRAY (Strings)</option>
                  </select>
                </div>
                <input 
                  type="text" 
                  placeholder="brief extraction instruction description (e.g. Total bill sum value)" 
                  value={newPropDesc}
                  onChange={(e) => setNewPropDesc(e.target.value)}
                  className="bg-white border text-[11px] p-1.5 rounded-lg w-full outline-none focus:border-blue-400"
                />
                <button 
                  onClick={addProperty}
                  className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium py-1 rounded-lg text-xs cursor-pointer transition"
                >
                  + Add Schema Field
                </button>
              </div>

              <div className="bg-emerald-500/10 text-[10px] text-emerald-800 p-2 rounded">
                The model will return raw structured JSON conforming EXACTLY to the specification designed above.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Sandbox editor and output area */}
      <div className="lg:col-span-8 flex flex-col space-y-6">
        
        {/* Editor Inputs */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          {/* Section: Header info */}
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between text-xs text-gray-500">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-500" />
              PROMPT SCRIPT ENGINE
            </span>
            <div className="flex items-center gap-3">
              <span className={`flex items-center gap-1 text-[11px] ${isCountingTokens ? "text-gray-400" : "text-gray-600"}`}>
                {isCountingTokens ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <span className="font-mono bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10px]">
                    {tokenCount} Tokens
                  </span>
                )}
                estimate
              </span>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            {/* System Instruction */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase">System Instructions (Model Personality Guide)</span>
                <span className="text-[10px] text-gray-400">Forces strict styling rules, context, or constraints</span>
              </div>
              <textarea 
                rows={2}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Ex. You are a Socratic coach. Never answer directly. Ask questions targeting their knowledge..."
                className="w-full bg-gray-50/50 border border-gray-150 rounded-xl p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 font-mono transition"
              />
            </div>

            {/* User Prompt */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase">User Core Prompt / Input Data</span>
              <textarea 
                rows={6}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                placeholder="Write your primary command instructions or paste raw contextual unstructured data to analyze here..."
                className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition"
              />
            </div>

            {/* Run button */}
            <div className="flex items-center justify-between pt-1">
              {!apiKeyConfigured && (
                <span className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg font-medium border border-amber-100">
                  ⚠️ API Key is not set up in Secrets. Fallback modes active.
                </span>
              )}
              <div className="flex-1" />
              <button 
                onClick={executePrompt}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl text-sm flex items-center gap-2 cursor-pointer transition shadow-md shadow-blue-500/10"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Inferring via Gemini...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Run Prompt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Output Area */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between text-xs text-gray-500">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              LIVE INFERENCE OUTPUT
            </span>
            {metaInfo.duration && (
              <div className="flex items-center gap-3 text-[11px] font-mono text-gray-500">
                <span>Time: {metaInfo.duration}ms</span>
                {metaInfo.promptTokens && (
                  <span>Tokens: {metaInfo.promptTokens} in / {metaInfo.completionTokens} out</span>
                )}
              </div>
            )}
          </div>

          <div className="p-5 flex-1 flex flex-col min-h-[180px] bg-gray-50/50">
            {completion ? (
              <div className="space-y-4 flex flex-col flex-1">
                {/* Action buttons */}
                <div className="flex justify-between items-center bg-white p-2 border border-gray-100 rounded-xl">
                  <span className="text-xs font-semibold text-gray-550 pl-2">Response Output</span>
                  <button 
                    onClick={copyResponse}
                    className="flex items-center gap-1.5 py-1 px-3 text-xs font-medium text-gray-650 hover:bg-gray-100 rounded-lg transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Clipboard className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy to Clipboard"}
                  </button>
                </div>
                
                {/* Final printed text */}
                <div className="flex-1 bg-white p-5 border border-gray-150 rounded-xl overflow-auto text-sm text-gray-800 leading-relaxed font-sans shadow-sm whitespace-pre-wrap">
                  {useSchema ? (
                    <pre className="font-mono text-xs text-emerald-700 bg-emerald-50/20 p-3 rounded-lg border border-emerald-100/50">
                      {JSON.stringify(JSON.parse(completion || "{}"), null, 2)}
                    </pre>
                  ) : (
                    completion
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 gap-2 border-2 border-dashed border-gray-150 rounded-xl">
                <Code className="w-8 h-8 text-gray-300" />
                <p className="text-sm font-medium">Ready for generation.</p>
                <p className="text-xs">Adjust parameters and click &quot;Run Prompt&quot; to review the output.</p>
              </div>
            )}
          </div>
        </div>

        {/* Realtime API Code Payload Inspector */}
        {lastApiLog && (
          <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 shadow-lg overflow-hidden border border-slate-800 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="font-semibold text-xs tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <FileJson className="w-4 h-4 text-blue-400" />
                Raw API REST Payload (Google GenAI Schema)
              </span>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">POST /api/generate</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">📤 HTTP Request Body JSON</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 max-h-[180px] overflow-auto text-[11px] text-blue-300">
                  {JSON.stringify(lastApiLog.request, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">📥 HTTP Response JSON</span>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 max-h-[180px] overflow-auto text-[11px] text-emerald-300">
                  {JSON.stringify(lastApiLog.response, null, 2)}
                </pre>
              </div>
            </div>
            
            <p className="text-[9px] text-slate-500 mt-3 italic">
              * Note: In full-stack architecture, these requests are sent to your Express backend, which executes standard `@google/genai` calls via server-side SDK and forwards payloads safely.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
