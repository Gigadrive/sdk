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
   custom-rendered toasts in createToastContent. Tactile: a raised neutral card;
   the semantic tone lives in the icon tile, not a tinted background. */
const TOAST_BASE =
  'group toast raised group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border rounded-xl w-[380px]';

/* Sonner-native type toasts (toast.success() etc.) can't render our icon tile,
   so they get the Alert-style soft treatment instead. */
const TOAST_TYPE_CLASSES: Record<NonNullable<Toast['type']>, string> = {
  success: 'group-[.toast]:border-success/25 group-[.toast]:bg-success-soft',
  error: 'group-[.toast]:border-danger/25 group-[.toast]:bg-danger-soft',
  info: 'group-[.toast]:border-info/25 group-[.toast]:bg-info-soft',
  warning: 'group-[.toast]:border-warning/25 group-[.toast]:bg-warning-soft',
};

/* Icon tile per type — the status-tile pattern shared with deployment headers. */
const TOAST_TILE_CLASSES: Record<NonNullable<Toast['type']>, string> = {
  success: 'bg-success-soft text-success',
  error: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
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

// eslint-disable-next-line react/prop-types -- props come from Sonner's ToasterProps, not a local shape
const Toaster: React.FC<ToasterProps> = ({ style, ...props }) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      richColors
      // Sonner's stylesheet hardcodes its own font-family on [data-sonner-toaster],
      // so toasts never inherit the page font. An inline style is the only override
      // that wins regardless of stylesheet load order.
      style={{ fontFamily: 'var(--font-sans)', ...style }}
      toastOptions={{
        classNames: {
          toast: TOAST_BASE,
          // No weight here: sonner wraps toast.custom content in its title slot, so this
          // class leaks onto the whole custom toast. Native styled toasts get their
          // title weight (500) from sonner's own stylesheet.
          title: 'text-sm',
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

const TOAST_TYPE_ICONS: Record<NonNullable<Toast['type']>, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

// Helper function to create toast content
const createToastContent = (toastData: Omit<Toast, 'id'>) => {
  // The card chrome (raised, border, bg-card) is applied by the Toaster's
  // classNames.toast to sonner's <li>; the custom element only lays out content.
  const toastClass = 'w-full p-4';

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
    const TypeIcon = toastData.type ? TOAST_TYPE_ICONS[toastData.type] : null;

    return {
      element: () => (
        <div className={toastClass}>
          <div className="flex items-start gap-3">
            {toastData.type && TypeIcon && (
              <div
                className={`grid size-8 flex-shrink-0 place-items-center rounded-lg ${TOAST_TILE_CLASSES[toastData.type]}`}
              >
                <TypeIcon aria-hidden className="size-4" />
              </div>
            )}
            <div className="min-w-0 flex-1 py-0.5">
              {toastData.title && <div className="text-sm font-medium">{toastData.title}</div>}
              {toastData.message && <div className="mt-0.5 text-sm text-muted-foreground">{toastData.message}</div>}
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
