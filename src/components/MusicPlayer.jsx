import { useRef, useState } from 'react'
import './MusicPlayer.css'

function MusicPlayer() {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)

    const toggleMusic = async () => {
        const audio = audioRef.current
        if (!audio) return

        if (audio.paused) {
            try {
                await audio.play()
                setIsPlaying(true)
            } catch (error) {
                console.error('Music playback failed:', error)
                setIsPlaying(false)
            }
        } else {
            audio.pause()
            setIsPlaying(false)
        }
    }

    return (
        <>
            <audio
                ref={audioRef}
                src="/music/pixel-vibes.mp3"
                loop
                preload="none"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            <button
                className={`music-button ${isPlaying ? 'playing' : ''}`}
                onClick={toggleMusic}
                aria-label={isPlaying ? 'Pause music' : 'Play music'}
                title={isPlaying ? 'Pause music' : 'Play music'}
            >
                {isPlaying ? '♫' : '♪'}
            </button>
        </>
    )
}

export default MusicPlayer