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

// Create folder if it doesn't exist
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
app.post('/schedules', upload.single('musicFile'), (req, res) => {
  try {
    const { scheduleName, startDate, endDate, startTime, endTime } = req.body;
    const file = req.file;

    if (!scheduleName || !startDate || !endDate || !startTime || !endTime || !file) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log("Incoming schedule form data:");
    console.log("scheduleName:", scheduleName);
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);
    console.log("startTime:", startTime);
    console.log("endTime:", endTime);
    console.log("file:", file);

    const scheduleData = {
      id: Date.now(),
      scheduleName,
      startDate,
      endDate,
      startTime,
      endTime,
      musicSrc: `/songs/${file.filename}`,
      songName: scheduleName,
      songArtist: 'Scheduled',
      songAvatar: './Assets/Images/image1.png',
    };

    const dataFile = path.join(__dirname, 'schedules.json');
    const existing = fs.existsSync(dataFile)
      ? JSON.parse(fs.readFileSync(dataFile))
      : [];

    existing.push(scheduleData);
    fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));

    console.log(`✅ Scheduled: ${scheduleName} from ${startDate} to ${endDate} at ${startTime}–${endTime}`);
    res.status(201).json({ message: 'Schedule saved', schedule: scheduleData });

  } catch (err) {
    console.error("❌ Internal server error in /schedules:", err);
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
