// Video Tutorial Content Index
// Integration of video tutorials with the content navigation system

import { sampleVideoTutorials, sampleVideoSeries } from '../data/videoTutorials';
import { getVideoTutorialById } from '../data/videoTutorials';

// Video tutorial navigation structure
export const videoTutorialContent = {
  id: 'video-tutorials',
  title: 'Video Tutorials',
  description: 'Interactive video-based learning experiences for Chromium development',
  icon: '🎬',
  children: [
    {
      id: 'getting-started-videos',
      title: 'Getting Started',
      description: 'Video tutorials for beginners',
      icon: '🎯',
      children: [
        {
          id: 'chromium-build-system',
          title: 'Setting Up Chromium Build Environment',
          path: '/video-tutorials/chromium-build-system',
          type: 'video-tutorial' as const,
          difficulty: 'beginner',
          duration: 2400,
          description: 'Complete setup guide with hands-on instructions'
        }
      ]
    },
    {
      id: 'architecture-videos',
      title: 'Architecture Deep Dives',
      description: 'Advanced architectural concepts with visual explanations',
      icon: '🏗️',
      children: [
        {
          id: 'chromium-architecture-overview',
          title: 'Chromium Architecture Deep Dive',
          path: '/video-tutorials/chromium-architecture-overview',
          type: 'video-tutorial' as const,
          difficulty: 'intermediate',
          duration: 1800,
          description: 'Multi-process architecture explained with examples'
        }
      ]
    },
    {
      id: 'development-tools-videos',
      title: 'Development Tools',
      description: 'Debugging, profiling, and development workflows',
      icon: '🛠️',
      children: [
        {
          id: 'debugging-chromium',
          title: 'Debugging Chromium: Tools and Techniques',
          path: '/video-tutorials/debugging-chromium',
          type: 'video-tutorial' as const,
          difficulty: 'advanced',
          duration: 2700,
          description: 'Comprehensive debugging guide with practical examples'
        }
      ]
    },
    {
      id: 'video-series',
      title: 'Learning Series',
      description: 'Structured learning paths with multiple videos',
      icon: '📚',
      children: [
        {
          id: 'chromium-fundamentals',
          title: 'Chromium Development Fundamentals',
          path: '/video-series/chromium-fundamentals',
          type: 'video-series' as const,
          difficulty: 'beginner',
          duration: 6900,
          description: 'Complete series from setup to advanced techniques'
        }
      ]
    }
  ]
};

// Helper functions for video tutorial routing
export const getVideoTutorialRoute = (tutorialId: string) => {
  return `/video-tutorials/${tutorialId}`;
};

export const getVideoSeriesRoute = (seriesId: string) => {
  return `/video-series/${seriesId}`;
};

// Integration with existing content index
export const integrateVideoTutorials = (existingContent: any[]) => {
  // Find the position to insert video tutorials (after interactive tutorials if they exist)
  const tutorialIndex = existingContent.findIndex(item => 
    item.id === 'interactive-tutorials' || item.title?.includes('Tutorial')
  );
  
  if (tutorialIndex >= 0) {
    // Insert after existing tutorials
    return [
      ...existingContent.slice(0, tutorialIndex + 1),
      videoTutorialContent,
      ...existingContent.slice(tutorialIndex + 1)
    ];
  } else {
    // Add at the end if no tutorials section found
    return [...existingContent, videoTutorialContent];
  }
};

// Content discovery helpers
export const getVideoTutorialsByCategory = (category: string) => {
  return sampleVideoTutorials.filter(tutorial => 
    tutorial.category.toLowerCase() === category.toLowerCase()
  );
};

export const getVideoTutorialsByDifficulty = (difficulty: string) => {
  return sampleVideoTutorials.filter(tutorial => 
    tutorial.difficulty === difficulty
  );
};

export const searchVideoTutorials = (query: string) => {
  const lowerQuery = query.toLowerCase();
  return sampleVideoTutorials.filter(tutorial =>
    tutorial.title.toLowerCase().includes(lowerQuery) ||
    tutorial.description.toLowerCase().includes(lowerQuery) ||
    tutorial.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    tutorial.chapters.some(chapter => 
      chapter.title.toLowerCase().includes(lowerQuery) ||
      chapter.description?.toLowerCase().includes(lowerQuery)
    )
  );
};

// Tutorial progress aggregation
export const getVideoTutorialProgress = async () => {
  // This would integrate with VideoProgressManager
  // For now, return placeholder data
  return {
    totalTutorials: sampleVideoTutorials.length,
    completedTutorials: 0,
    totalWatchTime: 0,
    currentStreak: 0
  };
};

// Recommendation engine
export const getRecommendedVideoTutorials = (userLevel: 'beginner' | 'intermediate' | 'advanced') => {
  return sampleVideoTutorials
    .filter(tutorial => tutorial.difficulty === userLevel)
    .slice(0, 3); // Return top 3 recommendations
};

// Video tutorial metadata for SEO and sharing
export const getVideoTutorialMetadata = (tutorialId: string) => {
  const tutorial = getVideoTutorialById(tutorialId);
  if (!tutorial) return null;

  return {
    title: tutorial.title,
    description: tutorial.description,
    duration: tutorial.duration,
    difficulty: tutorial.difficulty,
    category: tutorial.category,
    tags: tutorial.tags,
    author: tutorial.author,
    thumbnailUrl: tutorial.thumbnailUrl,
    learningObjectives: tutorial.learningObjectives,
    prerequisites: tutorial.prerequisites
  };
};
