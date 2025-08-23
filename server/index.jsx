// index.jsx
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const Database = require('better-sqlite3');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// -------------------- DATABASE --------------------
const schedulesDB = new Database(path.join(__dirname, 'schedules.sqlite3'));
const musicDB = new Database(path.join(__dirname, 'musicDB.sqlite3'));

// Create tables in schedulesDB
schedulesDB.prepare(`
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY,
  scheduleName TEXT NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  repeatType TEXT,
  weekdays TEXT
)`).run();

schedulesDB.prepare(`
CREATE TABLE IF NOT EXISTS occurrences (
  id INTEGER PRIMARY KEY,
  scheduleId INTEGER,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  FOREIGN KEY(scheduleId) REFERENCES schedules(id) ON DELETE CASCADE
)`).run();

schedulesDB.prepare(`
CREATE TABLE IF NOT EXISTS playlist (
  id INTEGER PRIMARY KEY,
  scheduleId INTEGER,
  songName TEXT NOT NULL,
  songArtist TEXT NOT NULL,
  songSrc TEXT NOT NULL,
  songAvatar TEXT,
  FOREIGN KEY(scheduleId) REFERENCES schedules(id) ON DELETE CASCADE
)`).run();

// Create songs table in musicDB
musicDB.prepare(`
CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY,
  songName TEXT NOT NULL,
  songArtist TEXT NOT NULL,
  songSrc TEXT NOT NULL,
  songAvatar TEXT
)`).run();

// -------------------- SERIAL PORT --------------------
const port = new SerialPort({
  path: 'COM3',
  baudRate: 9600
});
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

port.on('open', () => console.log('Serial port opened'));
port.on('error', err => console.error('Serial port error:', err));

// -------------------- APP SETUP --------------------
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const uploadPath = path.join(__dirname, 'list-of-songs');
if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
app.use('/songs', express.static(uploadPath));

// -------------------- MULTER --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadPath),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// -------------------- HELPERS --------------------
let startIndex = new Map();
let endIndex = new Map();
const triggeredEvents = new Map();
const TRIGGER_RETENTION_MS = 2 * 60 * 1000; // 2 minutes

function unixSecond(date) {
  return Math.floor(date.getTime() / 1000);
}

function parseTimeToDate(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr.padStart(5, '0')}:00`);
}

function addToIndex(map, keySec, event) {
  if (!map.has(keySec)) map.set(keySec, []);
  map.get(keySec).push(event);
}

function cleanupTriggeredEvents() {
  const now = Date.now();
  for (const [eventId, ts] of triggeredEvents.entries()) {
    if (now - ts > TRIGGER_RETENTION_MS) triggeredEvents.delete(eventId);
  }
}

function triggerOn(scheduleName, event) {
  if (triggeredEvents.has(event.eventId)) return;
  triggeredEvents.set(event.eventId, Date.now());
  console.log(`Schedule "${scheduleName}" starts soon! Turning ON`);
  try { port.write("ON\n"); } catch (err) { console.error(err); }
}

function triggerOff(scheduleName, event) {
  if (triggeredEvents.has(event.eventId)) return;
  triggeredEvents.set(event.eventId, Date.now());
  console.log(`Schedule "${scheduleName}" ended. Turning OFF`);

  try {
    port.write("OFF\n");
    console.log("Schedule Arduino OFF")
    // Remove occurrence once music finishes
    schedulesDB.prepare(`DELETE FROM occurrences WHERE scheduleId = ? AND date = ? AND startTime = ? AND endTime = ?`)
      .run(event.scheduleId, event.date, event.startTime, event.endTime);

    console.log(`Occurrence removed: scheduleId=${event.scheduleId}, date=${event.date}, time=${event.startTime}-${event.endTime}`);

    // Rebuild indexes to keep scheduler accurate
    buildIndexesFromDB();
  } catch (err) {
    console.error(err);
  }
}


// -------------------- ROUTES --------------------

// Fetch all schedules with their playlist
app.get('/schedules', (req, res) => {
  try {
    const schedules = schedulesDB.prepare(`SELECT * FROM schedules`).all();
    const schedulesWithDetails = schedules.map(s => {
      const occurrences = schedulesDB.prepare(`SELECT * FROM occurrences WHERE scheduleId = ?`).all(s.id);
      const playlist = schedulesDB.prepare(`SELECT * FROM playlist WHERE scheduleId = ?`).all(s.id);
      return { ...s, occurrences, playlist };
    });
    res.json(schedulesWithDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Add new schedule
app.post('/schedules', (req, res) => {
  try {
    const { scheduleName, startDate, endDate, startTime, endTime, songs, repeatType, weekdays, monthDates } = req.body;
    if (!scheduleName || !startDate || !endDate || !startTime || !endTime || !songs || songs.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = schedulesDB.prepare(`
      INSERT INTO schedules (scheduleName, startDate, endDate, startTime, endTime, repeatType, weekdays)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(scheduleName, startDate, endDate, startTime, endTime, repeatType, weekdays.join(','));

    const scheduleId = result.lastInsertRowid;

    const insertOcc = schedulesDB.prepare(`
      INSERT INTO occurrences (scheduleId, date, startTime, endTime)
      VALUES (?, ?, ?, ?)
    `);

    let current = new Date(startDate);
    const end = new Date(endDate);
    const weekdaysMap = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };

    while (current <= end) {
      const dayOfWeek = current.getDay(); // 0=Sun ... 6=Sat
      const dayOfMonth = current.getDate(); // 1-31

      if (repeatType === "weekly") {
        if (weekdays.some(d => weekdaysMap[d] === dayOfWeek)) {
          insertOcc.run(scheduleId, current.toISOString().slice(0, 10), startTime, endTime);
        }
      } else if (repeatType === "monthly") {
        if (monthDates.includes(dayOfMonth)) {
          insertOcc.run(scheduleId, current.toISOString().slice(0, 10), startTime, endTime);
        }
      } else {
        // no-repeat
        insertOcc.run(scheduleId, current.toISOString().slice(0, 10), startTime, endTime);
      }

      current.setDate(current.getDate() + 1);
    }

    const insertSong = schedulesDB.prepare(`
      INSERT INTO playlist (scheduleId, songName, songArtist, songSrc, songAvatar)
      VALUES (?, ?, ?, ?, ?)
    `);

    songs.forEach(song => insertSong.run(scheduleId, song.songName, song.songArtist, song.songSrc, song.songAvatar || null));

    res.status(201).json({ message: 'Schedule saved', scheduleId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save schedule' });
  }
});

// Upload song
app.post('/uploads', upload.single('songFile'), (req, res) => {
  const { songName, songArtist } = req.body;
  const file = req.file;
  if (!songName || !songArtist || !file) return res.status(400).json({ error: 'Missing fields' });

  const songSrc = `/songs/${file.filename}`;
  try {
    musicDB.prepare(`
      INSERT INTO songs (songName, songArtist, songSrc, songAvatar)
      VALUES (?, ?, ?, NULL)
    `).run(songName, songArtist, songSrc);

    console.log(`Uploaded: ${file.originalname}`);
    res.status(200).json({ message: 'Uploaded', song: { songName, songArtist, songSrc } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save song' });
  }
});

// Delete a song by filename
app.delete('/songs/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadPath, filename);

    const song = musicDB.prepare(`SELECT * FROM songs WHERE songSrc = ?`).get(`/songs/${filename}`);
    if (!song) {
      return res.status(404).json({ error: 'Song not found in DB' });
    }

    musicDB.prepare(`DELETE FROM songs WHERE id = ?`).run(song.id);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    console.log(`Deleted song: ${filename}`);
    res.status(200).json({ message: 'Song deleted successfully' });
  } catch (err) {
    console.error("Delete song error:", err);
    res.status(500).json({ error: 'Failed to delete song' });
  }
});

// Delete schedule OR just its playlist OR selected songs
app.delete('/schedules/:id', (req, res) => {
  try {
    const { mode, songs } = req.query; // mode = 'playlist' | 'all' | 'selected'
    const scheduleId = req.params.id;

    if (mode === 'playlist') {
      // Delete entire playlist for the schedule
      schedulesDB.prepare(`DELETE FROM playlist WHERE scheduleId = ?`).run(scheduleId);
      console.log("Deleted entire playlist for schedule", scheduleId);
      buildIndexesFromDB();
      return res.json({ message: `Playlist for schedule ${scheduleId} deleted` });
    }
    else if (mode === 'selected' && songs) {
      // Delete only selected songs
      const songList = Array.isArray(songs) ? songs : [songs];
      const deleteSongStmt = schedulesDB.prepare(`
        DELETE FROM playlist 
        WHERE scheduleId = ? AND songSrc = ?
      `);
      songList.forEach(songSrc => deleteSongStmt.run(scheduleId, songSrc));

      console.log(`Deleted selected songs from schedule ${scheduleId}:`, songList);
      buildIndexesFromDB();
      return res.json({ message: `Selected songs deleted from schedule ${scheduleId}` });
    }
    else if (mode === 'all' && scheduleId === 'all') {
      // Delete all schedules + occurrences + playlists
      schedulesDB.prepare(`DELETE FROM schedules`).run();
      schedulesDB.prepare(`DELETE FROM occurrences`).run();
      schedulesDB.prepare(`DELETE FROM playlist`).run();
      console.log("Deleted all schedules and playlists");
      buildIndexesFromDB();
      return res.json({ message: `All schedules and their playlists deleted` });
    }
    else {
      // Delete only the selected schedule + its occurrences + playlist
      schedulesDB.prepare(`DELETE FROM schedules WHERE id = ?`).run(scheduleId);
      schedulesDB.prepare(`DELETE FROM occurrences WHERE scheduleId = ?`).run(scheduleId);
      schedulesDB.prepare(`DELETE FROM playlist WHERE scheduleId = ?`).run(scheduleId);
      console.log("Deleted schedule completely", scheduleId);
      buildIndexesFromDB();
      return res.json({ message: `Schedule ${scheduleId} deleted completely` });
    }
  } catch (err) {
    console.error("Delete schedule error:", err);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});



// Get all songs
app.get('/songs-list', (req, res) => {
  try {
    const rows = musicDB.prepare(`SELECT * FROM songs`).all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// Manual play
app.post('/manual-play', (req, res) => {
  const { action } = req.body;
  try {
    if (action === 'play') {
      console.log("Manual Play ON")
      port.write("ON\n");
    }
    else if (action === 'pause' || action === 'stop') {
      console.log("Manual Play OFF")
      port.write("OFF\n");
    }
    else return res.status(400).json({ error: 'Invalid action' });
    res.status(200).json({ message: `Signal sent: ${action}` });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error sending signal' }); }
});

// -------------------- SCHEDULER --------------------
function buildIndexesFromDB() {
  startIndex = new Map();
  endIndex = new Map();

  const schedules = schedulesDB.prepare(`SELECT * FROM schedules`).all();

  schedules.forEach(schedule => {
    const playlist = schedulesDB.prepare(`SELECT * FROM playlist WHERE scheduleId = ?`).all(schedule.id);
    const occurrences = schedulesDB.prepare(`SELECT * FROM occurrences WHERE scheduleId = ?`).all(schedule.id);

    occurrences.forEach(occ => {
      const startDt = parseTimeToDate(occ.date, occ.startTime);
      const endDt = parseTimeToDate(occ.date, occ.endTime);
      const startNotifyDt = new Date(startDt.getTime() - 2 * 60 * 1000);

      const startSec = unixSecond(startNotifyDt);
      const endSec = unixSecond(endDt);

      const startEventId = `${schedule.id}::start::${occ.date}::${occ.startTime}`;
      const endEventId = `${schedule.id}::end::${occ.date}::${occ.endTime}`;

      addToIndex(startIndex, startSec, { eventId: startEventId, scheduleId: schedule.id, scheduleName: schedule.scheduleName, date: occ.date, startTime: occ.startTime, endTime: occ.endTime, playlist });
      addToIndex(endIndex, endSec, { eventId: endEventId, scheduleId: schedule.id, scheduleName: schedule.scheduleName, date: occ.date, startTime: occ.startTime, endTime: occ.endTime, playlist });
    });
  });

  console.log(`Indexes rebuilt: startIndex keys=${startIndex.size}, endIndex keys=${endIndex.size}`);
}

// Scheduler loop
(function initScheduler() {
  buildIndexesFromDB();

  setInterval(() => {
    try {
      const nowSec = Math.floor(Date.now() / 1000);
      cleanupTriggeredEvents();

      for (let offset = -1; offset <= 1; offset++) {
        const onEvents = startIndex.get(nowSec + offset);
        if (Array.isArray(onEvents)) onEvents.forEach(e => triggerOn(e.scheduleName, e));

        const offEvents = endIndex.get(nowSec + offset);
        if (Array.isArray(offEvents)) offEvents.forEach(e => triggerOff(e.scheduleName, e));
      }

    } catch (err) { console.error('Scheduler loop error:', err); }
  }, 1000);
})();

// -------------------- START SERVER --------------------
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
