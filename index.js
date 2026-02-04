if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
// const ZKJUBAER = require("zk-jubaer");
const session = require("express-session");
const cors = require("cors");
const passport = require("passport"); // authentication
const { initializingPassport } = require("./passportConfig");
const MongoStore = require("connect-mongo");

const userRouter = require("./routes/user");

const mongoose = require("mongoose");

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
const Level = require("./models/level");
const User = require("./models/user");
const { initializeAttendanceProcessing } = require("./db/attendanceDeviceDb");



var app = express();
let isProduction = process.env.NODE_ENV == "production";
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: isProduction
      ? ["https://tca-frontend-sync-git-main-zees-projects-3a466cf5.vercel.app", "https://tca-frontend-sync-git-lms-123-nit-demo-zees-projects-3a466cf5.vercel.app", "https://tca.educativecloud.com", "https://tcsravi.educativecloud.com", "https://tcsshalimar.educativecloud.com", "*"]  // Production URLs only
      : ["http://localhost:5173", "*"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    name: "finSess",
    secret: process.env.TOKEN_SECRET || "IAMCASTUDENT",
    resave: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_CONNECTION,
    }),
    saveUninitialized: true,
    cookie: isProduction
      ? {
        secure: true,
        sameSite: "none",
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
app.use("/api/quiz/", checkLoggedIn, checkSubscription, quizRouter);
app.use("/api/user/", checkLoggedIn, checkSubscription, userRouter);
app.use("/api/class/",
  // checkLoggedIn,
  classRouter);
app.use("/api/subject/", checkLoggedIn, checkSubscription, subjectRouter);
app.use("/api/feedback/", checkLoggedIn, checkSubscription, feedbackRouter);
app.use("/api/classroom/", checkLoggedIn, checkSubscription, classoomRouter);
app.use(
  "/api/classroom/attendence",
  checkLoggedIn,
  attendenceRouter);
app.use("/api/assignment/", checkLoggedIn, checkSubscription, assignmentRouter);
app.use("/api/assignment/", checkLoggedIn, checkSubscription, assignmentRouter);
app.use("/api/settings/", checkLoggedIn, checkSubscription, settingsRouter);
app.use("/api/notification/", checkLoggedIn, checkSubscription, notificationRouter);
app.use("/api/announcement/", checkLoggedIn, checkSubscription, announcementRouter);
app.use("/api/parent", require("./routes/parent"));
app.use("/api/upload/", require("./routes/uploadCSVFile"));
app.use("/api/chatroom/", checkLoggedIn, checkSubscription, require("./routes/chatroom"));
app.use("/webhook", require("./routes/whatsapp/whatsapp"));
app.use("/api/admin/", checkLoggedIn, checkSubscription, promoteRouter);




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
    const levels = await Level.find();
    const users = await User.find();

    res.status(200).send({
      success: true,
      data: levels,
      user: users
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




const db = process.env.MONGO_CONNECTION;
mongoose.connect(
  db,
  { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: true, tlsAllowInvalidCertificates: true },
  (err) => {
    if (err) {
      console.log(err);
    } else {
      initializeAttendanceProcessing();
      console.log("Connected to MongoDB");
    }
  }
);
var port = isProduction ? 443 : 4000;
const sslOptions = isProduction
  ? {
    key: fs.readFileSync("/etc/letsencrypt/live/tca.educativecloud.com/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/tca.educativecloud.com/fullchain.pem"),
  }
  : undefined;
var server = isProduction
  ? https.createServer(sslOptions, app)
  : http.createServer(app);
io.attach(server);
server.listen(port, () => {
  if (isProduction) {
    console.log(`AWS Server is running on port ${443}`);
  } else {
    console.log(`Server is running on port ${port}`);
  }
});
isProduction &&
  http
    .createServer((req, res) => {
      res.writeHead(301, {
        Location: "https://" + req.headers["host"] + req.url,
      });
      res.end();
    })
    .listen(80);
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










