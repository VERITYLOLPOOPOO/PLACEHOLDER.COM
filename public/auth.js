(() => {
  const USERS_KEY = 'placeholder-users-v1';
  const SESSION_KEY = 'placeholder-session-v1';

  const readUsers = () => {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch { return []; }
  };

  const writeUsers = users => localStorage.setItem(USERS_KEY, JSON.stringify(users));
  const getSession = () => localStorage.getItem(SESSION_KEY) || '';
  const setSession = email => localStorage.setItem(SESSION_KEY, email.toLowerCase());
  const clearSession = () => localStorage.removeItem(SESSION_KEY);
  const currentUser = () => {
    const email = getSession();
    return email ? readUsers().find(user => user.email === email) || null : null;
  };

  const bytesToHex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const hexToBytes = hex => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  async function passwordHash(password, saltHex) {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const saltBytes = hexToBytes(saltHex);
    const combined = new Uint8Array(saltBytes.length + passwordBytes.length);
    combined.set(saltBytes);
    combined.set(passwordBytes, saltBytes.length);
    const digest = await crypto.subtle.digest('SHA-256', combined);
    return bytesToHex(new Uint8Array(digest));
  }

  function makeDefaultAvatar(name) {
    const initial = (name || 'P').trim().charAt(0).toUpperCase().replace(/[<>&"']/g, '') || 'P';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#20242b"/><circle cx="80" cy="80" r="70" fill="#f4f4f4"/><text x="80" y="102" text-anchor="middle" font-family="Arial,sans-serif" font-size="72" font-weight="700" fill="#111820">${initial}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function resizeAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve('');
      if (!file.type.startsWith('image/')) return reject(new Error('Choose an image file.'));
      if (file.size > 5 * 1024 * 1024) return reject(new Error('Profile picture must be under 5 MB.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that image.'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('Could not open that image.'));
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 160;
          const ctx = canvas.getContext('2d');
          const side = Math.min(image.width, image.height);
          const sx = (image.width - side) / 2;
          const sy = (image.height - side) / 2;
          ctx.drawImage(image, sx, sy, side, side, 0, 0, 160, 160);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function register({ name, email, password, avatar, language }) {
    name = name.trim();
    email = email.trim().toLowerCase();
    if (!name || !email || !password) throw new Error('Name, email, and password are required.');
    if (password.length < 6) throw new Error('Use at least 6 characters for this prototype password.');
    const users = readUsers();
    if (users.some(user => user.email === email)) throw new Error('That email already has a local account. Try Log In.');
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = bytesToHex(saltBytes);
    const hash = await passwordHash(password, salt);
    const user = {
      name,
      email,
      salt,
      hash,
      avatar: avatar || makeDefaultAvatar(name),
      language: language || 'English',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeUsers(users);
    setSession(email);
    return user;
  }

  async function login(email, password) {
    email = email.trim().toLowerCase();
    const user = readUsers().find(item => item.email === email);
    if (!user) throw new Error('No local account found for that email.');
    const hash = await passwordHash(password, user.salt);
    if (hash !== user.hash) throw new Error('Wrong password.');
    setSession(email);
    return user;
  }

  function updateCurrentUser(changes) {
    const email = getSession();
    const users = readUsers();
    const index = users.findIndex(user => user.email === email);
    if (index < 0) return null;
    users[index] = { ...users[index], ...changes, email: users[index].email };
    writeUsers(users);
    return users[index];
  }

  function renderNavAuth() {
    document.querySelectorAll('[data-auth-slot]').forEach(slot => {
      const root = slot.dataset.authRoot || '';
      const user = currentUser();
      slot.replaceChildren();
      const link = document.createElement('a');
      link.href = `${root}account/`;
      if (!user) {
        link.className = 'signin-link';
        link.textContent = 'Sign In';
      } else {
        link.className = 'profile-link';
        const img = document.createElement('img');
        img.className = 'nav-avatar';
        img.src = user.avatar || makeDefaultAvatar(user.name);
        img.alt = '';
        const name = document.createElement('span');
        name.textContent = user.name;
        link.append(img, name);
      }
      slot.append(link);
    });
  }

  window.PlaceholderAuth = {
    readUsers,
    currentUser,
    register,
    login,
    logout: clearSession,
    updateCurrentUser,
    resizeAvatar,
    makeDefaultAvatar,
    renderNavAuth
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderNavAuth);
  else renderNavAuth();
})();
