import express from "express";
import { askRAG } from "../services/ragService.js";

const router = express.Router();

router.post("/rag/ask", async (req, res) => {
  try {
    const { query } = req.body;
    const result = await askRAG(query);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "RAG failed" });
  }
});

export default router;
