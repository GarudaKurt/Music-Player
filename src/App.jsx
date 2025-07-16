import { Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Addmusic from './app/Addmusic';
import Playlist from './app/Playlist';
import Schedule from './app/Schedule';
import SchedulesMusic from './app/Listschedules';
import { useLocation } from 'react-router-dom';

const App = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isHideShow, setIsHideShow] = useState(false);
  const location = useLocation();
  

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);
  
  useEffect(() => {
    const hiddenRoutes = ['/playlist', '/schedule', '/addmusic', '/schedulesmusic'];
    setIsHideShow(hiddenRoutes.includes(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) setIsMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigate = (path) => {
    navigate(path);
    setIsMenuOpen(false); // close menu after navigation
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
      <Route path="/"/>
    </Routes>

      {isMobile ? (
        <>
          <button className="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <i className="fa fa-bars"></i>
          </button>
          {isMenuOpen && (
            <div className="mobileNavMenu">
              <i className="fa-solid fa-house nav-icon" onClick={() => handleNavigate('/')}></i>
              <i className="fa-solid fa-play nav-icon" onClick={() => handleNavigate('/playlist')}></i>
              <i className="fa-solid fa-music nav-icon" onClick={() => handleNavigate('/addmusic')}></i>
              <i className="fa-solid fa-tags nav-icon" onClick={() => handleNavigate('/schedule')}></i>
              <i className="fa-solid fa-calendar-days nav-icon" onClick={() => handleNavigate('/schedulesmusic')}></i>
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
