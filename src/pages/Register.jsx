// import { useState } from 'react';
// import api from '../api/api';
// import { generateKeyPair } from '../crypto/crypto';
// import { storage } from '../utils/storage';

// export default function Register({ onRegister }) {
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const [loading, setLoading] = useState(false);

//   const handleRegister = async () => {
//     if (!username || !password) {
//       return alert("Username and password are required");
//     }

//     setLoading(true);
//     try {
//       const { publicKey, privateKey } = await generateKeyPair();

//       const response = await api.post('/auth/register', {
//         username,
//         password,
//         publicKey
//       });

//       storage.saveToken(response.data.token || response.data.accessToken);
//       storage.savePrivateKey(privateKey);
//       storage.saveUser({ username });

//       alert("Registration Successful! You can now login.");
//       onRegister();
//     } catch (error) {
//       console.error(error);
//       alert(error.response?.data?.message || "Registration failed");
//     }
//     setLoading(false);
//   };

//   return (
//     <div className="card">
//       <h2>Register New Account</h2>
//       <p style={{ marginBottom: "20px", color: "#666" }}>End-to-End Encrypted</p>

//       <input
//         type="text"
//         placeholder="Choose username"
//         value={username}
//         onChange={(e) => setUsername(e.target.value)}
//       />
//       <input
//         type="password"
//         placeholder="Create password"
//         value={password}
//         onChange={(e) => setPassword(e.target.value)}
//       />

//       <button onClick={handleRegister} disabled={loading}>
//         {loading ? "Creating Account..." : "Register"}
//       </button>
//     </div>
//   );
// }

import { useState } from "react";
import api from "../api/api";
import { generateKeyPair } from "../crypto/crypto";
import { storage } from "../utils/storage";

export default function Register({ onRegister, onGoToLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState("");
  const [error,    setError]    = useState("");

  const handleRegister = async () => {
    if (!username.trim()) return setError("Username is required.");
    if (username.length < 3) return setError("Username must be at least 3 characters.");
    if (!password) return setError("Password is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    setError("");

    try {
      setStep("Generating your encryption keys...");
      const { publicKey, privateKey, rawPrivateKey } = await generateKeyPair();

      setStep("Creating your account...");
      const response = await api.post("/auth/register", {
        username,
        password,
        publicKey,
      });

      const data  = response.data;
      const token = data.token || data.accessToken || data.access_token;
      const user  = data.user  || { id: data.id || data.userId, username };

      if (!token) throw new Error("No token received from server.");

      storage.saveToken(token);
      storage.saveUser(user);

      setStep("Securing your private key...");
      await storage.savePrivateKey(user.id, privateKey);

      setStep("");
      onRegister(user, rawPrivateKey);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.detail  ||
        err.message                 ||
        "Registration failed. Please try again."
      );
      storage.clearSession();
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) handleRegister();
  };

  return (
    <div className="auth-page">
      <div className="card">
        <h2 style={{ marginBottom: "6px" }}>🔐 Create Account</h2>
        <p style={{ color: "#888", fontSize: "13px", marginBottom: "20px" }}>
          Your encryption keys are generated locally
        </p>

        {error && <div className="error-box">{error}</div>}
        {loading && step && <div className="step-box">⏳ {step}</div>}

        <input
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Create a password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Confirm your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        <button onClick={handleRegister} disabled={loading}>
          {loading ? "Setting up..." : "Create Account"}
        </button>

        <div className="warning-box">
          ⚠️ Your private key is stored on this device only. Clearing browser
          data or switching devices means you cannot recover old messages.
        </div>

        <div className="auth-link">
          Already have an account?{" "}
          <button onClick={onGoToLogin}>Sign in</button>
        </div>

        <div className="security-note">🛡️ Private key never leaves this device</div>
      </div>
    </div>
  );
}
