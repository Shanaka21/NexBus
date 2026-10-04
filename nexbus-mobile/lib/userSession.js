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

export const setUserId   = (uid)  => { userId    = uid;   };
export const setUserName = (name) => { userName  = name;  };

export const getUserId    = () => userId;
export const getUserName  = () => userName;
export const getUserEmail = () => userEmail;
