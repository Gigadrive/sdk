'use client';

import { useTheme } from '@/theme/context';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { nanoid } from 'nanoid';
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

/* Shared toast chrome — single source for both the Sonner classNames map and the
   custom-rendered toasts in createToastContent. */
const TOAST_BASE =
  'group toast raised group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border rounded-lg w-[380px]';

const TOAST_TYPE_CLASSES: Record<NonNullable<Toast['type']>, string> = {
  success: 'group-[.toast]:border-success group-[.toast]:border-l-4 group-[.toast]:bg-success-soft',
  error: 'group-[.toast]:border-danger group-[.toast]:border-l-4 group-[.toast]:bg-danger-soft',
  info: 'group-[.toast]:border-info group-[.toast]:border-l-4 group-[.toast]:bg-info-soft',
  warning: 'group-[.toast]:border-warning group-[.toast]:border-l-4 group-[.toast]:bg-warning-soft',
};

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
          toast: TOAST_BASE,
          title: 'text-base',
          description: 'text-sm text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          success: TOAST_TYPE_CLASSES.success,
          error: TOAST_TYPE_CLASSES.error,
          info: TOAST_TYPE_CLASSES.info,
          warning: TOAST_TYPE_CLASSES.warning,
          icon: 'text-foreground',
          closeButton: 'text-foreground/50 hover:text-foreground',
          loader: 'text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

// Helper function to create toast content
const createToastContent = (toastData: Omit<Toast, 'id'>) => {
  let toastClass = `${TOAST_BASE} p-4`;

  // Add type-specific styling
  if (toastData.type) {
    toastClass += ` ${TOAST_TYPE_CLASSES[toastData.type]}`;
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
                {toastData.type === 'success' && <CheckCircle className="h-5 w-5 text-success" />}
                {toastData.type === 'error' && <AlertCircle className="h-5 w-5 text-danger" />}
                {toastData.type === 'info' && <Info className="h-5 w-5 text-info" />}
                {toastData.type === 'warning' && <AlertTriangle className="h-5 w-5 text-warning" />}
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
