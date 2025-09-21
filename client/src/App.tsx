import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Vision3D from "./components/Vision3D";
import "@fontsource/inter";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-900 text-white">
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-xl">Loading Vision3D...</div>
          </div>
        }>
          <Vision3D />
        </Suspense>
      </div>
    </QueryClientProvider>
  );
}

export default App;
