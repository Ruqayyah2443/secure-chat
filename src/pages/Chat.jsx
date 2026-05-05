import { useState, useEffect, useRef, useCallback } from "react";
import api from "../api/api";
import { encryptMessage, decryptMessage } from "../crypto/crypto";
import { storage } from "../utils/storage";

export default function Chat({ currentUser, privateKey, onLogout }) {
  const [users,        setUsers]        = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [inputText,    setInputText]    = useState("");
  const [sending,      setSending]      = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [sendError,    setSendError]    = useState("");

  const messagesEndRef = useRef(null);
  const pollRef        = useRef(null);
  const seenIds        = useRef(new Set());

  // ── Load all registered users ──────────────────────────────────────────────
  useEffect(() => {
    api.get("/users")
      .then((res) => {
        const all = res.data?.users || res.data || [];
        setUsers(all.filter((u) => u.id !== currentUser.id));
      })
      .catch(console.error)
      .finally(() => setLoadingUsers(false));
  }, [currentUser.id]);

  // ── Fetch + decrypt messages for the selected conversation ─────────────────
  const fetchMessages = useCallback(async () => {
    if (!selectedUser || !privateKey) return;
    try {
      const res = await api.get(`/messages/${selectedUser.id}`);
      const raw = res.data?.messages || res.data || [];
      if (!Array.isArray(raw)) return;

      const incoming = await Promise.all(
        raw.map(async (msg) => {
          // Skip messages we've already decrypted
          if (seenIds.current.has(msg.id)) return null;
          seenIds.current.add(msg.id);

          try {
            // Use our private key to decrypt
            const text = await decryptMessage(
              msg.encrypted_content,
              msg.encrypted_key,
              msg.iv,
              privateKey
            );
            return {
              id:          msg.id,
              senderId:    msg.sender_id,
              text,
              timestamp:   msg.created_at,
              isOwn:       msg.sender_id === currentUser.id,
              decryptFail: false,
            };
          } catch {
            // Decryption failed — show placeholder
            return {
              id:          msg.id,
              senderId:    msg.sender_id,
              text:        null,
              timestamp:   msg.created_at,
              isOwn:       msg.sender_id === currentUser.id,
              decryptFail: true,
            };
          }
        })
      );

      const fresh = incoming.filter(Boolean);
      if (!fresh.length) return;

      setMessages((prev) => {
        const map = {};
        for (const m of prev)  map[m.id] = m;
        for (const m of fresh) map[m.id] = m;
        return Object.values(map).sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
      });
    } catch (err) {
      console.error("fetchMessages error:", err);
    }
  }, [selectedUser, privateKey, currentUser.id]);

  // ── Poll every 3 seconds when a conversation is open ──────────────────────
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      seenIds.current.clear();
      return;
    }
    setMessages([]);
    seenIds.current.clear();
    setLoadingMsgs(true);
    fetchMessages().finally(() => setLoadingMsgs(false));
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [selectedUser, fetchMessages]);

  // ── Auto-scroll when new messages arrive ──────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Encrypt + send a message ───────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedUser || sending) return;

    setSending(true);
    setSendError("");
    setInputText("");

    try {
      // 1. Get recipient's public key from server
      const keyRes    = await api.get(`/users/${selectedUser.id}/public-key`);
      const publicKey = keyRes.data?.public_key || keyRes.data?.publicKey;
      if (!publicKey) throw new Error("Could not get recipient's public key.");

      // 2. Encrypt: generates AES key, encrypts message, wraps AES key with RSA
      const { encryptedContent, encryptedKey, iv } =
        await encryptMessage(text, publicKey);

      // 3. POST encrypted blob — server never sees plaintext
      const res = await api.post("/messages", {
        recipient_id:      selectedUser.id,
        encrypted_content: encryptedContent,
        encrypted_key:     encryptedKey,
        iv,
      });

      // 4. Show message immediately without waiting for next poll
      const msgId = res.data?.id || `local-${Date.now()}`;
      seenIds.current.add(msgId);
      setMessages((prev) => [
        ...prev,
        {
          id:          msgId,
          senderId:    currentUser.id,
          text,
          timestamp:   new Date().toISOString(),
          isOwn:       true,
          decryptFail: false,
        },
      ]);
    } catch (err) {
      setSendError(err.message || "Failed to send message.");
      setInputText(text); // restore text so user doesn't lose it
    } finally {
      setSending(false);
    }
  };

  // Enter sends, Shift+Enter is newline
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogout = () => {
    clearInterval(pollRef.current);
    storage.clearSession();
    onLogout();
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── CONTACT LIST VIEW (no conversation selected) ───────────────────────────
  if (!selectedUser) {
    return (
      <div className="container">

        <div className="header">
          <h2>💬 WhisperBox</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "#555" }}>👤 {currentUser.username}</span>
            <button
              onClick={handleLogout}
              style={{ width: "auto", padding: "8px 16px" }}
            >
              Logout
            </button>
          </div>
        </div>

        <p style={{ color: "#666", marginBottom: "16px", fontSize: "14px" }}>
          🔒 Select a contact below to start an encrypted conversation
        </p>

        {loadingUsers ? (
          <p style={{ color: "#999" }}>Loading contacts...</p>
        ) : users.length === 0 ? (
          <p style={{ color: "#999" }}>No other users registered yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {users.map((u) => (
              <div
                key={u.id}
                className="card"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
                onClick={() => setSelectedUser(u)}
              >
                <div>
                  <strong>{u.username}</strong>
                  <div style={{ fontSize: "12px", color: "#999", marginTop: "3px" }}>
                    🔒 End-to-end encrypted
                  </div>
                </div>
                <button style={{ width: "auto", padding: "8px 20px" }}>
                  Open Chat
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── CHAT VIEW (conversation open) ─────────────────────────────────────────
  return (
    <div className="chat-container">

      {/* Top header */}
      <div className="header">
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => setSelectedUser(null)}
            style={{ width: "auto", padding: "8px 14px", background: "#6c757d" }}
          >
            ← Back
          </button>
          <div>
            <strong>{selectedUser.username}</strong>
            <div style={{ fontSize: "12px", color: "#27ae60" }}>
              🔒 End-to-end encrypted
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "14px", color: "#555" }}>
            👤 {currentUser.username}
          </span>
          <button
            onClick={handleLogout}
            style={{ width: "auto", padding: "8px 16px" }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* E2EE notice bar */}
      <div style={{
        background: "#f0fff4",
        border: "1px solid #c3e6cb",
        borderRadius: "8px",
        padding: "8px 14px",
        fontSize: "13px",
        color: "#2d6a4f",
        marginBottom: "4px",
      }}>
        🔒 Messages are end-to-end encrypted. Only you and {selectedUser.username} can read them.
      </div>

      {/* Messages list */}
      <div className="messages-area">
        {loadingMsgs ? (
          <p style={{ textAlign: "center", color: "#999", marginTop: "40px" }}>
            Decrypting messages...
          </p>
        ) : messages.length === 0 ? (
          <p style={{ textAlign: "center", color: "#999", marginTop: "40px" }}>
            🔐 No messages yet. Say hello!
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.isOwn ? "mine" : "other"}`}
            >
              {/* Show sender name on received messages */}
              {!msg.isOwn && (
                <div style={{ fontSize: "11px", color: "#999", marginBottom: "3px" }}>
                  {selectedUser.username}
                </div>
              )}

              <span className="bubble">
                {msg.decryptFail
                  ? <em style={{ color: "#999", fontSize: "13px" }}>🔓 Could not decrypt</em>
                  : msg.text
                }
              </span>

              <div style={{
                fontSize: "10px",
                color: "#aaa",
                marginTop: "4px",
                textAlign: msg.isOwn ? "right" : "left",
              }}>
                {formatTime(msg.timestamp)} · {msg.decryptFail ? "🔓" : "🔒"}
              </div>
            </div>
          ))
        )}
        {/* Invisible anchor — scrolled to on new messages */}
        <div ref={messagesEndRef} />
      </div>

      {/* Send error */}
      {sendError && (
        <p style={{ color: "red", fontSize: "13px", margin: "4px 0" }}>
          ⚠️ {sendError}
        </p>
      )}

      {/* Compose row */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <input
          type="text"
          placeholder={`Message ${selectedUser.username}...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          style={{ margin: 0, flex: 1 }}
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          style={{ width: "auto", padding: "12px 20px", margin: 0, flexShrink: 0 }}
        >
          {sending ? "Sending..." : "Send 🔒"}
        </button>
      </div>

      <p style={{ fontSize: "11px", color: "#aaa", textAlign: "center", marginTop: "6px" }}>
        🔒 AES-256-GCM + RSA-2048 encrypted · Enter to send
      </p>

    </div>
  );
}
