export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  maxTokens: number;
  capabilities: string[];
}

export interface Preset {
  id: string;
  title: string;
  description: string;
  category: "Coding" | "Structured Data" | "Creative" | "Analysis";
  model: string;
  systemInstruction?: string;
  prompt: string;
  temperature: number;
  jsonSchema?: SchemaDefinition;
}

export type SchemaPropertyType = "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY" | "OBJECT";

export interface SchemaDefinition {
  type: SchemaPropertyType;
  description?: string;
  properties?: Record<string, SchemaDefinition>;
  items?: SchemaDefinition;
  required?: string[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface RequestLog {
  id: string;
  timestamp: string;
  type: "generate" | "chat" | "vision" | "tokenize";
  endpoint: string;
  payload: any;
  response: any;
  duration: number;
  success: boolean;
}
