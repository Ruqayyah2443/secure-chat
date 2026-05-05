// import { useState } from 'react';
// import Login from './pages/Login';
// import Register from './pages/Register';
// import Chat from './pages/Chat';
// import { storage } from './utils/storage';

// function App() {
//   const [isLoggedIn, setIsLoggedIn] = useState(!!storage.getToken());

//   const handleAuthSuccess = () => setIsLoggedIn(true);

//   const handleLogout = () => {
//     storage.clear();
//     setIsLoggedIn(false);
//   };

//   return (
//     <div className="min-h-screen">
//       {!isLoggedIn ? (
//         <div style={{ 
//           display: 'flex', 
//           gap: '40px', 
//           padding: '60px 20px', 
//           justifyContent: 'center',
//           flexWrap: 'wrap'
//         }}>
//           <Login onLogin={handleAuthSuccess} />
//           <Register onRegister={handleAuthSuccess} />
//         </div>
//       ) : (
//         <Chat onLogout={handleLogout} />
//       )}
//     </div>
//   );
// }

// export default App;

import { useState, useEffect } from "react";
import Login    from "./pages/Login";
import Register from "./pages/Register";
import Chat     from "./pages/Chat";
import { storage }          from "./utils/storage";
import { importPrivateKey } from "./crypto/crypto";

export default function App() {
  const [page,        setPage]        = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [privateKey,  setPrivateKey]  = useState(null);

  // Restore session on page refresh
  useEffect(() => {
    const restore = async () => {
      const token = storage.getToken();
      const user  = storage.getUser();
      if (!token || !user) return;

      try {
        const privateKeyBase64 = await storage.getPrivateKey(user.id);
        if (!privateKeyBase64) return;
        const key = await importPrivateKey(privateKeyBase64);
        setCurrentUser(user);
        setPrivateKey(key);
        setPage("chat");
      } catch {
        storage.clearSession();
      }
    };
    restore();
  }, []);

  const handleLogin = (user, key) => {
    setCurrentUser(user);
    setPrivateKey(key);
    setPage("chat");
  };

  const handleRegister = (user, key) => {
    setCurrentUser(user);
    setPrivateKey(key);
    setPage("chat");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setPrivateKey(null);
    setPage("login");
    storage.clearSession();
  };

  return (
    <>
      {page === "login" && (
        <Login
          onLogin={handleLogin}
          onGoToRegister={() => setPage("register")}
        />
      )}
      {page === "register" && (
        <Register
          onRegister={handleRegister}
          onGoToLogin={() => setPage("login")}
        />
      )}
      {page === "chat" && currentUser && privateKey && (
        <Chat
          currentUser={currentUser}
          privateKey={privateKey}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
