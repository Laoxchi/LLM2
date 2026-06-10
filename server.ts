import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "20mb" }));

// Lazy initializer for Google Gen AI client
let aiInstance: GoogleGenAI | null = null;

function getGoogleGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY environmental variable is missing or has a placeholder value. Please configure it in Settings > Secrets.");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// 1. Health & Config endpoint
app.get("/api/config", (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyConfigured = !!apiKey && apiKey !== "MY_GEMINI_API_KEY";
  res.json({
    status: "ok",
    apiKeyConfigured: isKeyConfigured,
    defaultModel: "gemini-3.5-flash",
  });
});

// Helper to sanitize schema type
function getMappedType(typeStr: string): Type {
  switch (typeStr?.toUpperCase()) {
    case "STRING": return Type.STRING;
    case "NUMBER": return Type.NUMBER;
    case "INTEGER": return Type.INTEGER;
    case "BOOLEAN": return Type.BOOLEAN;
    case "ARRAY": return Type.ARRAY;
    case "OBJECT": return Type.OBJECT;
    default: return Type.STRING;
  }
}

// Helper to convert frontend JSON definitions to official GenAI standard config schema
function parseCustomSchema(schemaInput: any): any {
  if (!schemaInput) return undefined;
  
  if (schemaInput.type === "ARRAY") {
    return {
      type: Type.ARRAY,
      description: schemaInput.description,
      items: parseCustomSchema(schemaInput.items),
    };
  }

  if (schemaInput.type === "OBJECT") {
    const properties: any = {};
    if (schemaInput.properties) {
      Object.keys(schemaInput.properties).forEach((key) => {
        properties[key] = parseCustomSchema(schemaInput.properties[key]);
      });
    }
    return {
      type: Type.OBJECT,
      description: schemaInput.description,
      properties,
      required: schemaInput.required || [],
    };
  }

  return {
    type: getMappedType(schemaInput.type),
    description: schemaInput.description,
  };
}

// 2. Main generate endpoint (Stateless Prompt Completion with Schema, parameters etc.)
app.post("/api/generate", async (req, res) => {
  try {
    const { 
      model = "gemini-3.5-flash", 
      prompt,
      systemInstruction,
      temperature,
      topP,
      topK,
      maxOutputTokens,
      jsonSchema // optional schema for structured output JSON
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing 'prompt' in request body." });
    }

    const ai = getGoogleGenAI();
    
    // Build parameters configuration dynamically
    const config: any = {};
    
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (typeof temperature === "number") {
      config.temperature = temperature;
    }
    if (typeof topP === "number") {
      config.topP = topP;
    }
    if (typeof topK === "number") {
      config.topK = topK;
    }
    if (typeof maxOutputTokens === "number") {
      config.maxOutputTokens = maxOutputTokens;
    }

    // Configure JSON output format if requested
    if (jsonSchema) {
      config.responseMimeType = "application/json";
      config.responseSchema = parseCustomSchema(jsonSchema);
    }

    const start = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });
    const duration = Date.now() - start;

    res.json({
      text: response.text || "",
      duration,
      usage: response.usageMetadata || {},
    });
  } catch (err: any) {
    console.error("Error in /api/generate:", err);
    res.status(500).json({ error: err.message || "An error occurred with Gemini API." });
  }
});

// 3. Multi-turn chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { 
      model = "gemini-3.5-flash",
      messages, // Array of { role: 'user'|'model', content: string }
      systemInstruction,
      temperature,
    } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array in request body." });
    }

    const ai = getGoogleGenAI();

    // Map frontend messages role/content format to GoogleGenAI SDK contents format:
    // role: 'user' or 'model', parts: [{ text: content }]
    const contents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const config: any = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (typeof temperature === "number") {
      config.temperature = temperature;
    }

    const start = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });
    const duration = Date.now() - start;

    res.json({
      text: response.text || "",
      duration,
      usage: response.usageMetadata || {},
    });
  } catch (err: any) {
    console.error("Error in /api/chat:", err);
    res.status(500).json({ error: err.message || "An error occurred in Chat execution." });
  }
});

// 4. Token Count endpoint
app.post("/api/tokenize", async (req, res) => {
  try {
    const { model = "gemini-3.5-flash", text } = req.body;
    if (!text) {
      return res.json({ tokenCount: 0 });
    }

    const ai = getGoogleGenAI();
    const result = await ai.models.countTokens({
      model,
      contents: text,
    });

    res.json({ tokenCount: result.totalTokens || 0 });
  } catch (err: any) {
    console.error("Error counting tokens:", err);
    // Return approximate character-based tokens as a safe calculation fallback
    const fallbackCount = Math.ceil(req.body.text.length / 4);
    res.json({ tokenCount: fallbackCount, fallback: true, error: err.message });
  }
});

// 5. Vision analysis endpoint
app.post("/api/vision", async (req, res) => {
  try {
    const { 
      model = "gemini-3.5-flash",
      prompt = "Describe this image in detail.",
      imageBase64, // Just the raw base64 string
      mimeType = "image/png"
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing 'imageBase64' string." });
    }

    const ai = getGoogleGenAI();

    // Prepare inputs: image part + text part
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    };
    const textPart = {
      text: prompt,
    };

    const start = Date.now();
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, textPart] },
    });
    const duration = Date.now() - start;

    res.json({
      text: response.text || "",
      duration,
      usage: response.usageMetadata || {},
    });
  } catch (err: any) {
    console.error("Error in /api/vision:", err);
    res.status(500).json({ error: err.message || "An error occurred with Vision API." });
  }
});

// Vite web app integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[LLM Hub server] Running at http://localhost:${PORT}`);
  });
}

startServer();
