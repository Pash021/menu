import { api } from "./client";

export async function getPublicRestaurant(slug, params = {}) {
  const { data } = await api.get(`/public/restaurant/${slug}`, { params });
  return data?.data;
}

export async function getPublicMenu(slug, params = {}) {
  const { data } = await api.get(`/public/restaurant/${slug}/menu`, { params });
  return data?.data;
}

export async function resolveQr(code) {
  const { data } = await api.get(`/public/qr/${code}`);
  return data?.data;
}

export async function callWaiter(payload) {
  const { data } = await api.post("/call_waiter", payload);
  return data?.data;
}
