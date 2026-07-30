// Fill in clientId after registering an app at https://portal.azure.com
// (Entra ID > App registrations > New registration > Single-page application).
// redirectUri is computed automatically from wherever this page is hosted, but
// that exact URL must also be added as a Redirect URI in the Azure app itself.
export const msalConfig = {
  auth: {
    clientId: 'YOUR_AZURE_APP_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin + window.location.pathname
  },
  cache: {
    // localStorage (not sessionStorage) so signing in once on a device survives
    // closing the tab/browser — matches "이어서 하고 싶어" across sessions.
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

// Files.ReadWrite (not the narrower Files.ReadWrite.AppFolder) is required here
// specifically because we need to read/write the *same* TEPS/data/*.json files
// the desktop app already uses — AppFolder would sandbox us into a separate,
// hidden folder instead of the real project folder.
export const graphScopes = ['Files.ReadWrite', 'User.Read'];
