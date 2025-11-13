# 🩺 Elevenlabs JS Demo App (React + Node)

This demo app shows how to integrate **AWS HealthScribe** with a simple **React + Node.js** setup.  
It records audio, uploads it to S3, triggers HealthScribe, and shows the transcription results.  

---

## 🧰 Features
- 🎙️ Record audio via browser
- ☁️ Upload to backend (Node + Express)
- 🧠 Call AWS HealthScribe API
- 📜 Display transcription below
- No database — just a working demo flow

---

## 🏗️ Project Structure

```
/healthscribe-demo
 ├── backend/
 │   ├── index.js
 │   ├── routes/
 │   │   ├── upload.js
 │   │   └── healthscribe.js
 │   ├── package.json
 │   └── .env
 ├── frontend/
 │   ├── src/
 │   │   ├── App.jsx
 │   │   └── components/Recorder.jsx
 │   ├── package.json
 │   └── vite.config.js
 └── README.md
```

---

## ⚙️ Step 1. Backend Setup (Node + Express)

### 1️⃣ Navigate and Initialize
```bash
mkdir healthscribe-demo && cd healthscribe-demo
mkdir backend && cd backend
npm init -y
npm install express multer cors dotenv @aws-sdk/client-s3 @aws-sdk/client-healthscribe
```

---

### 2️⃣ `.env` file
```env
AWS_REGION=us-east-1
AWS_AUDIO_BUCKET=my-healthscribe-audio
AWS_RESULTS_BUCKET=my-healthscribe-results
AWS_HEALTHSCRIBE_ROLE=arn:aws:iam::<your-account-id>:role/HealthScribeAccessRole
PORT=5000
```

---

### 3️⃣ `index.js`
```js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import uploadRouter from "./routes/upload.js";
import healthscribeRouter from "./routes/healthscribe.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/upload", uploadRouter);
app.use("/api/healthscribe", healthscribeRouter);

app.listen(process.env.PORT, () => {
  console.log(`🚀 Backend running on port ${process.env.PORT}`);
});
```

---

### 4️⃣ `routes/upload.js`
```js
import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const s3 = new S3Client({ region: process.env.AWS_REGION });

router.post("/", upload.single("audio"), async (req, res) => {
  try {
    const { buffer, originalname } = req.file;
    const key = `uploads/${Date.now()}-${originalname}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_AUDIO_BUCKET,
        Key: key,
        Body: buffer,
      })
    );
    res.json({ key });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
```

---

### 5️⃣ `routes/healthscribe.js`
```js
import express from "express";
import dotenv from "dotenv";
import {
  HealthScribeClient,
  StartMedicalScribeJobCommand,
  GetMedicalScribeJobCommand,
} from "@aws-sdk/client-healthscribe";

dotenv.config();
const router = express.Router();
const client = new HealthScribeClient({ region: process.env.AWS_REGION });

router.post("/start", async (req, res) => {
  try {
    const { s3Key } = req.body;
    const jobName = `hs-demo-${Date.now()}`;

    const command = new StartMedicalScribeJobCommand({
      MedicalScribeJobName: jobName,
      Media: {
        MediaFileUri: `s3://${process.env.AWS_AUDIO_BUCKET}/${s3Key}`,
      },
      OutputBucketName: process.env.AWS_RESULTS_BUCKET,
      DataAccessRoleArn: process.env.AWS_HEALTHSCRIBE_ROLE,
      LanguageCode: "en-US",
    });

    await client.send(command);
    res.json({ jobName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "HealthScribe job start failed" });
  }
});

router.get("/status/:name", async (req, res) => {
  try {
    const command = new GetMedicalScribeJobCommand({
      MedicalScribeJobName: req.params.name,
    });
    const data = await client.send(command);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});

export default router;
```

---

## 💻 Step 2. Frontend (React + Vite)

### 1️⃣ Setup
```bash
cd ..
npm create vite@latest frontend -- --template react
cd frontend
npm install axios react-mic
```

---

### 2️⃣ `src/App.jsx`
```jsx
import Recorder from "./components/Recorder";

export default function App() {
  return (
    <div className="app">
      <h1>🩺 Elevenlabs JS Demo</h1>
      <Recorder />
    </div>
  );
}
```

---

### 3️⃣ `src/components/Recorder.jsx`
```jsx
import { useState } from "react";
import axios from "axios";
import { ReactMic } from "react-mic";

export default function Recorder() {
  const [record, setRecord] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [jobName, setJobName] = useState("");

  const onStop = async (recordedBlob) => {
    try {
      const formData = new FormData();
      formData.append("audio", recordedBlob.blob, "demo.wav");
      const uploadRes = await axios.post("http://localhost:5000/api/upload", formData);
      const startRes = await axios.post("http://localhost:5000/api/healthscribe/start", {
        s3Key: uploadRes.data.key,
      });
      setJobName(startRes.data.jobName);
      checkStatus(startRes.data.jobName);
    } catch (err) {
      console.error(err);
    }
  };

  const checkStatus = async (name) => {
    const interval = setInterval(async () => {
      const res = await axios.get(`http://localhost:5000/api/healthscribe/status/${name}`);
      if (res.data.MedicalScribeJob?.MedicalScribeJobStatus === "COMPLETED") {
        clearInterval(interval);
        const outputUri = res.data.MedicalScribeJob.MedicalScribeOutput.OutputBucketName;
        setTranscript(`Transcription complete! Check S3 bucket: ${outputUri}`);
      }
    }, 10000);
  };

  return (
    <div>
      <ReactMic record={record} className="sound-wave" mimeType="audio/wav" />
      <button onClick={() => setRecord(!record)}>
        {record ? "⏹ Stop Recording" : "🎙️ Start Recording"}
      </button>
      <button onClick={() => setTranscript("")}>Clear</button>

      <div style={{ marginTop: "20px" }}>
        <h3>Job: {jobName}</h3>
        <pre>{transcript}</pre>
      </div>
    </div>
  );
}
```

---

## 🧪 Step 3. Run the Demo

### Start backend
```bash
cd backend
node index.js
```

### Start frontend
```bash
cd ../frontend
npm run dev
```

---

## ✅ Demo Flow

1. Open `http://localhost:5173`
2. Click **Start Recording**
3. Speak for a few seconds
4. Click **Stop**
5. Wait ~20–30s for AWS job completion
6. The UI shows job info & where to check the S3 transcription output

---

## ⚠️ Notes
- HealthScribe is **asynchronous** — transcription may take up to a minute.
- You’ll need valid **IAM Role + S3 buckets** configured.
- This demo skips PHI encryption and secure auth (for simplicity).

---

## 🚀 Next Steps
- Stream real-time results (AWS Transcribe WebSocket)
- Display extracted entities (diagnoses, meds)
- Use Bedrock/GPT for auto-summary & SOAP note generation

---

🧩 **Author**: Generated via ChatGPT (GPT-5)  
📅 **Demo purpose only**
