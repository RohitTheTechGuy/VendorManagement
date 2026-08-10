import { createBrowserRouter, Navigate } from "react-router-dom";
import { Home } from "./routes/home.js";

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);
