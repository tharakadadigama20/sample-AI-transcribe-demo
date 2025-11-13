import { useState } from "react";
import axios from "axios";
import { AudioRecorder } from "react-audio-voice-recorder";

const API_BASE_URL = "http://localhost:5000/api";

export default function Recorder() {
  const [transcript, setTranscript] = useState("");
  const [jobName, setJobName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [speakers, setSpeakers] = useState([]);
  const [orderedSegments, setOrderedSegments] = useState(null);

  const onStop = async (audioBlob) => {
    if (!audioBlob) {
      setError("No audio recorded");
      return;
    }

    setIsProcessing(true);
    setError("");
    setStatus("Sending audio to backend...");

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "demo.wav");

      setStatus("Transcribing audio... This usually takes 5-15 seconds...");

      const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 60000, // 1 minute timeout (ElevenLabs is usually faster)
      });

      if (response.data.transcript) {
        setTranscript(response.data.transcript);
        setJobName(response.data.jobName || "");
        setSpeakers(response.data.speakers || []);
        setOrderedSegments(response.data.orderedSegments || null);
        setStatus("Transcript received successfully!");
        setIsProcessing(false);
      } else {
        throw new Error("No transcript received from server");
      }
    } catch (err) {
      console.error("Error:", err);
      setError(
        err.response?.data?.error || err.response?.data?.details || err.message || "An error occurred"
      );
      setStatus("");
      setIsProcessing(false);
    }
  };


  const handleClear = () => {
    setTranscript("");
    setJobName("");
    setStatus("");
    setError("");
    setSpeakers([]);
    setOrderedSegments(null);
  };

  return (
    <div>
      <div style={{ margin: "20px 0", textAlign: "center" }}>
        <AudioRecorder
          onRecordingComplete={onStop}
          audioTrackConstraints={{
            noiseSuppression: true,
            echoCancellation: true,
          }}
          downloadOnSavePress={false}
          downloadFileExtension="wav"
          showVisualizer={true}
        />
      </div>
      <div style={{ textAlign: "center", margin: "20px 0" }}>
        <button onClick={handleClear} disabled={isProcessing}>
          Clear
        </button>
      </div>

      {status && (
        <div className="status">
          <strong>Status:</strong> {status}
        </div>
      )}

      {error && (
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {transcript && (
        <div className="transcript-container">
          <h3>Transcript:</h3>
          {orderedSegments ? (
            // Display in chronological order
            <div style={{ marginTop: "15px" }}>
              {orderedSegments.map((segment, index) => (
                <div key={index} style={{ marginBottom: "20px" }}>
                  <h4 style={{ 
                    marginBottom: "8px", 
                    color: "#007bff",
                    fontSize: "18px",
                    fontWeight: "bold"
                  }}>
                    {segment.speaker}:
                  </h4>
                  <div style={{ 
                    padding: "15px", 
                    background: "#f8f9fa", 
                    borderRadius: "6px",
                    borderLeft: "4px solid #007bff",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap"
                  }}>
                    {segment.text}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Fallback: display plain transcript
            <pre style={{ whiteSpace: "pre-wrap" }}>{transcript}</pre>
          )}
        </div>
      )}
    </div>
  );
}

