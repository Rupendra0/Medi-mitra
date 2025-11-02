import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import "../styles/page.css";
import { useLanguage } from '../utils/LanguageProvider';

export default function SymptomChecker() {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const { t, lang } = useLanguage();

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

  // localized symptoms array (stored in translations as an array)
  const localizedSymptoms = Array.isArray(t('symptomsList')) ? t('symptomsList') : [];

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms((prev) =>
      prev.includes(symptom)
        ? prev.filter((s) => s !== symptom)
        : [...prev, symptom]
    );
  };

  const checkSymptoms = async () => {
    if (selectedSymptoms.length === 0) {
      setResult(t('pleaseSelectSymptom'));
      return;
    }

    setLoading(true);
    setResult("");
    setShowOverlay(false);
    setHasResult(false);

    try {
      const res = await fetch(`${API_URL}/api/gemini-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${t('patientQueryPrefix') || 'Patient reports the following symptoms:'} ${selectedSymptoms.join(", ")}.`,
          language: lang
        }),
      });

      const data = await res.json();
      const reply = data.reply || t('aiNoResponse');
      const hasReply = !!reply;
      setResult(reply);
      setHasResult(hasReply);
      setShowOverlay(hasReply);
    } catch (err) {
      console.error("Error calling AI:", err);
      const fallback = t('aiError');
      setResult(fallback);
      setHasResult(true);
      setShowOverlay(true);
    } finally {
      setLoading(false);
    }
  };

  const closeOverlay = () => {
    setShowOverlay(false);
  };

  return (
    <div className="symptom-checker">
      <h2>{t('symptomCheckerTitle')}</h2>
      <p>{t('selectSymptoms')}</p>

      <div className="symptom-grid">
        {(localizedSymptoms.length ? localizedSymptoms : ["Fever","Cough"]).map((symptom) => (
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
        {loading ? `${t('checking')}` : `${t('checkSymptomsButton')}`}
      </button>

      {result && (
        <div className="result markdown-output">
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      )}

      {hasResult && (
        <button
          type="button"
          className="symptom-checker__expand"
          onClick={() => setShowOverlay(true)}
        >
          {t('expandFullView') || 'View full report'}
        </button>
      )}

      {showOverlay && result && (
        <div className="symptom-checker-overlay" role="dialog" aria-modal="true">
          <div
            className="symptom-checker-overlay__backdrop"
            onClick={closeOverlay}
            aria-hidden="true"
          />
          <div className="symptom-checker-overlay__card">
            <button
              type="button"
              className="symptom-checker-overlay__close"
              onClick={closeOverlay}
              aria-label={t('close') || 'Close'}
            >
              ×
            </button>
            <div className="symptom-checker-overlay__content markdown-output">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
