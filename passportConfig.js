const LocalStrategy = require("passport-local").Strategy;

const User = require("./models/user");
const bcrypt = require("bcryptjs");

exports.initializingPassport = (passport) => {
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true, // Pass the entire request object to the callback
      },
      async (req, email, password, done) => {
        try {
          const foundUser = await User.findOne({ email: email });
          console.log(foundUser ,"found user data");
          
          if (!foundUser) {
            return done(null, false, { message: "User does not exist" });
          } else {
            // if (foundUser.userType === "parent") {

            //   const user = await User.findOne({ guardianEmail: email })

            //   console.log(user ,"user hehhehe");
              
            //   // if (!req.body.currentStudentID) {
            //   //   return done(null, false, {
            //   //     message: "Please provide the current student ID",
            //   //   });
            //   // }
            //   // check if student has guardian with the email provided
            //   const student = await User.findOne({
            //     _id: user._id,
            //     guardianEmail: email,
            //   });
            //   if (!student) {
            //     return done(null, false, { message: "Student does not exist" });
            //   }

            //   return done(null, {
            //     ...foundUser._doc,
            //     studentID: user._id,
            //   });
            // }
            const validPass = await bcrypt.compare(
              password,
              foundUser.password
            );
            console.log(validPass ,":password is checkinf:");
            
            if (!validPass)
              return done(null, false, { message: "The password you entered is incorrect. Please try again." });
            
            if (foundUser.userType !== "admin" && !foundUser.isAccepted) {
              return done(null, false, { message: "Account pending admin approval" });
            }
            
            return done(null, foundUser);
          }
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );

  passport.serializeUser(async (user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  });
};
