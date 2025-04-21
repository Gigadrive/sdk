'use client';

import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useTheme } from 'next-themes';
import { createContext, useContext, useState } from 'react';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

export interface Toast {
  id: string;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  type?: 'success' | 'error' | 'info' | 'warning';
  autoClose?: boolean;
  action?: React.ReactNode;
  cancel?: React.ReactNode;
  onDismiss?: () => void;
  onAutoClose?: () => void;
}

export const ToastContext = createContext<{
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}>({
  toasts: [],
  addToast: () => '',
  removeToast: () => {},
});

const Toaster: React.FC<ToasterProps> = ({ ...props }) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      richColors
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:shadow-lg rounded-lg w-[380px]',
          title: 'text-base',
          description: 'text-sm text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success:
            'group-[.toast]:border-green-500 group-[.toast]:border-l-4 group-[.toast]:bg-green-50 dark:group-[.toast]:bg-green-950/20',
          error:
            'group-[.toast]:border-red-500 group-[.toast]:border-l-4 group-[.toast]:bg-red-50 dark:group-[.toast]:bg-red-950/20',
          info: 'group-[.toast]:border-blue-500 group-[.toast]:border-l-4 group-[.toast]:bg-blue-50 dark:group-[.toast]:bg-blue-950/20',
          warning:
            'group-[.toast]:border-yellow-500 group-[.toast]:border-l-4 group-[.toast]:bg-yellow-50 dark:group-[.toast]:bg-yellow-950/20',
          icon: 'text-foreground dark:text-white',
          closeButton: 'text-foreground/50 hover:text-foreground dark:text-white/50 dark:hover:text-white',
          loader: 'text-muted-foreground dark:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

// Helper function to create toast content
const createToastContent = (toastData: Omit<Toast, 'id'>) => {
  let toastClass =
    'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:shadow-lg rounded-lg p-4 w-[380px]';

  // Add type-specific styling
  if (toastData.type) {
    switch (toastData.type) {
      case 'success':
        toastClass +=
          ' group-[.toast]:border-green-500 group-[.toast]:border-l-4 group-[.toast]:bg-green-50 dark:group-[.toast]:bg-green-950/20';
        break;
      case 'error':
        toastClass +=
          ' group-[.toast]:border-red-500 group-[.toast]:border-l-4 group-[.toast]:bg-red-50 dark:group-[.toast]:bg-red-950/20';
        break;
      case 'info':
        toastClass +=
          ' group-[.toast]:border-blue-500 group-[.toast]:border-l-4 group-[.toast]:bg-blue-50 dark:group-[.toast]:bg-blue-950/20';
        break;
      case 'warning':
        toastClass +=
          ' group-[.toast]:border-yellow-500 group-[.toast]:border-l-4 group-[.toast]:bg-yellow-50 dark:group-[.toast]:bg-yellow-950/20';
        break;
    }
  }

  if (toastData.children) {
    return {
      element: () => <div className={toastClass}>{toastData.children}</div>,
      options: {
        duration: toastData.autoClose === false ? Infinity : 5000,
        onDismiss: toastData.onDismiss,
        onAutoClose: toastData.onAutoClose,
      },
    };
  } else {
    return {
      element: () => (
        <div className={toastClass}>
          <div className="flex items-start gap-3">
            {toastData.type && (
              <div className="flex-shrink-0 mt-0.5">
                {toastData.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                {toastData.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
                {toastData.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
                {toastData.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
              </div>
            )}
            <div className="flex-1">
              {toastData.title && <div className="text-base font-medium">{toastData.title}</div>}
              {toastData.message && <div className="text-sm text-muted-foreground">{toastData.message}</div>}
              {(toastData.action || toastData.cancel) && (
                <div className="mt-2 flex gap-2">
                  {toastData.action && (
                    <div className="group-[.toast]:bg-primary group-[.toast]:text-primary-foreground">
                      {toastData.action}
                    </div>
                  )}
                  {toastData.cancel && (
                    <div className="group-[.toast]:bg-muted group-[.toast]:text-muted-foreground">
                      {toastData.cancel}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      options: {
        duration: toastData.autoClose === false ? Infinity : 5000,
        onDismiss: toastData.onDismiss,
        onAutoClose: toastData.onAutoClose,
      },
    };
  }
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    const addToast = (toastData: Omit<Toast, 'id'>) => {
      const id = nanoid();
      const { element, options } = createToastContent(toastData);
      toast.custom(element, options);
      return id;
    };

    const removeToast = (id: string) => {
      toast.dismiss(id);
    };

    return { addToast, removeToast };
  }

  return context;
};

interface ToastContextProviderProps {
  children: React.ReactNode;
}

export const ToastContextProvider = ({ children }: ToastContextProviderProps): JSX.Element => {
  const [toasts] = useState<Toast[]>([]);

  const addToast = (toastData: Omit<Toast, 'id'>) => {
    const id = nanoid();
    const { element, options } = createToastContent(toastData);
    toast.custom(element, options);
    return id;
  };

  const removeToast = (id: string) => {
    toast.dismiss(id);
  };

  return <ToastContext.Provider value={{ toasts, addToast, removeToast }}>{children}</ToastContext.Provider>;
};

export { Toaster };
