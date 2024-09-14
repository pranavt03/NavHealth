import React, { useState, useRef } from 'react';
import axios from 'axios';

const AudioRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const [chunks, setChunks] = useState([]);

  const startRecording = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setChunks((prevChunks) => [...prevChunks, event.data]);
        }
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } else {
      console.error('Media devices are not supported');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setRecording(false);

      const audioBlob = new Blob(chunks, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioUrl);
      setChunks([]);

      await uploadAndTranscribe(audioBlob);
    }
  };

  const uploadAndTranscribe = async (audioBlob) => {
    setUploading(true);
    try {
      // Create FormData and append the audio blob
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');

      // Upload the audio file to AssemblyAI
      const uploadResponse = await axios.post('https://api.assemblyai.com/v2/upload', formData, {
        headers: {
          'authorization': 'YOUR_ASSEMBLYAI_API_KEY', // Replace with your actual API key
          'Content-Type': 'multipart/form-data',
        },
      });

      const audioUrl = uploadResponse.data.upload_url;

      // Request transcription of the uploaded audio
      const transcriptResponse = await axios.post('https://api.assemblyai.com/v2/transcript', {
        audio_url: audioUrl,
      }, {
        headers: {
          'authorization': 'YOUR_ASSEMBLYAI_API_KEY', // Replace with your actual API key
          'Content-Type': 'application/json',
        },
      });

      const transcriptId = transcriptResponse.data.id;

      // Function to check the status of the transcription
      const checkTranscriptionStatus = async (transcriptId) => {
        try {
          const statusResponse = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
            headers: {
              'authorization': 'YOUR_ASSEMBLYAI_API_KEY', // Replace with your actual API key
            },
          });

          if (statusResponse.data.status === 'completed') {
            setTranscription(statusResponse.data.text);
            setUploading(false);
          } else if (statusResponse.data.status === 'failed') {
            console.error('Transcription failed');
            setTranscription('Transcription failed.');
            setUploading(false);
          } else {
            // Polling: check again after 5 seconds if not completed
            setTimeout(() => checkTranscriptionStatus(transcriptId), 5000);
          }
        } catch (error) {
          console.error('Error checking transcription status:', error);
          setTranscription('Error occurred during transcription.');
          setUploading(false);
        }
      };

      checkTranscriptionStatus(transcriptId);
    } catch (error) {
      console.error('Error uploading or transcribing:', error);
      setUploading(false);
    }
  };

  return (
    <div>
      <h1>Speech to Text Transcription</h1>
      <button onClick={startRecording} disabled={recording}>Start Recording</button>
      <button onClick={stopRecording} disabled={!recording}>Stop Recording</button>

      {uploading && <p>Uploading and transcribing...</p>}
      {audioUrl && <audio src={audioUrl} controls />}
      {transcription && <div><h2>Transcription:</h2><p>{transcription}</p></div>}
    </div>
  );
};

export default AudioRecorder;