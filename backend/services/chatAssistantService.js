const { GoogleGenerativeAI } = require("@google/generative-ai");
const { analyze } = require("./geminiService");

const CHAT_MODELS = ["gemini-2.5-flash", "gemini-3-flash-preview"];

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

function hasGeminiClient() {
  return Boolean(genAI);
}

async function generateWithModel(modelName, prompt, inlineAudio = null) {
  const model = genAI.getGenerativeModel({ model: modelName });
  const parts = [];
  if (inlineAudio) parts.push({ inlineData: inlineAudio });
  parts.push(prompt);
  const result = await model.generateContent(parts);
  return result.response.text().trim();
}

async function runGeminiWithFallback(prompt, inlineAudio = null) {
  if (!genAI) {
    throw new Error("Gemini API key not configured");
  }
  let lastError = null;
  for (const modelName of CHAT_MODELS) {
    try {
      return await generateWithModel(modelName, prompt, inlineAudio);
    } catch (error) {
      lastError = error;
      console.error(
        `Gemini model ${modelName} failed:`,
        error?.message || error,
      );
    }
  }
  throw lastError || new Error("No Gemini model available");
}

async function generateChatResponse(message, conversationHistory = []) {
  const lowerMessage = String(message || "").toLowerCase();

  if (
    lowerMessage.includes("complaint") ||
    lowerMessage.includes("problem") ||
    lowerMessage.includes("issue") ||
    lowerMessage.includes("report")
  ) {
    try {
      const analysis = await analyze(message);

      if (analysis.type === "newComplaint") {
        return `I understand you want to report: "${analysis.refinedText}". This appears to be a ${analysis.department} department issue with ${analysis.priority} priority. Would you like me to help you register this complaint? Please provide your location details if you'd like to proceed.`;
      }

      if (analysis.type === "statusQuery") {
        return "I can help you check your complaint status. Please provide your complaint ID, or I can look up your most recent complaint if you're logged in.";
      }
    } catch (error) {
      console.error("Analysis error:", error);
    }
  }

  if (genAI) {
    try {
      const context =
        conversationHistory.length > 0
          ? `Previous conversation:\n${conversationHistory
              .map((msg) => `${msg.role || "user"}: ${msg.text}`)
              .join("\n")}\n\n`
          : "";

      const prompt = `${context}You are a helpful municipal assistant chatbot. The user is interacting with a municipal complaints system.

Respond helpfully to their query: "${message}"

Keep responses concise, friendly, and relevant to municipal services. If they ask about complaints, guide them to register or check status.

Available services:
- Complaint registration
- Complaint status tracking
- Information about municipal services
- Office hours and contact information

Respond in a conversational tone.`;

      return await runGeminiWithFallback(prompt);
    } catch (error) {
      console.error("Gemini chat error:", error);
    }
  }

  if (
    lowerMessage.includes("hello") ||
    lowerMessage.includes("hi") ||
    lowerMessage.includes("hey")
  ) {
    return "Hello! I'm your municipal assistant. I can help you register complaints, check complaint status, or provide information about our services. How can I assist you today?";
  }

  if (lowerMessage.includes("help")) {
    return "I can assist you with:\nâ€¢ Registering new complaints\nâ€¢ Checking complaint status\nâ€¢ Information about municipal services\nâ€¢ Office hours and contact details\nâ€¢ Service procedures\n\nWhat would you like to know more about?";
  }

  if (
    lowerMessage.includes("office hours") ||
    lowerMessage.includes("timing")
  ) {
    return "Our office hours are:\nMonday-Friday: 9:00 AM - 6:00 PM\nSaturday: 9:00 AM - 2:00 PM\nNo service on Sundays and public holidays.";
  }

  if (lowerMessage.includes("contact") || lowerMessage.includes("phone")) {
    return "You can reach us at:\nPhone: 1800-123-4567\nEmail: complaints@municipality.gov\nAddress: Municipal Corporation Office, 123 Civic Center";
  }

  return "I understand you need assistance. I can help you register complaints, check status, or provide information about municipal services. Could you please be more specific about what you need help with?";
}

module.exports = {
  hasGeminiClient,
  runGeminiWithFallback,
  generateChatResponse,
};
