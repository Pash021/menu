import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App";
import "./styles/global.css";
import { ThemeProvider } from "./lib/theme";
import { I18nProvider } from "./lib/i18n";
import { AuthProvider } from "./lib/auth";
import { ActiveRestaurantProvider } from "./lib/activeRestaurant";
import { Toaster } from "./components/Toaster";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function inferBasename() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname.startsWith("/app") ? "/app" : "/";
}

function resolveBasename() {
  const inferred = inferBasename();
  const envBase = import.meta.env.VITE_BASENAME;
  if (typeof window === "undefined") return inferred;
  if (typeof envBase !== "string" || !envBase) return inferred;
  return window.location.pathname.startsWith(envBase) ? envBase : inferred;
}

const basename = resolveBasename();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <ActiveRestaurantProvider>
              <BrowserRouter basename={basename}>
                <App />
              </BrowserRouter>
              <Toaster />
            </ActiveRestaurantProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
      {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  </React.StrictMode>
);
