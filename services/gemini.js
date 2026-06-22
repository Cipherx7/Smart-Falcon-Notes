const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const KNOWLEDGE_SYSTEM_PROMPT = `You are a general-purpose knowledge processor. Your job is to take raw text about any topic and structure it into organized, actionable knowledge.

You MUST respond with valid JSON only. No markdown, no code fences, no extra text.

Output this exact JSON structure:
{
  "title": "A concise, descriptive title for this knowledge entry",
  "category": "One of: command, note, code, concept, troubleshooting, general",
  "folder": "The primary topic/technology/domain this knowledge belongs to (e.g., Proofpoint, Docker, Python, Linux, AWS, CrowdStrike, Kubernetes, Git, etc.)",
  "structured": {
    "summary": "A clear 2-3 sentence summary of what this knowledge covers",
    "commands": [
      {
        "syntax": "The exact command syntax",
        "description": "What the command does",
        "example": "A practical usage example"
      }
    ],
    "codeSnippets": [
      {
        "language": "The programming/query language",
        "code": "The actual code or query",
        "description": "What this code does"
      }
    ],
    "whenToUse": "Specific scenarios where this knowledge applies",
    "howToUse": "Step-by-step instructions on how to apply this",
    "whyToUse": "The reasoning and benefits of using this approach",
    "tips": ["Practical tips and best practices"],
    "relatedTopics": ["Related topics to explore"]
  },
  "tags": ["relevant", "search", "tags"]
}

Rules:
- If the input doesn't contain commands, leave the commands array empty
- If the input doesn't contain code, leave the codeSnippets array empty
- Always provide summary, whenToUse, howToUse, whyToUse even if you need to infer them
- Tags should include relevant domain-specific terms for searchability
- Category should best match the primary content type
- The "folder" field should be a short, clean topic name (1-3 words, Title Case). Examples: "Proofpoint", "Docker", "CrowdStrike Falcon", "Python", "Linux Administration", "AWS", "Git", "Networking"
- If the topic is too generic or unclear, use "General" as the folder
- Be thorough but concise`;

const SEARCH_SYSTEM_PROMPT = `You are a knowledge assistant with access to a knowledge base of stored notes on various topics.

CRITICAL RULES:
1. When the user asks for a query, command, code, or syntax — DIRECTLY return the EXACT stored query/command/code from the notes. Do NOT paraphrase or generate new ones.
2. If a note contains the exact command, query, or code snippet the user is asking about, copy it verbatim.
3. Always mention which note the answer came from, and explicitly include a "References" section at the bottom.
4. If multiple notes match, show all relevant results.
5. Include the syntax, example, and description exactly as stored.
6. If no notes contain the requested information, clearly say: "No matching notes found in your knowledge base for this query."

Format:
- Lead with the direct answer (the actual query/command/code)
- Follow with context: when to use, how to use, tips — pulled from the note
- Keep it practical and actionable
- Use code formatting for queries and commands
- END your response with a markdown list under "### References" containing the Note Title and its Source URL (if available). For example: "- [Note Title](Source URL)" or "- Note Title (No source URL)"`;

const WHATSAPP_MARATHI_PROMPT = `You are a helpful Gen Z buddy giving advice over a WhatsApp chat.
The user is asking a question based on their knowledge base.

IMPORTANT RULES FOR YOU:
1. You MUST answer in the Marathi language, but written ENTIRELY in English alphabet/Latin script (Hinglish/Marathi-English style). 
   - Example style: "Bhau, he query use kar..." or "Mitra, he search kar..."
2. Keep the tone very casual, friendly, and helpful—like you are texting a friend.
3. Use plenty of appropriate WhatsApp emojis (🚀, 💬, 💻, 🔥, etc.).
4. If there is a specific command or query requested, make sure to still format it properly in a markdown block so it's easy to copy.
5. Base your answers on the provided notes context.
6. Always include a reference at the bottom (like "He info hyacha madhun aali: [Note Title] - [Source URL]").
7. Keep it concise.

Example output format:
"Arre mitra! 🚀 He filter use karaycha ahe na? Ekdum simple ahe, he bagh:
\`\`\`
example-command
\`\`\`
He try kar, ani kuthli issue aali tar sang mala! 🚀🔥

References:
- Note Title - Source URL"
`;

async function processKnowledge(rawText) {
  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: rawText }] }],
      systemInstruction: { parts: [{ text: KNOWLEDGE_SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json'
      }
    });

    const response = result.response;
    const text = response.text();
    
    // Parse the JSON response
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse Gemini response as JSON');
      }
    }

    return parsed;
  } catch (error) {
    console.error('Gemini processKnowledge error:', error);
    throw error;
  }
}

async function smartSearch(query, notes, mode = 'default') {
  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    // Build FULL context from notes — include everything so AI can pull exact content
    const notesContext = notes.map((note, i) => {
      const s = note.structured || {};
      const cmds = (s.commands || []).map(c => 
        `  Command: ${c.syntax || ''}\n  Description: ${c.description || ''}\n  Example: ${c.example || ''}`
      ).join('\n');
      const code = (s.codeSnippets || []).map(c => 
        `  Language: ${c.language || ''}\n  Code: ${c.code || ''}\n  Description: ${c.description || ''}`
      ).join('\n');
      return `--- Note ${i + 1}: "${note.title}" (${note.category}) [Folder: ${note.folder || 'General'}] ---
Source URL: ${note.sourceUrl || 'None'}
Summary: ${s.summary || 'No summary'}
Commands:\n${cmds || '  None'}
Code Snippets:\n${code || '  None'}
When to Use: ${s.whenToUse || 'N/A'}
How to Use: ${s.howToUse || 'N/A'}
Why to Use: ${s.whyToUse || 'N/A'}
Tips: ${(s.tips || []).join('; ') || 'None'}
Tags: ${(note.tags || []).join(', ') || 'None'}
Raw Input: ${note.rawInput || ''}`;
    }).join('\n\n');

    const prompt = `User Question: ${query}

Available Knowledge Base Notes:
${notesContext || 'No notes found in the database.'}

Please answer the user's question based on the available notes.`;

    const systemPrompt = mode === 'whatsapp' ? WHATSAPP_MARATHI_PROMPT : SEARCH_SYSTEM_PROMPT;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: mode === 'whatsapp' ? 0.7 : 0.4 // Slightly more creative for whatsapp style
      }
    });

    return result.response.text();
  } catch (error) {
    console.error('Gemini smartSearch error:', error);
    throw error;
  }
}

module.exports = { processKnowledge, smartSearch };
