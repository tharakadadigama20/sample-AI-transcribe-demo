import express from "express";
import dotenv from "dotenv";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

const router = express.Router();
const client = new TranscribeClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });

router.post("/start", async (req, res) => {
  try {
    const { s3Key } = req.body;

    if (!s3Key) {
      return res.status(400).json({ error: "s3Key is required" });
    }

    const jobName = `transcribe-demo-${Date.now()}`;

    const command = new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: {
        MediaFileUri: `s3://${process.env.AWS_AUDIO_BUCKET}/${s3Key}`,
      },
      OutputBucketName: process.env.AWS_RESULTS_BUCKET,
      OutputKey: `transcripts/${jobName}.json`,
      LanguageCode: "en-US",
      MediaFormat: "wav",
    });

    const response = await client.send(command);
    res.json({ jobName: response.TranscriptionJob?.TranscriptionJobName || jobName });
  } catch (err) {
    console.error("Transcribe start error:", err);
    res.status(500).json({ 
      error: "Transcribe job start failed", 
      details: err.message 
    });
  }
});

router.get("/status/:name", async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) {
      return res.status(400).json({ error: "Job name is required" });
    }

    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: name,
    });

    const data = await client.send(command);
    res.json(data);
  } catch (err) {
    console.error("Transcribe status error:", err);
    res.status(500).json({ 
      error: "Failed to fetch job status", 
      details: err.message 
    });
  }
});

router.get("/transcript/:name", async (req, res) => {
  try {
    const { name } = req.params;

    if (!name) {
      return res.status(400).json({ error: "Job name is required" });
    }

    const statusCommand = new GetTranscriptionJobCommand({
      TranscriptionJobName: name,
    });

    const statusData = await client.send(statusCommand);
    const job = statusData.TranscriptionJob;

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (job.TranscriptionJobStatus !== "COMPLETED") {
      return res.json({ 
        status: job.TranscriptionJobStatus,
        message: "Job not completed yet" 
      });
    }

    const transcriptUri = job.Transcript?.TranscriptFileUri;
    
    if (!transcriptUri) {
      return res.status(404).json({ error: "Transcript file URI not found" });
    }

    // Parse S3 URI: s3://bucket-name/key
    const uriMatch = transcriptUri.match(/s3:\/\/([^/]+)\/(.+)/);
    if (!uriMatch) {
      return res.status(400).json({ error: "Invalid transcript URI format" });
    }

    const [, bucket, key] = uriMatch;

    const getObjectCommand = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const transcriptData = await s3.send(getObjectCommand);
    const transcriptJson = await transcriptData.Body.transformToString();
    
    // Parse JSON and extract transcript text
    let transcriptText = transcriptJson;
    try {
      const parsed = JSON.parse(transcriptJson);
      // Transcribe JSON structure: results.transcripts[0].transcript
      if (parsed.results?.transcripts?.[0]?.transcript) {
        transcriptText = parsed.results.transcripts[0].transcript;
      } else if (parsed.Transcript) {
        transcriptText = parsed.Transcript;
      } else if (typeof parsed === "string") {
        transcriptText = parsed;
      } else {
        // Return formatted JSON if structure is different
        transcriptText = JSON.stringify(parsed, null, 2);
      }
    } catch (parseErr) {
      // If not JSON, return as-is
      console.log("Transcript is not JSON, returning as text");
    }

    res.json({ transcript: transcriptText });
  } catch (err) {
    console.error("Transcript fetch error:", err);
    res.status(500).json({ 
      error: "Failed to fetch transcript", 
      details: err.message 
    });
  }
});

export default router;

