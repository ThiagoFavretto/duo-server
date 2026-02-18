const express = require("express");

const LoginController = require("./controllers/LoginController");
const GameController = require("./controllers/GameController");

const routes = express.Router();

routes.post("/login/criar", LoginController.criar);
routes.post("/login/entrar", LoginController.entrar);

routes.get("/game/comecar/:codigoSala", GameController.comecar);

module.exports = routes;