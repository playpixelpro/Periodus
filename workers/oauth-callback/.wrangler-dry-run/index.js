var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var CALLBACK_PATH = "/auth/openrouter";
var APPLE_ASSOCIATION_PATHS = /* @__PURE__ */ new Set([
  "/.well-known/apple-app-site-association",
  "/apple-app-site-association"
]);
var ANDROID_ASSOCIATION_PATH = "/.well-known/assetlinks.json";
var DEFAULT_APPLE_TEAM_ID = "R5R3ZS54LV";
var DEFAULT_APPLE_BUNDLE_ID = "app.Periodus.mobile";
var DEFAULT_ANDROID_PACKAGE_NAME = "app.Periodus.mobile";
var JSON_HEADERS = {
  "content-type": "application/json",
  "x-content-type-options": "nosniff"
};
var src_default = {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
function handleRequest(request, env = {}) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        allow: "GET, HEAD",
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
  const { pathname } = new URL(request.url);
  let response;
  if (pathname === CALLBACK_PATH) {
    response = callbackResponse();
  } else if (APPLE_ASSOCIATION_PATHS.has(pathname)) {
    response = appleAssociationResponse(env);
  } else if (pathname === ANDROID_ASSOCIATION_PATH) {
    response = androidAssociationResponse(env);
  } else if (pathname === "/robots.txt") {
    response = new Response("User-agent: *\nDisallow: /\n", {
      status: 200,
      headers: {
        "cache-control": "public, max-age=86400",
        "content-type": "text/plain; charset=utf-8"
      }
    });
  } else {
    response = new Response("Not found", {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
  if (request.method !== "HEAD")
    return response;
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
__name(handleRequest, "handleRequest");
function buildAppleAssociation(env = {}) {
  const teamID = env.APPLE_TEAM_ID || DEFAULT_APPLE_TEAM_ID;
  const bundleID = env.APPLE_BUNDLE_ID || DEFAULT_APPLE_BUNDLE_ID;
  if (!/^[A-Z0-9]{10}$/.test(teamID) || !isPackageIdentifier(bundleID)) {
    return null;
  }
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamID}.${bundleID}`],
          components: [
            {
              "/": CALLBACK_PATH,
              comment: "Open the OpenRouter OAuth callback in Periodus"
            }
          ]
        }
      ]
    }
  };
}
__name(buildAppleAssociation, "buildAppleAssociation");
function buildAndroidAssociation(env = {}) {
  const packageName = env.ANDROID_PACKAGE_NAME || DEFAULT_ANDROID_PACKAGE_NAME;
  const fingerprints = parseFingerprints(
    env.ANDROID_SHA256_CERT_FINGERPRINTS
  );
  if (!isPackageIdentifier(packageName) || fingerprints.length === 0) {
    return null;
  }
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints
      }
    }
  ];
}
__name(buildAndroidAssociation, "buildAndroidAssociation");
function callbackResponse() {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const headers = {
    "cache-control": "no-store, max-age=0",
    "content-security-policy": [
      "default-src 'none'",
      `style-src 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
      "base-uri 'none'",
      "connect-src 'none'",
      "font-src 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "img-src 'none'",
      "object-src 'none'"
    ].join("; "),
    "content-type": "text/html; charset=utf-8",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    expires: "0",
    "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    pragma: "no-cache",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  };
  return new Response(callbackHTML(nonce), { status: 200, headers });
}
__name(callbackResponse, "callbackResponse");
function appleAssociationResponse(env) {
  const association = buildAppleAssociation(env);
  if (!association) {
    return configurationError(["APPLE_TEAM_ID", "APPLE_BUNDLE_ID"]);
  }
  return json(association, 200, {
    "cache-control": "public, max-age=3600"
  });
}
__name(appleAssociationResponse, "appleAssociationResponse");
function androidAssociationResponse(env) {
  const association = buildAndroidAssociation(env);
  if (!association) {
    return configurationError([
      "ANDROID_PACKAGE_NAME",
      "ANDROID_SHA256_CERT_FINGERPRINTS"
    ]);
  }
  return json(association, 200, {
    "cache-control": "public, max-age=3600"
  });
}
__name(androidAssociationResponse, "androidAssociationResponse");
function configurationError(required) {
  return json(
    {
      error: "association_not_configured",
      required
    },
    503,
    { "cache-control": "no-store" }
  );
}
__name(configurationError, "configurationError");
function json(value, status, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}
__name(json, "json");
function parseFingerprints(raw) {
  if (typeof raw !== "string")
    return [];
  const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/i;
  const normalized = raw.split(",").map((value) => value.trim().toUpperCase()).filter((value) => fingerprintPattern.test(value));
  return [...new Set(normalized)];
}
__name(parseFingerprints, "parseFingerprints");
function isPackageIdentifier(value) {
  return typeof value === "string" && /^(?:[A-Za-z][A-Za-z0-9_]*\.)+[A-Za-z][A-Za-z0-9_]*$/.test(value);
}
__name(isPackageIdentifier, "isPackageIdentifier");
function callbackHTML(nonce) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Return to Periodus</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light;
      font-family: ui-rounded, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #fbf6f1;
      color: #33262c;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100dvh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at 15% 8%, #f9e8e3 0 18%, transparent 42%),
        radial-gradient(circle at 92% 88%, #eee2f4 0 15%, transparent 38%),
        #fbf6f1;
    }
    main {
      width: min(100%, 430px);
      padding: 32px 26px;
      border: 1px solid rgba(81, 54, 68, .1);
      border-radius: 30px;
      background: rgba(255, 255, 255, .88);
      box-shadow: 0 18px 55px rgba(81, 54, 68, .1);
      text-align: center;
    }
    .moon {
      width: 58px;
      height: 58px;
      margin: 0 auto 22px;
      border-radius: 50%;
      background: #7a5368;
      box-shadow: 15px -7px 0 0 #fff;
      transform: translateX(-7px);
    }
    h1 {
      margin: 0 0 12px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(2rem, 8vw, 2.65rem);
      font-weight: 500;
      letter-spacing: -.035em;
    }
    p {
      margin: 0 auto;
      max-width: 32ch;
      color: #725f68;
      font-size: 1rem;
      line-height: 1.55;
    }
    button {
      width: 100%;
      min-height: 56px;
      margin-top: 28px;
      border: 0;
      border-radius: 999px;
      background: #6e4860;
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 3px solid #d8abc2;
      outline-offset: 3px;
    }
    button:disabled {
      cursor: not-allowed;
      opacity: .45;
    }
    small {
      display: block;
      margin-top: 18px;
      color: #907d86;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  <main>
    <div class="moon" aria-hidden="true"></div>
    <h1>Return to Periodus</h1>
    <p id="message">Your OpenRouter connection is ready to finish in the app.</p>
    <button id="open-app" type="button">Open Periodus</button>
    <small>This page never sees or stores your OpenRouter API key.</small>
  </main>
  <script nonce="${nonce}">
    (() => {
      const limits = {
        code: 2048,
        state: 1024,
        error: 128,
        error_description: 512,
        error_uri: 1024,
        iss: 1024
      };
      const source = new URLSearchParams(window.location.search);
      const forwarded = new URLSearchParams();

      for (const [name, limit] of Object.entries(limits)) {
        const value = source.get(name);
        if (
          value &&
          value.length <= limit &&
          !/[\\u0000-\\u001F\\u007F]/.test(value)
        ) {
          forwarded.set(name, value);
        }
      }

      const button = document.getElementById('open-app');
      const message = document.getElementById('message');
      const hasOAuthResponse =
        forwarded.has('code') || forwarded.has('error');

      if (!hasOAuthResponse) {
        button.disabled = true;
        message.textContent =
          'This callback is incomplete. Return to Periodus and start the connection again.';
        return;
      }

      button.addEventListener('click', () => {
        window.location.assign(
          'Periodus://openrouter/callback?' + forwarded.toString()
        );
      });
    })();
  <\/script>
</body>
</html>`;
}
__name(callbackHTML, "callbackHTML");
export {
  buildAndroidAssociation,
  buildAppleAssociation,
  src_default as default,
  handleRequest
};
//# sourceMappingURL=index.js.map
