import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context.js";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./router.js";

export function App() {
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </AuthProvider>
  );
}
