// ingest.js
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embedModel = genAI.getGenerativeModel({ model: "embedding-001" });

// Simple text splitter (you can replace with smarter chunking if needed)
function chunkText(text, chunkSize = 500) {
  const words = text.split(" ");
  let chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(" "));
  }
  return chunks;
}

async function embedAndSaveDocs() {
  // Example docs (replace with WHO or public health data)
  const docs = [
    { id: 1, text: "Fever is often caused by infection. Drink fluids and rest." },
    { id: 2, text: "Headache may be due to dehydration, stress, or migraine." },
    { id: 3, text: "Cough could be from cold, flu, or respiratory infection." }
  ];

  let vectorStore = [];

  for (let doc of docs) {
    const chunks = chunkText(doc.text);
    for (let chunk of chunks) {
      const result = await embedModel.embedContent(chunk);
      vectorStore.push({
        id: doc.id,
        text: chunk,
        embedding: result.embedding.values
      });
    }
  }

  fs.writeFileSync("vectorstore.json", JSON.stringify(vectorStore, null, 2));
  console.log("✅ Vectorstore created with", vectorStore.length, "chunks");
}

embedAndSaveDocs();
