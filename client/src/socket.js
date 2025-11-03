// src/socket.js
import { io } from "socket.io-client";

// Use http:// not https://
const SOCKET_URL = "https://auctionplay.onrender.com";

const socket = io(SOCKET_URL, {
  transports: ["websocket"],
});

export default socket;
