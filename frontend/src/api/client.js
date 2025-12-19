import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "X-Requested-With": "XMLHttpRequest",
  },
});

export function getApiErrorMessage(err) {
  if (!err) return "Սխալ";
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data === "string") return data;
    const message = data?.error?.message ?? data?.message ?? data?.error;
    if (message) return String(message);
    if (err.response?.status) return `Սխալ (${err.response.status})`;
    return "Ցանցային սխալ";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Սխալ";
}
