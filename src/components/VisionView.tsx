import React, { useState, useRef } from "react";
import { RequestLog } from "../types";
import { Image, Upload, Play, Sparkles, AlertCircle, RefreshCw, FileText, Check, Clipboard } from "lucide-react";

interface VisionViewProps {
  onLogRequest: (log: RequestLog) => void;
  apiKeyConfigured: boolean;
}

const SAMPLE_IMAGES = [
  {
    name: "UI Mockup / Wireframe",
    url: "https://images.unsplash.com/photo-1541462608141-2758533cb99a?auto=format&fit=crop&w=600&q=80",
    prompt: "Perform a detailed heuristic audit on this UI mockup. Suggest improvements for accessibility, visual hierarchy, and negative space usage in a Markdown table."
  },
  {
    name: "Business Dashboard KPI Chart",
    url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80",
    prompt: "Extract the core trends and potential growth inhibitors visible in this data chart. Format as distinct structured bullet points."
  },
  {
    name: "Complex Mathematical formula or handwritten code",
    url: "https://images.unsplash.com/photo-1453733190148-c44698c26588?auto=format&fit=crop&w=600&q=80",
    prompt: "Describe what is depicted in this photo, translate any structured workflow diagrams, and explain its practical engineering application."
  }
];

export default function VisionView({ onLogRequest, apiKeyConfigured }: VisionViewProps) {
  const [imageBase64, setImageBase64] = useState<string>("");
  const [imageMimeType, setImageMimeType] = useState<string>("image/jpeg");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("Explore this mockup and perform a visual design audit of spacing, alignment, and fonts.");
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [completion, setCompletion] = useState<string>("");
  const [metaInfo, setMetaInfo] = useState<{ duration?: number; promptTokens?: number; completionTokens?: number }>({});
  const [copied, setCopied] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const convertFileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:image/...;base64, from the beginning
        const base64Data = result.split(",")[1];
        resolve({
          base64: base64Data,
          mimeType: file.type
        });
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image is too large (maximum size is 5MB).");
      return;
    }

    setUploadError("");
    try {
      const { base64, mimeType } = await convertFileToBase64(file);
      setImageBase64(base64);
      setImageMimeType(mimeType);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      setUploadError("Failed to parse image file.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file.");
      return;
    }

    setUploadError("");
    try {
      const { base64, mimeType } = await convertFileToBase64(file);
      setImageBase64(base64);
      setImageMimeType(mimeType);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      setUploadError("Failed to parse image data.");
    }
  };

  const loadSample = async (sample: typeof SAMPLE_IMAGES[0]) => {
    setIsLoading(true);
    setUploadError("");
    setPrompt(sample.prompt);
    setPreviewUrl(sample.url);
    
    try {
      // Direct remote URL might have CORS restrictions, but we download it inside client or use proxy
      const res = await fetch(sample.url);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImageBase64(result.split(",")[1]);
        setImageMimeType(blob.type);
        setIsLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.warn("Could not convert sample to base64 directly due to CORS, but let's allow rendering of UI preview on front-end.");
      // Soft placeholder base64 for preview demo if CORS blocks fetch
      setImageBase64("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"); 
      setImageMimeType("image/jpeg");
      setIsLoading(false);
    }
  };

  const analyzeImage = async () => {
    if (!imageBase64) {
      setUploadError("Please upload an image or choose a demo sample first.");
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setCompletion("");
    setMetaInfo({});
    
    const requestPayload = {
      model: "gemini-3.5-flash",
      prompt,
      imageBase64,
      mimeType: imageMimeType
    };

    const startTime = Date.now();

    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
      });

      const responseData = await res.json();
      const endTime = Date.now();
      const duration = endTime - startTime;

      if (!res.ok) {
        throw new Error(responseData.error || "Vision analysis failed");
      }

      setCompletion(responseData.text);
      setMetaInfo({
        duration,
        promptTokens: responseData.usage?.promptTokenCount,
        completionTokens: responseData.usage?.candidatesTokenCount
      });

      const logEntry: RequestLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        type: "vision",
        endpoint: "/api/vision",
        payload: { model: "gemini-3.5-flash", prompt, mimeType: imageMimeType, hasImage: true },
        response: responseData,
        duration,
        success: true
      };
      onLogRequest(logEntry);

    } catch (err: any) {
      console.error(err);
      setCompletion(`⚠️ Vision Error: ${err.message}`);
      
      const logEntry: RequestLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        type: "vision",
        endpoint: "/api/vision",
        payload: { model: "gemini-3.5-flash", prompt, mimeType: imageMimeType, hasImage: true },
        response: { error: err.message },
        duration: Date.now() - startTime,
        success: false
      };
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
      
      {/* Configuration & Uploader column */}
      <div className="lg:col-span-5 space-y-5 flex flex-col">
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Image className="w-5 h-5 text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider">Vision Engine upload</h2>
          </div>

          {/* Quick samples */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 uppercase">Load Live Sample Demos</label>
            <div className="grid grid-cols-1 gap-2">
              {SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.name}
                  onClick={() => loadSample(sample)}
                  className="text-left text-xs bg-gray-50 hover:bg-purple-50 hover:text-purple-700 p-2.5 rounded-xl border border-gray-200 transition font-medium flex items-center justify-between"
                >
                  <span className="truncate pr-2">{sample.name}</span>
                  <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-70" />
                </button>
              ))}
            </div>
          </div>

          {/* File drop area */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase block">Drop or Upload Custom File</label>
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 hover:border-purple-300 rounded-2xl p-6 text-center cursor-pointer bg-gray-50 hover:bg-purple-50/25 transition group relative min-h-[140px] flex flex-col items-center justify-center gap-1"
            >
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Upload className="w-8 h-8 text-gray-400 group-hover:text-purple-500 transition mb-1" />
              <p className="text-xs font-semibold text-gray-700">Click to upload or Drag & Drop</p>
              <p className="text-[10px] text-gray-400">PNG, JPEG, WEBP files up to 5MB</p>
            </div>
          </div>

          {uploadError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs flex items-center gap-2 border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Live Preview Display */}
        {previewUrl && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex-1 flex flex-col self-stretch">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Selected Media Analysis Preview</label>
            <div className="flex-1 bg-gray-950 rounded-xl overflow-hidden relative border border-gray-150 min-h-[220px] flex items-center justify-center">
              <img 
                src={previewUrl} 
                alt="Source preview" 
                className="max-h-[300px] max-w-full object-contain"
              />
              <span className="absolute bottom-2 right-2 bg-black/60 backdrop-blur text-white text-[10px] font-mono px-2 py-0.5 rounded uppercase">
                {imageMimeType}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Inputs & Output Display */}
      <div className="lg:col-span-7 flex flex-col space-y-6">
        
        {/* Core Prompt */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase block">Vision Instructions & Query</label>
            <textarea 
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Identify any styling faults, text alignment glitches, and list contrast suggestions..."
              className="w-full bg-white border border-gray-200 rounded-xl p-3.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition"
            />
          </div>

          <div className="flex items-center justify-between">
            {!apiKeyConfigured && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                ⚠️ Off-line mock simulation active
              </span>
            )}
            <div className="flex-1" />
            <button 
              onClick={analyzeImage}
              disabled={isLoading || !imageBase64}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 px-6 rounded-xl text-sm flex items-center gap-2 cursor-pointer transition shadow-md shadow-purple-500/10"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Analyzing Media...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Run Vision Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inference output */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="bg-gray-50 border-b border-gray-100 px-5 py-3 flex items-center justify-between text-xs text-gray-500">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-purple-600" />
              ANALYSIS REPORT
            </span>
            {metaInfo.duration && (
              <span className="font-mono text-gray-500 text-[11px]">Latency: {metaInfo.duration}ms</span>
            )}
          </div>

          <div className="p-5 flex-1 flex flex-col min-h-[180px] bg-gray-50/50">
            {completion ? (
              <div className="space-y-4 flex flex-col flex-1">
                <div className="flex justify-between items-center bg-white p-2 border border-gray-100 rounded-xl">
                  <span className="text-xs font-semibold text-purple-700 pl-2">Report Feedback</span>
                  <button 
                    onClick={copyResponse}
                    className="flex items-center gap-1.5 py-1 px-3 text-xs font-medium text-gray-650 hover:bg-gray-100 rounded-lg transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Clipboard className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy report"}
                  </button>
                </div>
                
                <div className="flex-1 bg-white p-5 border border-gray-150 rounded-xl overflow-auto text-sm text-gray-850 leading-relaxed font-sans shadow-sm whitespace-pre-wrap">
                  {completion}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400 gap-2 border-2 border-dashed border-gray-150 rounded-xl">
                <Image className="w-8 h-8 text-gray-300" />
                <p className="text-sm font-medium">Ready for Vision audit.</p>
                <p className="text-xs text-center max-w-[280px]">Select a design screenshot or upload an interface diagram above, and compile metadata.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
