// index.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const fsPromises = fs.promises;

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const port = new SerialPort({
  path: 'COM3',
  baudRate: 9600,
});
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

const app = express();
const PORT = 5000;

const crypto = require('crypto');

let lastFileHash = null;
let rebuildTimeout = null;

function getFileHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}


app.use(cors());
app.use(express.json());

const uploadPath = path.join(__dirname, 'list-of-songs');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}
app.use('/songs', express.static(uploadPath));

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// ---------- In-memory indexes ----------
/**
 * startIndex: Map<number, Array<Event>>
 * endIndex:   Map<number, Array<Event>>
 *
 * Key: unixSecond (Math.floor(ms/1000))
 * Event: { eventId: string, scheduleId, scheduleName, date, startTime, endTime, playlist }
 */
let startIndex = new Map();
let endIndex = new Map();

// keep track of triggered event ids to avoid double-triggering
// stores eventId -> triggerTimestamp (ms)
const triggeredEvents = new Map();
const TRIGGER_RETENTION_MS = 2 * 60 * 1000; // keep record for 2 minutes to avoid re-triggers

let schedulesCache = []; // raw schedules loaded from file
let rebuilding = false; // prevent concurrent rebuilds

// ---------- Helpers ----------
const scheduleFilePath = path.join(__dirname, 'schedules.json');
const songsFilePath = path.join(__dirname, 'songs.json');

function unixSecond(date) {
  return Math.floor(date.getTime() / 1000);
}

function parseTimeToDate(dateStr, timeStr) {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:mm"
  return new Date(`${dateStr}T${timeStr.padStart(5, '0')}:00`);
}

async function loadSchedulesFromFile() {
  try {
    if (!fs.existsSync(scheduleFilePath)) {
      schedulesCache = [];
      return schedulesCache;
    }
    const raw = await fsPromises.readFile(scheduleFilePath, 'utf8');
    schedulesCache = JSON.parse(raw || '[]');
    return schedulesCache;
  } catch (err) {
    console.error('Failed to read schedules.json:', err);
    schedulesCache = [];
    return schedulesCache;
  }
}

function addToIndex(map, keySec, event) {
  if (!map.has(keySec)) map.set(keySec, []);
  map.get(keySec).push(event);
}

async function buildIndexesFromSchedules(schedules) {
  if (rebuilding) return;
  rebuilding = true;
  try {
    startIndex = new Map();
    endIndex = new Map();

    schedules.forEach((schedule) => {
      const { id: scheduleId, scheduleName, occurrences = [], playlist = [] } = schedule;
      occurrences.forEach((occ) => {
        try {
          const startDt = parseTimeToDate(occ.date, occ.startTime);
          const endDt = parseTimeToDate(occ.date, occ.endTime);

          // start notify time is 2 minutes before start
          const startNotifyDt = new Date(startDt.getTime() - 2 * 60 * 1000);

          const startSec = unixSecond(startNotifyDt);
          const endSec = unixSecond(endDt);

          const startEventId = `${scheduleId}::start::${occ.date}::${occ.startTime}`;
          const endEventId = `${scheduleId}::end::${occ.date}::${occ.endTime}`;

          const startEvent = {
            eventId: startEventId,
            scheduleId,
            scheduleName,
            date: occ.date,
            startTime: occ.startTime,
            endTime: occ.endTime,
            playlist,
          };

          const endEvent = {
            eventId: endEventId,
            scheduleId,
            scheduleName,
            date: occ.date,
            startTime: occ.startTime,
            endTime: occ.endTime,
            playlist,
          };

          addToIndex(startIndex, startSec, startEvent);
          addToIndex(endIndex, endSec, endEvent);
        } catch (err) {
          // ignore malformed occurrence but log
          console.warn('Malformed occurrence skipped:', scheduleId, occ, err);
        }
      });
    });

    // optional: convert to plain Objects to reduce memory overhead? leaving as Map is fine
    console.log(`Indexes rebuilt: startIndex keys=${startIndex.size}, endIndex keys=${endIndex.size}`);
  } finally {
    rebuilding = false;
  }
}

function cleanupOldOccurrences(schedules) {
  const now = new Date();
  return schedules.map(schedule => {
    schedule.occurrences = schedule.occurrences.filter(occ => {
      const occEnd = parseTimeToDate(occ.date, occ.endTime);
      return occEnd >= now;
    });
    return schedule;
  }).filter(schedule => schedule.occurrences.length > 0);
}

async function rebuildScheduleIndex() {
  await loadSchedulesFromFile();
  schedulesCache = cleanupOldOccurrences(schedulesCache);
  await fsPromises.writeFile(scheduleFilePath, JSON.stringify(schedulesCache, null, 2), 'utf8');
  await buildIndexesFromSchedules(schedulesCache);
}


// Clears old triggered event records to prevent unbounded growth
function cleanupTriggeredEvents() {
  const now = Date.now();
  for (const [eventId, ts] of triggeredEvents.entries()) {
    if (now - ts > TRIGGER_RETENTION_MS) {
      triggeredEvents.delete(eventId);
    }
  }
}

// trigger ON (write "1\n"), OFF (write "0\n")
function triggerOn(scheduleName, event) {
  const { eventId } = event;
  if (triggeredEvents.has(eventId)) return; // already triggered recently
  triggeredEvents.set(eventId, Date.now());
  console.log(`Schedule "${scheduleName}" starts soon! Turning amplifier ON — eventId=${eventId}`);
  try {
    port.write("ON\n");
  } catch (err) {
    console.error('Serial write error (ON):', err);
  }
}

async function triggerOff(scheduleName, event) {
  const { eventId, scheduleId, date, endTime } = event;
  if (triggeredEvents.has(eventId)) return;

  triggeredEvents.set(eventId, Date.now());
  console.log(`Schedule "${scheduleName}" ended. Turning amplifier OFF — eventId=${eventId}`);

  try {
    port.write("OFF\n");
  } catch (err) {
    console.error('Serial write error (OFF):', err);
  }

  // Remove this past occurrence from schedules
  try {
    let schedules = [];
    if (fs.existsSync(scheduleFilePath)) {
      schedules = JSON.parse(await fsPromises.readFile(scheduleFilePath, 'utf8'));
    }

    let modified = false;
    schedules = schedules.map(schedule => {
      if (schedule.id === scheduleId) {
        const beforeCount = schedule.occurrences.length;
        schedule.occurrences = schedule.occurrences.filter(
          occ => !(occ.date === date && occ.endTime === endTime)
        );
        if (beforeCount !== schedule.occurrences.length) {
          modified = true;
        }
      }
      return schedule;
    });

    // If no occurrences left, remove the whole schedule
    schedules = schedules.filter(schedule => schedule.occurrences.length > 0);

    if (modified) {
      await fsPromises.writeFile(scheduleFilePath, JSON.stringify(schedules, null, 2), 'utf8');
      console.log(`🗑 Removed past occurrence ${date} ${endTime} from "${scheduleName}"`);
      await rebuildScheduleIndex(); // keep in-memory index updated
    }
  } catch (err) {
    console.error('Error removing past occurrence:', err);
  }
}


if (fs.existsSync(scheduleFilePath)) {
  fs.watchFile(scheduleFilePath, { interval: 1000 }, async (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      // Debounce multiple events
      if (rebuildTimeout) clearTimeout(rebuildTimeout);

      rebuildTimeout = setTimeout(async () => {
        try {
          const raw = await fsPromises.readFile(scheduleFilePath, 'utf8');
          const currentHash = getFileHash(raw);

          if (currentHash !== lastFileHash) {
            lastFileHash = currentHash;
            console.log('schedules.json changed on disk — rebuilding indexes');
            await rebuildScheduleIndex();
          } else {
            // File content same, ignore
            // console.log('File changed but content identical, skipping rebuild');
          }
        } catch (err) {
          console.error('Error during schedule file watcher:', err);
        }
      }, 500); // wait 500ms after last change before rebuild
    }
  });
}


app.get('/songs-list', async (req, res) => {
  try {
    if (!fs.existsSync(songsFilePath)) return res.json([]);
    const data = await fsPromises.readFile(songsFilePath, 'utf8');
    const songList = JSON.parse(data || '[]');
    return res.json(songList);
  } catch (err) {
    console.error('Error reading songs.json:', err);
    return res.status(500).json({ error: 'Failed to read songs' });
  }
});

// Upload song
app.post('/uploads', upload.single('songFile'), async (req, res) => {
  const { songName, songArtist } = req.body;
  const file = req.file;

  if (!songName || !songArtist || !file) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const songData = {
    songName,
    songArtist,
    songSrc: `/songs/${file.filename}`
  };

  try {
    const existing = fs.existsSync(songsFilePath) ? JSON.parse(await fsPromises.readFile(songsFilePath, 'utf8')) : [];
    existing.push(songData);
    await fsPromises.writeFile(songsFilePath, JSON.stringify(existing, null, 2), 'utf8');

    console.log(`Uploaded: ${file.originalname}`);
    return res.status(200).json({ message: 'Uploaded successfully', song: songData });
  } catch (err) {
    console.error('Upload song error:', err);
    return res.status(500).json({ error: 'Failed to save song' });
  }
});

// Upload schedule
app.post('/schedules', async (req, res) => {
  try {
    const {
      scheduleName,
      startDate,
      endDate,
      startTime,
      endTime,
      songs,
      repeatType = "none",
      weekdays = []
    } = req.body;

    if (
      !scheduleName || !startTime || !endTime ||
      !Array.isArray(songs) || songs.length === 0 ||
      !startDate || !endDate
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (repeatType === 'weekly' && weekdays.length === 0) {
      return res.status(400).json({ error: 'Weekly repeat selected but no weekdays provided' });
    }

    // existing schedules (from cache) — ensure cache is loaded
    await loadSchedulesFromFile();

    // Build occurrences (same logic you had)
    const weekdayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const start = new Date(startDate);
    const end = new Date(endDate);
    const occurrences = [];
    let current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      const dayName = Object.keys(weekdayMap).find(k => weekdayMap[k] === day);

      if (
        repeatType === 'none' ||
        (repeatType === 'weekly' && weekdays.includes(dayName)) ||
        (repeatType === 'monthly' && current.getDate() === start.getDate())
      ) {
        occurrences.push({
          date: current.toISOString().split('T')[0],
          startTime,
          endTime
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (occurrences.length === 0) {
      return res.status(400).json({ error: 'No valid occurrences within the selected range.' });
    }

    const scheduleData = {
      id: Date.now(),
      scheduleName,
      startDate,
      endDate,
      startTime,
      endTime,
      repeatType,
      weekdays,
      occurrences,
      playlist: songs.map(song => ({
        songName: song.songName,
        songArtist: song.songArtist,
        songSrc: song.songSrc,
        songAvatar: song.songAvatar || './Assets/Images/image.png'
      }))
    };

    // Conflict check against schedulesCache (which was loaded)
    const existing = schedulesCache.length ? schedulesCache : (fs.existsSync(scheduleFilePath) ? JSON.parse(await fsPromises.readFile(scheduleFilePath, 'utf8')) : []);
    const hasConflict = existing.some(sch => {
      return sch.occurrences.some(existingOcc => {
        return occurrences.some(newOcc => (
          existingOcc.date === newOcc.date &&
          newOcc.startTime < existingOcc.endTime &&
          newOcc.endTime > existingOcc.startTime
        ));
      });
    });

    if (hasConflict) {
      return res.status(409).json({ error: 'Schedule conflict: Time overlaps with existing schedule' });
    }

    // push and save
    existing.push(scheduleData);
    await fsPromises.writeFile(scheduleFilePath, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`✅ Scheduled playlist: ${scheduleName}`);

    // rebuild in-memory index (async)
    await rebuildScheduleIndex();

    return res.status(201).json({ message: 'Schedule saved successfully', schedule: scheduleData });

  } catch (err) {
    console.error("Internal server error in /schedules:", err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get schedules
app.get('/schedules', async (req, res) => {
  try {
    if (!fs.existsSync(scheduleFilePath)) return res.json([]);
    const raw = await fsPromises.readFile(scheduleFilePath, 'utf8');
    return res.json(JSON.parse(raw || '[]'));
  } catch (err) {
    console.error('Get schedules error:', err);
    return res.status(500).json({ error: 'Failed to read schedules' });
  }
});

// Delete schedule by ID
app.delete('/schedules/:id', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    if (!fs.existsSync(scheduleFilePath)) {
      return res.status(404).json({ error: 'Schedule file not found' });
    }

    const schedules = JSON.parse(await fsPromises.readFile(scheduleFilePath, 'utf8'));
    const updatedSchedules = schedules.filter(sch => sch.id !== scheduleId);

    if (schedules.length === updatedSchedules.length) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    await fsPromises.writeFile(scheduleFilePath, JSON.stringify(updatedSchedules, null, 2), 'utf8');
    console.log(`Deleted schedule with ID: ${scheduleId}`);

    // rebuild index
    await rebuildScheduleIndex();

    return res.status(200).json({ message: 'Schedule deleted successfully' });
  } catch (err) {
    console.error('Delete schedule error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update schedule
app.put('/schedules/:id', async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.id, 10);
    const updatedData = req.body;
    if (!fs.existsSync(scheduleFilePath)) {
      return res.status(404).json({ error: 'Schedule file not found' });
    }

    const schedules = JSON.parse(await fsPromises.readFile(scheduleFilePath, 'utf8'));
    const index = schedules.findIndex((s) => s.id === scheduleId);

    if (index === -1) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    schedules[index] = {
      ...schedules[index],
      ...updatedData,
      playlist: updatedData.songs ? updatedData.songs.map(song => ({
        songName: song.songName,
        songArtist: song.songArtist,
        songSrc: song.songSrc,
        songAvatar: song.songAvatar || './Assets/Images/image.png'
      })) : schedules[index].playlist
    };

    await fsPromises.writeFile(scheduleFilePath, JSON.stringify(schedules, null, 2), 'utf8');
    console.log(`Updated schedule ID ${scheduleId}`);

    // rebuild index
    await rebuildScheduleIndex();

    return res.status(200).json({ message: 'Schedule updated successfully' });
  } catch (err) {
    console.error('Update schedule error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/songs/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const songPath = path.join(uploadPath, filename);

    if (fs.existsSync(songPath)) {
      await fsPromises.unlink(songPath);
    }

    if (fs.existsSync(songsFilePath)) {
      const songs = JSON.parse(await fsPromises.readFile(songsFilePath, 'utf8'));
      const updatedSongs = songs.filter(song => !song.songSrc.endsWith(`/${filename}`));
      await fsPromises.writeFile(songsFilePath, JSON.stringify(updatedSongs, null, 2), 'utf8');
      console.log(`Deleted song: ${filename}`);
      return res.status(200).json({ message: 'Song deleted' });
    }

    return res.status(404).json({ error: 'Song not found' });
  } catch (err) {
    console.error('Delete song error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/manual-play', (req, res) => {
  try {
    const { action } = req.body;

    if (action === 'play') {
      console.log('Manual play signal received. Turning amplifier ON.');
      port.write("ON\n");
    } else if (action === 'pause' || action === 'stop') {
      console.log('Manual pause/stop signal received. Turning amplifier OFF.');
      port.write("OFF\n");
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(200).json({ message: `Signal sent to Arduino: ${action}` });
  } catch (err) {
    console.error('Error handling manual play signal:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Scheduler loop (efficient lookups) ----------
(async function init() {
  // initial load & index
  await rebuildScheduleIndex();

  // run every 1 second — fast lookup by unix second
  const intervalMs = 1000;
  setInterval(() => {
    try {
      const nowMs = Date.now();
      const nowSec = Math.floor(nowMs / 1000);

      // cleanup old triggered events
      cleanupTriggeredEvents();

      // check ON events at this second (and optionally +/- 1 second to be tolerant)
      for (let offset = -1; offset <= 1; offset++) {
        const keySec = nowSec + offset;
        const onEvents = startIndex.get(keySec);
        if (Array.isArray(onEvents)) {
          onEvents.forEach((event) => {
            triggerOn(event.scheduleName, event);
          });
        }

        const offEvents = endIndex.get(keySec);
        if (Array.isArray(offEvents)) {
          offEvents.forEach((event) => {
            triggerOff(event.scheduleName, event);
          });
        }
      }
    } catch (err) {
      console.error('Scheduler loop error:', err);
    }
  }, intervalMs);
})();

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on...`);
});