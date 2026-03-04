import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}
const token = getCookie('access_token');
export const socket = io({
      auth:                 { token },
      reconnection:         true,
      reconnectionDelay:    3000,
      reconnectionAttempts: 10
    });