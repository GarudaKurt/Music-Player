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

  const [audioProgress, setAudioProgress] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [musicIndex, setMusicIndex] = useState(0);
  const [musicTotalLength, setMusicTotalLength] = useState('00 : 00');
  const [musicCurrentTime, setMusicCurrentTime] = useState('00 : 00');
  const [videoIndex, setVideoIndex] = useState(0);
  const [avatarClassIndex, setAvatarClassIndex] = useState(0);

  const avatarClass = ['objectFitCover', 'objectFitContain', 'none'];
  const currentAudio = useRef();
  const hasPlayedToday = useRef({});
  const autoplayUnlocked = useRef(false);
  const isScheduledPlaying = useRef(false);

  const scheduledLoopStartTime = useRef(null);
  const scheduledLoopEndTime = useRef(null);

  // 🔓 Unlock autoplay via user interaction
  useEffect(() => {
    const unlockAutoplay = () => {
      if (currentAudio.current) {
        currentAudio.current.muted = true;
        currentAudio.current.play().then(() => {
          currentAudio.current.pause();
          currentAudio.current.muted = false;
          autoplayUnlocked.current = true;
          console.log('✅ Autoplay unlocked');
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
    const checkScheduledTimeout = setInterval(() => {
      const now = new Date();

      if (
        isScheduledPlaying.current &&
        scheduledLoopEndTime.current &&
        now >= scheduledLoopEndTime.current
      ) {
        console.log('🛑 15-minute scheduled duration ended, stopping playback');

        if (currentAudio.current) {
          currentAudio.current.pause();
          currentAudio.current.currentTime = 0;
        }

        isScheduledPlaying.current = false;
        scheduledLoopStartTime.current = null;
        scheduledLoopEndTime.current = null;
        setIsAudioPlaying(false);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkScheduledTimeout);
  }, []);


  useEffect(() => {
    axios.get('http://localhost:5000/songs-list')
      .then(res => {
        setMusicAPI(res.data);
        if (res.data.length > 0) {
          const firstSong = res.data[0];
          setCurrentMusicDetails(firstSong);
          if (currentAudio.current) {
            currentAudio.current.oncanplay = null; // 🚫 Clear any existing autoplay logic
            currentAudio.current.src = `http://localhost:5000${firstSong.songSrc}`;
            currentAudio.current.load(); // ✅ Prepares it but does NOT autoplay
          }
        }
      })
      .catch(err => console.error('Failed to fetch songs:', err));
  }, []);


  useEffect(() => {
    const checkAndPlayScheduledSong = async () => {
      try {
        const schedulesRes = await axios.get('http://localhost:5000/schedules');
        const schedules = schedulesRes.data;

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const hour = now.getHours().toString().padStart(2, '0');
        const minute = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${hour}:${minute}`;

        schedules.forEach((schedule) => {
          const isWithinDate = schedule.startDate <= today && schedule.endDate >= today;
          const isTimeReached = currentTime >= schedule.time;
          const alreadyPlayed = hasPlayedToday.current[schedule.id];

          if (isWithinDate && isTimeReached && !alreadyPlayed) {
            console.log(`🎯 Playing scheduled music: ${schedule.scheduleName}`);
            hasPlayedToday.current[schedule.id] = true;
            isScheduledPlaying.current = true;

            const src = new URL(schedule.musicSrc, 'http://localhost:5000').toString();
            console.log('🎵 Audio source set to:', src);

            setCurrentMusicDetails({
              songName: schedule.songName || schedule.scheduleName,
              songArtist: schedule.songArtist || 'Scheduled',
              songSrc: schedule.musicSrc,
              songAvatar: './Assets/Images/image2.png'
            });

            if (currentAudio.current) {
              const audioEl = currentAudio.current;
              console.log('🔍 currentAudio readyState:', audioEl.readyState);

              // Ensure event is bound before load
              audioEl.oncanplay = () => {
                console.log('🎧 oncanplay triggered');
                const tryPlay = () => {
                  audioEl.play().then(() => {
                    console.log('✅ Scheduled audio playing');
                    setIsAudioPlaying(true);
                    scheduledLoopStartTime.current = new Date();
                    scheduledLoopEndTime.current = new Date(
                      scheduledLoopStartTime.current.getTime() + 15 * 60000
                    );
                  }).catch((err) => {
                    console.warn('❌ Autoplay blocked:', err.message);

                    // 🔇 Fallback: muted autoplay
                    audioEl.muted = true;
                    audioEl.play().then(() => {
                      console.log('🔇 Muted autoplay fallback success');
                      setIsAudioPlaying(true);
                      scheduledLoopStartTime.current = new Date();
                      scheduledLoopEndTime.current = new Date(
                        scheduledLoopStartTime.current.getTime() + 15 * 60000
                      );
                    }).catch((e) => {
                      console.error('🚫 Even muted autoplay failed:', e.message);
                    });
                  });
                };

                // Fallback timeout in case browser skips oncanplay
                setTimeout(() => {
                  if (audioEl.paused) tryPlay();
                }, 500);

                tryPlay();
              };

              audioEl.src = src;
              audioEl.load(); // Triggers oncanplay
              console.log('📦 Audio load triggered');
            } else {
              console.warn('⚠️ currentAudio ref is null');
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
  }, []);

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

  const handleNextSong = () => {
    if (isScheduledPlaying.current) {
      const now = new Date();
      if (scheduledLoopEndTime.current && now < scheduledLoopEndTime.current) {
        console.log('🔁 Replaying scheduled song');
        currentAudio.current.currentTime = 0;
        currentAudio.current.play().catch(err => {
          console.warn('Loop playback error:', err.message);
        });
        return;
      } else {
        console.log('⏹ Scheduled loop complete');
        isScheduledPlaying.current = false;
        scheduledLoopStartTime.current = null;
        scheduledLoopEndTime.current = null;
        setIsAudioPlaying(false);
        return;
      }
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
