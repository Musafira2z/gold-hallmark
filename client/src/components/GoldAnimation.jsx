import React, { useEffect, useState } from 'react';

const GoldAnimation = () => {
    const [particles, setParticles] = useState([]);
    const [isAnimating, setIsAnimating] = useState(true);

    useEffect(() => {
        // Create multiple gold particles
        const newParticles = Array.from({ length: 40 }, (_, i) => ({
            id: i,
            left: Math.random() * 100, // Random horizontal position
            delay: Math.random() * 0.5, // Random delay (faster)
            duration: 0.8 + Math.random() * 0.7, // Faster duration between 0.8-1.5s
            size: 10 + Math.random() * 15, // Random size between 10-25px
            rotation: Math.random() * 360, // Random rotation
            direction: Math.random() > 0.5 ? 'right' : 'left', // Left or right direction
            horizontalDistance: 150 + Math.random() * 200, // How far left/right to go
        }));
        setParticles(newParticles);

        // Stop animation after 2 seconds (faster)
        const timer = setTimeout(() => {
            setIsAnimating(false);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    if (!isAnimating && particles.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute bottom-0"
                    style={{
                        left: `${particle.left}%`,
                        animation: `goldJump${particle.direction === 'right' ? 'Right' : 'Left'} ${particle.duration}s ease-out ${particle.delay}s forwards`,
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                    }}
                >
                    <img
                        src="/gold.avif"
                        alt="Gold"
                        className="w-full h-full object-contain"
                        style={{
                            transform: `rotate(${particle.rotation}deg)`,
                            filter: `drop-shadow(0 0 ${particle.size * 0.2}px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 ${particle.size * 0.4}px rgba(255, 165, 0, 0.6))`,
                        }}
                    />
                </div>
            ))}
            <style>{`
                @keyframes goldJumpRight {
                    0% {
                        transform: translate(0, 0) scale(0) rotate(0deg);
                        opacity: 0;
                    }
                    5% {
                        opacity: 1;
                        transform: translate(0, -20px) scale(1) rotate(45deg);
                    }
                    50% {
                        transform: translate(150px, -300px) scale(1.1) rotate(180deg);
                    }
                    100% {
                        transform: translate(300px, -600px) scale(0.3) rotate(360deg);
                        opacity: 0;
                    }
                }
                
                @keyframes goldJumpLeft {
                    0% {
                        transform: translate(0, 0) scale(0) rotate(0deg);
                        opacity: 0;
                    }
                    5% {
                        opacity: 1;
                        transform: translate(0, -20px) scale(1) rotate(-45deg);
                    }
                    50% {
                        transform: translate(-150px, -300px) scale(1.1) rotate(-180deg);
                    }
                    100% {
                        transform: translate(-300px, -600px) scale(0.3) rotate(-360deg);
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default GoldAnimation;

