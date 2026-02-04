const express = require("express");
const authRouter = express.Router();
const controller = require("../controllers/user");

// Login route
authRouter.post("/login", controller.login);

// Register route
authRouter.post("/register", controller.register);

module.exports = authRouter;
