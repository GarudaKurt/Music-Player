import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';

import Addmusic from './app/Addmusic';
import Playlist from './app/Playlist';
import Schedule from './app/Schedule';
import SchedulesMusic from './app/Listschedules';

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHideShow, setIsHideShow] = useState(false);
  const [schedules, setSchedules] = useState([]);

  // ------------------ Check for upcoming schedules ------------------
  // Fetch schedules in every 1 mins
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const res = await axios.get(
          `http://localhost:5000/schedules?year=${currentYear}`
        );

        setSchedules(res.data);

        // 🔍 Debug log full API response
        console.log("🔍 API Schedules Response:", JSON.stringify(res.data, null, 2));
      } catch (err) {
        console.error("❌ Error fetching schedules:", err);
      }
    };

    fetchSchedules();
    const refresh = setInterval(fetchSchedules, 60000);
    return () => clearInterval(refresh);
  }, []);

  // ------------------ Activate when inside schedule ------------------
  useEffect(() => {
    if (!schedules.length) return;

    const now = currentTime;
    const today = now.toLocaleDateString("en-CA");

    console.log(" Current local date:", today);

    for (const schedule of schedules) {
      console.log("Checking schedule:", schedule.scheduleName);

      const activeOccurrence = schedule.occurrences?.find((occ) => {
        // Debug each occurrence date
        console.log(
          `  Occurrence date=${occ.date}, start=${occ.startTime}, end=${occ.endTime}`
        );

        if (occ.date !== today) return false;

        const [startH, startM] = occ.startTime.split(":").map(Number);
        const [endH, endM] = occ.endTime.split(":").map(Number);

        const startTime = new Date(now);
        startTime.setHours(startH, startM, 0, 0);

        const endTime = new Date(now);
        endTime.setHours(endH, endM, 0, 0);

        console.log("    Now:", now);
        console.log("    Start:", startTime);
        console.log("    End:", endTime);

        return now >= startTime && now <= endTime;
      });

      if (activeOccurrence) {
        console.log("✅ Active occurrence found → Arduino ON:", activeOccurrence);

        axios
          .post("http://localhost:5000/activate", {
            scheduleName: schedule.scheduleName,
            event: {
              eventId: `${schedule.id}::start::${activeOccurrence.date}::${activeOccurrence.startTime}`,
              ...activeOccurrence,
              scheduleId: schedule.id,
            },
          })
          .catch((err) => console.error("❌ Activate failed:", err));

        if (location.pathname === "/") navigate("/playlist");
        break;
      }
    }
  }, [currentTime, schedules, location.pathname, navigate]);

  // ------------------ Current time updater ------------------
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ------------------ Hide/show logic ------------------
  useEffect(() => {
    const hiddenRoutes = [
      '/playlist',
      '/schedule',
      '/addmusic',
      '/schedulesmusic',
    ];
    setIsHideShow(hiddenRoutes.includes(location.pathname));
  }, [location.pathname]);

  // ------------------ Mobile resize ------------------
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
      if (window.innerWidth >= 1025) setIsMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  return (
    <div className="app-wrapper">
      <div className="background-image" />
      <div className="overlay-content">
        {!isHideShow && (
          <div className="date-time-center">
            {currentTime.toLocaleDateString()}
            <br />
            {currentTime.toLocaleTimeString()}
          </div>
        )}

        <Routes>
          <Route path="/playlist" element={<Playlist />} />
          <Route path="/addmusic" element={<Addmusic />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/schedulesmusic" element={<SchedulesMusic />} />
          <Route path="/" />
        </Routes>

        {isMobile ? (
          <>
            <button
              className="hamburger"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <i className="fa fa-bars"></i>
            </button>
            {isMenuOpen && (
              <div className="mobileNavMenu">
                <i
                  className="fa-solid fa-house nav-icon"
                  onClick={() => handleNavigate('/')}
                />
                <i
                  className="fa-solid fa-play nav-icon"
                  onClick={() => handleNavigate('/playlist')}
                />
                <i
                  className="fa-solid fa-music nav-icon"
                  onClick={() => handleNavigate('/addmusic')}
                />
                <i
                  className="fa-solid fa-tags nav-icon"
                  onClick={() => handleNavigate('/schedule')}
                />
                <i
                  className="fa-solid fa-calendar-days nav-icon"
                  onClick={() => handleNavigate('/schedulesmusic')}
                />
              </div>
            )}
          </>
        ) : (
          <div className="bottomNav">
            <div className="nav-item" onClick={() => navigate('/')}>
              <i className="fa-solid fa-house nav-icon"></i>
              <span className="nav-label">Home</span>
            </div>
            <div className="nav-item" onClick={() => navigate('/playlist')}>
              <i className="fa-solid fa-play nav-icon"></i>
              <span className="nav-label">Playlist</span>
            </div>
            <div className="nav-item" onClick={() => navigate('/addmusic')}>
              <i className="fa-solid fa-music nav-icon"></i>
              <span className="nav-label">Add Music</span>
            </div>
            <div className="nav-item" onClick={() => navigate('/schedule')}>
              <i className="fa-solid fa-tags nav-icon"></i>
              <span className="nav-label">Set Schedule</span>
            </div>
            <div
              className="nav-item"
              onClick={() => navigate('/schedulesmusic')}
            >
              <i className="fa-solid fa-calendar-days nav-icon"></i>
              <span className="nav-label">Music Sched</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
