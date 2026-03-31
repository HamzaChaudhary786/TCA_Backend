if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
console.log("Server starting... Gemini API Key:", process.env.GEMINI_API_KEY ? "Present" : "Missing");

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const axios = require("axios");
// const ZKJUBAER = require("zk-jubaer");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport"); // authentication
const { initializingPassport } = require("./passportConfig");
const pgSession = require("connect-pg-simple")(session);
const rateLimit = require("express-rate-limit");

const userRouter = require("./routes/user");

const prisma = require("./db/prisma");

var debug = require("debug")("tyre-project:server");
var http = require("http");
var https = require("https");
var fs = require("fs");
const classoomRouter = require("./routes/classroom");
const announcementRouter = require("./routes/announcements");
const subjectRouter = require("./routes/subject");
const levelRouter = require("./routes/level");
const classRouter = require("./routes/class");
const assignmentRouter = require("./routes/assignment");
const notificationRouter = require("./routes/notification");
const attendenceRouter = require("./routes/attendenceRouter");
const feedbackRouter = require("./routes/feedback");
const promoteRouter = require("./routes/studentPromote");
const quizRouter = require("./routes/quiz");
const { io } = require("./utils/socket");
const { checkLoggedIn } = require("./middlewares/checkLoggedIn");
const { checkSubscription } = require("./middlewares/checkSubscription");
const authRouter = require("./routes/auth");
const settingsRouter = require("./routes/settingsRouter")
const { initializeAttendanceProcessing } = require("./db/attendanceDeviceDb");



var app = express();
app.set("trust proxy", 1);
let isProduction = process.env.NODE_ENV == "production";
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : (isProduction ? ["https://tecveq-frontend.onrender.com"] : ["http://localhost:5173", "http://localhost:4173"]),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    name: "finSess",
    secret: process.env.TOKEN_SECRET || "IAMCASTUDENT",
    resave: false,
    store: new pgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'session'
    }),
    saveUninitialized: true,
    cookie: isProduction
      ? {
        secure: true,
        sameSite: "none",
        httpOnly: true,
      }
      : {
        sameSite: "lax", // "none" for cross-origin, "lax" for development
        httpOnly: true, // Prevent JavaScript access to cookies
      },
  })
);
app.use(passport.initialize());
initializingPassport(passport);
app.use(passport.session());
// api routes
app.use("/api/auth/", authRouter);
app.use("/api/subscription", checkLoggedIn, require("./routes/subscription"));
app.use("/api/level/", levelRouter);
app.use("/api/quiz/", checkLoggedIn, quizRouter);
app.use("/api/user/", checkLoggedIn, userRouter);
app.use("/api/class/",
  checkLoggedIn,
  classRouter);
app.use("/api/subject/", checkLoggedIn, subjectRouter);
app.use("/api/feedback/", checkLoggedIn, feedbackRouter);
app.use("/api/classroom/", checkLoggedIn, classoomRouter);
app.use(
  "/api/classroom/attendence",
  checkLoggedIn,
  attendenceRouter);
app.use("/api/assignment/", checkLoggedIn, assignmentRouter);
app.use("/api/assignment/", checkLoggedIn, assignmentRouter);
app.use("/api/settings/", checkLoggedIn, settingsRouter);
app.use("/api/notification/", checkLoggedIn, notificationRouter);
app.use("/api/announcement/", checkLoggedIn, announcementRouter);
app.use("/api/parent", require("./routes/parent"));
app.use("/api/upload/", require("./routes/uploadCSVFile"));
app.use("/api/media/", checkLoggedIn, require("./routes/upload"));
app.use("/api/chatroom/", checkLoggedIn, require("./routes/chatroom"));
app.use("/webhook", require("./routes/whatsapp/whatsapp"));
app.use("/api/admin/", checkLoggedIn, promoteRouter);
app.use("/api/stats/", checkLoggedIn, require("./routes/stats"));

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3, // 3 requests per minute per user
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after a minute",
  },
});

app.use("/api/chat/", checkLoggedIn, aiLimiter, require("./routes/chat"));





app.get("/", (req, res) => {


  // res.sendFile(path.resolve(__dirname, "public", "index.html"));

  return res.send({
    success: true,
    lastCount: 107,
    count: 108,
    message: "Backend live on AWS!",
  });

});
app.get("/developers", (req, res) => {
  // res.sendFile(path.resolve(__dirname, "public", "index.html"));
  return res.send({
    developers: ["Mustafa", "Muneeb", "Hassan"],
  });
});

//check levels in productions
app.get("/dbHealth", async (req, res) => {
  try {

    res.status(200).send({
      success: true,
      message: "Database connection is healthy and levels data is accessible.",

    });
  } catch (error) {
    console.error("Error fetching levels data:", error.message);
    res.status(500).send({
      success: false,
      message: "Failed to fetch data from the levels collection.",
    });
  }
});




// const runMachine = async () => {
//   let obj = new ZKJUBAER('192.168.80.100', 4370, 5000); // Using TCP port 4370
//   try {
//     // Create socket to machine
//     await obj.createSocket();

//     // Get all logs in the machine
//     const logs = await obj.getAttendances();
//     console.log(logs ,"get all data of this device");

//     // Read real-time logs
//     await obj.getRealTimeLogs((data) => {
//       console.log(data,"real time logs");
//     });

//     // Disconnect from device
//     await obj.disconnect();
//   } catch (e) {
//     console.log(e);
//   }
// };

// runMachine();


// error handler

app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  console.log(err);
  // render the error page
  res.status(err.status || 500);
  res.send(err);
});




// Database connection is handled by Prisma internally, 
// but we ensure it's healthy here.
prisma.$connect()
  .then(() => {
    initializeAttendanceProcessing();
    console.log("Connected to PostgreSQL via Prisma");
  })
  .catch((err) => {
    console.error("Failed to connect to PostgreSQL:", err);
  });
var port = process.env.PORT || (isProduction ? 443 : 4000);
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
const sslOptions = (isProduction && sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath))
  ? {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath),
  }
  : null;

var server = (sslOptions)
  ? https.createServer(sslOptions, app)
  : http.createServer(app);

io.attach(server);
server.listen(port, async () => {
  console.log(`Server is running on port ${port} ${sslOptions ? '(SSL enabled)' : ''}`);

  // Log ngrok URL when running locally (ngrok must be running)
  if (process.env.NODE_ENV !== "production") {
    try {
      const res = await axios.get("http://127.0.0.1:4040/api/tunnels");
      const tunnels = Array.isArray(res.data.tunnels) ? res.data.tunnels : [];
      const httpsTunnel = tunnels.find((t) => t.public_url?.startsWith("https://"));
      const tunnel = httpsTunnel || tunnels[0];

      if (tunnel && tunnel.public_url) {
        console.log(`ngrok public URL: ${tunnel.public_url}`);
        console.log(`Webhook URL: ${tunnel.public_url}/webhook/<tenant>`);
      } else {
        console.log("ngrok tunnel not found. Is ngrok running? (ngrok http <port>)");
      }
    } catch (err) {
      console.log("Unable to query ngrok API (http://127.0.0.1:4040/api/tunnels).", err.message);
    }
  }
});

if (isProduction && sslOptions && process.env.REDIRECT_HTTP !== "false") {
  http
    .createServer((req, res) => {
      res.writeHead(301, {
        Location: "https://" + req.headers["host"] + req.url,
      });
      res.end();
    })
    .listen(80);
}
server.on("error", onError);
server.on("listening", onListening);
function normalizePort(val) {
  var port = parseInt(val, 10);
  if (isNaN(port)) {
    // named pipe
    return val;
  }
  if (port >= 0) {
    // port number
    return port;
  }
  return false;
}
function onError(error) {
  if (error.syscall !== "listen") {
    throw error;
  }
  var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;
  // handle specific listen errors with friendly messages
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires elevated privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + " is already in use");
      process.exit(1);
      break;
    default:
      throw error;
  }
}
function onListening() {
  var addr = server.address();
  var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
  debug("Listening on " + bind);
}










