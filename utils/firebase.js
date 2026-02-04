var admin = require("firebase-admin");

var serviceAccount = require("../config/tca-backend-454ca-firebase-adminsdk-hijr9-7aec9a2b1e.json");

exports.admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
