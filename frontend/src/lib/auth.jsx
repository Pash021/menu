import React, { createContext, useContext, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiLogin, apiLogout, apiMe } from "@/api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: apiMe,
    staleTime: 60_000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: apiLogin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: apiLogout,
    onSuccess: async () => {
      queryClient.setQueryData(["me"], null);
    },
  });

  const user = meQuery.data?.user ?? null;

  const value = useMemo(() => {
    return {
      user,
      isLoading: meQuery.isLoading,
      isAuthenticated: Boolean(user),
      refresh: () => meQuery.refetch(),
      login: (payload) => loginMutation.mutateAsync(payload),
      logout: () => logoutMutation.mutateAsync(),
    };
  }, [user, meQuery, loginMutation, logoutMutation]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

