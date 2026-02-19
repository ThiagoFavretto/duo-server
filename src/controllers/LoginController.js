const { salas } = require("../data/sala");
const crypto = require('crypto');

module.exports = {
  async criar(req, res) {
    const { nick } = req.body;

    const codigoSala = crypto.randomBytes(5)
      .toString('base64')
      .replace(/[^A-Z0-9]/gi, '')
      .substring(0, 5)
      .toUpperCase();

    const codigoJogador = crypto.randomUUID()

    salas.push({
      codigoSala,
      jogadores: [{
        nick,
        id: codigoJogador,
        host: true
      }]
    })

    return res.json({ codigoSala, codigoJogador });
  },

  async entrar(req, res) {
    const { nick, codigoSala } = req.body;

    const sala = salas.find(s => s.codigoSala === codigoSala);

    if (!sala) {
      return res.status(404).json({ erro: "Sala não encontrada" });
    }

    const codigoJogador = crypto.randomUUID()

    sala.jogadores.push({
      nick,
      id: codigoJogador,
      host: false
    });

    req.io.to(codigoSala).emit("novoJogador", sala.jogadores);

    return res.json({ codigoSala, codigoJogador });
  },



};