import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const savedToken = await AsyncStorage.getItem("sahayak_token");
      if (savedToken) {
        try {
          const me = await api.me(savedToken);
          setToken(savedToken);
          setUser(me.user);
        } catch (_error) {
          await AsyncStorage.removeItem("sahayak_token");
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (loginId, password) => {
    const data = await api.login({ loginId, password });
    await AsyncStorage.setItem("sahayak_token", data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api.register(payload);
    await AsyncStorage.setItem("sahayak_token", data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("sahayak_token");
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    const data = await api.me(token);
    setUser(data.user);
  }, [token]);

  const value = useMemo(
    () => ({ token, user, loading, login, register, logout, refreshMe }),
    [token, user, loading, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
