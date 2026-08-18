import { RouterProvider } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { AuthProvider } from "./lib/auth-context.js";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { router } from "./router.js";

// Register GSAP's React integration once for the whole app (Awwwards motion port).
gsap.registerPlugin(useGSAP);

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
