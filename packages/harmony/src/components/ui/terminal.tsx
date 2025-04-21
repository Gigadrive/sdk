'use client';

import { cn } from '@/lib/utils';
import { Circle, Minus, Square, X } from 'lucide-react';
import * as React from 'react';

export type TerminalTheme = 'macos' | 'windows' | 'linux';

export interface ColoredSegment {
  text: string;
  color: string;
}

export interface TerminalStep {
  text: string;
  delay: number;
  wait: number;
  color: string;
}

export interface TerminalProps extends React.HTMLAttributes<HTMLDivElement> {
  steps?: TerminalStep[];
  theme?: TerminalTheme;
  onThemeChange?: (theme: TerminalTheme) => void;
  title?: string;
}

const Terminal = React.forwardRef<HTMLDivElement, TerminalProps>(
  ({ className, steps = defaultSteps, theme = 'macos', title = 'Terminal — vercel deploy', ...props }, ref) => {
    const [segments, setSegments] = React.useState<ColoredSegment[]>([]);
    const [showCursor, setShowCursor] = React.useState(true);
    const [currentStep, setCurrentStep] = React.useState(0);
    const [currentTheme, setCurrentTheme] = React.useState<TerminalTheme>(theme);

    // Update currentTheme when theme prop changes - without resetting text
    React.useEffect(() => {
      setCurrentTheme(theme);
    }, [theme]);

    // Cursor blinking effect
    React.useEffect(() => {
      const cursorInterval = setInterval(() => {
        setShowCursor((prev) => !prev);
      }, 530);
      return () => clearInterval(cursorInterval);
    }, []);

    // Handle typing animation
    React.useEffect(() => {
      if (currentStep >= steps.length) return;

      const currentStepData = steps[currentStep];
      let charIndex = 0;
      const timeoutIds: ReturnType<typeof setTimeout>[] = [];

      const typeNextChar = () => {
        if (charIndex < currentStepData.text.length) {
          const char = currentStepData.text.charAt(charIndex);
          setSegments((prev) => updateSegments(prev, char, currentStepData.color));
          charIndex++;
          const timeoutId = setTimeout(typeNextChar, currentStepData.delay);
          timeoutIds.push(timeoutId);
        } else {
          const timeoutId = setTimeout(() => setCurrentStep(currentStep + 1), currentStepData.wait);
          timeoutIds.push(timeoutId);
        }
      };

      typeNextChar();

      // Cleanup function to clear all timeouts
      return () => {
        timeoutIds.forEach((id) => clearTimeout(id));
      };
    }, [currentStep, steps]);

    return (
      <div className={cn('space-y-4', className)} ref={ref} {...props}>
        <div className="w-full min-w-[640px] max-w-3xl mx-auto rounded-lg overflow-hidden shadow-2xl dark:shadow-lg dark:shadow-gray-900/50">
          <TerminalHeader theme={currentTheme} title={title} />
          <TerminalContent theme={currentTheme}>
            <TerminalPrompt theme={currentTheme} />
            <div className="ml-2 whitespace-pre-wrap text-left">
              {segments.map((segment, index) => (
                <span key={index} className={getColorClass(segment.color)}>
                  {segment.text}
                </span>
              ))}
              {showCursor && <span className="animate-pulse">▋</span>}
            </div>
          </TerminalContent>
        </div>
      </div>
    );
  }
);

Terminal.displayName = 'Terminal';

const TerminalHeader = React.forwardRef<HTMLDivElement, { theme: TerminalTheme; title: string }>(
  ({ theme, title }, ref) => {
    const headers = {
      macos: (
        <div className="bg-gray-200 dark:bg-gray-800 px-4 py-2 flex items-center">
          <div className="flex space-x-2">
            <Circle className="h-3 w-3 text-red-500 fill-red-500" />
            <Circle className="h-3 w-3 text-yellow-500 fill-yellow-500" />
            <Circle className="h-3 w-3 text-green-500 fill-green-500" />
          </div>
          <div className="mx-auto text-sm text-gray-600 dark:text-gray-300">{title}</div>
        </div>
      ),
      windows: (
        <div className="bg-blue-700 dark:bg-blue-900 px-4 py-2 flex items-center justify-between">
          <div className="text-sm text-white">{title}</div>
          <div className="flex space-x-2">
            <Minus className="h-3 w-3 text-white" />
            <Square className="h-3 w-3 text-white" />
            <X className="h-3 w-3 text-white" />
          </div>
        </div>
      ),
      linux: (
        <div className="bg-zinc-800 dark:bg-zinc-900 px-4 py-2 flex items-center justify-between">
          <div className="text-sm text-white">{title}</div>
          <div className="flex space-x-2">
            <Minus className="h-3 w-3 text-white" />
            <Square className="h-3 w-3 text-white" />
            <X className="h-3 w-3 text-white" />
          </div>
        </div>
      ),
    };

    return <div ref={ref}>{headers[theme]}</div>;
  }
);

TerminalHeader.displayName = 'TerminalHeader';

const TerminalContent = React.forwardRef<HTMLDivElement, React.PropsWithChildren<{ theme: TerminalTheme }>>(
  ({ theme, children }, ref) => {
    const bgColor = theme === 'windows' ? 'bg-black' : theme === 'linux' ? 'bg-zinc-900 dark:bg-zinc-950' : 'bg-black';

    return (
      <div ref={ref} className={cn('p-4 font-mono text-sm h-64 overflow-y-auto text-white shadow-inner', bgColor)}>
        <div className="flex">{children}</div>
      </div>
    );
  }
);

TerminalContent.displayName = 'TerminalContent';

const TerminalPrompt = React.forwardRef<HTMLDivElement, { theme: TerminalTheme }>(({ theme }, ref) => {
  const prompts = {
    macos: (
      <>
        <span className="text-green-400">➜</span>
        <span className="text-blue-400 ml-2">~</span>
        <span className="ml-2">$</span>
      </>
    ),
    windows: <span className="text-white">C:\Users\user&gt;</span>,
    linux: <span className="text-green-400">user@ubuntu:~$</span>,
  };

  return <div ref={ref}>{prompts[theme]}</div>;
});

TerminalPrompt.displayName = 'TerminalPrompt';

const getColorClass = (color: string) => {
  const colorMap: Record<string, string> = {
    gray: 'text-gray-400 dark:text-gray-500',
    green: 'text-green-400 dark:text-green-500',
    blue: 'text-blue-400 dark:text-blue-500',
    cyan: 'text-cyan-400 dark:text-cyan-500',
    white: 'text-white dark:text-gray-100',
  };
  return colorMap[color] || colorMap.white;
};

const updateSegments = (prev: ColoredSegment[], char: string, color: string): ColoredSegment[] => {
  const newSegments = [...prev];

  if (char === '\n') {
    if (newSegments.length > 0) {
      const lastSegment = newSegments[newSegments.length - 1];
      return [...newSegments.slice(0, -1), { ...lastSegment, text: lastSegment.text + char }];
    }
    return [{ text: char, color }];
  }

  const lastSegment = newSegments.length > 0 ? newSegments[newSegments.length - 1] : null;
  if (lastSegment && lastSegment.color === color) {
    return [...newSegments.slice(0, -1), { ...lastSegment, text: lastSegment.text + char }];
  }

  return [...newSegments, { text: char, color }];
};

const defaultSteps: TerminalStep[] = [
  { text: 'gigadrive deploy', delay: 100, wait: 500, color: 'white' },
  {
    text: '\nVerifying project settings...',
    delay: 30,
    wait: 800,
    color: 'gray',
  },
  {
    text: '\nLooking up deployment status...',
    delay: 30,
    wait: 1000,
    color: 'blue',
  },
  { text: '\nPreparing deployment...', delay: 30, wait: 1200, color: 'gray' },
  {
    text: '\nUploading [====================] 100%',
    delay: 10,
    wait: 800,
    color: 'cyan',
  },
  { text: '\nDeployment complete!', delay: 30, wait: 500, color: 'green' },
  { text: '\n\n🎉 Production: ', delay: 20, wait: 0, color: 'white' },
  {
    text: 'https://your-project.gigadrive.app',
    delay: 20,
    wait: 0,
    color: 'blue',
  },
  { text: ' [6s]', delay: 20, wait: 0, color: 'gray' },
];

export { Terminal };
