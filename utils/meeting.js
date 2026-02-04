const { OAuth2Client } = require("google-auth-library");
const fs = require("fs");
const { google } = require("googleapis");

exports.createMeeting = async () => {
  try {
    let oauth2Client;
    const credentials = fs.readFileSync("./secrets/backup.json");
    const { client_secret, client_id, redirect_uris } =
      JSON.parse(credentials).web;
    oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token..

    const token = fs.readFileSync("./secrets/token.json");
    oauth2Client.setCredentials(JSON.parse(token));

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const event = {
      summary: "Meeting with client",
      location: "Location",
      description: "Description",
      start: {
        dateTime: "2024-02-25T02:47:00-07:00",
        // pakistan time zone
        timeZone: "Asia/Karachi",
      },
      end: {
        dateTime: "2024-02-25T02:47:00-07:00",
        // pakistan time zone
        timeZone: "Asia/Karachi",
      },

      conferenceData: {
        createRequest: {
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
          requestId: "random-request-id",
        },
      },
      attendees: [{ email: "mustafahassan09999@gmail.com" }],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 10 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      conferenceDataVersion: 1,
    });

    console.log("Event created:", response.data);
  } catch (err) {
    console.error("Error creating event:", err);
  }
};

// id = b2k83ob9961ursu8kh872fueac
// conferenceId = nas-atji-yzq

// id = 0b81ok45clcdrd4oahaur039dk
// conferenceId = bgv-tsog-rwo

// get meeting details
exports.getMeetingDetails = async () => {
  try {
    let oauth2Client;
    const credentials = fs.readFileSync("./secrets/backup.json");
    const { client_secret, client_id, redirect_uris } =
      JSON.parse(credentials).web;
    oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.

    const token = fs.readFileSync("./secrets/token.json");
    oauth2Client.setCredentials(JSON.parse(token));

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const response = await calendar.events.get({
      calendarId: "primary",
      eventId: "0b81ok45clcdrd4oahaur039dk",
      conferenceDataVersion: 1,
    });

    // get users in meeting
    const reports = google.admin({ version: "reports_v1", auth: oauth2Client });
    console.log(
      await reports.activities.list({
        userKey: "all",
        applicationName: "meet",
        eventName: "call_ended",
        maxResults: 100,
        filters: `meeting_code==nas-atji-yzq`,
      })
    );

    // console.log("Meeting details:", response.data);
  } catch (err) {
    console.error("Error getting meeting details:", err);
  }
};

// exports.getMeetingDetails = async (req, res) => {
//   try {
//     let oauth2Client;
//     const credentials = fs.readFileSync("./secrets/backup.json");
//     const { client_secret, client_id, redirect_uris } =
//       JSON.parse(credentials).web;
//     oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

//     // Check if we have previously stored a token.

//     const token = fs.readFileSync("./secrets/token.json");
//     oauth2Client.setCredentials(JSON.parse(token));

//     const reports = google.admin({ version: "reports_v1", auth: oauth2Client });

//     // Example: Get information about participants in a specific meeting
//     const meetingCode = "nas-atji-yzq"; // Replace with the actual meeting code

//     reports.activities.list(
//       {
//         userKey: "all",
//         applicationName: "meet",
//         eventName: "call_ended",
//         maxResults: 100,
//         filters: `meeting_code==${meetingCode}`,
//       },
//       (err, res) => {
//         if (err) {
//           console.error("Error fetching reports:", err);
//           return;
//         }

//         console.log("Meeting Report:", res.data);
//       }
//     );
//   } catch (err) {
//     console.error("Error getting event details:", err);
//   }
// };
