const leveController = require("../controllers/level");
const levelRouter = require("express").Router();

levelRouter.post("/", leveController.createLevel);
levelRouter.get("/", leveController.getLevels);
levelRouter.put("/:id", leveController.updateLevel);
levelRouter.delete("/:id", leveController.deleteLevel);

module.exports = levelRouter;
