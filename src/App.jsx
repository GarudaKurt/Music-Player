import { Routes, Route, useNavigate } from 'react-router-dom';
import Addmusic from './app/Addmusic';
import Playlist from './app/Playlist';
import Schedule from './app/Schedule';

const App = () => {
  const navigate = useNavigate();

  return (
    <div className="container">
      <Routes>
        <Route path="/playlist" element={<Playlist />} />
        <Route path="/addmusic" element={<Addmusic />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/" element={<Playlist />} />
      </Routes>

      <div className="bottomNav">
        <i className="fa-solid fa-house nav-icon" onClick={() => navigate('/playlist')}></i>
        <i className="fa-solid fa-music nav-icon" onClick={() => navigate('/addmusic')}></i>
        <i className="fa-solid fa-tags nav-icon" onClick={() => navigate("/schedule")}></i>
      </div>
    </div>
  );
};

export default App;
