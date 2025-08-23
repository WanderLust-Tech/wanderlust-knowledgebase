import React, { useState, useRef, useEffect } from 'react';
import { ArticleComponent, VideoContent } from '../../types/ComponentTypes';

interface VideoRendererProps {
  component: ArticleComponent;
  onInteraction?: (interaction: string, data?: any) => void;
}

const VideoRenderer: React.FC<VideoRendererProps> = ({ 
  component, 
  onInteraction 
}) => {
  const content = component.content as VideoContent;
  const { metadata } = component;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [activeCaptionIndex, setActiveCaptionIndex] = useState(-1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Update active caption
      if (content.captions) {
        const activeIndex = content.captions.findIndex((caption, index) => {
          const nextCaption = content.captions![index + 1];
          return caption.time <= video.currentTime && 
                 (!nextCaption || video.currentTime < nextCaption.time);
        });
        setActiveCaptionIndex(activeIndex);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onInteraction?.('video_play', { currentTime: video.currentTime, videoUrl: content.url });
    };

    const handlePause = () => {
      setIsPlaying(false);
      onInteraction?.('video_pause', { currentTime: video.currentTime, videoUrl: content.url });
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onInteraction?.('video_ended', { videoUrl: content.url });
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [content.url, content.captions, onInteraction]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      onInteraction?.('video_seek', { seekTime: time, videoUrl: content.url });
    }
  };

  const handleCaptionClick = (caption: { time: number; text: string }) => {
    handleSeek(caption.time);
  };

  return (
    <div className="video-content">
      {/* Header */}
      {(metadata.title || content.title) && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {metadata.title || content.title}
          </h2>
          {metadata.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {metadata.description}
            </p>
          )}
        </div>
      )}

      {/* Video container */}
      <div className="bg-black rounded-lg overflow-hidden relative">
        {content.thumbnailUrl && !isPlaying && currentTime === 0 && (
          <div className="absolute inset-0 z-10 bg-black bg-opacity-50 flex items-center justify-center">
            <button
              onClick={() => videoRef.current?.play()}
              className="bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-4 transition-all"
            >
              <svg className="w-8 h-8 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          src={content.url}
          poster={content.thumbnailUrl}
          controls
          className="w-full h-auto"
          style={{ maxHeight: '500px' }}
        >
          Your browser does not support the video tag.
        </video>

        {/* Video progress bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <div className="flex items-center space-x-2 text-white text-sm">
            <span>{formatTime(currentTime)}</span>
            <div className="flex-1 bg-gray-600 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span>{formatTime(content.duration || duration)}</span>
          </div>
        </div>
      </div>

      {/* Video controls */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => isPlaying ? videoRef.current?.pause() : videoRef.current?.play()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          
          {content.transcript && (
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
            >
              {showTranscript ? 'Hide' : 'Show'} Transcript
            </button>
          )}
        </div>

        {/* Video metadata */}
        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
          {content.duration && (
            <span>📺 {formatTime(content.duration)}</span>
          )}
          {metadata.difficulty && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              metadata.difficulty === 'beginner' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              metadata.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {metadata.difficulty}
            </span>
          )}
        </div>
      </div>

      {/* Captions/Transcript */}
      {showTranscript && (content.transcript || content.captions) && (
        <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            {content.captions ? 'Interactive Captions' : 'Transcript'}
          </h3>
          
          {content.captions ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {content.captions.map((caption, index) => (
                <div
                  key={index}
                  className={`p-2 rounded cursor-pointer transition-colors ${
                    index === activeCaptionIndex
                      ? 'bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => handleCaptionClick(caption)}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 min-w-[50px]">
                      {formatTime(caption.time)}
                    </span>
                    <span className={`text-sm ${
                      index === activeCaptionIndex 
                        ? 'text-blue-900 dark:text-blue-100 font-medium' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {caption.text}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="prose dark:prose-invert max-w-none text-sm">
              <pre className="whitespace-pre-wrap">{content.transcript}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoRenderer;
