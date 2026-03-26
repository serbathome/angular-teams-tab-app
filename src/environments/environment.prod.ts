export const environment = {
  production: true,
  oidc: {
    // Entra ID v2 OIDC authority — replace {TENANT_ID} with your Directory (tenant) ID
    authority: 'https://login.microsoftonline.com/5ffb773d-6490-492c-94d7-7d1ce0328178/v2.0',
    clientId: '75846af0-8e4e-44a5-a239-3ff7805f5034',
    redirectUri: 'https://8wjt3082-4200.euw.devtunnels.ms/auth-end',
    scope: 'openid profile email offline_access',
    responseType: 'code',
  },
};
