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
    console.log(`disconnected lobby: ${reason}`);
  })
});


interface timeKeeperValue {
  white: number // time remaining for white
  whiteIntervalId: NodeJS.Timeout
  black: number
  blackIntervalId: NodeJS.Timeout
  increment: number // increment per move
}

// stores needed values for keeping track of both player's times
// key is the roomId
// value is an object
const time = new Map() as Map<string, timeKeeperValue>;

const game = io.of("/game");
game.on('connection', (socket) => {
  console.log('connected to game', socket.id);

  socket.on('game setup', (roomId, timeControl) => {
    // on game initialization, store data needed to keep track of each player's time in Map
    if (!time.has(roomId)) {
      time.set(roomId, {
        white: timeControl.totalTime * 60, // time remaining in seconds
        whiteIntervalId: null,
        black: timeControl.totalTime * 60,
        blackIntervalId: null,
        increment: parseInt(timeControl.increment),
      });
    }
    // TODO: delete this roomId when the game is over so that the roomId
    // can be reused
    // overwrite no matter what?
  })

  // recieving a sent move is relayed to all others in that room
  socket.on('send move', (message) => {
    // console.log("message", message);
    // relay message to everyone in the lobby
    game.emit('send move', message);

    // start ticking opponent's clock and increment own clock
    if (message.sentBy === 'b') {
      // start ticking white's clock
      time.set(message.roomId, {
        ...time.get(message.roomId),
        whiteIntervalId: setInterval(() => {
          // decrement white's time by 1 every second
          time.set(message.roomId, {
            ...time.get(message.roomId),
            white: time.get(message.roomId).white - 1
          })

          // send updated server time to client!
          game.emit('time', {
            roomId: message.roomId,
            white: time.get(message.roomId).white,
            black: time.get(message.roomId).black
          })

        }, 1000),
        black: time.get(message.roomId).black + time.get(message.roomId).increment
      })
      clearInterval(time.get(message.roomId).blackIntervalId);
    } else {
      // start ticking black's clock
      time.set(message.roomId, {
        ...time.get(message.roomId),
        blackIntervalId: setInterval(() => {
          // decrement black's time by 1 every second
          time.set(message.roomId, {
            ...time.get(message.roomId),
            black: time.get(message.roomId).black - 1
          })

          // send updated server time to client!
          game.emit('time', {
            roomId: message.roomId,
            white: time.get(message.roomId).white,
            black: time.get(message.roomId).black
          })

        }, 1000),
        white: time.get(message.roomId).white + time.get(message.roomId).increment
      })
      clearInterval(time.get(message.roomId).whiteIntervalId);
    }
  })

  // server updated for time is relayed to everyone in that room
  socket.on('time', (message: any) => {
    game.emit('time', message);
  })

  socket.on('disconnect', (reason) => {
    console.log(`<${socket.id}> disconnected game: [${reason}]`);
  })
})

server.listen(port, () => {
  return console.log(`Express is listening at *:${port}`);
});
