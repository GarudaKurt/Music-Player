

const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const port = new SerialPort({
  path: 'COM3',
  baudRate: 9600,
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

const app = express();
const PORT = 5000;

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

// Get uploaded song list
app.get('/songs-list', (req, res) => {
  const dataFile = path.join(__dirname, 'songs.json');
  if (!fs.existsSync(dataFile)) return res.json([]);
  const songList = JSON.parse(fs.readFileSync(dataFile));
  res.json(songList);
});

// Upload song
app.post('/uploads', upload.single('songFile'), (req, res) => {
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

  const dataFile = path.join(__dirname, 'songs.json');
  const existing = fs.existsSync(dataFile) ? JSON.parse(fs.readFileSync(dataFile)) : [];
  existing.push(songData);
  fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));

  console.log(`Uploaded: ${file.originalname}`);
  res.status(200).json({ message: 'Uploaded successfully', song: songData });
});

// Upload schedule
app.post('/schedules', (req, res) => {
  try {
    const {
      scheduleName,
      startDate,
      endDate,
      startTime,
      endTime,
      songs,
      repeatType = "none", // none | weekly | monthly
      weekdays = [] // Only used if repeatType is weekly
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

    const scheduleFile = path.join(__dirname, 'schedules.json');
    const existing = fs.existsSync(scheduleFile) ? JSON.parse(fs.readFileSync(scheduleFile)) : [];

    // Helper: Convert day string to number (Mon -> 1, Sun -> 0)
    const weekdayMap = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3,
      'Thu': 4, 'Fri': 5, 'Sat': 6
    };

    const start = new Date(startDate);
    const end = new Date(endDate);
    const occurrences = [];

    let current = new Date(start);

    while (current <= end) {
      const day = current.getDay(); // 0 (Sun) to 6 (Sat)
      const dayName = Object.keys(weekdayMap).find(k => weekdayMap[k] === day);

      if (
        repeatType === 'none' ||
        (repeatType === 'weekly' && weekdays.includes(dayName)) ||
        (repeatType === 'monthly' && current.getDate() === start.getDate())
      ) {
        const occurrenceStart = new Date(current);
        occurrenceStart.setHours(...startTime.split(':').map(Number));
        const occurrenceEnd = new Date(current);
        occurrenceEnd.setHours(...endTime.split(':').map(Number));

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
      repeatType, // none | weekly | monthly
      weekdays,
      occurrences,
      playlist: songs.map(song => ({
        songName: song.songName,
        songArtist: song.songArtist,
        songSrc: song.songSrc,
        songAvatar: song.songAvatar || './Assets/Images/image.png'
      }))
    };

    // Check for time conflicts
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

    existing.push(scheduleData);
    fs.writeFileSync(scheduleFile, JSON.stringify(existing, null, 2));

    console.log(`✅ Scheduled playlist: ${scheduleName}`);
    res.status(201).json({ message: 'Schedule saved successfully', schedule: scheduleData });

  } catch (err) {
    console.error("Internal server error in /schedules:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get schedules
app.get('/schedules', (req, res) => {
  const scheduleFile = path.join(__dirname, 'schedules.json');
  if (!fs.existsSync(scheduleFile)) return res.json([]);
  const schedules = JSON.parse(fs.readFileSync(scheduleFile));
  res.json(schedules);
});

// Delete schedule by ID
app.delete('/schedules/:id', (req, res) => {
  const scheduleFile = path.join(__dirname, 'schedules.json');
  const scheduleId = parseInt(req.params.id, 10);

  if (!fs.existsSync(scheduleFile)) {
    return res.status(404).json({ error: 'Schedule file not found' });
  }

  const schedules = JSON.parse(fs.readFileSync(scheduleFile));
  const updatedSchedules = schedules.filter(sch => sch.id !== scheduleId);

  if (schedules.length === updatedSchedules.length) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  fs.writeFileSync(scheduleFile, JSON.stringify(updatedSchedules, null, 2));
  console.log(`Deleted schedule with ID: ${scheduleId}`);
  res.status(200).json({ message: 'Schedule deleted successfully' });
});

// Update schedule
app.put('/schedules/:id', (req, res) => {
  const scheduleFile = path.join(__dirname, 'schedules.json');
  const scheduleId = parseInt(req.params.id, 10);
  const updatedData = req.body;

  if (!fs.existsSync(scheduleFile)) {
    return res.status(404).json({ error: 'Schedule file not found' });
  }

  const schedules = JSON.parse(fs.readFileSync(scheduleFile));
  const index = schedules.findIndex((s) => s.id === scheduleId);

  if (index === -1) {
    return res.status(404).json({ error: 'Schedule not found' });
  }

  schedules[index] = {
    ...schedules[index],
    ...updatedData,
    playlist: updatedData.songs.map(song => ({
      songName: song.songName,
      songArtist: song.songArtist,
      songSrc: song.songSrc,
      songAvatar: song.songAvatar || './Assets/Images/image.png'
    }))
  };


  fs.writeFileSync(scheduleFile, JSON.stringify(schedules, null, 2));
  console.log(`Updated schedule ID ${scheduleId}`);
  res.status(200).json({ message: 'Schedule updated successfully' });
});

app.delete('/songs/:filename', (req, res) => {
  const filename = req.params.filename;
  const songPath = path.join(uploadPath, filename);
  const dataFile = path.join(__dirname, 'songs.json');

  // Delete song file
  if (fs.existsSync(songPath)) {
    fs.unlinkSync(songPath);
  }

  // Remove from songs.json
  if (fs.existsSync(dataFile)) {
    const songs = JSON.parse(fs.readFileSync(dataFile));
    const updatedSongs = songs.filter(song => !song.songSrc.endsWith(`/${filename}`));
    fs.writeFileSync(dataFile, JSON.stringify(updatedSongs, null, 2));
    console.log(`Deleted song: ${filename}`);
    return res.status(200).json({ message: 'Song deleted' });
  }

  return res.status(404).json({ error: 'Song not found' });
});

app.post('/manual-play', (req, res) => {
  try {
    const { action } = req.body; // e.g., 'play' or 'pause'

    if (action === 'play') {
      console.log('Manual play signal received. Turning amplifier ON.');
      port.write("1\n");  // Turn ON Arduino amplifier
    } else if (action === 'pause' || action === 'stop') {
      console.log('Manual pause/stop signal received. Turning amplifier OFF.');
      port.write("0\n");  // Turn OFF Arduino amplifier
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    res.status(200).json({ message: `Signal sent to Arduino: ${action}` });
  } catch (err) {
    console.error('Error handling manual play signal:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

setInterval(() => {
  const now = new Date();
  const scheduleFile = path.join(__dirname, 'schedules.json');
  if (!fs.existsSync(scheduleFile)) return;

  const schedules = JSON.parse(fs.readFileSync(scheduleFile));

  schedules.forEach(schedule => {
    schedule.occurrences.forEach(occ => {
      const [startHour, startMin] = occ.startTime.split(':').map(Number);
      const [endHour, endMin] = occ.endTime.split(':').map(Number);

      const startTime = new Date(`${occ.date}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`);
      const endTime = new Date(`${occ.date}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`);

      // ON: 2 minutes before start
      const notifyTime = new Date(startTime.getTime() - 2 * 60000);
      const diffStart = Math.abs(now - notifyTime);

      if (diffStart < 5000) {
        console.log(`Schedule "${schedule.scheduleName}" starts soon! Turning amplifier ON`);
        port.write("1\n"); // Arduino receives 1 to turn ON
      }

      // OFF: when scheduled end hits
      const diffEnd = Math.abs(now - endTime);

      if (diffEnd < 5000) {
        console.log(`Schedule "${schedule.scheduleName}" ended. Turning amplifier OFF`);
        port.write("0\n"); // Arduino receives 0 to turn OFF
      }
    });
  });
}, 10000);
