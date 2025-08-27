import { useEffect, useState } from 'react';
import axios from 'axios';
import '../App.css';

const SchedulesMusic = () => {
  const [scheduledPlaylist, setScheduledPlaylist] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [availableMusics, setAvailableMusics] = useState([]);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isOccurrenceModalOpen, setIsOccurrenceModalOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteScheduleId, setDeleteScheduleId] = useState(null);

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
      setSelectedSongs(schedule.playlist);
      setIsEditModalOpen(true);
    } catch (err) {
      console.error("Error loading songs:", err);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!selectedSchedule) return;

    try {
      const updatedSchedule = { ...selectedSchedule, songs: selectedSongs };
      await axios.put(
        `http://192.168.99.142:5000/schedules/${selectedSchedule.id}`,
        updatedSchedule,
        { headers: { 'Content-Type': 'application/json' } }
      );
      setIsEditModalOpen(false);
      setSelectedSchedule(null);
      setSelectedSongs([]);
      fetchSchedules();
    } catch (err) {
      console.error("Failed to update schedule:", err);
    }
  };

  const toggleSongSelection = (song) => {
    setSelectedSongs((prev) =>
      prev.some((s) => s.songSrc === song.songSrc)
        ? prev.filter((s) => s.songSrc !== song.songSrc)
        : [...prev, song]
    );
  };

  const confirmDelete = (schedule) => {
    setDeleteScheduleId(schedule.id);
    setSelectedSchedule(schedule);
    setSelectedSongs([]);
    setIsDeleteModalOpen(true);
  };

  const deleteSelectedDates = async () => {
    if (!selectedSchedule) return;
    try {
      await Promise.all(
        selectedDates.map((date) =>
          axios.delete(
            `http://192.168.99.142:5000/schedules/${selectedSchedule.id}?mode=occurrence&date=${date}&startTime=${selectedSchedule.startTime}&endTime=${selectedSchedule.endTime}`
          )
        )
      );
      alert(`✅ Selected dates deleted for schedule ${selectedSchedule.scheduleName}`);
      fetchSchedules();
    } catch (err) {
      console.error("Failed to delete occurrences:", err);
      alert("Failed to delete occurrences");
    } finally {
      setIsOccurrenceModalOpen(false);
      setIsDeleteModalOpen(false);
      setSelectedDates([]);
    }
  };

  const handleDelete = async (mode, deleteAll = false) => {
    try {
      let url = `http://192.168.99.142:5000/schedules/${deleteAll ? 'all' : deleteScheduleId}?mode=${mode}`;
      if (mode === 'selected' && selectedSongs.length > 0) {
        const songParams = selectedSongs.map(s => encodeURIComponent(s.songSrc)).join(',');
        url += `&songs=${songParams}`;
      }
      if (mode === 'occurrence' && selectedSchedule) {
        url += `&date=${selectedSchedule.startDate}&startTime=${selectedSchedule.startTime}&endTime=${selectedSchedule.endTime}`;
      }

      await axios.delete(url);

      if (deleteAll) alert(`✅ All schedules deleted successfully.`);
      else if (mode === 'occurrence')
        alert(`✅ Schedule ID ${deleteScheduleId} deleted for date ${selectedSchedule.startDate}`);
      else if (mode === 'selected') {
        const songNames = selectedSongs.map(s => s.songName).join(', ');
        alert(`✅ Selected songs deleted from Schedule ID ${deleteScheduleId}: ${songNames}`);
      }

      fetchSchedules();
    } catch (err) {
      console.error("Failed to delete schedule:", err);
      alert("Failed to delete schedule");
    } finally {
      setIsDeleteModalOpen(false);
      setDeleteScheduleId(null);
      setSelectedSongs([]);
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
        return new Date(`${a.startDate}T${a.startTime}`) - new Date(`${b.startDate}T${b.startTime}`);
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
                  <button className="edit-btn" onClick={() => handleEdit(schedule)} title="Edit Schedule">
                    <i className="fa-solid fa-pencil nav-icon"></i>
                  </button>
                  <button className="delete-btn" onClick={() => confirmDelete(schedule)} title="Delete Schedule">
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
              <button onClick={() => setIsEditModalOpen(false)} className="btn-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && selectedSchedule && (
        <div className="music-modal">
          <div className="music-modal-content">
            <h3 className='headerBlack'>🗑️ Delete Schedule</h3>
            <p>Choose what you want to delete:</p>

            <ul className="music-list">
              {selectedSchedule.playlist.map((song, index) => (
                <li key={index} className="music-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedSongs.some(s => s.songSrc === song.songSrc)}
                      onChange={() => toggleSongSelection(song)}
                    />
                    {song.songName} — <em>{song.songArtist}</em>
                  </label>
                </li>
              ))}
            </ul>

            {isOccurrenceModalOpen && (
              <div className="music-modal">
                <div className="music-modal-content">
                  <h3 className='headerBlack'>🗑️ Select Dates to Delete</h3>
                  <ul className="music-list">
                    {selectedSchedule.occurrences?.map((occ, index) => (
                      <li key={index} className="music-item">
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedDates.includes(occ.date)}
                            onChange={() => {
                              setSelectedDates(prev =>
                                prev.includes(occ.date)
                                  ? prev.filter(d => d !== occ.date)
                                  : [...prev, occ.date]
                              );
                            }}
                          />
                          {occ.date} ({occ.startTime} - {occ.endTime})
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="modal-buttons">
                    <button onClick={deleteSelectedDates} className="addmusic-button">
                      Delete Selected Dates
                    </button>
                    <button onClick={() => setIsOccurrenceModalOpen(false)} className="btn-cancel">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!isOccurrenceModalOpen && (
              <div className="modal-buttons">
                <button onClick={() => handleDelete('all', true)} className="addmusic-button">
                  🗑️ All Schedules
                </button>
                <button onClick={() => { setSelectedDates([]); setIsOccurrenceModalOpen(true); }} className="btn-cancel">
                  🗑️ Selected Date Only
                </button>
                <button onClick={() => handleDelete('selected')} className="btn-cancel">
                  🗑️ Selected Schedules
                </button>
                <button onClick={() => setIsDeleteModalOpen(false)} className="btn-cancel">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SchedulesMusic;