// const { google } = require("googleapis");
// const key = require("./secrets/googleapi.json");

// // const calendar = google.calendar("v3");

// const jwtClient = new google.auth.JWT(key.client_email, null, key.private_key, [
//   "https://www.googleapis.com/auth/calendar",
// ]);

// jwtClient.authorize((err, tokens) => {
//   if (err) {
//     console.error("Error authorizing the JWT client:", err);
//     return;
//   }

//   // Now that the client is authorized, you can make API requests
//   createMeeting(jwtClient);
// }); 

// async function createMeeting(auth) {
//   const calendar = google.calendar({ version: "v3", auth: auth });
//   const event = {
//     summary: "Meeting Title",
//     start: {
//       dateTime: "2022-02-24T15:25:00Z",
//       timeZone: "UTC",
//     },
//     end: {
//       dateTime: "2022-02-24T15:35:00Z",
//       timeZone: "UTC",
//     },
//     conferenceData: {
//       createRequest: {
//         requestId: "1238123102",
//       },
//       conferenceSolution: {
//         key: {
//           type: "hangoutsMeet",
//         },
//       },
//     },
//     attendees: [{ email: "mustafahassan058@gmail.com" }],
//     reminders: {
//       useDefault: false,
//       overrides: [
//         { method: "email", minutes: 24 * 60 },
//         { method: "popup", minutes: 10 },
//       ],
//     },
//   };

//   calendar.events.insert(
//     {
//       conferenceDataVersion: 1,
//       calendarId: "primary",
//       resource: event,
//     },
//     (err, res) => {
//       if (err) {
//         console.error(err.response.data.error);
//         return;
//       }

//       console.log("Event created:", res.data);
//       console.log("Meeting link:", res.data.hangoutLink);
//     }
//   );
// }
console.log(new Date());

const express = require("express");
const { google } = require("googleapis");
const { OAuth2Client } = require("google-auth-library");
const fs = require("fs").promises;

const app = express();
const PORT = 3000;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/admin.reports.audit.readonly",
];

const credentialsPath = "./secrets/backup.json";

let oauth2Client;

async function authorize() {
  const credentials = await fs.readFile(credentialsPath);
  const { client_secret, client_id, redirect_uris } =
    JSON.parse(credentials).web;
  oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  try {
    const token = await fs.readFile("./secrets/token.json");
    oauth2Client.setCredentials(JSON.parse(token));
  } catch (err) {
    await getNewToken();
  }
}

async function getNewToken() {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log(`Authorize this app by visiting this URL: ${authUrl}`);
  const code =
    "4/0AeaYSHDdqfn-J834QdZOqxZR2H46saoBDvOMG1cJj2h-hS74yPiTXhQ1TpE-3K_cRmnTjw"; // Paste the code from the authorization page here
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  await fs.writeFile("./secrets/token.json", JSON.stringify(tokens));
  console.log("Token stored to", "./secrets/token.json");
}

app.get("/create-event", async (req, res) => {
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const event = {
      summary: "Sample Event",
      start: {
        dateTime: "2024-02-25T10:00:00",
        timeZone: "UTC",
      },
      end: {
        dateTime: "2024-02-25T12:00:00",
        timeZone: "UTC",
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    res.json(response.data);
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).send("Internal Server Error");
  }
});
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  authorize();
});
