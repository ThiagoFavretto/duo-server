const { salas } = require("../data/sala");

function proximoJogador(sala) {
  const indexAtual = sala.jogadores.findIndex(
    j => j.id === sala.jogadorAtual
  );

  let novoIndex = indexAtual + sala.sentido;

  if (novoIndex >= sala.jogadores.length) novoIndex = 0;
  if (novoIndex < 0) novoIndex = sala.jogadores.length - 1;

  sala.jogadorAtual = sala.jogadores[novoIndex].id;
}

function obterProximoJogador(sala) {
  const indexAtual = sala.jogadores.findIndex(
    j => j.id === sala.jogadorAtual
  );

  let novoIndex = indexAtual + sala.sentido;

  if (novoIndex >= sala.jogadores.length) novoIndex = 0;
  if (novoIndex < 0) novoIndex = sala.jogadores.length - 1;

  return sala.jogadores[novoIndex];
}

function aplicarCompraAcumulada(sala, qtd, req) {
  let proximo = obterProximoJogador(sala);
  const temAcumulavel = proximo.cartas.some(c => c.valor === `+${qtd}`);

  if (temAcumulavel) {
    sala.acumulador = (sala.acumulador || 0) + qtd;
  } else {
    const total = (sala.acumulador || 0) + qtd;
    for (let i = 0; i < total; i++) {
      if (sala.baralho.length == 0) {
        sala.baralho = sala.descarte.slice(0, -1);
        sala.descarte = [sala.descarte[sala.descarte.length - 1]]

        sala.baralho.sort(() => Math.random() - 0.5);
      }

      proximo.cartas.push(sala.baralho.shift());
    }

    sala.acumulador = 0;

    const socketId = req.connectUsers[proximo.id];

    req.io.to(socketId).emit("suasCartas", {
      cartas: proximo.cartas
    });

    proximoJogador(sala);
  }
}

module.exports = {
  async comecar(req, res) {
    const codigoJogador = req.headers["codigojogador"];
    const { codigoSala } = req.params;

    const sala = salas.find(s => s.codigoSala === codigoSala);

    if (!sala) {
      return res.status(404).json({ erro: "Sala não encontrada" });
    }

    if (sala.jogadores.length < 2) {
      return res.status(400).json({ erro: "Mínimo 2 jogadores" });
    }

    const player = sala.jogadores.find(j => j.id === codigoJogador);

    if (!player.host) {
      return res.status(404).json({ erro: "Apenas o host pode começar" });
    }

    const cores = ["#D72600", "#0956BF", "#379711", "#ECD407"];
    const valores = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "pular", "inverter", "+2"];

    const baralho = [];

    cores.forEach(cor => {
      valores.forEach(valor => {
        baralho.push({ cor, valor });
        if (valor !== "0") {
          baralho.push({ cor, valor });
        }
      });
    });

    for (let i = 0; i < 4; i++) {
      baralho.push({ cor: "#000", valor: "coringa" });
      baralho.push({ cor: "#000", valor: "+4" });
    }

    baralho.sort(() => Math.random() - 0.5);

    sala.jogadores.forEach(jogador => {
      jogador.cartas = baralho.splice(0, 7);
    });

    sala.baralho = baralho;

    const isNumero = (valor) => /^[0-9]$/.test(valor);

    let indicePrimeiraNumerica = sala.baralho.findIndex(carta =>
      isNumero(carta.valor) && carta.cor !== "#000"
    );

    if (indicePrimeiraNumerica === -1) {
      throw new Error("Nenhuma carta numérica encontrada no baralho.");
    }

    const primeiraCarta = sala.baralho.splice(indicePrimeiraNumerica, 1)[0];

    sala.descarte = [primeiraCarta];
    sala.jogadorAtual = sala.jogadores[Math.floor(Math.random() * sala.jogadores.length)].id;
    sala.sentido = 1;
    sala.status = "jogando";

    sala.jogadores.forEach(jogador => {
      const socketId = req.connectUsers[jogador.id];

      req.io.to(socketId).emit("suasCartas", {
        cartas: jogador.cartas
      });
    });

    req.io.to(codigoSala).emit("partidaIniciada", {
      cartaMesa: sala.descarte[0],
      jogadorAtual: sala.jogadorAtual
    });

    return res.json({ ok: true });
  },

  async jogarCarta(req, res) {
    const { codigoSala, carta } = req.body;
    const codigoJogador = req.headers["codigojogador"];

    const sala = salas.find(s => s.codigoSala === codigoSala);

    if (!sala) return res.status(404).json({ erro: "Sala não encontrada" });

    if (sala.jogadorAtual !== codigoJogador) {
      return res.status(400).json({ erro: "Não é sua vez" });
    }

    const jogador = sala.jogadores.find(j => j.id === codigoJogador);

    const cartaSala = sala.descarte[sala.descarte.length - 1];

    if (sala.acumulador > 0) {
      if (carta.valor != cartaSala.valor) {
        return res.status(400).json({ erro: "Cor ou numero errado" });
      }
    } else if ((carta.valor != "coringa" && carta.valor != "+4") && carta.cor != cartaSala.cor && carta.valor != cartaSala.valor) {
      return res.status(400).json({ erro: "Cor ou numero errado" });
    }

    if (sala.status == "coringa") {
      if (!carta.cor || carta.cor == "#000") {
        return res.status(400).json({ erro: "Selecione uma cor" });
      }

      sala.descarte[sala.descarte.length - 1].cor = carta.cor
    } else {
      const indexCarta = jogador.cartas.findIndex(
        c => c.cor === carta.cor && c.valor === carta.valor
      );

      if (indexCarta === -1) {
        return res.status(400).json({ erro: "Você não tem essa carta" });
      }

      sala.descarte.push(carta);
      jogador.cartas.splice(indexCarta, 1);

      if (jogador.cartas.length == 0) {

        req.io.to(codigoSala).emit("ganhador", {
          ganhador: jogador.nick
        });

        atualizarMesa(codigoSala, req);
        return res.json({ ok: true });
      }

      if ((carta.valor == "coringa" || carta.valor == "+4") && carta.cor == "#000") {
        sala.status = "coringa";
        const socketId = req.connectUsers[jogador.id];

        req.io.to(socketId).emit("coringaJogado");

        atualizarMesa(codigoSala, req);

        return res.json({ ok: true });
      }
    }

    sala.status = "jogando";

    switch (carta.valor) {
      case "inverter":
        if (sala.jogadores.length > 2) {
          sala.sentido *= -1;
          proximoJogador(sala);
        } else {
          proximoJogador(sala);
          proximoJogador(sala);
        }
        break;

      case "pular":
        proximoJogador(sala);
        proximoJogador(sala);
        break;

      case "+2":
        aplicarCompraAcumulada(sala, 2, req);
        proximoJogador(sala);
        break;

      case "+4":
        aplicarCompraAcumulada(sala, 4, req);
        proximoJogador(sala);
        break;

      default:
        proximoJogador(sala);
        break;
    }

    atualizarMesa(codigoSala, req);

    return res.json({ ok: true });
  },

  async comprarCarta(req, res) {
    const codigoJogador = req.headers["codigojogador"];
    const { codigoSala } = req.params;

    const sala = salas.find(s => s.codigoSala === codigoSala);

    if (!sala) return res.status(404).json({ erro: "Sala não encontrada" });

    if (sala.jogadorAtual !== codigoJogador) {
      return res.status(400).json({ erro: "Não é sua vez" });
    }

    const jogador = sala.jogadores.find(j => j.id === codigoJogador);

    const total = sala.acumulador > 0 ? sala.acumulador : 1
    for (let i = 0; i < total; i++) {
      if (sala.baralho.length == 0) {
        sala.baralho = sala.descarte.slice(0, -1);
        sala.descarte = [sala.descarte[sala.descarte.length - 1]]

        baralho.sort(() => Math.random() - 0.5);
      }

      jogador.cartas.push(sala.baralho.shift());
    }

    sala.acumulador = 0;

    const socketId = req.connectUsers[jogador.id];

    req.io.to(socketId).emit("suasCartas", {
      cartas: jogador.cartas
    });

    proximoJogador(sala);

    atualizarMesa(codigoSala, req);

    return res.json({ ok: true });
  }
};

function atualizarMesa(codigoSala, req) {
  const sala = salas.find(s => s.codigoSala === codigoSala);

  const listaJogador = sala.jogadores.map(jogador => ({
    id: jogador.id,
    cartasJogadorRestante: jogador.cartas.length
  }));

  req.io.to(codigoSala).emit("atualizarMesa", {
    jogadores: listaJogador,
    jogadorAtual: sala.jogadorAtual,
    cartaMesa: sala.descarte[sala.descarte.length - 1],
    acumulador: sala.acumulador
  });
}
