// PROJOYSTICK PAYMENT WORKER
// Cloudflare secret required: FIREBASE_SERVICE_ACCOUNT_B64
// Store the Base64 encoding of the complete Firebase service-account JSON file.

const FIREBASE_PROJECT_ID = "my-project-d6a7e";
const FIREBASE_ISSUER = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;
const FIREBASE_JWKS_URL =
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

// Add your production site URL here before deployment.
const ALLOWED_ORIGINS = new Set([
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "https://projoystick.vercel.app"
]);

export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(origin)
            });
        }

        const url = new URL(request.url);

        try {
            if (url.pathname === "/fastcoin/info") {
                if (request.method !== "GET") {
                    return json({ success: false, message: "Method not allowed." }, 405, origin);
                }

                const user = await requireUser(request, origin);
                if (user instanceof Response) return user;

                const accessToken = await getGoogleAccessToken(env);
                const [userDocument, settingsDocument] = await Promise.all([
                    getDocument(accessToken, `users/${user.uid}`),
                    getDocument(accessToken, "coinSettings/config")
                ]);

                if (!userDocument) {
                    throw httpError("User account was not found.", 404);
                }

                const userData = fieldsToObject(userDocument.fields);
                const settings = fieldsToObject(settingsDocument?.fields);
                const balance = integer(userData.coins, "User Fast Coin balance");
                const coinsPerRupee = positiveInteger(
                    settings.coinsPerRupee,
                    "Fast Coin conversion rate"
                );

                return json({
                    success: true,
                    balance,
                    coinsPerRupee,
                    coinsEnabled: settings.coinsEnabled !== false
                }, 200, origin);
            }

            if (url.pathname === "/fastcoin/pay") {
                if (request.method !== "POST") {
                    return json({ success: false, message: "Method not allowed." }, 405, origin);
                }

                const user = await requireUser(request, origin);
                if (user instanceof Response) return user;

                const body = await request.json().catch(() => null);
                const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";

                if (!/^[A-Za-z0-9_-]{3,128}$/.test(orderId)) {
                    throw httpError("A valid order ID is required.", 400);
                }

                const result = await payWithFastCoins(
                    await getGoogleAccessToken(env),
                    user.uid,
                    orderId
                );

                return json({ success: true, orderId, ...result }, 200, origin);
            }

            return json({ success: false, message: "Endpoint not found." }, 404, origin);
        } catch (error) {
            console.error("Payment Worker error:", error);
            return json(
                { success: false, message: errorMessage(error, "Payment request failed.") },
                errorStatus(error),
                origin
            );
        }
    }
};

async function payWithFastCoins(accessToken, uid, orderId) {
    const transaction = await beginTransaction(accessToken);
    const orderPath = `orders/${orderId}`;
    const userPath = `users/${uid}`;
    const settingsPath = "coinSettings/config";
    const paymentPath = `fastcoinPayments/${orderId}`;
    const coinTransactionPath = `coinTransactions/fastcoin_${orderId}`;

    const [orderDocument, userDocument, settingsDocument, existingPayment] = await Promise.all([
        getDocument(accessToken, orderPath, transaction),
        getDocument(accessToken, userPath, transaction),
        getDocument(accessToken, settingsPath, transaction),
        getDocument(accessToken, paymentPath, transaction)
    ]);

    if (!orderDocument) throw httpError("Order was not found.", 404);
    if (!userDocument) throw httpError("User account was not found.", 404);
    if (!settingsDocument) throw httpError("Fast Coin settings are not configured.", 500);

    const order = fieldsToObject(orderDocument.fields);
    const user = fieldsToObject(userDocument.fields);
    const settings = fieldsToObject(settingsDocument.fields);

    if (order.userId !== uid) throw httpError("You are not allowed to pay for this order.", 403);
    if (settings.coinsEnabled === false) throw httpError("Fast Coin payments are currently disabled.", 403);

    const paymentStatus = String(order.paymentStatus || "").toLowerCase();
    if (order.paymentVerified === true || paymentStatus === "paid" || paymentStatus === "verified") {
        throw httpError("This order has already been paid.", 409);
    }

    if (existingPayment) {
        const payment = fieldsToObject(existingPayment.fields);
        if (payment.status === "paid") {
            return {
                message: "Fast Coin payment was already completed.",
                coinsUsed: Number(payment.coinsUsed) || 0,
                balance: Number(payment.balanceAfter) || 0,
                coinsPerRupee: Number(payment.coinsPerRupee) || 0
            };
        }
        throw httpError("A Fast Coin payment is already being processed for this order.", 409);
    }

    const total = Number(order.total);
    if (!Number.isFinite(total) || total <= 0) throw httpError("This order has an invalid total.", 400);

    const coinsPerRupee = positiveInteger(settings.coinsPerRupee, "Fast Coin conversion rate");
    const coinsRequired = Math.ceil(total * coinsPerRupee);
    if (!Number.isSafeInteger(coinsRequired) || coinsRequired <= 0) {
        throw httpError("Unable to calculate the Fast Coins needed for this order.", 400);
    }

    const currentBalance = integer(user.coins, "User Fast Coin balance");
    if (currentBalance < coinsRequired) {
        throw httpError(`Insufficient Fast Coins. You need ${coinsRequired} Fast Coins.`, 400);
    }

    const balance = currentBalance - coinsRequired;
    const now = new Date().toISOString();
    const writes = [
        updateDocument(userPath, { coins: integerValue(balance) }),
        updateDocument(orderPath, {
            paymentMethod: stringValue("fastcoin"),
            paymentStatus: stringValue("paid"),
            paymentVerified: booleanValue(true),
            orderStatus: stringValue("processing"),
            fastCoinAmount: integerValue(coinsRequired),
            fastCoinConversionRate: integerValue(coinsPerRupee),
            updatedAt: timestampValue(now)
        }),
        createDocument(paymentPath, {
            orderId: stringValue(orderId),
            userId: stringValue(uid),
            status: stringValue("paid"),
            type: stringValue("fastcoin_payment"),
            amountRupees: doubleValue(total),
            coinsUsed: integerValue(coinsRequired),
            coinsPerRupee: integerValue(coinsPerRupee),
            balanceBefore: integerValue(currentBalance),
            balanceAfter: integerValue(balance),
            createdAt: timestampValue(now)
        }),
        createDocument(coinTransactionPath, {
            userId: stringValue(uid),
            amount: integerValue(-coinsRequired),
            type: stringValue("fastcoin_payment"),
            orderId: stringValue(orderId),
            rupeeAmount: doubleValue(total),
            coinsPerRupee: integerValue(coinsPerRupee),
            createdAt: timestampValue(now)
        })
    ];

    await commitTransaction(accessToken, transaction, writes);
    return {
        message: "Fast Coin payment completed successfully.",
        coinsUsed: coinsRequired,
        balance,
        coinsPerRupee
    };
}

async function requireUser(request, origin) {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
        return json({ success: false, message: "Authorization token is required." }, 401, origin);
    }

    try {
        return await verifyFirebaseIdToken(authorization.slice(7).trim());
    } catch (error) {
        console.error("Firebase token verification failed:", error);
        return json({ success: false, message: "Invalid or expired Firebase token." }, 401, origin);
    }
}

async function verifyFirebaseIdToken(idToken) {
    const [encodedHeader, encodedPayload, encodedSignature, extra] = String(idToken).split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature || extra) throw new Error("Invalid Firebase token.");

    const header = JSON.parse(textFromBase64Url(encodedHeader));
    const payload = JSON.parse(textFromBase64Url(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (header.alg !== "RS256" || !header.kid) throw new Error("Invalid Firebase token header.");
    if (payload.iss !== FIREBASE_ISSUER || payload.aud !== FIREBASE_PROJECT_ID) {
        throw new Error("Firebase token is for a different project.");
    }
    if (!payload.sub || payload.exp <= now || payload.iat > now + 60) throw new Error("Expired Firebase token.");

    const keyResponse = await fetch(FIREBASE_JWKS_URL);
    if (!keyResponse.ok) throw new Error("Unable to retrieve Firebase signing keys.");
    const { keys } = await keyResponse.json();
    const jwk = keys?.find(key => key.kid === header.kid);
    if (!jwk) throw new Error("Firebase signing key was not found.");

    const key = await crypto.subtle.importKey(
        "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const valid = await crypto.subtle.verify(
        { name: "RSASSA-PKCS1-v1_5" },
        key,
        decodeBase64UrlBytes(encodedSignature),
        new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    if (!valid) throw new Error("Invalid Firebase token signature.");

    return { uid: payload.sub, email: payload.email || null };
}

async function getGoogleAccessToken(env) {
    if (!env.FIREBASE_SERVICE_ACCOUNT_B64) {
        throw httpError("FIREBASE_SERVICE_ACCOUNT_B64 secret is not configured.", 500);
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(atob(String(env.FIREBASE_SERVICE_ACCOUNT_B64)));
    } catch {
        throw httpError("FIREBASE_SERVICE_ACCOUNT_B64 must contain Base64-encoded Firebase JSON.", 500);
    }

    if (serviceAccount.project_id !== FIREBASE_PROJECT_ID) {
        throw httpError("The service account belongs to a different Firebase project.", 500);
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
        throw httpError("The service-account JSON is missing client_email or private_key.", 500);
    }

    const now = Math.floor(Date.now() / 1000);
    const unsignedToken = `${base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64UrlText(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: FIRESTORE_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat: now,
        exp: now + 3600
    }))}`;

    let privateKey;
    try {
        privateKey = await crypto.subtle.importKey(
            "pkcs8",
            pemToArrayBuffer(serviceAccount.private_key),
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["sign"]
        );
    } catch (error) {
        console.error("Service-account key import failed:", {
            name: error?.name,
            message: error?.message,
            projectId: serviceAccount.project_id,
            keyId: serviceAccount.private_key_id,
            beginsCorrectly: serviceAccount.private_key.startsWith("-----BEGIN PRIVATE KEY-----"),
            endsCorrectly: serviceAccount.private_key.trim().endsWith("-----END PRIVATE KEY-----")
        });
        throw httpError("The Firebase service-account private key is invalid or malformed.", 500);
    }

    const signature = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5" }, privateKey, new TextEncoder().encode(unsignedToken)
    );
    const assertion = `${unsignedToken}.${base64UrlBytes(new Uint8Array(signature))}`;

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion
        })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token) {
        throw httpError("Google rejected the Firebase service account.", 500);
    }
    return data.access_token;
}

async function getDocument(accessToken, documentPath, transaction) {
    const url = new URL(firestoreUrl(`/documents/${documentPath}`));
    if (transaction) url.searchParams.set("transaction", transaction);
    const response = await fetch(url, { headers: bearerHeaders(accessToken) });
    if (response.status === 404) return null;
    if (!response.ok) throw await firestoreError(response, "Unable to read Firestore data.");
    return response.json();
}

async function beginTransaction(accessToken) {
    const response = await fetch(firestoreUrl("/documents:beginTransaction"), {
        method: "POST",
        headers: bearerHeaders(accessToken),
        body: "{}"
    });
    if (!response.ok) throw await firestoreError(response, "Unable to start payment transaction.");
    const data = await response.json();
    if (!data.transaction) throw httpError("Unable to start payment transaction.", 500);
    return data.transaction;
}

async function commitTransaction(accessToken, transaction, writes) {
    const response = await fetch(firestoreUrl("/documents:commit"), {
        method: "POST",
        headers: bearerHeaders(accessToken),
        body: JSON.stringify({ transaction, writes })
    });
    if (!response.ok) throw await firestoreError(response, "Fast Coin payment could not be saved.");
}

function firestoreUrl(path) {
    return `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)${path}`;
}

function bearerHeaders(accessToken) {
    return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
}

async function firestoreError(response, fallback) {
    const data = await response.json().catch(() => null);
    return httpError(data?.error?.message || fallback, response.status);
}

function updateDocument(path, fields) {
    /*
     * Firestore REST updates replace a document unless an update mask is
     * supplied. Keep every existing order field (items, userId, delivery
     * data, and so on) and change only the payment-related fields below.
     */
    return {
        update: {
            name: documentName(path),
            fields
        },
        updateMask: {
            fieldPaths: Object.keys(fields)
        },
        currentDocument: {
            exists: true
        }
    };
}

function createDocument(path, fields) {
    return { update: { name: documentName(path), fields }, currentDocument: { exists: false } };
}

function documentName(path) {
    return `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
}

function fieldsToObject(fields = {}) {
    return Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, firestoreValue(value)]));
}

function firestoreValue(value = {}) {
    if ("stringValue" in value) return value.stringValue;
    if ("integerValue" in value) return Number(value.integerValue);
    if ("doubleValue" in value) return Number(value.doubleValue);
    if ("booleanValue" in value) return value.booleanValue;
    if ("timestampValue" in value) return value.timestampValue;
    if ("nullValue" in value) return null;
    if ("mapValue" in value) return fieldsToObject(value.mapValue.fields);
    if ("arrayValue" in value) return (value.arrayValue.values || []).map(firestoreValue);
    return null;
}

const stringValue = value => ({ stringValue: String(value) });
const integerValue = value => ({ integerValue: String(value) });
const doubleValue = value => ({ doubleValue: Number(value) });
const booleanValue = value => ({ booleanValue: Boolean(value) });
const timestampValue = value => ({ timestampValue: value });

function integer(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) throw httpError(`${label} is invalid.`, 500);
    return number;
}

function positiveInteger(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0) throw httpError(`${label} is not configured correctly.`, 500);
    return number;
}

function pemToArrayBuffer(value) {
    const pem = String(value || "").replace(/\\n/g, "\n").replace(/\r/g, "").trim();
    const match = pem.match(/-----BEGIN PRIVATE KEY-----([\s\S]+)-----END PRIVATE KEY-----/);
    if (!match) throw new Error("The private key does not contain a valid PKCS#8 PEM envelope.");

    const base64 = match[1].replace(/\s/g, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new Error("The private key contains invalid Base64 data.");
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0)).buffer;
}

function base64UrlText(value) {
    return base64UrlBytes(new TextEncoder().encode(value));
}

function base64UrlBytes(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlBytes(value) {
    const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function textFromBase64Url(value) {
    return new TextDecoder().decode(decodeBase64UrlBytes(value));
}

function httpError(message, status = 500) {
    return { message, status };
}

function errorMessage(error, fallback) {
    return typeof error?.message === "string" ? error.message : fallback;
}

function errorStatus(error) {
    const status = Number(error?.status);
    return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function corsHeaders(origin) {
    const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "http://127.0.0.1:5501";
    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin"
    };
}

function json(data, status, origin) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
    });
}


