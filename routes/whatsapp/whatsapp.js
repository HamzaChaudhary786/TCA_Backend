// const { fillTenantInfo } = require("../../middlewares/fillTenantInfo");
const whatsappRouter = require("express").Router();
const whatsappController = require("../../controllers/whatsapp/whatsapp");




// whatsappRouter.param("tenant", fillTenantInfo);

whatsappRouter.post("/", whatsappController.createWebHook);
whatsappRouter.get("/", whatsappController.getWebHook);
whatsappRouter.post("/broadcast",
    // checkIsAdmin,
    whatsappController.sendAdminBroadcast);
module.exports = whatsappRouter;
