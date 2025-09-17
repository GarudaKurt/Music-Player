import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

import Addmusic from './app/Addmusic';
import Playlist from './app/Playlist';
import Schedule from './app/Schedule';
import SchedulesMusic from './app/Listschedules';

// ------------------ FETCH SCHEDULES ------------------
const fetchTodaySchedules = async () => {
  // Get today's date in PH timezone
  const nowPH = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
  );
  const todayPH = nowPH.toISOString().split('T')[0]; // YYYY-MM-DD

  const res = await axios.get(`http://localhost:5000/schedules?date=${todayPH}`);
  return res.data;
};

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHideShow, setIsHideShow] = useState(false);
  const [activeEventId, setActiveEventId] = useState(null);

  // ------------------ FETCH TODAY'S SCHEDULES ------------------
  const {
    data: schedules = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['todaySchedules'],
    queryFn: fetchTodaySchedules,
    refetchInterval: 60000, // auto-refetch every 1 min
  });

  // ------------------ ACTIVATE CURRENT SCHEDULE ------------------
  useEffect(() => {
    if (!schedules.length) return;

    const nowPH = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    );

    for (const schedule of schedules) {
      const activeOccurrence = schedule.occurrences?.find((occ) => {
        const [startH, startM] = occ.startTime.split(':').map(Number);
        const [endH, endM] = occ.endTime.split(':').map(Number);

        const startTime = new Date(nowPH);
        startTime.setHours(startH, startM, 0, 0);

        const endTime = new Date(nowPH);
        endTime.setHours(endH, endM, 0, 0);
        return nowPH >= startTime && nowPH <= endTime;
      });

      if (activeOccurrence) {
        const newEventId = `${schedule.id}::start::${activeOccurrence.date}::${activeOccurrence.startTime}`;

        if (activeEventId !== newEventId) {
          setActiveEventId(newEventId);

          axios
            .post('http://localhost:5000/activate', {
              scheduleName: schedule.scheduleName,
              event: {
                eventId: newEventId,
                ...activeOccurrence,
                scheduleId: schedule.id,
              },
            })
            .then(() =>
              console.log(`[DEBUG] Activated scheduleId=${schedule.id}`)
            )
            .catch((err) => console.error('❌ Activate failed:', err));

          if (location.pathname === '/') navigate('/playlist');
        }
        break;
      }
    }
  }, [currentTime, schedules, location.pathname, navigate, activeEventId]);

  // ------------------ CURRENT TIME UPDATER ------------------
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ------------------ HIDE/SHOW LOGIC ------------------
  useEffect(() => {
    const hiddenRoutes = [
      '/playlist',
      '/schedule',
      '/addmusic',
      '/schedulesmusic',
    ];
    setIsHideShow(hiddenRoutes.includes(location.pathname));
  }, [location.pathname]);

  // ------------------ MOBILE RESIZE ------------------
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

        {isLoading && <p>Loading schedules...</p>}
        {error && <p>Failed to load schedules</p>}

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
                <i className="fa-solid fa-house nav-icon" onClick={() => handleNavigate('/')} />
                <i className="fa-solid fa-play nav-icon" onClick={() => handleNavigate('/playlist')} />
                <i className="fa-solid fa-music nav-icon" onClick={() => handleNavigate('/addmusic')} />
                <i className="fa-solid fa-tags nav-icon" onClick={() => handleNavigate('/schedule')} />
                <i className="fa-solid fa-calendar-days nav-icon" onClick={() => handleNavigate('/schedulesmusic')} />
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
            <div className="nav-item" onClick={() => navigate('/schedulesmusic')}>
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
