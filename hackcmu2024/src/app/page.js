'use client';
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Stethoscope, FileText, Calendar, ChevronDown, ChevronUp, User, X, Pill, Activity, Menu } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Mock data for demonstration (unchanged)
const patients = [
  { id: 1, name: "John Doe" },
  { id: 2, name: "Jane Smith" },
  { id: 3, name: "Bob Johnson" },
];

const patientData = {
  1: {
    vitals: { heartRate: 72, bloodPressure: "120/80", temperature: "98.6°F" },
    medications: ["Aspirin", "Lisinopril"],
    diagnoses: ["Hypertension", "Type 2 Diabetes"],
    notes: [
      { id: 1, title: "Initial Consultation", date: "2023-05-01", content: "Patient presented with complaints of frequent urination and increased thirst. Blood tests reveal elevated glucose levels. Diagnosed with Type 2 Diabetes. Prescribed Metformin and advised on dietary changes." },
      { id: 2, title: "Follow-up", date: "2023-06-15", content: "Patient's condition has improved. Blood glucose levels are stabilizing. Continuing current treatment plan. Encouraged patient to maintain diet and exercise regimen." },
    ],
    glucoseReadings: [
      { date: '2023-05-01', glucose: 180 },
      { date: '2023-05-15', glucose: 160 },
      { date: '2023-06-01', glucose: 140 },
      { date: '2023-06-15', glucose: 130 },
    ]
  },
  2: {
    vitals: { heartRate: 68, bloodPressure: "118/75", temperature: "98.2°F" },
    medications: ["Levothyroxine", "Vitamin D"],
    diagnoses: ["Hypothyroidism", "Vitamin D Deficiency"],
    notes: [
      { id: 1, title: "Initial Consultation", date: "2023-04-10", content: "Patient reported fatigue and weight gain. Blood tests showed low thyroid hormone levels. Diagnosed with hypothyroidism. Prescribed Levothyroxine and ordered follow-up tests." },
      { id: 2, title: "Follow-up", date: "2023-05-25", content: "Patient feeling more energetic. Thyroid levels improving but still below normal range. Adjusted Levothyroxine dosage. Also noted low Vitamin D levels and prescribed supplements." },
    ],
    thyroidReadings: [
      { date: '2023-04-10', tsh: 8.5 },
      { date: '2023-04-25', tsh: 6.2 },
      { date: '2023-05-10', tsh: 4.8 },
      { date: '2023-05-25', tsh: 3.5 },
    ]
  },
  3: {
    vitals: { heartRate: 76, bloodPressure: "130/85", temperature: "98.8°F" },
    medications: ["Atorvastatin", "Metoprolol"],
    diagnoses: ["High Cholesterol", "Hypertension"],
    notes: [
      { id: 1, title: "Initial Consultation", date: "2023-03-20", content: "Patient came in for routine check-up. Blood tests revealed high cholesterol levels. Blood pressure also elevated. Prescribed Atorvastatin for cholesterol and Metoprolol for hypertension. Advised on lifestyle changes including diet and exercise." },
      { id: 2, title: "Follow-up", date: "2023-05-05", content: "Patient reports adhering to medication regimen. Some improvement in cholesterol levels, but blood pressure still high. Increased Metoprolol dosage. Emphasized importance of reducing sodium intake and regular exercise." },
    ],
    cholesterolReadings: [
      { date: '2023-03-20', ldl: 160, hdl: 45 },
      { date: '2023-04-05', ldl: 150, hdl: 48 },
      { date: '2023-04-20', ldl: 140, hdl: 50 },
      { date: '2023-05-05', ldl: 130, hdl: 52 },
    ]
  }
};

export default function ClinicDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(patients[0]);
  const [expandedNote, setExpandedNote] = useState(null);

  // State and refs for recording and transcription
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  
  const assemblyAI = axios.create({
    baseURL: "https://api.assemblyai.com/v2",
    headers: {
        authorization: "773691fe44574433a4bef0cafbdabcee", // Replace with your actual API key
        "Content-Type": "application/json",
    },
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        await uploadAndTranscribe(audioBlob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const uploadAndTranscribe = async (audioBlob) => {
    setIsTranscribing(true);
    try {
      console.log('Starting upload and transcription process');
      
      // Upload the audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
  
      console.log('Uploading audio file');
      const uploadResponse = await assemblyAI.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
      });
  
      const audioUrl = uploadResponse.data.upload_url;
      console.log('Audio uploaded successfully. URL:', audioUrl);
  
      // Request transcription
      console.log('Requesting transcription');
      const transcriptResponse = await assemblyAI.post('/transcript', {
        audio_url: audioUrl
      });
  
      const transcriptId = transcriptResponse.data.id;
      console.log('Transcription requested. Transcript ID:', transcriptId);
  
      // Poll for transcription completion
      const getTranscript = async () => {
        try {
          console.log('Checking transcription status');
          const statusResponse = await assemblyAI.get(`/transcript/${transcriptId}`);
          
          console.log('Transcription status:', statusResponse.data.status);
          
          if (statusResponse.data.status === 'completed') {
            console.log('Transcription completed');
            setTranscription(statusResponse.data.text);
            setIsTranscribing(false);
          } else if (statusResponse.data.status === 'error') {
            console.error('Transcription failed:', statusResponse.data.error);
            setTranscription('Transcription failed. Please try again.');
            setIsTranscribing(false);
          } else {
            console.log('Transcription still in progress. Checking again in 3 seconds.');
            setTimeout(() => getTranscript(), 3000);
          }
        } catch (error) {
          console.error('Error checking transcription status:', error);
          setTranscription('Error occurred while checking transcription status.');
          setIsTranscribing(false);
        }
      };
  
      getTranscript();
    } catch (error) {
      console.error('Error uploading or transcribing:', error);
      setTranscription('Error occurred during transcription process.');
      setIsTranscribing(false);
    }
  };

  const patientInfo = patientData[selectedPatient.id];

  return (
    <div className="flex h-screen bg-black text-green-400 font-mono">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-gray-900 border-r border-green-500 transition-all duration-300 ease-in-out`}>
        <div className="flex justify-between items-center p-4">
          <h2 className={`text-xl font-bold ${sidebarOpen ? '' : 'hidden'}`}>Patients</h2>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-64px)]">
          {patients.map((patient) => (
            <Button
              key={patient.id}
              variant="ghost"
              className={`w-full justify-start ${selectedPatient.id === patient.id ? 'bg-green-900' : ''}`}
              onClick={() => setSelectedPatient(patient)}
            >
              <User className="mr-2 h-4 w-4" />
              {sidebarOpen && patient.name}
            </Button>
          ))}
        </ScrollArea>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6 bg-gradient-to-br from-gray-900 to-black">
        <h1 className="text-3xl font-bold mb-6 text-green-400">Patient Dashboard: {selectedPatient.name}</h1>

        {/* Voice Recording */}
        <div className="mb-6 bg-gray-800 p-4 rounded-lg border border-green-500 shadow-neon">
          <h2 className="text-xl font-bold mb-2 flex items-center">
            Voice Recording
          </h2>
          <div>
            {isRecording ? (
              <Button onClick={stopRecording} className="btn btn-red">
                Stop Recording
              </Button>
            ) : (
              <Button onClick={startRecording} className="btn btn-green">
                Start Recording
              </Button>
            )}
          </div>
          {audioURL && (
            <div className="mt-4">
              <h3 className="text-lg font-bold text-green-400">Recorded Audio:</h3>
              <audio controls src={audioURL} className="w-full mt-2"></audio>
            </div>
          )}
          {isTranscribing && <p className="text-yellow-400">Transcribing...</p>}
          {transcription && (
            <div className="mt-4">
              <h3 className="text-lg font-bold text-green-400">Transcription:</h3>
              <p className="text-green-300">{transcription}</p>
            </div>
          )}
        </div>

        {/* Vitals */}
        <div className="mb-6 bg-gray-800 p-4 rounded-lg border border-green-500 shadow-neon">
          <h2 className="text-xl font-bold mb-2 flex items-center">
            <Stethoscope className="mr-2" /> Vitals
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(patientInfo.vitals).map(([key, value]) => (
              <div key={key} className="text-center">
                <div className="text-sm text-green-300">{key}</div>
                <div className="text-lg font-bold">{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Medications */}
        <div className="mb-6 bg-gray-800 p-4 rounded-lg border border-green-500 shadow-neon">
          <h2 className="text-xl font-bold mb-2 flex items-center">
            <Pill className="mr-2" /> Medications
          </h2>
          <ul className="list-disc list-inside">
            {patientInfo.medications.map((med, index) => (
              <li key={index}>{med}</li>
            ))}
          </ul>
        </div>

        {/* Diagnoses */}
        <div className="mb-6 bg-gray-800 p-4 rounded-lg border border-green-500 shadow-neon">
          <h2 className="text-xl font-bold mb-2 flex items-center">
            <FileText className="mr-2" /> Diagnoses
          </h2>
          <ul className="list-disc list-inside">
            {patientInfo.diagnoses.map((diagnosis, index) => (
              <li key={index}>{diagnosis}</li>
            ))}
          </ul>
        </div>

        {/* Chart */}
        <div className="mb-6 bg-gray-800 p-4 rounded-lg border border-green-500 shadow-neon">
          <h2 className="text-xl font-bold mb-2 flex items-center">
            <Activity className="mr-2" /> Health Metrics
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={patientInfo[Object.keys(patientInfo).find(key => key.includes('Readings'))]}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                <XAxis dataKey="date" stroke="#48BB78" />
                <YAxis stroke="#48BB78" />
                <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #48BB78' }} />
                <Line type="monotone" dataKey={Object.keys(patientInfo[Object.keys(patientInfo).find(key => key.includes('Readings'))][0]).find(key => key !== 'date')} stroke="#48BB78" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Notes */}
        <div className="bg-gray-800 p-4 rounded-lg border border-green-500 shadow-neon">
          <h2 className="text-xl font-bold mb-2 flex items-center">
            <FileText className="mr-2" /> Notes
          </h2>
          {patientInfo.notes.map((note) => (
            <Collapsible key={note.id} open={expandedNote === note.id} onOpenChange={() => setExpandedNote(expandedNote === note.id ? null : note.id)}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between mb-2">
                  <span className="flex items-center">
                    <Calendar className="mr-2 h-4 w-4" />
                    {note.date} - {note.title}
                  </span>
                  {expandedNote === note.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="bg-gray-700 p-4 rounded-md">
                {note.content}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  );
}