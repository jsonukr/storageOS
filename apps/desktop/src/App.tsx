import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./router";
import { useAgentConnection } from "./hooks/useAgentConnection";

const queryClient = new QueryClient();

function AgentBootstrap({ children }: { children: React.ReactNode }) {
  useAgentConnection();
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AgentBootstrap>
        <RouterProvider router={router} />
      </AgentBootstrap>
    </QueryClientProvider>
  );
}
