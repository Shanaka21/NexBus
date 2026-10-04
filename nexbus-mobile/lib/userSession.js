let userId = null;
let userName = null;
let userEmail = null;
let role = null;
let operatorId = null;
let idToken = null;
let refreshToken = null;

const cleanups = [];
// Other modules (e.g. the Firebase session) register work to run when the user signs out
export const onSessionCleared = (fn) => { cleanups.push(fn); };

export const setUserSession = (uid, name, email, extra = {}) => {
  userId = uid;
  userName = name;
  userEmail = email;
  role = extra.role || "passenger";
  operatorId = extra.operatorId || null;
  if (extra.idToken) idToken = extra.idToken;
  if (extra.refreshToken) refreshToken = extra.refreshToken;
};

export const setTokens = ({ idToken: id, refreshToken: refresh }) => {
  if (id) idToken = id;
  if (refresh) refreshToken = refresh;
};

export const clearSession = () => {
  userId = null;
  userName = null;
  userEmail = null;
  role = null;
  operatorId = null;
  idToken = null;
  refreshToken = null;
  cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
};

export const setUserId   = (uid)  => { userId    = uid;   };
export const setUserName = (name) => { userName  = name;  };

export const getUserId       = () => userId;
export const getUserName     = () => userName;
export const getUserEmail    = () => userEmail;
export const getRole         = () => role;
export const getOperatorId   = () => operatorId;
export const getIdToken      = () => idToken;
export const getRefreshToken = () => refreshToken;
