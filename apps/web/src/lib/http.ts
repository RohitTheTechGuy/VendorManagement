import axios from "axios";

// Single axios instance for the whole client.
// withCredentials sends/receives the httpOnly auth cookie on every request.
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "",
  withCredentials: true,
});
