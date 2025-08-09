import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const Landing = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const checkIncomingSchedule = async () => {
            try {
                const schedulesRes = await axios.get('http://localhost:5000/schedules');
                const schedules = schedulesRes.data;
                const now = new Date();
                const today = now.toISOString().split('T')[0];

                for (const schedule of schedules) {
                    const isWithinDate = schedule.startDate <= today && schedule.endDate >= today;

                    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
                    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

                    const startTime = new Date(now);
                    startTime.setHours(startHour, startMinute, 0, 0);

                    const endTime = new Date(now);
                    endTime.setHours(endHour, endMinute, 0, 0);

                    const isWithinTime = now >= startTime && now <= endTime;

                    if (isWithinDate && isWithinTime) {
                        if (location.pathname === '/') {
                            navigate('/playlist');
                        }
                        break;
                    }
                }
            } catch (err) {
                console.error('Error checking schedule in Landing.jsx:', err);
            }
        };

        checkIncomingSchedule();
        const interval = setInterval(checkIncomingSchedule, 10000);
        return () => clearInterval(interval);
    }, [location.pathname, navigate]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="date-time-center">
            {currentTime.toLocaleDateString()}<br />
            {currentTime.toLocaleTimeString()}
        </div>
    );
};

export default Landing;
