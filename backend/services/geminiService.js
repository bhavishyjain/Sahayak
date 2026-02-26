// services/geminiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
function getGeminiApiKey() {
  const raw = process.env.GEMINI_API_KEY;
  if (!raw) return "";
  return String(raw)
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

const genAI = getGeminiApiKey()
  ? new GoogleGenerativeAI(getGeminiApiKey())
  : null;
const GEMINI_ALLOWED_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];
const GEMINI_PRIMARY_MODEL = GEMINI_ALLOWED_MODELS[0];

// Analyze raw text and return structured complaint or FAQ info
async function analyze(rawText) {
  if (!genAI) return { error: "Gemini API not configured" };

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_PRIMARY_MODEL });

    // Prompt for Gemini
    const prompt = `
You are an intelligent municipal assistant. Analyze the following user input and respond ONLY in valid JSON.

User Input: """${rawText}"""

Instructions:
1. Determine type:
   - "newComplaint" => user is reporting an issue
   - "statusQuery" => user wants complaint status
   - "faq" => general question
2. For new complaints, extract:
  - "department": Road, Water, Drainage, Electricity, Waste, Other
   - "refinedText": a concise, clear version of the complaint
   - "priority": 
       • Default to "Medium".
       • Set to "High" only if the complaint mentions urgent situations, danger, accidents, safety hazards, major leaks, or ongoing incidents.
       • Set to "Low" for minor issues or low-impact complaints.
   - "locationName": extract location if mentioned; otherwise null
3. For status queries:
   - "complaintId": the ticket ID if mentioned; else "last"
4. For FAQs:
   - "answer": a helpful answer
5. Return JSON only. No explanations.
6. Respond in the same language as the user is using. If it is a FAQ, provide the answer in the same language as the user.

Note: Certain locations may have higher importance during festivals or events.
If the complaint location is near such areas during those times, set "priority": "High".
Examples:
- Rajwada on Holi => High priority
- MG Road on Diwali => High priority
- Normal day in same locations => follow default keyword logic


Examples:

Input: "There is a water pipe leakage near Central Park. It's urgent!"
Output:
{
  "type": "newComplaint",
  "department": "Water",
  "refinedText": "Water pipe leakage near Central Park",
  "priority": "High",
  "locationName": "Central Park"
}

Input: "Streetlight not working in my area"
Output:
{
  "type": "newComplaint",
  "department": "Electricity",
  "refinedText": "Streetlight not working in my area",
  "priority": "Medium",
  "locationName": null
}

Input: "Check status of my complaint 12345"
Output:
{
  "type": "statusQuery",
  "complaintId": "12345"
}

Input: "When will the garbage be collected today?"
Output:
{
  "type": "faq",
  "answer": "Garbage is collected twice a week. Please check your local schedule or contact the waste management department."
}

Now analyze the user input and return JSON only.
`;

    const response = await model.generateContent(prompt);
    let text = response.response.text().trim();

    // Remove triple backticks and language hints
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const json = JSON.parse(text);
      return json;
    } catch (err) {
      console.error("Gemini returned invalid JSON:", text);
      return { error: "AI response invalid" };
    }
  } catch (err) {
    console.error("Gemini analyze error:", err);
    return { error: true, message: err.message };
  }
}

module.exports = { analyze };
