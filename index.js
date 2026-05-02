require("dotenv").config();

const express = require("express");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const requiredEnv = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "SESSION_SECRET",
];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}. Copy .env.example to .env and set values.`);
    process.exit(1);
  }
}

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    (_accessToken, _refreshToken, profile, done) => {
      const email = profile.emails && profile.emails[0] && profile.emails[0].value;
      done(null, {
        id: profile.id,
        displayName: profile.displayName || "User",
        email: email || "",
      });
    }
  )
);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signInPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>DSA Nexus — Sign in</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 4rem auto; padding: 0 1rem; }
    a.button { display: inline-block; margin-top: 1rem; padding: 0.6rem 1rem; background: #1a73e8; color: #fff; text-decoration: none; border-radius: 6px; }
    a.button:hover { background: #1557b0; }
  </style>
</head>
<body>
  <h1>DSA Nexus</h1>
  <p>Sign in with your Google account to continue.</p>
  <a class="button" href="/auth/google">Sign in with Google</a>
</body>
</html>`;
}

function welcomePage(user) {
  const name = escapeHtml(user.displayName);
  const email = user.email ? `<p>${escapeHtml(user.email)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Welcome — DSA Nexus</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 28rem; margin: 4rem auto; padding: 0 1rem; }
  </style>
</head>
<body>
  <h1>Welcome</h1>
  <p>Hello, <strong>${name}</strong>.</p>
  ${email}
  <p>You are signed in.</p>
</body>
</html>`;
}

app.get("/", (req, res) => {
  if (req.user) {
    res.type("html").send(welcomePage(req.user));
    return;
  }
  res.type("html").send(signInPage());
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (_req, res) => {
    res.redirect("/");
  }
);

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
