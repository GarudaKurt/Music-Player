import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";

const Schedule = () => {
  const [scheduleName, setScheduleName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [musicFile, setMusicFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [availableMusics, setAvailableMusics] = useState([]);

  const [message, setMessage] = useState("");

  const navigate = useNavigate();
  const idleTimerRef = useRef(null);

  // ✅ Fetch music list
  const fetchAvailableMusics = async () => {
    try {
      const res = await axios.get("http://localhost:5000/songs-list");
      setAvailableMusics(res.data);
    } catch (err) {
      console.error("Error fetching songs:", err);
      setMessage("Failed to fetch songs.");
    }
  };

  const openModal = () => {
    fetchAvailableMusics();
    setShowModal(true);
  };

  const selectMusic = (song) => {
    setMusicFile(song);
    setShowModal(false);
  };

  // ✅ Auto-fade messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // ✅ Auto redirect on inactivity
  useEffect(() => {
    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        navigate("/playlist");
      }, 30000); // 30s
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      clearTimeout(idleTimerRef.current);
    };
  }, [navigate]);

  // ✅ Handle submit
const handleScheduleSubmit = async (e) => {
  e.preventDefault();

  if (!scheduleName || !startDate || !endDate || !musicFile || !startTime || !endTime) {
    setMessage("⚠️ Please fill in all fields");
    return;
  }

  const formData = new FormData(); // ✅ Moved outside try block so it's defined

  try {
    setSaving(true);

    formData.append("scheduleName", scheduleName);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);
    formData.append("startTime", startTime);
    formData.append("endTime", endTime);

    const res = await fetch(`http://localhost:5000${musicFile.songSrc}`);
    const blob = await res.blob();
    const file = new File([blob], musicFile.songSrc.split("/").pop(), {
      type: "audio/mp3",
    });

    formData.append("musicFile", file);

    const response = await axios.post("http://localhost:5000/schedules", formData);

    console.log("✅ Server response:", response);

    if (response.status >= 200 && response.status < 300) {
      setMessage("✅ Schedule saved successfully!");
    } else {
      setMessage("⚠️ Schedule saved but server returned unexpected status.");
    }

    // Clear form
    setScheduleName('');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setMusicFile(null);

    // Redirect after 10 seconds
    setTimeout(() => {
      navigate('/playlist');
    }, 10000);

  } catch (error) {
    console.error("❌ Save error:", error);
    if (error.response) {
      console.error("❗ Server responded with error:", error.response.data);
    }
    setMessage("❌ Failed to save schedule.");
  } finally {
    setSaving(false);
  }
};

  return (
    <div className="addmusic-container">
      <h2 className="addmusic-heading">⏰ Schedule Music</h2>

      {message && <div className="message-box fade-out">{message}</div>}

      <form className="addmusic-form" onSubmit={handleScheduleSubmit}>
        <div className="input-row">
          <label>
            Schedule Name:
            <input
              placeholder="Enter name"
              type="text"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              className="addmusic-input"
            />
          </label>
        </div>

        <div className="input-row">
          <label>
            Start Time:
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="addmusic-input"
            />
          </label>

          <label>
            End Time:
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="addmusic-input"
            />
          </label>
        </div>

        <div className="input-row">
          <label>
            Start Date:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="addmusic-input"
            />
          </label>

          <label>
            End Date:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="addmusic-input"
            />
          </label>
        </div>

        <button type="button" className="addmusic-button" onClick={openModal}>
          {musicFile ? `🎵 ${musicFile.songName} - ${musicFile.songArtist}` : "Select Music"}
        </button>

        <button type="submit" className="addmusic-button" disabled={saving}>
          {saving ? "Saving..." : "Set Schedule"}
        </button>
      </form>

      {showModal && (
        <div className="music-modal">
          <div className="music-modal-content">
            <h3>Select a Music File</h3>
            <ul className="music-list">
              {availableMusics.map((song, index) => (
                <li
                  key={index}
                  onClick={() => selectMusic(song)}
                  className="music-item"
                >
                  🎵 {song.songName} — <em>{song.songArtist}</em>
                </li>
              ))}
            </ul>
            <button onClick={() => setShowModal(false)} className="addmusic-button">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
