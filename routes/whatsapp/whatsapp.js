// const { fillTenantInfo } = require("../../middlewares/fillTenantInfo");
const whatsappRouter = require("express").Router();
const whatsappController = require("../../controllers/whatsapp/whatsapp");




// whatsappRouter.param("tenant", fillTenantInfo);

whatsappRouter.post("/:tenant", whatsappController.createWebHook);
whatsappRouter.get("/:tenant", whatsappController.getWebHook);
whatsappRouter.post("/:tenant/broadcast",
    // checkIsAdmin,
    whatsappController.sendAdminBroadcast);
module.exports = whatsappRouter;
