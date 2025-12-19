import axios from "axios";
import { api } from "./client";

export async function apiMe() {
  try {
    const { data } = await api.get("/auth/me");
    return data?.data ?? null;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) return null;
    throw err;
  }
}

export async function apiLogin(payload) {
  const { data } = await api.post("/auth/login", payload);
  return data?.data;
}

export async function apiLogout() {
  const { data } = await api.post("/auth/logout");
  return data?.data;
}
