let userId = null;
let userName = null;
let userEmail = null;

export const setUserSession = (uid, name, email) => {
  userId = uid;
  userName = name;
  userEmail = email;
};

export const clearSession = () => {
  userId = null;
  userName = null;
  userEmail = null;
};

// Keep setUserId for backward compatibility
export const setUserId = (uid) => { userId = uid; };

export const getUserId    = () => userId;
export const getUserName  = () => userName;
export const getUserEmail = () => userEmail;
