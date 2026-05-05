import { useState } from "react";
import api from "../api/api";
import { importPrivateKey } from "../crypto/crypto";
import { storage } from "../utils/storage";

export default function Login({ onLogin, onGoToRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      return setError("Please enter both username and password.");
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", { username, password });
      const data  = response.data;
      const token = data.token || data.accessToken || data.access_token;
      const user  = data.user  || { id: data.id || data.userId, username };

      if (!token) throw new Error("No token received from server.");

      storage.saveToken(token);
      storage.saveUser(user);

      const privateKeyBase64 = await storage.getPrivateKey(user.id);

      if (!privateKeyBase64) {
        throw new Error(
          "Encryption key not found on this device. " +
          "Please register again or use the device you originally signed up on."
        );
      }

      const privateKey = await importPrivateKey(privateKeyBase64);
      onLogin(user, privateKey);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.detail  ||
        err.message                 ||
        "Login failed. Please try again."
      );
      storage.clearSession();
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleLogin();
  };

  return (
    <div className="auth-page">
      <div className="card">
        <h2 style={{ marginBottom: "6px" }}>🔒 WhisperBox</h2>
        <p style={{ color: "#888", fontSize: "13px", marginBottom: "20px" }}>
          End-to-end encrypted messaging
        </p>

        {error && <div className="error-box">{error}</div>}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        <button onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <div className="auth-link">
          Don't have an account?{" "}
          <button onClick={onGoToRegister}>Create one</button>
        </div>

        <div className="security-note">🛡️ Your private key never leaves this device</div>
      </div>
    </div>
  );
}
