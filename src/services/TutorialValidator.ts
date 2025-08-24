import { TutorialStep, TutorialValidationResult } from '../types/TutorialTypes';

export class TutorialValidator {
  static validateStep(step: TutorialStep, userCode: string, output?: string): TutorialValidationResult {
    if (!step.validation) {
      return {
        isValid: true,
        message: 'Step completed! Click continue to proceed.',
        nextStepUnlocked: true
      };
    }

    const { type, value } = step.validation;

    try {
      switch (type) {
        case 'exact':
          return this.validateExact(userCode, value as string);
        
        case 'contains':
          return this.validateContains(userCode, value as string);
        
        case 'regex':
          return this.validateRegex(userCode, value as string);
        
        case 'function':
          if (typeof value === 'function') {
            const isValid = value(userCode, output);
            return {
              isValid,
              message: isValid ? 'Perfect! Your solution is correct.' : 'Not quite right. Check the hints for guidance.',
              nextStepUnlocked: isValid
            };
          }
          break;
        
        default:
          return {
            isValid: false,
            message: 'Unknown validation type',
            nextStepUnlocked: false
          };
      }
    } catch (error) {
      return {
        isValid: false,
        message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        nextStepUnlocked: false
      };
    }

    return {
      isValid: false,
      message: 'Validation failed',
      nextStepUnlocked: false
    };
  }

  private static validateExact(userCode: string, expected: string): TutorialValidationResult {
    const userCodeNormalized = userCode.trim().replace(/\s+/g, ' ');
    const expectedNormalized = expected.trim().replace(/\s+/g, ' ');
    
    const isValid = userCodeNormalized === expectedNormalized;
    
    return {
      isValid,
      message: isValid 
        ? 'Excellent! Your code matches exactly what was expected.' 
        : 'Your code doesn\'t match the expected solution. Check for typos or missing parts.',
      nextStepUnlocked: isValid
    };
  }

  private static validateContains(userCode: string, required: string): TutorialValidationResult {
    const isValid = userCode.includes(required);
    
    return {
      isValid,
      message: isValid 
        ? `Great! Your code contains the required element: "${required}"` 
        : `Your code is missing the required element: "${required}"`,
      nextStepUnlocked: isValid
    };
  }

  private static validateRegex(userCode: string, pattern: string): TutorialValidationResult {
    try {
      const regex = new RegExp(pattern);
      const isValid = regex.test(userCode);
      
      return {
        isValid,
        message: isValid 
          ? 'Perfect! Your code matches the required pattern.' 
          : 'Your code doesn\'t match the expected pattern. Review the requirements.',
        nextStepUnlocked: isValid
      };
    } catch (error) {
      return {
        isValid: false,
        message: 'Invalid regex pattern in validation',
        nextStepUnlocked: false
      };
    }
  }

  static getProgressPercentage(completedSteps: string[], totalSteps: number): number {
    return Math.round((completedSteps.length / totalSteps) * 100);
  }

  static getEstimatedTimeRemaining(
    currentStep: number, 
    totalSteps: number, 
    averageStepTime: number
  ): number {
    const remainingSteps = totalSteps - currentStep;
    return remainingSteps * averageStepTime;
  }
}
