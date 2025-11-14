import express from "express";
import multer from "multer";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Initialize ElevenLabs client
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

function formatDiarizedTranscript(words) {
  const result = [];
  let currentSpeaker = null;
  let currentText = [];

  for (const w of words) {
    if (w.speakerId !== currentSpeaker) {
      // Speaker changed → save previous block
      if (currentText.length > 0) {
        result.push({
          speaker: currentSpeaker,
          text: currentText.join("")
        });
      }

      // Reset for new speaker block
      currentSpeaker = w.speakerId;
      currentText = [];
    }

    currentText.push(w.text);
  }

  // Push last block
  if (currentText.length > 0) {
    result.push({
      speaker: currentSpeaker,
      text: currentText.join("")
    });
  }

  return result;
}

router.post("/", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const { buffer } = req.file;

    // Convert audio directly to text using ElevenLabs
    const transcription = await elevenlabs.speechToText.convert({
      file: buffer, // Direct file buffer - no S3 needed!
      modelId: "scribe_v1", // Use scribe_v1 model
      languageCode: "en", // Language code
      diarize: true, // Enable speaker diarization
      tagAudioEvents: true, // Tag audio events like laughter, etc.
    });

    // Format transcript with speaker diarization
    const formattedTranscript = formatDiarizedTranscript(transcription.words);

    // Format transcript text from formatted segments
    const transcriptText = formattedTranscript.map((seg) => {
      return `${seg.speaker}:\n\n${seg.text}\n`;
    }).join("\n");

    // Get unique speakers from formattedTranscript
    const speakers = [...new Set(formattedTranscript.map(seg => seg.speaker))];

    // Return transcript to frontend with speaker information
    res.json({ 
      transcript: transcriptText,
      speakers: speakers.length > 0 ? speakers : null,
      orderedSegments: formattedTranscript,
      status: "completed"
    });
  } catch (error) {
    console.error("Transcription error:", error);
    res.status(500).json({ 
      error: "Transcription failed", 
      details: error.message || "Unknown error"
    });
  }
});

export default router;
