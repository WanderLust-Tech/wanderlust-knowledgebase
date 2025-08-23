import React, { useState } from 'react';
import { ArticleComponent, QuizContent } from '../../types/ComponentTypes';

interface QuizRendererProps {
  component: ArticleComponent;
  onInteraction?: (interaction: string, data?: any) => void;
}

const QuizRenderer: React.FC<QuizRendererProps> = ({ 
  component, 
  onInteraction 
}) => {
  const content = component.content as QuizContent;
  const { metadata } = component;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [showResults, setShowResults] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string>('');

  const currentQuestion = content.questions[currentQuestionIndex];
  const totalQuestions = content.questions.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleAnswer = (answer: string | string[]) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    
    onInteraction?.('quiz_answer', {
      questionId: currentQuestion.id,
      answer,
      questionIndex: currentQuestionIndex,
      componentId: component.id
    });

    if (currentQuestion.type === 'multiple-choice') {
      setSelectedOption(answer as string);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowResults(true);
      onInteraction?.('quiz_complete', {
        answers,
        totalQuestions,
        componentId: component.id
      });
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption('');
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      const previousAnswer = answers[currentQuestion.id];
      if (previousAnswer && typeof previousAnswer === 'string') {
        setSelectedOption(previousAnswer);
      }
    }
  };

  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowResults(false);
    setSelectedOption('');
    onInteraction?.('quiz_retry', { componentId: component.id });
  };

  const calculateScore = () => {
    let correct = 0;
    content.questions.forEach(question => {
      const userAnswer = answers[question.id];
      if (Array.isArray(question.correctAnswer)) {
        if (Array.isArray(userAnswer) && 
            userAnswer.length === question.correctAnswer.length &&
            userAnswer.every(answer => question.correctAnswer.includes(answer))) {
          correct++;
        }
      } else {
        if (userAnswer === question.correctAnswer) {
          correct++;
        }
      }
    });
    return { correct, total: totalQuestions, percentage: Math.round((correct / totalQuestions) * 100) };
  };

  const renderQuestion = () => {
    const userAnswer = answers[currentQuestion.id];

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm text-gray-500 dark:text-gray-400">
          <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
            {currentQuestion.type}
          </span>
        </div>

        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          {currentQuestion.question}
        </h3>

        {/* Multiple Choice */}
        {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
          <div className="space-y-2">
            {currentQuestion.options.map((option, index) => (
              <label
                key={index}
                className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedOption === option
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={option}
                  checked={selectedOption === option}
                  onChange={() => handleAnswer(option)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                  selectedOption === option
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-gray-500'
                }`}>
                  {selectedOption === option && (
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  )}
                </div>
                <span className="text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        )}

        {/* True/False */}
        {currentQuestion.type === 'true-false' && (
          <div className="flex gap-4">
            {['True', 'False'].map((option) => (
              <label
                key={option}
                className={`flex items-center p-3 rounded-lg border cursor-pointer flex-1 transition-colors ${
                  selectedOption === option
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name={`question-${currentQuestion.id}`}
                  value={option}
                  checked={selectedOption === option}
                  onChange={() => handleAnswer(option)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                  selectedOption === option
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-gray-500'
                }`}>
                  {selectedOption === option && (
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  )}
                </div>
                <span className="text-gray-700 dark:text-gray-300">{option}</span>
              </label>
            ))}
          </div>
        )}

        {/* Code Completion */}
        {currentQuestion.type === 'code-completion' && (
          <div className="space-y-2">
            <textarea
              value={userAnswer as string || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Enter your code here..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm"
              rows={6}
            />
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            ← Previous
          </button>

          <button
            onClick={handleNext}
            disabled={!userAnswer}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            {isLastQuestion ? 'Finish Quiz' : 'Next →'}
          </button>
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const score = calculateScore();

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Quiz Complete!
          </h3>
          <div className={`text-4xl font-bold mb-4 ${
            score.percentage >= 80 ? 'text-green-600' :
            score.percentage >= 60 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {score.percentage}%
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            You got {score.correct} out of {score.total} questions correct
          </p>
        </div>

        {/* Detailed Results */}
        <div className="space-y-4">
          {content.questions.map((question, index) => {
            const userAnswer = answers[question.id];
            const isCorrect = Array.isArray(question.correctAnswer)
              ? Array.isArray(userAnswer) && 
                userAnswer.length === question.correctAnswer.length &&
                userAnswer.every(answer => question.correctAnswer.includes(answer))
              : userAnswer === question.correctAnswer;

            return (
              <div
                key={question.id}
                className={`p-4 rounded-lg border ${
                  isCorrect
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                    isCorrect ? 'bg-green-500' : 'bg-red-500'
                  }`}>
                    <span className="text-white text-sm">
                      {isCorrect ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white mb-1">
                      Question {index + 1}: {question.question}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your answer: <span className="font-medium">{
                        Array.isArray(userAnswer) ? userAnswer.join(', ') : userAnswer || 'No answer'
                      }</span>
                    </p>
                    {!isCorrect && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Correct answer: <span className="font-medium text-green-600 dark:text-green-400">
                          {Array.isArray(question.correctAnswer) 
                            ? question.correctAnswer.join(', ') 
                            : question.correctAnswer}
                        </span>
                      </p>
                    )}
                    {question.explanation && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
                        {question.explanation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        {content.allowRetry && (
          <div className="text-center">
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Retake Quiz
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="quiz-content">
      {/* Header */}
      {metadata.title && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {metadata.title}
          </h2>
          {metadata.description && (
            <p className="text-gray-600 dark:text-gray-400">
              {metadata.description}
            </p>
          )}
        </div>
      )}

      {/* Quiz container */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        {showResults ? renderResults() : renderQuestion()}
      </div>

      {/* Progress bar */}
      {!showResults && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span>{Math.round(((currentQuestionIndex + 1) / totalQuestions) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizRenderer;
