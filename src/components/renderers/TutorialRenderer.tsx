import React, { useState, useEffect, useCallback } from 'react';
import { InteractiveTutorial, TutorialStep, TutorialProgress, TutorialState } from '../../types/TutorialTypes';
import { TutorialValidator } from '../../services/TutorialValidator';
import { TutorialProgressManager } from '../../services/TutorialProgressManager';

interface TutorialRendererProps {
  tutorial: InteractiveTutorial;
  onComplete?: (tutorialId: string) => void;
}

const TutorialRenderer: React.FC<TutorialRendererProps> = ({ tutorial, onComplete }) => {
  const [progress, setProgress] = useState<TutorialProgress | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tutorialState, setTutorialState] = useState<TutorialState>({
    currentCode: '',
    output: '',
    isRunning: false,
    hasError: false,
    showHints: false,
    hintsUsed: 0,
    stepStartTime: new Date()
  });

  const currentStep = tutorial.steps[currentStepIndex];

  // Load progress on mount
  useEffect(() => {
    const savedProgress = TutorialProgressManager.getTutorialProgress(tutorial.id);
    if (savedProgress) {
      setProgress(savedProgress);
      setCurrentStepIndex(savedProgress.currentStep);
    } else {
      // Initialize new tutorial
      const newProgress = TutorialProgressManager.updateTutorialProgress(tutorial.id, {
        currentStep: 0
      });
      setProgress(newProgress);
    }
  }, [tutorial.id]);

  // Initialize step code when step changes
  useEffect(() => {
    if (currentStep) {
      setTutorialState(prev => ({
        ...prev,
        currentCode: currentStep.code || '',
        output: '',
        hasError: false,
        showHints: false,
        hintsUsed: 0,
        stepStartTime: new Date()
      }));
    }
  }, [currentStep]);

  const handleCodeChange = useCallback((newCode: string) => {
    setTutorialState(prev => ({
      ...prev,
      currentCode: newCode
    }));
  }, []);

  const validateStep = useCallback(() => {
    const validation = TutorialValidator.validateStep(
      currentStep,
      tutorialState.currentCode,
      tutorialState.output
    );

    if (validation.isValid) {
      // Mark step as completed
      const updatedProgress = TutorialProgressManager.markStepCompleted(
        tutorial.id,
        currentStep.id
      );
      setProgress(updatedProgress);

      // Add time spent on this step
      const timeSpent = (new Date().getTime() - tutorialState.stepStartTime.getTime()) / (1000 * 60);
      TutorialProgressManager.addTimeSpent(tutorial.id, timeSpent);

      // Check if tutorial is complete
      if (updatedProgress.completedSteps.length === tutorial.steps.length) {
        TutorialProgressManager.markTutorialCompleted(tutorial.id);
        onComplete?.(tutorial.id);
      }
    }

    return validation;
  }, [tutorial.id, tutorial.steps.length, currentStep, tutorialState, onComplete]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < tutorial.steps.length - 1) {
      const newStepIndex = currentStepIndex + 1;
      setCurrentStepIndex(newStepIndex);
      TutorialProgressManager.updateTutorialProgress(tutorial.id, {
        currentStep: newStepIndex
      });
    }
  }, [currentStepIndex, tutorial.steps.length, tutorial.id]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }, [currentStepIndex]);

  const runCode = useCallback(async () => {
    setTutorialState(prev => ({ ...prev, isRunning: true, hasError: false }));
    
    try {
      // Simulate code execution (you can integrate with actual code execution here)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, generate mock output
      const mockOutput = `// Code executed successfully\n// ${tutorialState.currentCode.split('\n').length} lines processed`;
      
      setTutorialState(prev => ({
        ...prev,
        output: mockOutput,
        isRunning: false
      }));
    } catch (error) {
      setTutorialState(prev => ({
        ...prev,
        output: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        hasError: true,
        isRunning: false
      }));
    }
  }, [tutorialState.currentCode]);

  const toggleHints = useCallback(() => {
    setTutorialState(prev => {
      const newShowHints = !prev.showHints;
      return {
        ...prev,
        showHints: newShowHints,
        hintsUsed: newShowHints ? prev.hintsUsed + 1 : prev.hintsUsed
      };
    });
  }, []);

  const isStepCompleted = progress?.completedSteps.includes(currentStep?.id || '') || false;
  const progressPercentage = progress ? 
    TutorialValidator.getProgressPercentage(progress.completedSteps, tutorial.steps.length) : 0;

  if (!currentStep) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-red-800 font-medium">Tutorial Error</h3>
        <p className="text-red-600">No steps found in this tutorial.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Tutorial Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {tutorial.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {tutorial.description}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Step {currentStepIndex + 1} of {tutorial.steps.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {tutorial.difficulty} • {tutorial.estimatedTime}min
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{progressPercentage}% complete</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* Instructions Panel */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {currentStep.title}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              {currentStep.instruction}
            </p>
            {currentStep.description && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  {currentStep.description}
                </p>
              </div>
            )}
          </div>

          {/* Learning Objectives */}
          {tutorial.learningObjectives.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Learning Objectives
              </h4>
              <ul className="space-y-1">
                {tutorial.learningObjectives.map((objective, index) => (
                  <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 flex-shrink-0"></span>
                    {objective}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Hints */}
          <div className="space-y-2">
            <button
              onClick={toggleHints}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <svg 
                className={`w-4 h-4 mr-1 transform transition-transform ${tutorialState.showHints ? 'rotate-90' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Need a hint? ({tutorialState.hintsUsed} used)
            </button>
            
            {tutorialState.showHints && currentStep.hints.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <ul className="space-y-1">
                  {currentStep.hints.map((hint, index) => (
                    <li key={index} className="text-yellow-800 dark:text-yellow-200 text-sm">
                      💡 {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Resources */}
          {currentStep.resources && currentStep.resources.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                Additional Resources
              </h4>
              <ul className="space-y-1">
                {currentStep.resources.map((resource, index) => (
                  <li key={index}>
                    <a 
                      href={resource.url}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {resource.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Code Editor Panel */}
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">
                Code Editor
              </h4>
              <div className="flex space-x-2">
                <button
                  onClick={runCode}
                  disabled={tutorialState.isRunning}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm rounded transition-colors"
                >
                  {tutorialState.isRunning ? 'Running...' : 'Run Code'}
                </button>
                <button
                  onClick={() => {
                    const validation = validateStep();
                    alert(validation.message);
                    if (validation.isValid && currentStep.nextAction === 'continue') {
                      nextStep();
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                >
                  {currentStep.nextAction === 'validate' ? 'Check Answer' : 'Validate'}
                </button>
              </div>
            </div>
            
            <textarea
              value={tutorialState.currentCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="w-full h-64 font-mono text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Write your code here..."
            />
          </div>

          {/* Output Panel */}
          {(tutorialState.output || currentStep.expectedOutput) && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                Output
              </h4>
              <div className="space-y-2">
                {tutorialState.output && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Actual Output:</div>
                    <pre className={`text-sm font-mono p-2 rounded border ${
                      tutorialState.hasError 
                        ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                        : 'bg-white border-gray-200 text-gray-800 dark:bg-gray-900 dark:border-gray-600 dark:text-gray-200'
                    }`}>
                      {tutorialState.output}
                    </pre>
                  </div>
                )}
                
                {currentStep.expectedOutput && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expected Output:</div>
                    <pre className="text-sm font-mono p-2 rounded border bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200">
                      {currentStep.expectedOutput}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <button
          onClick={previousStep}
          disabled={currentStepIndex === 0}
          className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        <div className="flex items-center space-x-2">
          {isStepCompleted && (
            <span className="flex items-center text-green-600 dark:text-green-400 text-sm">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Completed
            </span>
          )}
        </div>

        <button
          onClick={nextStep}
          disabled={currentStepIndex === tutorial.steps.length - 1}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          Next
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TutorialRenderer;
