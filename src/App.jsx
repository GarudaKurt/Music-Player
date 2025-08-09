import { Routes, Route, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

import Landing from './app/Landing';
import Playlist from './app/Playlist';
import Addmusic from './app/Addmusic';
import Schedule from './app/Schedule';
import SchedulesMusic from './app/Listschedules';

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHideShow, setIsHideShow] = useState(false);

  useEffect(() => {
    const hiddenRoutes = [];
    setIsHideShow(hiddenRoutes.includes(location.pathname));
  }, [location.pathname]);

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
        <Outlet />

        {!isHideShow && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
};

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Landing />} />
        <Route path="playlist" element={<Playlist />} />
        <Route path="addmusic" element={<Addmusic />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="schedulesmusic" element={<SchedulesMusic />} />
      </Route>
    </Routes>
  );
};

export default App;
