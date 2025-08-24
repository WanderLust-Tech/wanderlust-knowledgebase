// Video Tutorial Renderer
// Main component for rendering video tutorials with integrated learning features

import React, { useState, useEffect } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { VideoTutorial, VideoChapter, VideoProgress, VideoCodeExample } from '../types/VideoTypes';
import { VideoProgressManager } from '../services/VideoProgressManager';

interface VideoTutorialRendererProps {
  tutorial: VideoTutorial;
  onComplete?: (tutorialId: string) => void;
  autoplay?: boolean;
}

export const VideoTutorialRenderer: React.FC<VideoTutorialRendererProps> = ({
  tutorial,
  onComplete,
  autoplay = false
}) => {
  const [progress, setProgress] = useState<VideoProgress | null>(null);
  const [currentChapter, setCurrentChapter] = useState<VideoChapter | null>(null);
  const [showCodePanel, setShowCodePanel] = useState(true);
  const [selectedCodeExample, setSelectedCodeExample] = useState<VideoCodeExample | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'chapters' | 'code' | 'progress'>('overview');

  useEffect(() => {
    const loadProgress = async () => {
      const savedProgress = await VideoProgressManager.getProgress(tutorial.id);
      setProgress(savedProgress);
    };
    
    loadProgress();
  }, [tutorial.id]);

  useEffect(() => {
    // Select relevant code example when chapter changes
    if (currentChapter) {
      const relevantCode = tutorial.codeExamples.find(code => 
        code.chapterIds.includes(currentChapter.id)
      );
      if (relevantCode) {
        setSelectedCodeExample(relevantCode);
      }
    }
  }, [currentChapter, tutorial.codeExamples]);

  const handleProgressUpdate = (updatedProgress: VideoProgress) => {
    setProgress(updatedProgress);
    if (updatedProgress.completed && onComplete) {
      onComplete(tutorial.id);
    }
  };

  const handleChapterChange = (chapter: VideoChapter) => {
    setCurrentChapter(chapter);
  };

  const copyCodeToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    // You could add a toast notification here
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
    return `${minutes}m ${remainingSeconds}s`;
  };

  const completionPercentage = progress && tutorial.chapters.length > 0
    ? (progress.completedChapters.length / tutorial.chapters.length) * 100
    : 0;

  return (
    <div className="video-tutorial-container max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {tutorial.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {tutorial.description}
            </p>
            
            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center">
                ⏱️ {formatDuration(tutorial.duration)}
              </span>
              <span className="flex items-center">
                📊 {tutorial.difficulty}
              </span>
              <span className="flex items-center">
                📂 {tutorial.category}
              </span>
              <span className="flex items-center">
                👤 {tutorial.author}
              </span>
            </div>
          </div>
          
          {progress && (
            <div className="text-right">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Progress: {Math.round(completionPercentage)}%
              </div>
              <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Learning Objectives */}
        {tutorial.learningObjectives.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              What you'll learn:
            </h3>
            <ul className="list-disc list-inside text-blue-800 dark:text-blue-300 space-y-1">
              {tutorial.learningObjectives.map((objective, index) => (
                <li key={index}>{objective}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Prerequisites */}
        {tutorial.prerequisites.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-4">
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
              Prerequisites:
            </h3>
            <ul className="list-disc list-inside text-yellow-800 dark:text-yellow-300 space-y-1">
              {tutorial.prerequisites.map((prereq, index) => (
                <li key={index}>{prereq}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video Player - Takes up 2 columns on large screens */}
        <div className="lg:col-span-2">
          <VideoPlayer
            tutorial={tutorial}
            onProgressUpdate={handleProgressUpdate}
            onChapterChange={handleChapterChange}
            autoplay={autoplay}
          />
        </div>

        {/* Sidebar - Content tabs */}
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-4">
              {[
                { id: 'overview', label: 'Overview', icon: '📋' },
                { id: 'chapters', label: 'Chapters', icon: '📑' },
                { id: 'code', label: 'Code', icon: '💻' },
                { id: 'progress', label: 'Progress', icon: '📊' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            {activeTab === 'overview' && (
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  Tutorial Overview
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Duration:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {formatDuration(tutorial.duration)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Chapters:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {tutorial.chapters.length}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Code Examples:</span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {tutorial.codeExamples.length}
                    </span>
                  </div>
                  {progress && (
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Watch Time:</span>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">
                        {formatDuration(progress.watchTime)}
                      </span>
                    </div>
                  )}
                </div>
                
                {tutorial.tags.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Tags:</h4>
                    <div className="flex flex-wrap gap-2">
                      {tutorial.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chapters' && (
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  Chapters
                </h3>
                <div className="space-y-2">
                  {tutorial.chapters.map((chapter, index) => {
                    const isCompleted = progress?.completedChapters.includes(chapter.id);
                    const isCurrent = currentChapter?.id === chapter.id;
                    
                    return (
                      <div
                        key={chapter.id}
                        className={`p-3 rounded border transition-colors ${
                          isCurrent 
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {index + 1}. {chapter.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {chapter.description}
                            </p>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                              {formatDuration(chapter.startTime)} - {formatDuration(chapter.endTime)}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            {isCompleted && (
                              <span className="text-green-500 text-sm">✓</span>
                            )}
                            {isCurrent && (
                              <span className="text-blue-500 text-sm">▶</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'code' && (
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  Code Examples
                </h3>
                {tutorial.codeExamples.length > 0 ? (
                  <div className="space-y-3">
                    {tutorial.codeExamples.map(example => (
                      <div
                        key={example.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          selectedCodeExample?.id === example.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => setSelectedCodeExample(example)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {example.title}
                          </h4>
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
                            {example.language}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {example.description}
                        </p>
                        {selectedCodeExample?.id === example.id && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {example.filename || 'Code Example'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyCodeToClipboard(example.code);
                                }}
                                className="text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 px-2 py-1 rounded"
                              >
                                Copy
                              </button>
                            </div>
                            <pre className="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
                              <code>{example.code}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No code examples available for this tutorial.
                  </p>
                )}
              </div>
            )}

            {activeTab === 'progress' && (
              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  Your Progress
                </h3>
                {progress ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-gray-300">Completion</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {Math.round(completionPercentage)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                        <div 
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${completionPercentage}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="block text-gray-700 dark:text-gray-300 font-medium">
                          Watch Time
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {formatDuration(progress.watchTime)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-gray-700 dark:text-gray-300 font-medium">
                          Chapters
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {progress.completedChapters.length}/{tutorial.chapters.length}
                        </span>
                      </div>
                      <div>
                        <span className="block text-gray-700 dark:text-gray-300 font-medium">
                          Notes
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {progress.notes.length}
                        </span>
                      </div>
                      <div>
                        <span className="block text-gray-700 dark:text-gray-300 font-medium">
                          Last Watched
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {new Date(progress.lastWatched).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {progress.completed && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <span className="text-green-500 text-lg">🎉</span>
                          <span className="text-green-700 dark:text-green-300 font-medium">
                            Tutorial Completed!
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No progress data available. Start watching to track your progress!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Content */}
      {(tutorial.relatedTutorials.length > 0 || tutorial.relatedArticles.length > 0) && (
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Related Content
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tutorial.relatedTutorials.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Related Tutorials
                </h3>
                <ul className="space-y-1">
                  {tutorial.relatedTutorials.map(tutorialId => (
                    <li key={tutorialId}>
                      <a 
                        href={`#/tutorials/${tutorialId}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        Tutorial: {tutorialId}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {tutorial.relatedArticles.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Related Articles
                </h3>
                <ul className="space-y-1">
                  {tutorial.relatedArticles.map(articlePath => (
                    <li key={articlePath}>
                      <a 
                        href={`#/${articlePath}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                      >
                        {articlePath.split('/').pop()?.replace('.md', '').replace(/-/g, ' ')}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
