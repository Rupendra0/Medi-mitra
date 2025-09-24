import fs from "fs";
import cosineSimilarity from "cosine-similarity";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });
const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Safely load vector store from file
 */
function loadVectorStore(path) {
  try {
    if (!fs.existsSync(path)) {
      console.warn("⚠️ vectorstore.json not found. Using empty store.");
      return [];
    }

    const raw = fs.readFileSync(path, "utf8");
    if (!raw.trim()) {
      console.warn("⚠️ vectorstore.json is empty.");
      return [];
    }

    return JSON.parse(raw);
  } catch (err) {
    console.error("⚠️ Failed to load vectorstore.json:", err.message);
    return [];
  }
}

const vectorStore = loadVectorStore("./utils/vectorstore.json");

/**
 * Embed a query into a vector
 */
async function embedQuery(query) {
  try {
    const result = await embedModel.embedContent(query);
    return result.embedding.values;
  } catch (err) {
    console.error("⚠️ Embedding failed:", err.message);
    return null;
  }
}

/**
 * Search docs by cosine similarity
 */
function searchDocs(queryEmbedding, k = 3) {
  if (!queryEmbedding || !vectorStore.length) return [];

  return vectorStore
    .map(doc => ({
      ...doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Main RAG query function
 */
export async function askRAG(query) {
  if (!vectorStore.length) {
    return {
      reply: "⚠️ Knowledge base is not available right now. Please try again later.",
      sources: []
    };
  }

  const qEmb = await embedQuery(query);
  if (!qEmb) {
    return {
      reply: "⚠️ Could not process your query. Please try again later.",
      sources: []
    };
  }

  const hits = searchDocs(qEmb, 3);
  const context = hits.map(h => h.text).join("\n\n") || "No relevant documents found.";

  const prompt = `
You are MEDI_MITRA, a healthcare helper.
Answer ONLY using the provided documents.
If unsure, say: "Not certain — please consult a doctor."

Documents:
${context}

User: "${query}"
  `;

  try {
    const result = await chatModel.generateContent(prompt);
    const reply = await result.response.text();
    return { reply, sources: hits };
  } catch (err) {
    console.error("⚠️ Chat model error:", err.message);
    return {
      reply: "⚠️ Server error while generating a response. Please try again later.",
      sources: hits
    };
  }
}
