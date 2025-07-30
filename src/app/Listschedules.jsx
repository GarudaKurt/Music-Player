import { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';

const SchedulesMusic = () => {
  const [scheduledPlaylist, setScheduledPlaylist] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [availableMusics, setAvailableMusics] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [selectedSongs, setSelectedSongs] = useState([]);

  const getWeekRange = (offset) => {
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;

    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday + offset * 7);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const handleEdit = async (schedule) => {
    try {
      const res = await axios.get("http://192.168.99.142:5000/songs-list");
      setAvailableMusics(res.data);
      setSelectedSchedule(schedule);
      setSelectedSongs(schedule.playlist); // prefill current songs
      setIsEditModalOpen(true);
    } catch (err) {
      console.error("Error loading songs:", err);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!selectedSchedule) return;

    try {
      const updatedSchedule = {
        ...selectedSchedule,
        songs: selectedSongs
      };

      await axios.put(`'ttp://192.168.99.142:5000/schedules/${selectedSchedule.id}`, updatedSchedule, {
        headers: { 'Content-Type': 'application/json' }
      });

      setIsEditModalOpen(false);
      setSelectedSchedule(null);
      setSelectedSongs([]);
      fetchSchedules(); // refresh updated list
    } catch (err) {
      console.error("Failed to update schedule:", err);
    }
  };

  const toggleSongSelection = (song) => {
    const exists = selectedSongs.find((s) => s.songSrc === song.songSrc);
    if (exists) {
      setSelectedSongs((prev) => prev.filter((s) => s.songSrc !== song.songSrc));
    } else {
      setSelectedSongs((prev) => [...prev, song]);
    }
  };

  const handleDelete = async (scheduleId) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await axios.delete(`http://192.168.99.142:5000/schedules/${scheduleId}`);
        fetchSchedules(); // Refresh list
      } catch (err) {
        console.error('Failed to delete schedule:', err);
      }
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await axios.get('http://192.168.99.142:5000/schedules');
      const { monday, sunday } = getWeekRange(weekOffset);

      const filtered = res.data.filter(schedule => {
        const start = new Date(schedule.startDate);
        const end = new Date(schedule.endDate);
        return start <= sunday && end >= monday;
      });

      const sorted = filtered.sort((a, b) => {
        const dateTimeA = new Date(`${a.startDate}T${a.startTime}`);
        const dateTimeB = new Date(`${b.startDate}T${b.startTime}`);
        return dateTimeA - dateTimeB;
      });

      setScheduledPlaylist(sorted);
    } catch (err) {
      console.error('Failed to fetch schedules:', err);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [weekOffset]);

  const { monday, sunday } = getWeekRange(weekOffset);
  const formatDate = (date) => date.toISOString().split('T')[0];

  return (
    <div className="schedules-container">
      <h2 className="title">Scheduled Music</h2>

      <div className="week-nav">
        <button onClick={() => setWeekOffset(weekOffset - 1)}>← Previous</button>
        <span>
          Week of {formatDate(monday)} to {formatDate(sunday)}
        </span>
        <button onClick={() => setWeekOffset(weekOffset + 1)}>Next →</button>
      </div>

      <div className="schedule-list">
        {scheduledPlaylist.length === 0 ? (
          <p style={{ color: 'white' }}>No scheduled music for this week.</p>
        ) : (
          scheduledPlaylist.map((schedule) => (
            <div className="schedule-card" key={schedule.id}>
              <div className="flex justify-between items-center">
                <h3>{schedule.scheduleName}</h3>
                <div className="flex gap-2">
                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(schedule)}
                    title="Edit Schedule"
                  >
                    <i className="fa-solid fa-pencil nav-icon"></i>
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(schedule.id)}
                    title="Delete Schedule"
                  >
                    <i className="fa-solid fa-trash nav-icon"></i>
                  </button>
                </div>
              </div>
              <p><strong>Date:</strong> {schedule.startDate} - {schedule.endDate}</p>
              <p><strong>Time:</strong> {schedule.startTime} - {schedule.endTime}</p>
              <div className="songs-list">
                {schedule.playlist.map((song, index) => (
                  <div key={index} className="song-item">
                    <img src={song.songAvatar} alt="avatar" />
                    <div>
                      <p className="song-title">{song.songName}</p>
                      <p className="song-artist">{song.songArtist}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="music-modal">
          <div className="music-modal-content">
            <h3 className='headerBlack'>🎵 Update Music for: {selectedSchedule?.scheduleName}</h3>
            <ul className="music-list">
              {availableMusics.map((song, index) => (
                <li key={index} className="music-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedSongs.some((s) => s.songSrc === song.songSrc)}
                      onChange={() => toggleSongSelection(song)}
                    />
                    {song.songName} — <em>{song.songArtist}</em>
                  </label>
                </li>
              ))}
            </ul>
            <div className="modal-buttons">
              <button onClick={handleUpdateSchedule} className="addmusic-button">Save</button>
              <button onClick={() => setIsEditModalOpen(false)} className="btn-cancel"> Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulesMusic;
