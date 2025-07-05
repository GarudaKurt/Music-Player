import { Routes, Route, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Addmusic from './app/Addmusic';
import Playlist from './app/Playlist';
import Schedule from './app/Schedule';

const App = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    <div className="container">
      <Routes>
        <Route path="/playlist" element={<Playlist />} />
        <Route path="/addmusic" element={<Addmusic />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/" element={<Playlist />} />
      </Routes>

      {isMobile ? (
        <>
          <button className="hamburger" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <i className="fa fa-bars"></i>
          </button>
          {isMenuOpen && (
            <div className="mobileNavMenu">
              <i className="fa-solid fa-house nav-icon" onClick={() => handleNavigate('/playlist')}></i>
              <i className="fa-solid fa-music nav-icon" onClick={() => handleNavigate('/addmusic')}></i>
              <i className="fa-solid fa-tags nav-icon" onClick={() => handleNavigate('/schedule')}></i>
            </div>
          )}
        </>
      ) : (
        <div className="bottomNav">
          <i className="fa-solid fa-house nav-icon" onClick={() => navigate('/playlist')}></i>
          <i className="fa-solid fa-music nav-icon" onClick={() => navigate('/addmusic')}></i>
          <i className="fa-solid fa-tags nav-icon" onClick={() => navigate("/schedule")}></i>
        </div>
      )}
    </div>
  );
};

export default App;
