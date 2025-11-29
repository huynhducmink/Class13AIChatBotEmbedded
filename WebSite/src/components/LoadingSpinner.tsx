/**
 * Loading Spinner Component
 * Displays an animated loading indicator with spin, zoom-in, and zoom-out effects
 */

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner = ({ size = 'md' }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <>
      <style>
        {`
          @keyframes zoomInOut {
            0% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.3);
            }
            100% {
              transform: scale(1);
            }
          }
          
          .animate-zoom {
            animation: zoomInOut 1.5s infinite ease-in-out;
          }
        `}
      </style>
      <div className={`${sizeClasses[size]} relative animate-zoom`} style={{ transformOrigin: 'center center' }}>
        <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-600 dark:border-t-blue-400 animate-spin"></div>
      </div>
    </>
  );
};
