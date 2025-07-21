// ✅ Updated Schedule.jsx to support multiple music selection via checkboxes

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
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [songDurations, setSongDurations] = useState({});


  const [showModal, setShowModal] = useState(false);
  const [availableMusics, setAvailableMusics] = useState([]);

  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const idleTimerRef = useRef(null);

  const fetchAvailableMusics = async () => {
    try {
      const res = await axios.get("http://localhost:5000/songs-list");
      const songs = res.data;
      setAvailableMusics(songs);

      const durations = {};
      const promises = songs.map((song) => {
        return new Promise((resolve) => {
          const audio = new Audio(`http://localhost:5000${song.songSrc}`);
          audio.addEventListener('loadedmetadata', () => {
            durations[song.songSrc] = formatDuration(audio.duration);
            resolve();
          });
          audio.addEventListener('error', () => {
            durations[song.songSrc] = "N/A";
            resolve();
          });
        });
      });

      await Promise.all(promises);
      setSongDurations(durations);

    } catch (err) {
      console.error("Error fetching songs:", err);
      setMessage("Failed to fetch songs.");
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "N/A";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };



  const toggleSongSelection = (song) => {
    const exists = selectedSongs.find((s) => s.songSrc === song.songSrc);
    if (exists) {
      setSelectedSongs(selectedSongs.filter((s) => s.songSrc !== song.songSrc));
    } else {
      setSelectedSongs([...selectedSongs, song]);
    }
  };

  const openModal = () => {
    fetchAvailableMusics();
    setShowModal(true);
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => navigate("/"), 30000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer));
      clearTimeout(idleTimerRef.current);
    };
  }, [navigate]);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();

    if (!scheduleName || !startDate || !endDate || !startTime || !endTime || selectedSongs.length === 0) {
      setMessage("\u26A0\uFE0F Please fill in all fields and select at least one music");
      return;
    }

    try {
      setSaving(true);

      const schedulePayload = {
        scheduleName,
        startDate,
        endDate,
        startTime,
        endTime,
        songs: selectedSongs
      };

      await axios.post("http://localhost:5000/schedules", schedulePayload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setMessage("Schedule saved successfully!");
      setScheduleName('');
      setStartDate('');
      setEndDate('');
      setStartTime('');
      setEndTime('');
      setSelectedSongs([]);

      setTimeout(() => {
        navigate('/');
      }, 5000);
    } catch (error) {
      console.error("Save error:", error);
      if (error.response && error.response.status === 409) {
        setMessage("⚠️ Schedule conflict: overlaps with an existing schedule.");
      } else {
        setMessage("Failed to save schedule.");
      }
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
            <input type="text" value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} className="addmusic-input" />
          </label>
        </div>

        <div className="input-row">
          <label>Start Time:<input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="addmusic-input" /></label>
          <label>End Time:<input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="addmusic-input" /></label>
        </div>

        <div className="input-row">
          <label>Start Date:<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="addmusic-input" /></label>
          <label>End Date:<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="addmusic-input" /></label>
        </div>

        <button type="button" className="addmusic-button" onClick={openModal}>
          {selectedSongs.length > 0 ? `🎵 ${selectedSongs.length} song(s) selected` : "Select Music"}
        </button>

        <button type="submit" className="addmusic-button" disabled={saving}>
          {saving ? "Saving..." : "Set Schedule"}
        </button>
      </form>

      {showModal && (
        <div className="music-modal">
          <div className="music-modal-content">
            <h3>Select Music Files</h3>
            <ul className="music-list">
              {availableMusics.map((song, index) => (
                <li key={index} className="music-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedSongs.some((s) => s.songSrc === song.songSrc)}
                      onChange={() => toggleSongSelection(song)}
                    />
                    🎵 {song.songName} — <em>{song.songArtist}</em>
                    <span style={{ marginLeft: '8px', color: '#888' }}>
                      ({songDurations[song.songSrc] || '...'})
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            <button onClick={() => setShowModal(false)} className="addmusic-button">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
