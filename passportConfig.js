const LocalStrategy = require("passport-local").Strategy;
const prisma = require("./db/prisma");
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
          const normalizedEmail = email.trim().toLowerCase();
          const foundUser = await prisma.user.findUnique({ 
            where: { email: normalizedEmail } 
          });
          console.log(foundUser, "found user data");
          
          if (!foundUser) {
            return done(null, false, { message: "User does not exist" });
          } else {
            const validPass = await bcrypt.compare(
              password,
              foundUser.password
            );
            console.log(validPass, ":password is checking:");
            
            if (!validPass)
              return done(null, false, { message: "The password you entered is incorrect. Please try again." });
            
            if (foundUser.userType !== "admin" && foundUser.userType !== "super_admin" && !foundUser.isAccepted) {
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
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: id }
      });
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  });
};
