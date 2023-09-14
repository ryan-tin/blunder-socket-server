import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app)
const port = 60001;
const io = new Server(server, {
  cors: {
    origin: /http:\/\/localhost:(\d*)/, // REGEX, match all http://localhost:(any num)
    credentials: true
  }
});

const DEBUG = true;

// app.get('/', (req, res) => {
//   res.send('Hello World!');
// });

const lobbyNamespace = io.of("/lobby");

lobbyNamespace.on('connection', (socket) => {
  console.log('A user connected to lobby', socket.id);

  // when a user joins a game, send it out to all others listening on the socket
  socket.on("join game", (message) => {
    console.log("someone joined a game:", message);
    lobbyNamespace.emit("join game", message);
  })

  socket.on('disconnect', (reason) => {
    console.log(`A user disconnected lobby: ${reason}`);
  })
});


// use rooms for games
const game = io.of("/game");
game.on('connection', (socket) => {
  if (DEBUG) {
    console.log(`joined game ${socket.id}`)
  }

  socket.on('join room', (roomId) => {
    if (DEBUG) {
      console.log(`join request for room <${roomId}>`);
    }
    // client will remember what room it has joined
    socket.join(roomId);
  })

  // recieving a sent move is relayed to all others in that room
  socket.on('send move', ({ roomId, FEN, lastMove }) => {
    if (DEBUG) {
      console.log('roomId', roomId);
      console.log('FEN', FEN);
      console.log('lastMove', lastMove);
    }
    socket.to(roomId).emit('send move', { FEN: FEN, lastMove: lastMove });
  })

  socket.on('disconnect', (reason) => {
    if (DEBUG) {
      console.log(`<${socket.id}> disconnected game: [${reason}]`);
    }
  })
})


server.listen(port, () => {
  return console.log(`Express is listening at *:${port}`);
});
