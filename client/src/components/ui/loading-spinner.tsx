import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8"
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-2 border-gray-300 border-t-blue-600",
        sizeClasses[size],
        className
      )}
    />
  );
}

export function LoadingOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center z-10">
        <div className="bg-gray-800 rounded-lg p-4 flex items-center space-x-3">
          <LoadingSpinner />
          <span className="text-gray-300">{children}</span>
        </div>
      </div>
    </div>
  );
}
