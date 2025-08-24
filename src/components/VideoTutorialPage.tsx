// Video Tutorial Page Component
// Handles rendering of video tutorial pages based on URL paths

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { VideoTutorialRenderer } from './VideoTutorialRenderer';
import { getVideoTutorialById, sampleVideoSeries } from '../data/videoTutorials';
import { VideoTutorial, VideoSeries } from '../types/VideoTypes';

interface VideoTutorialPageProps {
  // Optional props for customization
  autoplay?: boolean;
  startTime?: number;
}

export const VideoTutorialPage: React.FC<VideoTutorialPageProps> = ({
  autoplay = false,
  startTime = 0
}) => {
  const { '*': path } = useParams<{ '*': string }>();
  const [tutorial, setTutorial] = useState<VideoTutorial | null>(null);
  const [series, setSeries] = useState<VideoSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setError('No video tutorial path specified');
      setLoading(false);
      return;
    }

    // Parse the path to determine what to load
    const pathParts = path.split('/');
    
    if (pathParts[0] === 'video-tutorials' && pathParts[1]) {
      // Individual video tutorial
      const tutorialId = pathParts[1];
      const foundTutorial = getVideoTutorialById(tutorialId);
      
      if (foundTutorial) {
        setTutorial(foundTutorial);
        setError(null);
      } else {
        setError(`Video tutorial "${tutorialId}" not found`);
      }
    } else if (pathParts[0] === 'video-series' && pathParts[1]) {
      // Video series
      const seriesId = pathParts[1];
      const foundSeries = sampleVideoSeries.find(s => s.id === seriesId);
      
      if (foundSeries) {
        setSeries(foundSeries);
        // Load the first tutorial in the series
        const firstTutorialId = foundSeries.tutorials[0];
        const firstTutorial = getVideoTutorialById(firstTutorialId);
        if (firstTutorial) {
          setTutorial(firstTutorial);
        }
        setError(null);
      } else {
        setError(`Video series "${seriesId}" not found`);
      }
    } else {
      setError('Invalid video tutorial path');
    }
    
    setLoading(false);
  }, [path]);

  const handleTutorialComplete = (tutorialId: string) => {
    console.log(`Video tutorial completed: ${tutorialId}`);
    
    // If we're in a series, move to the next tutorial
    if (series) {
      const currentIndex = series.tutorials.indexOf(tutorialId);
      if (currentIndex >= 0 && currentIndex < series.tutorials.length - 1) {
        const nextTutorialId = series.tutorials[currentIndex + 1];
        const nextTutorial = getVideoTutorialById(nextTutorialId);
        if (nextTutorial) {
          setTutorial(nextTutorial);
        }
      }
    }
  };

  const loadTutorialFromSeries = (tutorialId: string) => {
    const selectedTutorial = getVideoTutorialById(tutorialId);
    if (selectedTutorial) {
      setTutorial(selectedTutorial);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-300">Loading video tutorial...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-red-500 text-xl mr-3">⚠️</div>
            <div>
              <h2 className="text-red-800 dark:text-red-200 font-semibold text-lg">
                Video Tutorial Not Found
              </h2>
              <p className="text-red-600 dark:text-red-300 mt-1">
                {error}
              </p>
              <div className="mt-4">
                <a 
                  href="#/video-tutorials/overview"
                  className="inline-flex items-center px-4 py-2 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 rounded-md hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                >
                  ← Browse Video Tutorials
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Suggested Tutorials */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Available Video Tutorials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sampleVideoSeries[0]?.tutorials.map(tutorialId => {
              const tutorialData = getVideoTutorialById(tutorialId);
              if (!tutorialData) return null;
              
              return (
                <div key={tutorialId} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {tutorialData.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {tutorialData.description}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>⏱️ {Math.round(tutorialData.duration / 60)} min</span>
                    <span className={`px-2 py-1 rounded ${
                      tutorialData.difficulty === 'beginner' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      tutorialData.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    }`}>
                      {tutorialData.difficulty}
                    </span>
                  </div>
                  <a 
                    href={`#/video-tutorials/${tutorialId}`}
                    className="mt-3 inline-block w-full text-center px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    Watch Tutorial
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (!tutorial) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Tutorial Selected
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Please select a tutorial to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Series Navigation (if applicable) */}
      {series && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {series.title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {series.description}
                </p>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {series.tutorials.indexOf(tutorial.id) + 1} of {series.tutorials.length}
              </div>
            </div>
            
            {/* Series Progress */}
            <div className="mt-3">
              <div className="flex space-x-2">
                {series.tutorials.map((tutorialId, index) => {
                  const isCurrent = tutorialId === tutorial.id;
                  const tutorialData = getVideoTutorialById(tutorialId);
                  
                  return (
                    <button
                      key={tutorialId}
                      onClick={() => loadTutorialFromSeries(tutorialId)}
                      className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                        isCurrent 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                      title={tutorialData?.title}
                    >
                      {index + 1}. {tutorialData?.title.substring(0, 20)}...
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Content */}
      <VideoTutorialRenderer
        tutorial={tutorial}
        onComplete={handleTutorialComplete}
        autoplay={autoplay}
      />
    </div>
  );
};
