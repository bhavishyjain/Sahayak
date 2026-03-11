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
const GEMINI_ALLOWED_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];
const GEMINI_PRIMARY_MODEL = GEMINI_ALLOWED_MODELS[0];

// Sanitize user-supplied text before interpolating into Gemini prompts
function sanitizeInput(text, maxLength = 2000) {
  return String(text ?? "")
    .replace(/"""/g, '"')  // prevent breaking triple-quote prompt delimiters
    .replace(/```/g, "")
    .trim()
    .slice(0, maxLength);
}

// Analyze raw text and return structured complaint or FAQ info
async function analyze(rawText) {
  if (!genAI) return { error: "Gemini API not configured" };

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_PRIMARY_MODEL });

    // Prompt for Gemini
    const safeText = sanitizeInput(rawText);
    const prompt = `
You are an intelligent municipal assistant. Analyze the following user input and respond ONLY in valid JSON.

User Input: """${safeText}"""

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

// Analyze sentiment and urgency of complaint
async function analyzeSentiment(description) {
  if (!genAI) return { sentiment: "unknown", urgency: 5, keywords: [] };

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_PRIMARY_MODEL });

    const safeDesc = sanitizeInput(description);
    const prompt = `Analyze the sentiment and urgency of this complaint:

"${safeDesc}"

Return ONLY valid JSON with:
{
  "sentiment": "calm" | "frustrated" | "angry" | "desperate",
  "urgency": 1-10 (number),
  "keywords": ["keyword1", "keyword2"],
  "affectedCount": estimated number of people affected (number),
  "suggestedPriority": "Low" | "Medium" | "High"
}

Consider:
- Urgent words: urgent, immediate, emergency, dangerous, critical
- Anger indicators: terrible, awful, unacceptable, disgraceful
- Impact indicators: entire area, many people, whole street, community

Return only JSON, no explanation.`;

    const response = await model.generateContent(prompt);
    let text = response.response.text().trim();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const json = JSON.parse(text);
      return json;
    } catch (err) {
      console.error("Gemini sentiment analysis invalid JSON:", text);
      return { sentiment: "unknown", urgency: 5, keywords: [], affectedCount: 1 };
    }
  } catch (err) {
    console.error("Gemini sentiment analysis error:", err);
    return { sentiment: "unknown", urgency: 5, keywords: [], affectedCount: 1 };
  }
}

// Smart worker suggestion based on complaint and available workers
async function suggestWorker(complaint, workers) {
  if (!workers || workers.length === 0) return null;

  try {
    // Calculate score for each worker
    const workerScores = workers.map(worker => {
      let score = 0;

      // Factor 1: Same department (40 points)
      if (worker.department === complaint.department) {
        score += 40;
      }

      // Factor 2: Workload (30 points - inverse)
      const activeCount = worker.activeComplaints || 0;
      const workloadScore = Math.max(0, 30 - (activeCount * 5));
      score += workloadScore;

      // Factor 3: Performance/Rating (20 points)
      const rating = worker.avgRating || 3;
      const performanceScore = (rating / 5) * 20;
      score += performanceScore;

      // Factor 4: Completion rate (10 points)
      const totalResolved = worker.totalResolved || 0;
      const totalAssigned = totalResolved + activeCount;
      const completionRate = totalAssigned > 0 ? totalResolved / totalAssigned : 0;
      score += completionRate * 10;

      return {
        workerId: worker._id,
        workerName: worker.fullName || worker.username,
        score: Math.round(score),
        reason: `${worker.department} specialist, ${activeCount} active, ${rating.toFixed(1)}⭐`
      };
    });

    // Sort by score and return top 3
    const topWorkers = workerScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return topWorkers;
  } catch (err) {
    console.error("Worker suggestion error:", err);
    return null;
  }
}

// Enhanced complaint analysis with image description
async function analyzeComplaintWithImage(description, imageUrl = null) {
  if (!genAI) return { department: "Other", priority: "Medium", refinedText: description };

  try {
    const model = genAI.getGenerativeModel({ 
      model: imageUrl ? "gemini-2.0-flash-exp" : GEMINI_PRIMARY_MODEL 
    });

    const safeDesc = sanitizeInput(description);
    let prompt = `Analyze this complaint and categorize it:

Description: "${safeDesc}"
${imageUrl ? `Image URL: ${imageUrl}` : ''}

Return ONLY valid JSON:
{
  "department": "Road" | "Water" | "Electricity" | "Waste" | "Drainage" | "Other",
  "priority": "Low" | "Medium" | "High",
  "refinedText": "Clear, concise description",
  "confidence": 0-100 (number),
  "reasoning": "Brief explanation"
}

Department Guidelines:
- Road: potholes, cracks, road damage, traffic signs, zebra crossings
- Water: leaks, burst pipes, water shortage, contamination, tanker issues
- Electricity: power outage, streetlight not working, exposed wires, pole damage
- Waste: garbage not collected, overflowing bins, littering, sanitation
- Drainage: blocked drains, waterlogging, sewage overflow, manhole issues
- Other: anything else

Priority Guidelines:
- High: Safety hazards, affecting many people, urgent situations, dangerous conditions
- Medium: Causing inconvenience, needs attention soon
- Low: Minor issues, cosmetic problems, can wait

Return only JSON.`;

    const response = await model.generateContent(prompt);
    let text = response.response.text().trim();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const json = JSON.parse(text);
      return json;
    } catch (err) {
      console.error("Gemini image analysis invalid JSON:", text);
      return { 
        department: "Other", 
        priority: "Medium", 
        refinedText: description,
        confidence: 50
      };
    }
  } catch (err) {
    console.error("Gemini image analysis error:", err);
    return { 
      department: "Other", 
      priority: "Medium", 
      refinedText: description,
      confidence: 50
    };
  }
}

module.exports = { 
  analyze, 
  analyzeSentiment, 
  suggestWorker,
  analyzeComplaintWithImage,
  genAI,
  sanitizeInput,
};
