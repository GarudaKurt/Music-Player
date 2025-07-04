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

// ✅ Ensure directory exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// ✅ Serve uploaded files
app.use('/songs', express.static(uploadPath));

// ✅ Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Serve the list of uploaded songs
app.get('/songs-list', (req, res) => {
  const dataFile = path.join(__dirname, 'songs.json');
  if (!fs.existsSync(dataFile)) {
    return res.json([]); // return empty array if file doesn't exist
  }

  const songList = JSON.parse(fs.readFileSync(dataFile));
  res.json(songList);
});

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

  console.log(`✅ Uploaded: ${file.originalname}`);
  return res.status(200).json({ message: 'Uploaded successfully', song: songData });
});

app.post('/schedules', upload.single('musicFile'), (req, res) => {
  const { scheduleName, startDate, endDate, time } = req.body;
  const file = req.file;

  if (!scheduleName || !startDate || !endDate || !time || !file) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log("Incoming schedule form data:");
  console.log("scheduleName:", scheduleName);
  console.log("startDate:", startDate);
  console.log("endDate:", endDate);
  console.log("time:", time);
  console.log("file:", file);

  if (!scheduleName || !startDate || !endDate || !time || !file) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

 const scheduleData = {
  id: Date.now(),
  scheduleName,
  startDate,
  endDate,
  time,
  musicSrc: `/songs/${file.filename}`,
  songName: scheduleName,       // Or store from the selected song
  songArtist: 'Scheduled',      // Optional
  songAvatar: './Assets/Images/image1.jpg',
};


  const dataFile = path.join(__dirname, 'schedules.json');
  const existing = fs.existsSync(dataFile)
    ? JSON.parse(fs.readFileSync(dataFile))
    : [];

  existing.push(scheduleData);
  fs.writeFileSync(dataFile, JSON.stringify(existing, null, 2));

  console.log(`✅ Scheduled: ${scheduleName} from ${startDate} to ${endDate} at ${time}`);
  return res.status(200).json({ message: 'Schedule saved', schedule: scheduleData });
});

app.get('/schedules', (req, res) => {
  const scheduleFile = path.join(__dirname, 'schedules.json');
  if (!fs.existsSync(scheduleFile)) return res.json([]);
  const schedules = JSON.parse(fs.readFileSync(scheduleFile));
  res.json(schedules);
});



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


