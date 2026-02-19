const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const httpServer = express();
const server = require("http").Server(httpServer);
const { salas } = require("./data/sala");

const prod = true
const io = require("socket.io")(server, {
  cors: {
    origin: prod ? "https://duo-web2.netlify.app" : "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const connectUsers = {};

io.on("connection", socket => {
  const { codigoJogador, codigoSala } = socket.handshake.query;

  if (codigoSala) {
    const sala = salas.find(s => s.codigoSala === codigoSala);

    if (sala) {
      socket.join(codigoSala);
      connectUsers[codigoJogador] = socket.id;

      console.log(`Usuário ${codigoJogador} entrou na sala ${codigoSala}`);

      socket.emit("novoJogador", sala.jogadores);
    }
  }

  socket.on("disconnect", () => {
    const salaIndex = salas.findIndex(s => s.codigoSala === codigoSala);

    if (salaIndex !== -1) {
      const sala = salas[salaIndex];

      sala.jogadores = sala.jogadores.filter(
        j => j.id !== codigoJogador
      );

      if (sala.jogadores.length === 0) {
        salas.splice(salaIndex, 1);
      } else {
        io.to(codigoSala).emit("novoJogador", sala.jogadores);
      }
    }

    delete connectUsers[codigoJogador];

    console.log(`Usuário ${codigoJogador} desconectou`);
  });
});



httpServer.use((req, res, next) => {
  req.io = io;
  req.connectUsers = connectUsers;
  return next();
});

httpServer.use(cors());
httpServer.use(express.json());
httpServer.use(routes);

server.listen(process.env.PORT || 3333);