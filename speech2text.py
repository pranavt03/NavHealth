import streamlit as st
import assemblyai as aai
import sounddevice as sd
import numpy as np
import io
import scipy.io.wavfile as wavfile
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

# Set up AssemblyAI API key
aai.settings.api_key = "773691fe44574433a4bef0cafbdabcee"
transcriber = aai.Transcriber()

def record_audio(duration=1, sample_rate=44100):
    recording = []
    stop_recording = False

    def callback(indata, frames, time, status):
        if status:
            print(status, file=sys.stderr)
        recording.append(indata.copy())

    stream = sd.InputStream(callback=callback, channels=1, samplerate=sample_rate)
    with stream:
        sd.sleep(duration * 1000)  # duration in milliseconds

    return np.concatenate(recording, axis=0)

def save_audio(recording, sample_rate=44100):
    audio_buffer = io.BytesIO()
    wavfile.write(audio_buffer, sample_rate, recording)
    audio_buffer.seek(0)
    return audio_buffer

def update_plot(frame, audio_data, line):
    if frame + 1000 < len(audio_data):
        line.set_ydata(audio_data[frame:frame + 1000])
    return line,

st.title("Speech to Text Transcription")

if 'recording' not in st.session_state:
    st.session_state.recording = False
    st.session_state.audio_data = []  # Initialize audio_data in session state

col1, col2 = st.columns(2)

start_button = col1.button("Start Recording")
stop_button = col2.button("Stop Recording")

fig, ax = plt.subplots(figsize=(10, 3))
line, = ax.plot(np.zeros(1000))
ax.set_ylim(-1, 1)
ax.set_xlim(0, 1000)
ax.axis('off')
plot_placeholder = st.empty()

if start_button:
    st.session_state.recording = True
    while st.session_state.recording:
        chunk = record_audio(duration=1)  # Record for 1 second
        st.session_state.audio_data.extend(chunk.flatten())
        
        ani = FuncAnimation(fig, update_plot, frames=range(0, len(st.session_state.audio_data) - 1000, 1000),
                            fargs=(st.session_state.audio_data, line), interval=50, blit=True)
        plot_placeholder.pyplot(fig)

if stop_button:
    st.session_state.recording = False
    st.write("Recording complete. Transcribing...")
    
    audio_file = save_audio(np.array(st.session_state.audio_data))
    transcript = transcriber.transcribe(audio_file)
    
    st.write("Transcription:")
    st.write(transcript.text)
