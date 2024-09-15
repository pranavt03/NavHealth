import streamlit as st
import assemblyai as aai
import sounddevice as sd
import numpy as np
import io
import scipy.io.wavfile as wavfile
import pandas as pd
import plotly.graph_objects as go
import json
from streamlit_option_menu import option_menu
from anthropic import Anthropic

# File to store patient data
DATA_FILE = "patients_data.json"

# Anthropic API key and setup
ANTHROPIC_API_KEY = ""
anthropic = Anthropic(api_key=ANTHROPIC_API_KEY)

# Function to load patient data
def load_patient_data():
    try:
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

# Function to save patient data
def save_patient_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=4)

# Initialize or load patient data
patients = load_patient_data()

# Set up AssemblyAI API key
aai.settings.api_key = "773691fe44574433a4bef0cafbdabcee"
transcriber = aai.Transcriber()

def record_audio(duration=1, sample_rate=44100):
    recording = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1)
    sd.wait()
    return recording.flatten()

def save_audio(recording, sample_rate=44100):
    audio_buffer = io.BytesIO()
    wavfile.write(audio_buffer, sample_rate, recording)
    audio_buffer.seek(0)
    return audio_buffer

def toClaude(text):
    response = anthropic.messages.create(
        model="claude-3-5-sonnet-20240620",
        max_tokens=500,
        system="You are a medical coder with expertise in ICD-10-CM coding.",
        messages=[
            {"role": "user", "content": f"Do not provide any remarks or comments. Simply provide a key points summary of this text: {text}"}
        ]
    )
    return response.content[0].text

# Custom CSS for dark theme
st.markdown("""
<style>
    .reportview-container {
        background: #1E1E1E;
        color: #00FF00;
    }
    .sidebar .sidebar-content {
        background: #2D3748;
    }
    .Widget>label {
        color: #00FF00;
    }
    .stTextInput>div>div>input {
        background-color: #4A5568;
        color: #00FF00;
    }
    .stSelectbox>div>div>select {
        background-color: #4A5568;
        color: #00FF00;
    }
    .stTextArea>div>div>textarea {
        background-color: #4A5568;
        color: #00FF00;
    }
</style>
""", unsafe_allow_html=True)

st.title("Medical Dashboard")

# Sidebar for patient selection
st.sidebar.title("Patient Selection")
selected_patient = st.sidebar.selectbox("Select Patient", list(patients.keys()))

# Main content
patient_data = patients.get(selected_patient, {})

# Editable Vitals
st.header("Vitals")
col1, col2, col3 = st.columns(3)
heart_rate = col1.number_input("Heart Rate", value=patient_data.get("vitals", {}).get("Heart Rate", 0), min_value=0)
blood_pressure = col2.text_input("Blood Pressure", value=patient_data.get("vitals", {}).get("Blood Pressure", ""))
temperature = col3.text_input("Temperature", value=patient_data.get("vitals", {}).get("Temperature", ""))

# Update vitals in patient_data
patient_data["vitals"] = {"Heart Rate": heart_rate, "Blood Pressure": blood_pressure, "Temperature": temperature}

# Editable Medications
st.header("Medications")
medications = st.text_area("Medications (comma separated)", value=", ".join(patient_data.get("medications", [])))

# Update medications in patient_data
patient_data["medications"] = [med.strip() for med in medications.split(",")]

# Editable Diagnoses
st.header("Diagnoses")
diagnoses = st.text_area("Diagnoses (comma separated)", value=", ".join(patient_data.get("diagnoses", [])))

# Update diagnoses in patient_data
patient_data["diagnoses"] = [diag.strip() for diag in diagnoses.split(",")]

# Health Metrics Chart
st.header("Health Metrics")

metric_key = list(patient_data.keys())[-1] if patient_data else None

if metric_key:
    df = pd.DataFrame(patient_data.get(metric_key, []))
    
    # Debugging: Inspect DataFrame structure
    st.write("DataFrame Columns:")
    st.write(df.columns)
    st.write("DataFrame Content:")
    st.write(df.head())

    fig = go.Figure()

    # Check if 'date' column exists
    if 'date' in df.columns:
        # Automatically select the metric column (assuming it's the second column)
        metric_col = df.columns[1]
        fig.add_trace(go.Scatter(x=df['date'], y=df[metric_col], mode='lines+markers'))
        fig.update_layout(
            plot_bgcolor='rgba(0,0,0,0)',
            paper_bgcolor='rgba(0,0,0,0)',
            font_color='#00FF00'
        )
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.error("Data does not contain a 'date' column. Please check your data source.")

# Voice Recording
st.header("Voice Recording")
if 'recording' not in st.session_state:
    st.session_state.recording = False
    st.session_state.audio_data = []
    st.session_state.transcription = ""  # Store transcription

col1, col2 = st.columns(2)
start_button = col1.button("Start Recording", key="start_button")
stop_button = col2.button("Stop Recording", key="stop_button")

if start_button:
    st.session_state.recording = True
    st.session_state.audio_data = []
    st.write("Recording... Press 'Stop Recording' when finished.")
    
    while st.session_state.recording:
        chunk = record_audio(duration=1)
        st.session_state.audio_data.extend(chunk)

if stop_button:
    st.session_state.recording = False
    if len(st.session_state.audio_data) > 0:
        st.write("Recording complete. Transcribing...")
        audio_file = save_audio(np.array(st.session_state.audio_data))
        transcript = transcriber.transcribe(audio_file)
        st.session_state.transcription = transcript.text  # Store transcription
    else:
        st.write("No audio recorded. Please start recording first.")

# Editable Notes
st.header("Notes")

# Add new note
new_note_date = st.text_input("Date of New Note", "", key="new_note_date")
new_note_title = st.text_input("Title of New Note", "", key="new_note_title")
new_note_content = st.text_area("Content of New Note", value=st.session_state.transcription, key="new_note_content")  # Pre-fill with transcription

if st.button("Add Note", key="add_note"):
    if new_note_date and new_note_title and new_note_content:
        new_note = {"date": new_note_date, "title": new_note_title, "content": new_note_content}
        if "notes" not in patient_data:
            patient_data["notes"] = []
        patient_data["notes"].append(new_note)
        st.session_state.transcription = ""  # Clear transcription after adding
        st.success("Note added successfully!")
        save_patient_data(patients)  # Save data after adding note
    else:
        st.error("Please fill out all fields.")

# Display and delete notes
if "notes" in patient_data:
    note_titles = [f"{note['date']} - {note['title']}" for note in patient_data["notes"]]
    note_to_delete = st.selectbox("Select Note to Delete", [""] + note_titles)

    if st.button("Delete Selected Note"):
        if note_to_delete:
            note_index = note_titles.index(note_to_delete)
            del patient_data["notes"][note_index]
            st.success("Note deleted successfully!")
            save_patient_data(patients)  # Save data after deleting note

    # Summarize note
    note_to_summarize = st.selectbox("Select Note to Summarize", [""] + note_titles)
    if st.button("Summarize Note"):
        if note_to_summarize:
            note_index = note_titles.index(note_to_summarize)
            note_content = patient_data["notes"][note_index]["content"]
            summary = toClaude(note_content)
            summary_note = {
                "date": patient_data["notes"][note_index]["date"],
                "title": f"{patient_data["notes"][note_index]["title"]} - Summary",
                "content": summary
            }
            patient_data["notes"].append(summary_note)
            st.success("Note summarized successfully!")
            save_patient_data(patients)  # Save data after summarizing note

    # Display notes
    for note in patient_data["notes"]:
        with st.expander(f"{note['date']} - {note['title']}"):
            st.write(note["content"])

# Patient Management
st.sidebar.title("Manage Patients")
add_patient_name = st.sidebar.text_input("New Patient Name", "")
remove_patient_name = st.sidebar.selectbox("Patient to Remove", [""] + list(patients.keys()))

if st.sidebar.button("Add Patient"):
    if add_patient_name:
        if add_patient_name not in patients:
            patients[add_patient_name] = {
                "vitals": {"Heart Rate": 0, "Blood Pressure": "", "Temperature": ""},
                "medications": [],
                "diagnoses": [],
                "notes": []
            }
            save_patient_data(patients)  # Save data after adding patient
            st.sidebar.success(f"Patient '{add_patient_name}' added successfully!")
        else:
            st.sidebar.warning("Patient already exists.")

if st.sidebar.button("Remove Patient"):
    if remove_patient_name in patients:
        del patients[remove_patient_name]
        save_patient_data(patients)  # Save data after removing patient
        st.sidebar.success(f"Patient '{remove_patient_name}' removed successfully!")
    elif not remove_patient_name:
        st.sidebar.warning("No patient selected.")
    else:
        st.sidebar.error("Error removing patient. Please try again.")

if __name__ == "__main__":
    st.write("Welcome to NavHealth. Select a patient from the sidebar to view their information.")
