import React from 'react';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ fullScreen = false }) => {
  const spinnerClasses = fullScreen
    ? "fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50"
    : "w-full h-full flex items-center justify-center";

  return (
    <div className={spinnerClasses}>
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* Outer ring */}
          <div className="w-16 h-16 border-4 border-blue-500/30 rounded-full animate-spin"></div>
          {/* Inner ring */}
          <div className="w-16 h-16 border-4 border-t-blue-500 rounded-full animate-spin absolute top-0 left-0"></div>
        </div>
        <div className="text-white text-lg font-medium">Loading...</div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
