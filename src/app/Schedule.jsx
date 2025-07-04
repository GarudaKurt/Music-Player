import { useState, useEffect } from "react";
import axios from "axios";
import '../App.css';

const Schedule = () => {
  const [scheduleName, setScheduleName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [time, setTime] = useState('');
  const [musicFile, setMusicFile] = useState(null); // we will store song object
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [availableMusics, setAvailableMusics] = useState([]);

  const fetchAvailableMusics = async () => {
    try {
      const res = await axios.get("http://localhost:5000/songs-list");
      setAvailableMusics(res.data);
    } catch (err) {
      console.error("Error fetching songs:", err);
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

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();

    if (!scheduleName || !startDate || !endDate || !time || !musicFile) {
      alert("Please fill in all fields");
      return;
    }

    const formData = new FormData();
    formData.append("scheduleName", scheduleName);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);
    formData.append("time", time);

    // ✅ Fetch the song from public server and convert to Blob
    const res = await fetch(`http://localhost:5000${musicFile.songSrc}`);
    const blob = await res.blob();
    const file = new File([blob], musicFile.songSrc.split("/").pop(), { type: "audio/mp3" });

    formData.append("musicFile", file);

    try {
      setSaving(true);
      await axios.post("http://localhost:5000/schedules", formData);
      alert("Schedule saved successfully!");
      setScheduleName('');
      setStartDate('');
      setEndDate('');
      setTime('');
      setMusicFile(null);
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="addmusic-container">
    <h2 className="addmusic-heading">⏰ Schedule Music</h2>
    <form className="addmusic-form" onSubmit={handleScheduleSubmit}>
          <div className="input-row">
            <label>
              Schedule Name:
              <input
                placeholder="Enter schedule name"
                type="text"
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                className="addmusic-input"
              />
            </label>

            <label>
              Time:
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
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
                <li key={index} onClick={() => selectMusic(song)} className="music-item">
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
