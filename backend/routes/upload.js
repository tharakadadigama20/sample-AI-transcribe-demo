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

    // Log the response structure for debugging
    console.log("Transcription response type:", typeof transcription);
    console.log("Transcription response keys:", transcription ? Object.keys(transcription) : "null");
    if (transcription && typeof transcription === "object") {
      console.log("Transcription response sample:", JSON.stringify(transcription).substring(0, 500));
    }

    // Format transcript with speaker diarization in chronological order
    let transcriptText = "";
    let speakers = [];
    let orderedSegments = []; // Keep segments in chronological order
    
    // Handle different response formats
    if (typeof transcription === "string") {
      // If it's a string, try to parse it as JSON first
      try {
        const parsed = JSON.parse(transcription);
        if (parsed.segments || parsed.utterances) {
          transcription = parsed;
        } else {
          transcriptText = transcription;
        }
      } catch (e) {
        transcriptText = transcription;
      }
    }
    
    // Check for segments/utterances in various possible locations
    let segments = null;
    if (transcription?.segments) {
      segments = transcription.segments;
    } else if (transcription?.utterances) {
      segments = transcription.utterances;
    } else if (transcription?.results?.segments) {
      segments = transcription.results.segments;
    } else if (transcription?.results?.utterances) {
      segments = transcription.results.utterances;
    } else if (Array.isArray(transcription)) {
      segments = transcription;
    }
    
    if (segments && Array.isArray(segments) && segments.length > 0) {
      console.log("Found segments:", segments.length);
      console.log("First segment sample:", JSON.stringify(segments[0]));
      
      // Sort segments by start time to maintain chronological order
      const sortedSegments = [...segments].sort((a, b) => {
        const timeA = a.start !== undefined ? a.start : (a.start_time !== undefined ? a.start_time : (a.startTime || 0));
        const timeB = b.start !== undefined ? b.start : (b.start_time !== undefined ? b.start_time : (b.startTime || 0));
        return timeA - timeB;
      });
      
      // Process segments in chronological order
      sortedSegments.forEach((segment, index) => {
        const speakerId = segment.speaker || segment.speaker_id || segment.speakerId || segment.speaker_label || `Speaker ${index + 1}`;
        const text = segment.text || segment.transcript || segment.word || "";
        
        if (!text.trim()) return; // Skip empty segments
        
        // Track unique speakers
        if (!speakers.includes(speakerId)) {
          speakers.push(speakerId);
        }
        
        // Store segment with speaker info in order
        orderedSegments.push({
          speaker: speakerId,
          text: text.trim()
        });
      });
      
      // Format transcript in chronological order
      const formattedSegments = orderedSegments.map((seg) => {
        return `${seg.speaker}:\n\n${seg.text}\n`;
      });
      
      transcriptText = formattedSegments.join("\n");
    } else if (transcription?.text) {
      // Simple text response - if diarization is enabled but no segments, 
      // the text might still contain speaker info in the format
      const text = transcription.text;
      transcriptText = text;
      
      // Try to parse speaker labels from text if present
      // Some APIs return text with embedded speaker labels like "[Speaker 1] text"
      const speakerPattern = /\[?([Ss]peaker\s+\d+|[Ss]peaker\s*[A-Z])\]:?\s*(.+?)(?=\[?[Ss]peaker|$)/gi;
      const matches = [...text.matchAll(speakerPattern)];
      
      if (matches.length > 0) {
        orderedSegments = matches.map(match => ({
          speaker: match[1],
          text: match[2].trim()
        }));
        speakers = [...new Set(orderedSegments.map(s => s.speaker))];
      }
    } else if (transcription?.transcript) {
      transcriptText = transcription.transcript;
    } else {
      // Fallback: stringify the entire response for debugging
      console.log("Using fallback - full response:", JSON.stringify(transcription, null, 2));
      transcriptText = JSON.stringify(transcription, null, 2);
    }

    // Return transcript to frontend with speaker information
    res.json({ 
      transcript: transcriptText,
      speakers: speakers.length > 0 ? speakers : null,
      orderedSegments: orderedSegments.length > 0 ? orderedSegments : null,
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
