import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

import Addmusic from './app/Addmusic';
import Playlist from './app/Playlist';
import Schedule from './app/Schedule';
import SchedulesMusic from './app/Listschedules';

// ------------------ SOCKET.IO ------------------
const socket = io('http://localhost:5000'); // connect to backend

const App = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHideShow, setIsHideShow] = useState(false);

  // ------------------ SOCKET.IO LISTENERS ------------------
  const handleScheduleActive = useCallback(({ scheduleName, event }) => {
    console.log('[SOCKET] Active schedule:', scheduleName, event);
    navigate('/playlist');
  }, [navigate]);

  const handleScheduleInactive = useCallback(({ scheduleName, event }) => {
    console.log('[SOCKET] Inactive schedule:', scheduleName, event);
    navigate('/');
  }, [navigate]);

  useEffect(() => {
    socket.on('scheduleActive', handleScheduleActive);
    socket.on('scheduleInactive', handleScheduleInactive);
    return () => {
      socket.off('scheduleActive', handleScheduleActive);
      socket.off('scheduleInactive', handleScheduleInactive);
    };
  }, [handleScheduleActive, handleScheduleInactive]);

  // ------------------ CURRENT TIME ------------------
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ------------------ HIDE/SHOW ------------------
  useEffect(() => {
    const hiddenRoutes = [
      '/playlist',
      '/schedule',
      '/addmusic',
      '/schedulesmusic',
    ];
    setIsHideShow(hiddenRoutes.includes(location.pathname));
  }, [location.pathname]);

  // ------------------ RESIZE ------------------
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
      if (window.innerWidth > 1024) setIsMenuOpen(false);
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
        {/* DATE & TIME */}
        {!isHideShow && (
          <div className="date-time-center">
            {currentTime.toLocaleDateString()}
            <br />
            {currentTime.toLocaleTimeString()}
          </div>
        )}

        {/* ROUTES */}
        <Routes>
          <Route path="/playlist" element={<Playlist />} />
          <Route path="/addmusic" element={<Addmusic />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/schedulesmusic" element={<SchedulesMusic />} />
          <Route path="/" element={<div>Welcome</div>} />
        </Routes>

        {/* NAVIGATION */}
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
            {[
              { path: '/', icon: 'fa-house', label: 'Home' },
              { path: '/playlist', icon: 'fa-play', label: 'Playlist' },
              { path: '/addmusic', icon: 'fa-music', label: 'Add Music' },
              { path: '/schedule', icon: 'fa-tags', label: 'Set Schedule' },
              { path: '/schedulesmusic', icon: 'fa-calendar-days', label: 'Music Sched' },
            ].map(({ path, icon, label }) => (
              <div key={path} className="nav-item" onClick={() => navigate(path)}>
                <i className={`fa-solid ${icon} nav-icon`}></i>
                <span className="nav-label">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
