const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

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
      songs
    } = req.body;

    if (!scheduleName || !startDate || !endDate || !startTime || !endTime || !Array.isArray(songs) || songs.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or empty song list' });
    }

    const scheduleData = {
      id: Date.now(),
      scheduleName,
      startDate,
      endDate,
      startTime,
      endTime,
      playlist: songs.map(song => ({
        songName: song.songName,
        songArtist: song.songArtist,
        songSrc: song.songSrc,
        songAvatar: song.songAvatar || './Assets/Images/profile.jpg'
      }))
    };

    const dataFile = path.join(__dirname, 'schedules.json');
    const existing = fs.existsSync(dataFile)
      ? JSON.parse(fs.readFileSync(dataFile))
      : [];

    existing.push(scheduleData);
    fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));

    console.log(`Scheduled playlist: ${scheduleName} with ${songs.length} songs`);
    res.status(201).json({ message: 'Schedule saved with multiple songs', schedule: scheduleData });

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

  // Update only songs and leave other fields unchanged
  schedules[index] = {
    ...schedules[index],
    ...updatedData,
    playlist: updatedData.songs.map(song => ({
      ...song,
      songAvatar: song.songAvatar || './Assets/Images/profile.jpg'
    }))
  };

  fs.writeFileSync(scheduleFile, JSON.stringify(schedules, null, 2));
  console.log(`Updated schedule ID ${scheduleId}`);
  res.status(200).json({ message: 'Schedule updated successfully' });
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
