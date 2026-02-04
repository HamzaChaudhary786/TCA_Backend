const { google } = require("googleapis");
const fs = require("fs").promises;
const path = require("path");

// Define absolute paths to token.json and credentials.json
const BASE_PATH = path.join(__dirname, "../config"); // Change "config" to the folder where your JSON files are located
const TOKEN_PATH = path.join(BASE_PATH, "token.json");
const CREDENTIALS_PATH = path.join(BASE_PATH, "credentials.json");

// Scopes for Google Calendar API
const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

// Load saved credentials if token.json exists
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH, "utf-8");
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.warn("No saved credentials found. Authorization will be required.");
    return null;
  }
}

// Save credentials to token.json after successful authorization
async function saveCredentials(client) {
  try {
    const content = await fs.readFile(CREDENTIALS_PATH, "utf-8");
    const keys = JSON.parse(content);
    const key = keys.web || keys.installed; // Support for both "web" and "installed" keys
    const payload = JSON.stringify({
      type: "authorized_user",
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token,
    }, null, 2); // Pretty-print JSON
    await fs.writeFile(TOKEN_PATH, payload, "utf-8");
    console.log("Credentials saved to token.json.");
  } catch (err) {
    console.error("Failed to save credentials:", err.message);
    throw new Error("Could not save credentials.");
  }
}

// Authorize user with Google OAuth
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    console.log("Using saved credentials.");
    return client;
  }

  try {
    // Load credentials.json
    const credentials = await fs.readFile(CREDENTIALS_PATH, "utf-8");
    const keys = JSON.parse(credentials);
    const { client_id, client_secret, redirect_uris } = keys.web;

    // Create the OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0] // Use the first redirect URI
    );

    // Check if we already have a refresh token or need to authorize
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline", // offline to get refresh token
      scope: SCOPES,
    });

    console.log("Authorization URL:", authUrl);
    // Ideally, you should send this URL to the user to authenticate

    // In a real-world app, you'll need to handle the authorization process
    // and get the code from the redirect URL to obtain a refresh token.
    // For now, let's assume you've got the code manually:
    const code = await getAuthCodeFromUser(); // This needs to be implemented to capture the auth code

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save the credentials for future use
    await saveCredentials(oauth2Client);

    console.log("Authorization successful.");
    return oauth2Client;
  } catch (err) {
    console.error("Authorization failed:", err.message);
    throw new Error("Authorization process failed. Check your credentials.json or token.json.");
  }
}

module.exports = { authorize };
