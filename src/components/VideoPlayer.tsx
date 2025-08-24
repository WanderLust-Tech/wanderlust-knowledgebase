// Video Player Component
// Advanced video player with learning features

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoTutorial, VideoChapter, VideoProgress, VideoPlaybackState, VideoNote } from '../types/VideoTypes';
import { VideoProgressManager } from '../services/VideoProgressManager';

interface VideoPlayerProps {
  tutorial: VideoTutorial;
  onProgressUpdate?: (progress: VideoProgress) => void;
  onChapterChange?: (chapter: VideoChapter) => void;
  autoplay?: boolean;
  startTime?: number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  tutorial,
  onProgressUpdate,
  onChapterChange,
  autoplay = false,
  startTime = 0
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressIntervalRef = useRef<number>();
  
  const [playbackState, setPlaybackState] = useState<VideoPlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    playbackRate: 1,
    isFullscreen: false,
    showControls: true,
    bufferedRanges: {} as TimeRanges
  });

  const [currentChapter, setCurrentChapter] = useState<VideoChapter | null>(null);
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [totalWatchTime, setTotalWatchTime] = useState(0);

  // Initialize progress and video
  useEffect(() => {
    const initializeVideo = async () => {
      const savedProgress = await VideoProgressManager.getProgress(tutorial.id);
      setProgress(savedProgress);
      
      if (videoRef.current) {
        videoRef.current.currentTime = startTime || savedProgress?.currentTime || 0;
        setTotalWatchTime(savedProgress?.watchTime || 0);
      }
    };

    initializeVideo();
  }, [tutorial.id, startTime]);

  // Track watch time
  useEffect(() => {
    if (playbackState.isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        setTotalWatchTime(prev => prev + 1);
      }, 1000);
    } else {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [playbackState.isPlaying]);

  // Update current chapter based on time
  useEffect(() => {
    const chapter = tutorial.chapters.find(ch => 
      playbackState.currentTime >= ch.startTime && 
      playbackState.currentTime < ch.endTime
    );
    
    if (chapter && chapter.id !== currentChapter?.id) {
      setCurrentChapter(chapter);
      onChapterChange?.(chapter);
    }
  }, [playbackState.currentTime, tutorial.chapters, currentChapter, onChapterChange]);

  // Video event handlers
  const handleTimeUpdate = useCallback(async () => {
    if (!videoRef.current) return;

    const currentTime = videoRef.current.currentTime;
    setPlaybackState(prev => ({ ...prev, currentTime }));

    // Save progress every 10 seconds
    if (Math.floor(currentTime) % 10 === 0) {
      await VideoProgressManager.updateWatchTime(tutorial.id, currentTime, totalWatchTime);
    }
  }, [tutorial.id, totalWatchTime]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    
    setPlaybackState(prev => ({
      ...prev,
      duration: videoRef.current!.duration
    }));
  };

  const handlePlay = () => {
    setPlaybackState(prev => ({ ...prev, isPlaying: true }));
  };

  const handlePause = async () => {
    setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    
    // Save progress when pausing
    if (videoRef.current) {
      await VideoProgressManager.updateWatchTime(
        tutorial.id, 
        videoRef.current.currentTime, 
        totalWatchTime
      );
    }
  };

  const handleEnded = async () => {
    setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    
    // Mark tutorial as completed
    await VideoProgressManager.markTutorialComplete(tutorial.id);
    
    const updatedProgress = await VideoProgressManager.getProgress(tutorial.id);
    setProgress(updatedProgress);
    onProgressUpdate?.(updatedProgress!);
  };

  // Control functions
  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const skipToChapter = async (chapter: VideoChapter) => {
    const time = await VideoProgressManager.skipToChapter(tutorial.id, chapter.id, tutorial.chapters);
    seekTo(time);
    await VideoProgressManager.markChapterComplete(tutorial.id, chapter.id);
  };

  const changePlaybackRate = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackState(prev => ({ ...prev, playbackRate: rate }));
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.requestFullscreen();
      setPlaybackState(prev => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setPlaybackState(prev => ({ ...prev, isFullscreen: false }));
    }
  };

  // Notes functionality
  const addNote = async () => {
    if (!newNote.trim()) return;

    await VideoProgressManager.addNote(tutorial.id, {
      timestamp: playbackState.currentTime,
      content: newNote,
      isPrivate: true
    });

    setNewNote('');
    
    // Refresh progress to show new note
    const updatedProgress = await VideoProgressManager.getProgress(tutorial.id);
    setProgress(updatedProgress);
  };

  const deleteNote = async (noteId: string) => {
    await VideoProgressManager.deleteNote(tutorial.id, noteId);
    
    const updatedProgress = await VideoProgressManager.getProgress(tutorial.id);
    setProgress(updatedProgress);
  };

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = playbackState.duration > 0 
    ? (playbackState.currentTime / playbackState.duration) * 100 
    : 0;

  return (
    <div className="video-player-container bg-gray-900 rounded-lg overflow-hidden">
      {/* Video Element */}
      <div className="relative">
        <video
          ref={videoRef}
          src={tutorial.videoUrl}
          autoPlay={autoplay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          className="w-full aspect-video bg-black"
          controls={false} // We'll use custom controls
        />
        
        {/* Custom Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="relative h-2 bg-gray-600 rounded-full cursor-pointer">
              <div 
                className="absolute h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
              
              {/* Chapter Markers */}
              {tutorial.chapters.map(chapter => {
                const markerPosition = (chapter.startTime / playbackState.duration) * 100;
                return (
                  <div
                    key={chapter.id}
                    className="absolute top-0 w-1 h-full bg-yellow-400 cursor-pointer"
                    style={{ left: `${markerPosition}%` }}
                    onClick={() => skipToChapter(chapter)}
                    title={chapter.title}
                  />
                );
              })}
              
              {/* Note Markers */}
              {progress?.notes.map(note => {
                const notePosition = (note.timestamp / playbackState.duration) * 100;
                return (
                  <div
                    key={note.id}
                    className="absolute top-0 w-1 h-full bg-green-400 cursor-pointer"
                    style={{ left: `${notePosition}%` }}
                    onClick={() => seekTo(note.timestamp)}
                    title={note.content.substring(0, 50)}
                  />
                );
              })}
            </div>
          </div>
          
          {/* Control Buttons */}
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                className="p-2 hover:bg-white/20 rounded"
              >
                {playbackState.isPlaying ? '⏸️' : '▶️'}
              </button>
              
              <span className="text-sm">
                {formatTime(playbackState.currentTime)} / {formatTime(playbackState.duration)}
              </span>
              
              {/* Playback Speed */}
              <select
                value={playbackState.playbackRate}
                onChange={(e) => changePlaybackRate(Number(e.target.value))}
                className="bg-black/50 text-white rounded px-2 py-1 text-sm"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="p-2 hover:bg-white/20 rounded text-sm"
              >
                📝 Notes
              </button>
              
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="p-2 hover:bg-white/20 rounded text-sm"
              >
                📄 Transcript
              </button>
              
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-white/20 rounded"
              >
                ⛶
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chapter Information */}
      {currentChapter && (
        <div className="bg-blue-900/50 p-4 border-l-4 border-blue-400">
          <h3 className="text-white font-semibold">{currentChapter.title}</h3>
          <p className="text-gray-300 text-sm mt-1">{currentChapter.description}</p>
          {currentChapter.keyPoints.length > 0 && (
            <div className="mt-2">
              <p className="text-gray-300 text-sm font-medium">Key Points:</p>
              <ul className="text-gray-300 text-sm mt-1 list-disc list-inside">
                {currentChapter.keyPoints.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Notes Panel */}
      {showNotes && (
        <div className="bg-gray-800 p-4 border-t border-gray-700">
          <h3 className="text-white font-semibold mb-3">Notes</h3>
          
          {/* Add Note */}
          <div className="mb-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note at current time..."
                className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-400"
                onKeyPress={(e) => e.key === 'Enter' && addNote()}
              />
              <button
                onClick={addNote}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
          
          {/* Notes List */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {progress?.notes.map(note => (
              <div key={note.id} className="flex items-start justify-between bg-gray-700 p-3 rounded">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <button
                      onClick={() => seekTo(note.timestamp)}
                      className="text-blue-400 hover:text-blue-300 text-sm font-mono"
                    >
                      {formatTime(note.timestamp)}
                    </button>
                  </div>
                  <p className="text-gray-300 text-sm">{note.content}</p>
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-red-400 hover:text-red-300 ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Transcript Panel */}
      {showTranscript && tutorial.transcript && (
        <div className="bg-gray-800 p-4 border-t border-gray-700">
          <h3 className="text-white font-semibold mb-3">Transcript</h3>
          <div className="text-gray-300 text-sm whitespace-pre-wrap max-h-40 overflow-y-auto">
            {tutorial.transcript}
          </div>
        </div>
      )}
    </div>
  );
};
