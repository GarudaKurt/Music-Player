import { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';

const SchedulesMusic = () => {
  const [scheduledPlaylist, setScheduledPlaylist] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
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

  const fetchSchedules = async () => {
    try {
      const res = await axios.get('http://localhost:5000/schedules');
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
              <h3>{schedule.scheduleName}</h3>
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
    </div>
  );
};

export default SchedulesMusic;
