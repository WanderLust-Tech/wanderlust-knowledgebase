import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { ArticleComponent, CodePlaygroundContent } from '../../types/ComponentTypes';
import { useTheme } from '../../contexts/ThemeContext';

interface CodePlaygroundRendererProps {
  component: ArticleComponent;
  onInteraction?: (interaction: string, data?: any) => void;
}

const CodePlaygroundRenderer: React.FC<CodePlaygroundRendererProps> = ({ 
  component, 
  onInteraction 
}) => {
  const content = component.content as CodePlaygroundContent;
  const { metadata } = component;
  const { isDark } = useTheme();
  const [code, setCode] = useState(content.initialCode);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeFile, setActiveFile] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const editorRef = useRef<any>(null);

  // Get Monaco theme based on app theme
  const monacoTheme = content.theme || (isDark ? 'vs-dark' : 'vs-light');

  useEffect(() => {
    // Reset code when component changes
    setCode(content.initialCode);
    setOutput('');
    setConsoleOutput([]);
    setShowSolution(false);
  }, [content.initialCode]);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure editor features
    editor.updateOptions({
      minimap: { enabled: content.features?.minimap ?? true },
      lineNumbers: content.features?.lineNumbers ? 'on' : 'off',
      wordWrap: content.features?.wordWrap ? 'on' : 'off',
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });

    // Add custom keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (content.runnable) {
        runCode();
      }
    });

    onInteraction?.('editor_mounted', { language: content.language });
  };

  const runCode = async () => {
    if (!content.runnable || isRunning) return;

    setIsRunning(true);
    setConsoleOutput([]);
    setOutput('');

    try {
      onInteraction?.('code_run_start', { 
        language: content.language, 
        codeLength: code.length 
      });

      // Handle different languages
      switch (content.language) {
        case 'javascript':
        case 'typescript':
          await runJavaScript();
          break;
        case 'html':
          await runHTML();
          break;
        case 'css':
          await runCSS();
          break;
        case 'python':
          await runPython();
          break;
        case 'cpp':
          await runCpp();
          break;
        default:
          setOutput('Language not supported for execution');
      }

      onInteraction?.('code_run_complete', { 
        language: content.language,
        success: true 
      });
    } catch (error) {
      setOutput(`Error: ${error}`);
      onInteraction?.('code_run_error', { 
        language: content.language, 
        error: String(error) 
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runJavaScript = async () => {
    const consoleCapture: string[] = [];
    
    // Create a sandbox console
    const sandboxConsole = {
      log: (...args: any[]) => {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        consoleCapture.push(message);
      },
      error: (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        consoleCapture.push(`Error: ${message}`);
      },
      warn: (...args: any[]) => {
        const message = args.map(arg => String(arg)).join(' ');
        consoleCapture.push(`Warning: ${message}`);
      }
    };

    try {
      // Create a function with the code and custom console
      const wrappedCode = `
        const console = arguments[0];
        ${code}
      `;
      
      const func = new Function(wrappedCode);
      const result = func(sandboxConsole);
      
      if (result !== undefined) {
        consoleCapture.push(`Result: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      consoleCapture.push(`Runtime Error: ${error}`);
    }

    setConsoleOutput(consoleCapture);
    setOutput(consoleCapture.join('\n') || 'Code executed successfully (no output)');
  };

  const runHTML = async () => {
    // For HTML, we'll show a preview
    setOutput('HTML Preview (see output panel)');
    // In a real implementation, this would render in an iframe
  };

  const runCSS = async () => {
    setOutput('CSS styles applied (preview would show in output panel)');
  };

  const runPython = async () => {
    setOutput('Python execution not implemented in this demo. Would use Pyodide or server-side execution.');
  };

  const runCpp = async () => {
    setOutput('C++ compilation not implemented in this demo. Would use server-side compilation or WASM.');
  };

  const resetCode = () => {
    setCode(content.initialCode);
    setOutput('');
    setConsoleOutput([]);
    setShowSolution(false);
    onInteraction?.('code_reset', { language: content.language });
  };

  const toggleSolution = () => {
    if (content.solution) {
      if (showSolution) {
        setCode(content.initialCode);
      } else {
        setCode(content.solution);
      }
      setShowSolution(!showSolution);
      onInteraction?.('solution_toggle', { 
        language: content.language, 
        showing: !showSolution 
      });
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    onInteraction?.('code_copy', { language: content.language });
  };

  const getCurrentFile = () => {
    if (content.files && content.files.length > 0) {
      return content.files[activeFile];
    }
    return { name: `main.${content.language}`, content: code, language: content.language };
  };

  return (
    <div className="code-playground">
      {/* Header */}
      {metadata.title && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {metadata.title}
          </h2>
          {metadata.description && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
              {metadata.description}
            </p>
          )}
          {content.instructions && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>Instructions:</strong> {content.instructions}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* File tabs (if multiple files) */}
        {content.files && content.files.length > 1 && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex">
              {content.files.map((file, index) => (
                <button
                  key={index}
                  onClick={() => setActiveFile(index)}
                  className={`px-4 py-2 text-sm font-medium border-r border-gray-200 dark:border-gray-700 transition-colors ${
                    index === activeFile
                      ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {file.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getCurrentFile().name}
            </span>
            <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-medium text-gray-600 dark:text-gray-400">
              {content.language.toUpperCase()}
            </span>
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

          <div className="flex items-center space-x-2">
            <button
              onClick={copyCode}
              className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
              title="Copy code"
            >
              Copy
            </button>
            {content.runnable && (
              <button
                onClick={runCode}
                disabled={isRunning}
                className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded transition-colors"
                title="Run code (Ctrl/Cmd + Enter)"
              >
                {isRunning ? 'Running...' : 'Run'}
              </button>
            )}
            <button
              onClick={resetCode}
              className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              title="Reset to initial code"
            >
              Reset
            </button>
            {content.solution && (
              <button
                onClick={toggleSolution}
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                title="Toggle solution"
              >
                {showSolution ? 'Hide Solution' : 'Show Solution'}
              </button>
            )}
          </div>
        </div>

        {/* Code Editor */}
        <div className="relative">
          <Editor
            height="400px"
            language={content.language === 'cpp' ? 'cpp' : content.language}
            value={code}
            theme={monacoTheme}
            onChange={(value) => setCode(value || '')}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 14,
              fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              readOnly: getCurrentFile().readOnly || false,
            }}
          />
        </div>

        {/* Output Panel */}
        {(content.showOutput || content.showConsole) && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="bg-gray-50 dark:bg-gray-900 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Output
              </span>
            </div>
            <div className="p-3 bg-gray-900 text-green-400 font-mono text-sm max-h-48 overflow-y-auto">
              {output ? (
                <pre className="whitespace-pre-wrap">{output}</pre>
              ) : (
                <span className="text-gray-500">No output yet. Run your code to see results.</span>
              )}
            </div>
          </div>
        )}

        {/* Expected Output (if provided) */}
        {content.expectedOutput && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-900/20 px-3 py-2 border-b border-blue-200 dark:border-blue-800">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Expected Output
              </span>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-900 dark:text-blue-100 font-mono text-sm">
              <pre className="whitespace-pre-wrap">{content.expectedOutput}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Metadata footer */}
      {metadata.estimatedReadTime && (
        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          ⏱️ Estimated time: {metadata.estimatedReadTime} minutes
        </div>
      )}
    </div>
  );
};

export default CodePlaygroundRenderer;
