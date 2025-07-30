import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '../App.css';
import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';

const Playlist = () => {
  const [musicAPI, setMusicAPI] = useState([]);
  const [currentMusicDetails, setCurrentMusicDetails] = useState({
    songName: '',
    songArtist: '',
    songSrc: '',
    songAvatar: './Assets/Images/image.png'
  });
  const [scheduledPlaylist, setScheduledPlaylist] = useState([]);
  const [scheduledSongIndex, setScheduledSongIndex] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [musicIndex, setMusicIndex] = useState(0);
  const [musicTotalLength, setMusicTotalLength] = useState('00 : 00');
  const [musicCurrentTime, setMusicCurrentTime] = useState('00 : 00');
  const [avatarClassIndex, setAvatarClassIndex] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);
  const [isOverrideMode, setIsOverrideMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pausedScheduledDetails, setPausedScheduledDetails] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const navigate = useNavigate();

  const location = useLocation();
  const previousPathRef = useRef(location.pathname);

  const inactivityTimeoutRef = useRef(null);
  const lastPlayedTimestampRef = useRef(Date.now());

  useEffect(() => {
    const prev = previousPathRef.current;
    const now = location.pathname;

    // If we were on /playlist and now leaving
    if (prev === '/playlist' && now !== '/playlist') {
      if (isScheduledPlaying.current && !isOverrideMode) {
        currentAudio.current.pause();
        setPausedScheduledDetails(currentMusicDetails);
        console.log('⏸ Music paused due to route change');
      }
    }

    // If we are returning to /playlist and there’s paused music
    if (prev !== '/playlist' && now === '/playlist') {
      if (pausedScheduledDetails && !isOverrideMode) {
        setCurrentMusicDetails(pausedScheduledDetails);
        currentAudio.current.src = `http://localhost:5000${pausedScheduledDetails.songSrc}`;
        currentAudio.current.load();
        currentAudio.current.play().then(() => {
          setIsAudioPlaying(true);
          console.log('Resumed scheduled music after route return');
          setPausedScheduledDetails(null);
        }).catch(err => {
          console.warn('Autoplay resume failed:', err.message);
        });
      }
    }

    previousPathRef.current = now;
  }, [location.pathname]);


  useEffect(() => {
    const checkInactivity = setInterval(() => {
      const now = Date.now();
      const diff = now - lastPlayedTimestampRef.current;

      const noSchedulePlaying = !isScheduledPlaying.current;
      const noOverride = !isOverrideMode;
      const audioNotPlaying = currentAudio.current?.paused;

      // If no music playing and idle for 2 minutes, navigate home
      if (diff >= 2 * 60 * 1000 && noSchedulePlaying && noOverride && audioNotPlaying) {
        console.warn('Inactive for 2 mins, navigating home...');
        navigate('/');
      }
    }, 5000);

    return () => clearInterval(checkInactivity);
  }, []);


  const avatarClass = ['objectFitCover', 'objectFitContain', 'none'];
  const currentAudio = useRef();
  const hasPlayedToday = useRef({});
  const autoplayUnlocked = useRef(false);
  const isScheduledPlaying = useRef(false);
  const hasEndedRef = useRef(false);

  const scheduledLoopStartTime = useRef(null);
  const scheduledLoopEndTime = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      clearInterval(timer);
      clearTimeout(inactivityTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const unlockAutoplay = () => {
      if (currentAudio.current) {
        currentAudio.current.muted = true;
        currentAudio.current.play().then(() => {
          currentAudio.current.pause();
          currentAudio.current.muted = false;
          autoplayUnlocked.current = true;
          console.log('Autoplay unlocked');
        }).catch(err => {
          console.warn('Autoplay unlock failed:', err.message);
        });
      }
      window.removeEventListener('click', unlockAutoplay);
    };

    window.addEventListener('click', unlockAutoplay);
    return () => window.removeEventListener('click', unlockAutoplay);
  }, []);

  useEffect(() => {
    axios.get('http://localhost:5000/songs-list')
      .then(res => {
        setMusicAPI(res.data);

        // Only preload default song if no schedule is playing
        if (res.data.length > 0 && !isScheduledPlaying.current) {
          const firstSong = res.data[0];
          setCurrentMusicDetails(firstSong);
          if (currentAudio.current) {
            currentAudio.current.oncanplay = null;
            currentAudio.current.src = `http://localhost:5000${firstSong.songSrc}`;
            currentAudio.current.load();
          }
          setIsAudioPlaying(false);
        }
      })
      .catch(err => console.error('Failed to fetch songs:', err));
  }, []);



  useEffect(() => {
    const checkScheduledTimeout = setInterval(() => {
      const now = new Date();
      if (isScheduledPlaying.current && scheduledLoopEndTime.current && now >= scheduledLoopEndTime.current) {
        console.log('Scheduled duration ended, stopping playback');
        setHasEnded(true);
        hasEndedRef.current = true;
        if (currentAudio.current) {
          currentAudio.current.pause();
          currentAudio.current.currentTime = 0;
        }
        isScheduledPlaying.current = false;
        scheduledLoopStartTime.current = null;
        scheduledLoopEndTime.current = null;
        setIsAudioPlaying(false);
        setScheduledPlaylist([]);
        setScheduledSongIndex(0);
        navigate("/")
        if (currentAudio.current) {
          currentAudio.current.pause();
          currentAudio.current.currentTime = 0;
          currentAudio.current.src = "";
        }

      }
    }, 5000);
    return () => clearInterval(checkScheduledTimeout);
  }, []);

  const playScheduledSong = (song, scheduleName = '') => {
    const audioEl = currentAudio.current;
    if (!audioEl || !song) return;

    setCurrentMusicDetails({
      songName: song.songName,
      songArtist: song.songArtist || scheduleName,
      songSrc: song.songSrc,
      songAvatar: song.songAvatar || './Assets/Images/image.png'
    });

    audioEl.src = `http://localhost:5000${song.songSrc}`;
    audioEl.load();

    const tryPlay = () => {
      audioEl.play().then(() => {
        console.log(`▶️ Playing: ${song.songName}`);
        setIsAudioPlaying(true);
        lastPlayedTimestampRef.current = Date.now();
        clearTimeout(inactivityTimeoutRef.current);
      }).catch((err) => {
        console.warn('Autoplay error:', err.message);
        audioEl.muted = true;
        audioEl.play().then(() => {
          console.log('Muted autoplay fallback success');
          setIsAudioPlaying(true);
          lastPlayedTimestampRef.current = Date.now();
          clearTimeout(inactivityTimeoutRef.current);
        }).catch((e) => {
          console.error('Even muted autoplay failed:', e.message);
        });
      });
    };

    audioEl.oncanplay = tryPlay;
    setTimeout(() => {
      if (audioEl.paused) tryPlay();
    }, 1000);
  };


  useEffect(() => {
    const checkAndPlayScheduledSong = async () => {
      if (isOverrideMode) return;
      try {
        const schedulesRes = await axios.get('http://localhost:5000/schedules');
        const schedules = schedulesRes.data;

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        let anySchedulePlayed = false;

        schedules.forEach((schedule) => {
          const isWithinDate = schedule.startDate <= today && schedule.endDate >= today;
          const alreadyPlayed = hasPlayedToday.current[schedule.id];


          const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
          const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

          const startTime = new Date(now);
          startTime.setHours(startHour, startMinute, 0, 0);

          const endTime = new Date(now);
          endTime.setHours(endHour, endMinute, 0, 0);

          const isWithinTimeRange = now >= startTime && now <= endTime;

          if (isWithinDate && isWithinTimeRange && !alreadyPlayed) {
            if (hasEndedRef.current) {
              setHasEnded(false);
              hasEndedRef.current = false;
            }

            if (schedule.playlist && Array.isArray(schedule.playlist)) {
              console.log(`Playing scheduled playlist: ${schedule.scheduleName}`);
              setScheduledPlaylist(schedule.playlist);
              setScheduledSongIndex(0);
              playScheduledSong(schedule.playlist[0], schedule.scheduleName);
              isScheduledPlaying.current = true;
              hasPlayedToday.current[schedule.id] = true;
              scheduledLoopStartTime.current = startTime;
              scheduledLoopEndTime.current = endTime;
            }
          }
        });
        if (!anySchedulePlayed) {
          // No schedule playing, so keep the inactivity timer running
        }
      } catch (err) {
        console.error('Error checking schedule:', err);
      }
    };

    checkAndPlayScheduledSong();
    const interval = setInterval(checkAndPlayScheduledSong, 30000);
    return () => clearInterval(interval);
  }, [hasEnded, isOverrideMode]);

  const handleOverrideClick = () => {
    if (isOverrideMode) {
      if (pausedScheduledDetails) {
        setCurrentMusicDetails(pausedScheduledDetails);
        currentAudio.current.src = `http://localhost:5000${pausedScheduledDetails.songSrc}`;
        currentAudio.current.load();
        currentAudio.current.play();
        setIsAudioPlaying(true);
        lastPlayedTimestampRef.current = Date.now();
        clearTimeout(inactivityTimeoutRef.current);
      }
      setIsOverrideMode(false);
      setPausedScheduledDetails(null);
    } else {
      if (isScheduledPlaying.current) {
        currentAudio.current.pause();
        setPausedScheduledDetails(currentMusicDetails);
      }
      setIsModalOpen(true);
    }
  };

  const handleSelectOverrideSong = (song) => {
    setCurrentMusicDetails(song);
    currentAudio.current.src = `http://localhost:5000${song.songSrc}`;
    currentAudio.current.load();
    currentAudio.current.play();
    setIsAudioPlaying(true);
    lastPlayedTimestampRef.current = Date.now();
    clearTimeout(inactivityTimeoutRef.current);
    setIsOverrideMode(true);
    setIsModalOpen(false);
  };


  const handleNextSong = () => {
    const now = new Date();
    if (hasEndedRef.current || (isScheduledPlaying.current && scheduledLoopEndTime.current && now >= scheduledLoopEndTime.current)) {
      return;
    }

    if (isScheduledPlaying.current && scheduledPlaylist.length > 0) {
      const nextIndex = (scheduledSongIndex + 1) % scheduledPlaylist.length;
      setScheduledSongIndex(nextIndex);
      playScheduledSong(scheduledPlaylist[nextIndex]);
      return;
    }

    const newIndex = (musicIndex + 1) % musicAPI.length;
    setMusicIndex(newIndex);
    updateCurrentMusicDetails(newIndex, true); // autoplay on navigation
    lastPlayedTimestampRef.current = Date.now();
    clearTimeout(inactivityTimeoutRef.current);
  };


  const handlePrevSong = () => {
    isScheduledPlaying.current = false;
    const newIndex = (musicIndex - 1 + musicAPI.length) % musicAPI.length;
    setMusicIndex(newIndex);
    updateCurrentMusicDetails(newIndex, true); // autoplay on navigation
  };


  const updateCurrentMusicDetails = (index, playNow = true) => {
    isScheduledPlaying.current = false;
    const music = musicAPI[index];
    if (!music) return;

    setCurrentMusicDetails(music);

    if (currentAudio.current) {
      currentAudio.current.src = `http://localhost:5000${music.songSrc}`;
      currentAudio.current.load();
      if (playNow) {
        currentAudio.current.play()
          .then(() => {
            setIsAudioPlaying(true);
            lastPlayedTimestampRef.current = Date.now();
            clearTimeout(inactivityTimeoutRef.current);
          })
          .catch(err => console.warn('Play error:', err.message));
      }
    }

    if (!playNow) setIsAudioPlaying(false);
  };


  const handleMusicProgressBar = (e) => {
    setAudioProgress(e.target.value);
    currentAudio.current.currentTime = e.target.value * currentAudio.current.duration / 100;
  };

  const handleAvatar = () => {
    setAvatarClassIndex((prev) => (prev + 1) % avatarClass.length);
  };

  const handleAudioPlay = async () => {
    if (currentAudio.current.paused) {
      try {
        await axios.post('http://localhost:5000/manual-play', { action: 'play' });
        console.log('Sent play signal to server');
      } catch (err) {
        console.error('Failed to send play signal:', err);
      }

      currentAudio.current.play();
      setIsAudioPlaying(true);
      lastPlayedTimestampRef.current = Date.now();
      clearTimeout(inactivityTimeoutRef.current);
    } else {
      try {
        await axios.post('http://localhost:5000/manual-play', { action: 'pause' });
        console.log('Sent pause signal to server');
      } catch (err) {
        console.error('Failed to send pause signal:', err);
      }

      currentAudio.current.pause();
      setIsAudioPlaying(false);
    }
  };


  const handleAudioUpdate = () => {
    const duration = currentAudio.current.duration || 0;
    const currentTime = currentAudio.current.currentTime || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    setMusicTotalLength(`${minutes < 10 ? `0${minutes}` : minutes} : ${seconds < 10 ? `0${seconds}` : seconds}`);
    const currentMin = Math.floor(currentTime / 60);
    const currentSec = Math.floor(currentTime % 60);
    setMusicCurrentTime(`${currentMin < 10 ? `0${currentMin}` : currentMin} : ${currentSec < 10 ? `0${currentSec}` : currentSec}`);
    const progress = parseInt((currentTime / duration) * 100);
    setAudioProgress(isNaN(progress) ? 0 : progress);
  };


  return (
    <>
      <div className="container">
        <audio
          ref={currentAudio}
          onEnded={handleNextSong}
          onTimeUpdate={handleAudioUpdate}
        />
        <div className="date-time-display">
          <span>{currentTime.toLocaleDateString()}</span>
          <span>{currentTime.toLocaleTimeString()}</span>
        </div>
        <div className="blackScreen"></div>
        <div className="music-Container">
          <p className='musicPlayer'>Music Player</p>
          <p className='music-Head-Name'>{currentMusicDetails.songName}</p>
          <p className='music-Artist-Name'>{currentMusicDetails.songArtist}</p>
          <img
            src={currentMusicDetails.songAvatar || './Assets/Images/image.png'}
            className={avatarClass[avatarClassIndex]}
            onClick={handleAvatar}
            alt="song Avatar"
            id='songAvatar'
          />
          <div className="musicTimerDiv">
            <p className='musicCurrentTime'>{musicCurrentTime}</p>
            <p className='musicTotalLenght'>{musicTotalLength}</p>
          </div>
          <input
            type="range"
            className='musicProgressBar'
            value={audioProgress}
            onChange={handleMusicProgressBar}
          />
          <div className="musicControlers">
            <i className='fa-solid fa-backward musicControler' onClick={handlePrevSong}></i>
            <i className={`fa-solid ${isAudioPlaying ? 'fa-pause-circle' : 'fa-circle-play'} playBtn`} onClick={handleAudioPlay}></i>
            <i className='fa-solid fa-forward musicControler' onClick={handleNextSong}></i>
          </div>
          <button onClick={handleOverrideClick} className="addmusic-button">
            {isOverrideMode ? 'Resume Scheduled Music' : 'Override Music'}
          </button>
        </div>

        {isModalOpen && (
          <div className="music-modal">
            <div className="music-modal-content">
              <h3>Select Override Music</h3>
              <ul className="music-list">
                {musicAPI.map((song, i) => (
                  <li key={i} className="music-item" onClick={() => handleSelectOverrideSong(song)}>
                    {song.songName} - {song.songArtist}
                  </li>
                ))}
              </ul>
              <button className="addmusic-button" onClick={() => setIsModalOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Playlist;
