import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '../App.css';

const Playlist = () => {
  const [musicAPI, setMusicAPI] = useState([]);
  const [currentMusicDetails, setCurrentMusicDetails] = useState({
    songName: '',
    songArtist: '',
    songSrc: '',
    songAvatar: './Assets/Images/image2.png'
  });
  const [scheduledPlaylist, setScheduledPlaylist] = useState([]);
  const [scheduledSongIndex, setScheduledSongIndex] = useState(0);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [musicIndex, setMusicIndex] = useState(0);
  const [musicTotalLength, setMusicTotalLength] = useState('00 : 00');
  const [musicCurrentTime, setMusicCurrentTime] = useState('00 : 00');
  const [videoIndex, setVideoIndex] = useState(0);
  const [avatarClassIndex, setAvatarClassIndex] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);

  const avatarClass = ['objectFitCover', 'objectFitContain', 'none'];
  const currentAudio = useRef();
  const hasPlayedToday = useRef({});
  const autoplayUnlocked = useRef(false);
  const isScheduledPlaying = useRef(false);
  const hasEndedRef = useRef(false);

  const scheduledLoopStartTime = useRef(null);
  const scheduledLoopEndTime = useRef(null);

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
        if (res.data.length > 0) {
          const firstSong = res.data[0];
          setCurrentMusicDetails(firstSong);
          if (currentAudio.current) {
            currentAudio.current.oncanplay = null;
            currentAudio.current.src = `http://localhost:5000${firstSong.songSrc}`;
            currentAudio.current.load();
          }
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
      }
    }, 5000);
    return () => clearInterval(checkScheduledTimeout);
  }, []);

  const playScheduledSong = (song) => {
    const audioEl = currentAudio.current;
    if (!audioEl || !song) return;

    setCurrentMusicDetails({
      songName: song.songName,
      songArtist: song.songArtist,
      songSrc: song.songSrc,
      songAvatar: song.songAvatar || './Assets/Images/image2.png'
    });

    audioEl.src = `http://localhost:5000${song.songSrc}`;
    audioEl.load();

    const tryPlay = () => {
      audioEl.play().then(() => {
        console.log(`▶️ Playing: ${song.songName}`);
        setIsAudioPlaying(true);
      }).catch((err) => {
        console.warn('Autoplay error:', err.message);
        audioEl.muted = true;
        audioEl.play().then(() => {
          console.log(' Muted autoplay fallback success');
          setIsAudioPlaying(true);
        }).catch((e) => {
          console.error(' Even muted autoplay failed:', e.message);
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
      try {
        const schedulesRes = await axios.get('http://localhost:5000/schedules');
        const schedules = schedulesRes.data;

        const now = new Date();
        const today = now.toISOString().split('T')[0];

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
              playScheduledSong(schedule.playlist[0]);
              isScheduledPlaying.current = true;
              hasPlayedToday.current[schedule.id] = true;
              scheduledLoopStartTime.current = startTime;
              scheduledLoopEndTime.current = endTime;
            }
          }
        });
      } catch (err) {
        console.error('Error checking schedule:', err);
      }
    };

    checkAndPlayScheduledSong();
    const interval = setInterval(checkAndPlayScheduledSong, 30000);
    return () => clearInterval(interval);
  }, [hasEnded]);

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
    updateCurrentMusicDetails(newIndex);
  };

  const handlePrevSong = () => {
    isScheduledPlaying.current = false;
    const newIndex = (musicIndex - 1 + musicAPI.length) % musicAPI.length;
    setMusicIndex(newIndex);
    updateCurrentMusicDetails(newIndex);
  };

  const updateCurrentMusicDetails = (index) => {
    isScheduledPlaying.current = false;
    const music = musicAPI[index];
    if (!music) return;
    setCurrentMusicDetails(music);
    if (currentAudio.current) {
      currentAudio.current.src = `http://localhost:5000${music.songSrc}`;
      currentAudio.current.load();
      currentAudio.current.play().catch(err => {
        console.warn('Play error:', err.message);
      });
    }
    setIsAudioPlaying(true);
  };

  const handleMusicProgressBar = (e) => {
    setAudioProgress(e.target.value);
    currentAudio.current.currentTime = e.target.value * currentAudio.current.duration / 100;
  };

  const handleAvatar = () => {
    setAvatarClassIndex((prev) => (prev + 1) % avatarClass.length);
  };

  const handleAudioPlay = () => {
    if (currentAudio.current.paused) {
      currentAudio.current.play();
      setIsAudioPlaying(true);
    } else {
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

  const vidArray = [
    './Assets/Videos/video1.mp4',
    './Assets/Videos/video2.mp4',
    './Assets/Videos/video3.mp4',
    './Assets/Videos/video4.mp4',
    './Assets/Videos/video5.mp4',
    './Assets/Videos/video6.mp4'
  ];

  const handleChangeBackground = () => {
    setVideoIndex((prev) => (prev + 1) % vidArray.length);
  };

  return (
    <>
      <div className="container">
        <audio
          ref={currentAudio}
          onEnded={handleNextSong}
          onTimeUpdate={handleAudioUpdate}
        />
        <video src={vidArray[videoIndex]} loop muted autoPlay className='backgroundVideo'></video>
        <div className="blackScreen"></div>
        <div className="music-Container">
          <p className='musicPlayer'>Music Player</p>
          <p className='music-Head-Name'>{currentMusicDetails.songName}</p>
          <p className='music-Artist-Name'>{currentMusicDetails.songArtist}</p>
          <img
            src={currentMusicDetails.songAvatar || './Assets/Images/image2.png'}
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
        </div>
      </div>
    </>
  );
};

export default Playlist;
