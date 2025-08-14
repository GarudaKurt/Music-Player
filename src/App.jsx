// App.jsx
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

  // ------------------ Check for upcoming schedules ------------------
  useEffect(() => {
    const checkIncomingSchedule = async () => {
      try {
        const res = await axios.get('http://localhost:5000/schedules');
        const schedules = res.data;
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        for (const schedule of schedules) {
          // Check occurrences first
          const upcoming = schedule.occurrences?.some(occ => {
            if (occ.date !== today) return false;

            const [startH, startM] = occ.startTime.split(':').map(Number);
            const [endH, endM] = occ.endTime.split(':').map(Number);

            const startTime = new Date(now);
            startTime.setHours(startH, startM, 0, 0);

            const endTime = new Date(now);
            endTime.setHours(endH, endM, 0, 0);

            return now >= startTime && now <= endTime;
          });

          if (upcoming) {
            if (location.pathname === '/') navigate('/playlist');
            break;
          }
        }
      } catch (err) {
        console.error('Error checking schedules:', err);
      }
    };

    checkIncomingSchedule();
    const interval = setInterval(checkIncomingSchedule, 10000);
    return () => clearInterval(interval);
  }, [location.pathname, navigate]);

  // ------------------ Current time updater ------------------
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ------------------ Hide/show logic ------------------
  useEffect(() => {
    const hiddenRoutes = ['/playlist', '/schedule', '/addmusic', '/schedulesmusic'];
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
            {currentTime.toLocaleDateString()}<br />
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
            <button className="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
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
