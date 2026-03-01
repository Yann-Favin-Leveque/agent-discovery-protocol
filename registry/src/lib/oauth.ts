// ─── Types ──────────────────────────────────────────────────────

export type OAuthProvider = "google" | "github" | "microsoft";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export interface OAuthUserInfo {
  email: string;
  name: string | null;
  provider_id: string;
  avatar_url: string | null;
}

// ─── Provider configs ───────────────────────────────────────────

function getProviderConfig(provider: OAuthProvider): OAuthConfig {
  switch (provider) {
    case "google":
      return {
        clientId: process.env.OAUTH_GOOGLE_WEB_APP_ID ?? process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.OAUTH_GOOGLE_WEB_APP_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? "",
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
        scopes: ["openid", "email", "profile"],
      };
    case "github":
      return {
        clientId: process.env.OAUTH_GITHUB_WEB_APP_ID ?? process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.OAUTH_GITHUB_WEB_APP_SECRET ?? process.env.GITHUB_CLIENT_SECRET ?? "",
        authorizationUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userInfoUrl: "https://api.github.com/user",
        scopes: ["read:user", "user:email"],
      };
    case "microsoft":
      return {
        clientId: process.env.OAUTH_MICROSOFT_WEB_APP_ID ?? process.env.MICROSOFT_CLIENT_ID ?? "",
        clientSecret: process.env.OAUTH_MICROSOFT_WEB_APP_SECRET ?? process.env.MICROSOFT_CLIENT_SECRET ?? "",
        authorizationUrl:
          "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl:
          "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userInfoUrl: "https://graph.microsoft.com/v1.0/me",
        scopes: ["openid", "email", "profile", "User.Read"],
      };
  }
}

// ─── OAuth flow ─────────────────────────────────────────────────

export function getAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  redirectUri: string
): string {
  const config = getProviderConfig(provider);
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });

  // Google needs access_type for refresh tokens
  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<{ access_token: string }> {
  const config = getProviderConfig(provider);

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // GitHub requires Accept: application/json
  if (provider === "github") {
    headers["Accept"] = "application/json";
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: body.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Token exchange error: ${data.error_description || data.error}`);
  }

  return { access_token: data.access_token };
}

export async function fetchUserInfo(
  provider: OAuthProvider,
  accessToken: string
): Promise<OAuthUserInfo> {
  const config = getProviderConfig(provider);

  const res = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`User info fetch failed: ${res.status}`);
  }

  const data = await res.json();

  switch (provider) {
    case "google":
      return {
        email: data.email,
        name: data.name ?? null,
        provider_id: String(data.id),
        avatar_url: data.picture ?? null,
      };

    case "github": {
      let email = data.email;

      // GitHub may not return email if it's private — fetch from /user/emails
      if (!email) {
        const emailsRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (emailsRes.ok) {
          const emails = await emailsRes.json();
          const primary = emails.find(
            (e: { primary: boolean; verified: boolean }) =>
              e.primary && e.verified
          );
          email = primary?.email ?? emails[0]?.email;
        }
      }

      if (!email) throw new Error("Could not retrieve email from GitHub");

      return {
        email,
        name: data.name ?? data.login ?? null,
        provider_id: String(data.id),
        avatar_url: data.avatar_url ?? null,
      };
    }

    case "microsoft":
      return {
        email: data.mail ?? data.userPrincipalName,
        name: data.displayName ?? null,
        provider_id: String(data.id),
        avatar_url: null,
      };
  }
}
