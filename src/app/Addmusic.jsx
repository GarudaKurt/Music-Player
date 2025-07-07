import { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import axios from "axios";
import '../App.css';

const Addmusic = () => {
  const [songName, setSongName] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songFile, setSongFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  const navigate = useNavigate();
  const idleTimerRef = useRef(null);

  // 👇 Fade message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // 👇 Idle detection: Navigate after 30s of no interaction
  useEffect(() => {
    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        navigate('/playlist');
      }, 30000); // 30 seconds idle
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer(); // Start initial timer

    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      clearTimeout(idleTimerRef.current);
    };
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!songName || !songArtist || !songFile) {
      setMessage("Please fill in all fields");
      return;
    }

    const formData = new FormData();
    formData.append("songName", songName);
    formData.append("songArtist", songArtist);
    formData.append("songFile", songFile);

    try {
      setUploading(true);
      await axios.post("http://localhost:5000/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessage("✅ Music uploaded successfully!");
      setSongName("");
      setSongArtist("");
      setSongFile(null);

      setTimeout(() => {
        navigate('/playlist');
      }, 10000); // 10 seconds after upload
    } catch (error) {
      console.error("Upload error:", error);
      setMessage("❌ Failed to upload music.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="addmusic-container">
      <h2 className="addmusic-heading">🎵 Add New Music</h2>
      
      {message && (
        <div className="message-box fade-out">
          {message}
        </div>
      )}

      <form className="addmusic-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Song Name"
          value={songName}
          onChange={(e) => setSongName(e.target.value)}
          className="addmusic-input"
        />
        <input
          type="text"
          placeholder="Song Artist"
          value={songArtist}
          onChange={(e) => setSongArtist(e.target.value)}
          className="addmusic-input"
        />
        <input
          type="file"
          accept=".mp3"
          onChange={(e) => setSongFile(e.target.files[0])}
          className="addmusic-input"
        />
        <button type="submit" className="addmusic-button" disabled={uploading}>
          {uploading ? "Uploading..." : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default Addmusic;
