'use client';

import { Eye, EyeOff } from 'lucide-react';
import * as React from 'react';
import zxcvbn, { type ZXCVBNScore } from 'zxcvbn';

import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PasswordProps extends Omit<InputProps, 'type'> {
  showStrength?: boolean;
  discouragedWords?: string[];
}

const Password = React.forwardRef<HTMLInputElement, PasswordProps>(
  ({ showStrength = false, discouragedWords = [], className, ...props }, ref) => {
    const [score, setScore] = React.useState<ZXCVBNScore | -1>(-1);
    const [value, setValue] = React.useState<string | number | readonly string[] | undefined>(props.value);
    const [showPassword, setShowPassword] = React.useState(false);

    // Sync props value to state value
    React.useEffect(() => {
      setValue(props.value);
    }, [props.value]);

    // Update strength with password
    React.useEffect(() => {
      const computedValue: string = typeof value === 'string' ? value : '';
      setScore(computedValue === '' ? -1 : zxcvbn(computedValue, discouragedWords).score);
    }, [discouragedWords, value]);

    const togglePasswordVisibility = () => {
      setShowPassword(!showPassword);
    };

    const PasswordStrength = ({ score }: { score: ZXCVBNScore | -1 }) => {
      const colors: Record<ZXCVBNScore | -1, string> = {
        0: 'bg-red-500',
        1: 'bg-yellow-500',
        2: 'bg-lime-500',
        3: 'bg-green-500',
        4: 'bg-green-500',
        '-1': 'bg-gray-200 dark:bg-gray-700',
      };

      const scoreText: Record<ZXCVBNScore | -1, string> = {
        0: 'Very Weak',
        1: 'Weak',
        2: 'Okay',
        3: 'Good',
        4: 'Strong',
        '-1': 'Password strength',
      };

      return (
        <div className="mt-1 space-y-1">
          <div className="flex space-x-1">
            {Array.from(Array(4).keys()).map((i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 w-1/4 rounded-sm',
                  i < score ? colors[score] : colors[-1],
                  'transition-colors duration-300 ease-in-out'
                )}
              />
            ))}
          </div>
          <div className="flex-1 text-right text-sm text-gray-500 dark:text-gray-400">{scoreText[score]}</div>
        </div>
      );
    };

    return (
      <Input
        type={showPassword ? 'text' : 'password'}
        className={className}
        ref={ref}
        rightElement={
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        bottomElement={showStrength && <PasswordStrength score={score} />}
        onChange={(e) => {
          props.onChange?.(e);
          setValue(e.target.value);
        }}
        {...props}
      />
    );
  }
);

Password.displayName = 'Password';

export { Password };
