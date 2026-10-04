import React, { useState } from 'react';

export default function App() {
  const [status, setStatus] = useState("Upload any audio file to convert");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [fileName, setFileName] = useState("");

  const processAudio = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const newFileName = file.name.split('.')[0] + '_YAMAHA.wav';
    setFileName(newFileName);
    setStatus("1/4: Decoding audio...");
    setDownloadUrl(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      setStatus("2/4: Resampling to 44.1kHz Stereo...");
      
      const targetSampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(2, audioBuffer.duration * targetSampleRate, targetSampleRate);
      
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      const renderedBuffer = await offlineCtx.startRendering();

      setStatus("3/4: Encoding to 16-bit PCM WAV...");
      
      // Delay slightly so UI updates before heavy processing
      setTimeout(() => {
        const wavData = audioBufferToWav(renderedBuffer);
        
        setStatus("4/4: Ready!");
        const blob = new Blob([new DataView(wavData)], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
      }, 50);

    } catch (err) {
      console.error(err);
      setStatus("Error: Could not process file.");
    }
  };

  function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const wav = new ArrayBuffer(44 + buffer.length * blockAlign);
    const view = new DataView(wav);
    
    function writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * blockAlign, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, buffer.length * blockAlign, true);
    
    const channelData = [];
    for (let i = 0; i < numChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        let sample = channelData[channel][i];
        sample = Math.max(-1, Math.min(1, sample));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sample, true);
        offset += 2;
      }
    }
    
    return wav;
  }

  return (
    <div className="container">
      <h2>Yamaha WAV Converter</h2>
      <p style={{color: "#6b7280", fontSize: "14px"}}>Converts audio directly in your browser to 44.1kHz, 16-bit, Stereo WAV</p>
      
      <label className="upload-btn">
        Choose Audio File
        <input type="file" accept="audio/*,video/*" className="file-input" onChange={processAudio} />
      </label>

      <div className="status">{status}</div>

      {downloadUrl && (
        <a href={downloadUrl} download={fileName} className="download-btn">
          Download {fileName}
        </a>
      )}
    </div>
  );
}
