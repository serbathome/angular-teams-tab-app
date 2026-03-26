export const environment = {
  production: false,
  oidc: {
    // Entra ID v2 OIDC authority — replace {TENANT_ID} with your Directory (tenant) ID
    // To switch IdP later: change only authority, clientId, and scope here.
    authority: 'https://login.microsoftonline.com/5ffb773d-6490-492c-94d7-7d1ce0328178/v2.0',
    clientId: '75846af0-8e4e-44a5-a239-3ff7805f5034',   // Application (client) ID from app registration
    redirectUri: 'https://8wjt3082-4200.euw.devtunnels.ms/auth-end',
    // offline_access is required for Entra ID to issue a refresh_token
    scope: 'openid profile email offline_access',
    responseType: 'code',
  },
};
