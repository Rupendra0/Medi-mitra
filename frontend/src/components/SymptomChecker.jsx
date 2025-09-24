import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import "../styles/page.css";

const symptomsList = [
  "Fever", "Cough", "Headache", "Fatigue", "Shortness of breath", "Body ache", "Sore throat", "Nausea", "Vomiting", "Diarrhea", "Constipation", "Stomach pain", "Chest pain", "Back pain", "Joint pain", "Dizziness", "Loss of appetite", "Weight loss", "Swelling (Edema)", "Skin rash", "Itching", "Chills", "Runny nose", "Eye redness", "Ear pain", "Toothache", "Burning urination", "Frequent urination"
];


export default function SymptomChecker() {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const checkSymptoms = async () => {
    if (selectedSymptoms.length === 0) {
      setResult("⚠️ Please select at least one symptom.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const res = await fetch(`${API_URL}/api/gemini-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `Patient reports the following symptoms: ${selectedSymptoms.join(", ")}.`
        }),
      });

      const data = await res.json();
      setResult(data.reply || "⚠️ No response from AI.");
    } catch (err) {
      console.error("Error calling AI:", err);
      setResult("❌ Failed to fetch AI response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="symptom-checker">
      <h2>🧠 AI Symptom Checker</h2>
      <p>Select symptoms you're experiencing:</p>

      <div className="symptom-grid">
        {symptomsList.map((symptom) => (
          <button
            key={symptom}
            onClick={() => toggleSymptom(symptom)}
            className={`symptom-button ${selectedSymptoms.includes(symptom) ? "selected" : ""
              }`}
          >
            {symptom}
          </button>
        ))}
      </div>

      <button className="check-button" onClick={checkSymptoms} disabled={loading}>
        {loading ? "⏳ Checking..." : "✅ Check Symptoms"}
      </button>

      {result && (
        <div className="result markdown-output">
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
