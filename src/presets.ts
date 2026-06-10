import { Preset } from "./types";

export const PRESETS: Preset[] = [
  {
    id: "structured_resume",
    title: "Resume Parser (Structured JSON)",
    description: "Extract professional achievements, education, and skills from raw text into a schema-validated resume Object.",
    category: "Structured Data",
    model: "gemini-3.5-flash",
    prompt: "A seasoned full-stack engineer with 8 years of experience in JavaScript/TypeScript, React, Node.js, and Cloud environments. Previously worked as a Senior Software Architect at TechCorp from 2021 to 2025 where they led a team of 5, reducing load time by 40% with smart state hydration systems. Holds a High Honors BS in Computer Science from Stanford (Graduated 2018). Enthusiastic about building LLM playbooks.",
    systemInstruction: "You are a specialized CV Parser. Analyze the CV details and extract them accurately according to the specified JSON schema structure. Maintain professional styling.",
    temperature: 0.1,
    jsonSchema: {
      type: "OBJECT",
      description: "Extracted professional engineer profile",
      properties: {
        candidateName: { type: "STRING", description: "Inferred or placeholder name" },
        yearsOfExperience: { type: "NUMBER", description: "Total years of software engineering experience" },
        techStack: {
          type: "ARRAY",
          description: "List of technology stacks mentioned",
          items: { type: "STRING" }
        },
        achievements: {
          type: "ARRAY",
          description: "Major professional achievements or metrics quantified",
          items: { type: "STRING" }
        },
        education: {
          type: "OBJECT",
          description: "Highest academic degree details",
          properties: {
            degree: { type: "STRING", description: "The degree obtained" },
            school: { type: "STRING", description: "Institution name" },
            gradYear: { type: "INTEGER", description: "Four-digit graduation year" }
          },
          required: ["degree", "school"]
        }
      },
      required: ["yearsOfExperience", "techStack", "achievements", "education"]
    }
  },
  {
    id: "sql_gen",
    title: "Natural Language to SQL Builder",
    description: "Translate normal English requests into pristine, optimized SQL queries with explanations.",
    category: "Coding",
    model: "gemini-3.5-flash",
    systemInstruction: "You are an expert database administrator. Translate English queries into standard PostgreSQL or standard BigQuery SQL. Always use uppercase SQL commands and format for extreme clarity. Provide a precise, non-preachy explanation.",
    prompt: "Show me the top 5 customers in the year 2025 who spent more than $500 in total. Include their id, fullName, and the exact count of individual orders they performed.",
    temperature: 0.2
  },
  {
    id: "customer_support_classifier",
    title: "Customer Ticket Classifier",
    description: "Classifies ticket incoming text, flags urgency, classifies category, and generates an immediate empathetic draft.",
    category: "Analysis",
    model: "gemini-3.5-flash",
    systemInstruction: "Analyze the customer message carefully to extract classification analytics.",
    prompt: "I am absolutely fuming! I bought your premium monthly subscription 3 hours ago and my login page still says I am on the free tier! I have a client presentation starting in exactly half an hour and I can't access any of my templates. Fix this immediately or I am reporting a credit card dispute!",
    temperature: 0.1,
    jsonSchema: {
      type: "OBJECT",
      description: "Ticket classification analytics",
      properties: {
        sentimentScore: { type: "NUMBER", description: "Sentiment intensity from -1.0 (extremely angry) to +1.0 (extremely pleased)" },
        categoryType: { type: "STRING", description: "Category string such as 'BILLING', 'TECHNICAL_GLITCH', 'REFUND', 'GENERAL'" },
        isUrgent: { type: "BOOLEAN", description: "Set to true if there is an imminent business or technical deadline" },
        keyEscalationWords: {
          type: "ARRAY",
          description: "Escalation buzzwords detected",
          items: { type: "STRING" }
        },
        shortSummary: { type: "STRING", description: "A one-sentence objective summary of the issue" },
        quickReplyDraft: { type: "STRING", description: "An ultra-empathetic, professional, action-oriented support draft to defuse the customer" }
      },
      required: ["sentimentScore", "categoryType", "isUrgent", "shortSummary", "quickReplyDraft"]
    }
  },
  {
    id: "socratic_tutor",
    title: "Socratic Programming Mentor",
    description: "A tutor that guides you to find engineering and design bugs yourself rather than vomiting code.",
    category: "Coding",
    model: "gemini-3.5-flash",
    systemInstruction: "You are a Socratic software engineering mentor. Do not provide direct solutions, code snippets, or bug-fixes. Instead, analyze the user's code, ask exactly 1-2 thoughtful guiding questions that pinpoint their conceptual gap, and offer a tiny conceptual hint. Keep explanations concise, motivational, and technical.",
    prompt: "Why is my React useEffect block causing an infinite loop when I invoke fetchUserData() inside? I have `dependencies: [userData]` which updates on fetch completion.",
    temperature: 0.6
  },
  {
    id: "vision_critique",
    title: "Design Critique Analyst (Vision)",
    description: "Detailed heuristic analysis of user interface layouts, typographic hierarchy, and alignments.",
    category: "Analysis",
    model: "gemini-3.5-flash",
    systemInstruction: "You are an elite, picky UI/UX Design System Critic. Examine wireframes, logos, or mockups. Highlight design flaws, contrast issues, and alignment issues, and provide strict visual recommendations.",
    prompt: "Critique the layout alignment, visual margins, color combination, and call-to-actions in this uploaded UI screen. Present recommendations in a crisp, elegant table.",
    temperature: 0.4
  }
];
