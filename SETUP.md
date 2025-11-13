# 🚀 Setup and Run Instructions

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- ElevenLabs API key ([Get one here](https://elevenlabs.io/app/settings/api-keys))

## Step 1: Backend Setup

```bash
cd backend
npm install
```

### Configure Environment Variables

Create a `.env` file in the `backend` directory:

```bash
# Create .env file manually or copy from example
```

Edit `.env` with your ElevenLabs API key:

```env
ELEVENLABS_API_KEY=your_api_key_here
PORT=5000
```

**Important**: 
- Get your API key from [ElevenLabs Dashboard](https://elevenlabs.io/app/settings/api-keys)
- Keep your API key secure and never commit it to version control

## Step 2: Frontend Setup

```bash
cd ../frontend
npm install
```

## Step 3: Run the Application

### Terminal 1 - Start Backend

```bash
cd backend
npm start
```

You should see: `🚀 Backend running on port 5000`

### Terminal 2 - Start Frontend

```bash
cd frontend
npm run dev
```

You should see: `Local: http://localhost:5173`

## Step 4: Test the Application

1. Open your browser and navigate to `http://localhost:5173`
2. Click the **record button** to start recording
3. Speak for a few seconds
4. Click **stop** to finish recording
5. Wait for transcription (usually takes 5-15 seconds)
6. The transcript will appear below when complete

## Troubleshooting

### Backend Issues

- **Port already in use**: Change `PORT` in `.env` or kill the process using port 5000
- **API key error**: Verify your ElevenLabs API key is correct and has sufficient credits
- **Transcription fails**: Check backend logs for error details. Ensure audio format is supported (WAV, MP3, etc.)

### Frontend Issues

- **Cannot connect to backend**: Ensure backend is running on port 5000
- **CORS errors**: Backend CORS is enabled, but check if firewall is blocking connections
- **Recording not working**: Grant microphone permissions in your browser

### Common Issues

- **Transcription timeout**: Large audio files may take longer. Check backend logs.
- **Transcript not showing**: Check browser console and backend logs for errors
- **API rate limits**: ElevenLabs has rate limits based on your plan. Check your usage in the dashboard

## Project Structure

```
speech-to-text-demo/
├── backend/
│   ├── index.js                 # Express server entry point
│   ├── routes/
│   │   └── upload.js            # Audio upload and transcription route
│   ├── package.json
│   └── .env                     # Environment variables (create manually)
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main app component
│   │   ├── main.jsx             # React entry point
│   │   ├── index.css            # Styles
│   │   └── components/
│   │       └── Recorder.jsx     # Audio recorder component
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
└── README.md
```

## API Endpoints

- `POST /api/upload` - Upload audio file and get transcription (returns transcript directly)

## Notes

- **No S3 required**: Audio is sent directly to ElevenLabs API
- **Fast transcription**: Usually completes in 5-15 seconds
- **Speaker diarization**: Enabled by default (identifies different speakers)
- **Audio event tagging**: Enabled by default (tags laughter, applause, etc.)
- **No database required**: This is a demo application
- **Supported formats**: WAV, MP3, and other common audio formats

## ElevenLabs Features Used

- **Model**: `scribe_v1` (Speech-to-Text model)
- **Language**: English (`en`)
- **Speaker Diarization**: Enabled (identifies who is speaking)
- **Audio Event Tagging**: Enabled (tags events like laughter, applause)

For more information, visit [ElevenLabs Speech-to-Text Documentation](https://elevenlabs.io/docs/cookbooks/speech-to-text/quickstart)
