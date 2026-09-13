// ============================================================
// PROJOYSTICK - UPI / QR PAYMENT MODULE
// ============================================================

const PAYMENT_TIMEOUT = 4 * 60 * 1000;
const PAYMENT_START_STORAGE_PREFIX = "gamevault_payment_started_";
const GAMEVAULT_UPI_ID = "fullmast592@okhdfcbank";

let qrTimerInterval = null;
let qrPaymentStartedAt = null;
let qrCurrentOrderId = null;
let qrCurrentTotal = 0;
let getCurrentOrder = null;
let getCurrentOrderId = null;
let onPaymentTimeout = null;

function notifyQrPaymentTimeout() {
    if (typeof onPaymentTimeout === "function") {
        onPaymentTimeout();
    }
}

function resolvePaymentDetails(orderOrDetails, fallbackTotal = 0) {
    if (orderOrDetails && typeof orderOrDetails === "object") {
        const order = orderOrDetails.order || orderOrDetails;

        return {
            orderId: orderOrDetails.orderId || order.orderId || null,
            total: Number(orderOrDetails.total ?? order.total ?? fallbackTotal) || 0
        };
    }

    return {
        orderId: orderOrDetails || null,
        total: Number(fallbackTotal) || 0
    };
}


// ------------------------------------------------------------
// DOM HELPERS
// ------------------------------------------------------------

function getQrElement(id) {
    return document.getElementById(id);
}


// ------------------------------------------------------------
// PAYMENT START STORAGE
// ------------------------------------------------------------

function getPaymentStartStorageKey(orderId) {
    return `${PAYMENT_START_STORAGE_PREFIX}${orderId}`;
}

function getStoredPaymentStart(orderId) {
    if (!orderId) {
        return null;
    }

    const value = localStorage.getItem(
        getPaymentStartStorageKey(orderId)
    );

    if (!value) {
        return null;
    }

    const timestamp = Number(value);

    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        localStorage.removeItem(
            getPaymentStartStorageKey(orderId)
        );
        return null;
    }

    return timestamp;
}

function savePaymentStart(orderId, timestamp) {
    if (!orderId || !timestamp) {
        return;
    }

    localStorage.setItem(
        getPaymentStartStorageKey(orderId),
        String(timestamp)
    );
}

function clearQrPaymentStorage(orderId) {
    if (!orderId) {
        return;
    }

    localStorage.removeItem(
        getPaymentStartStorageKey(orderId)
    );
}


// ------------------------------------------------------------
// UPI PAYMENT URI
// ------------------------------------------------------------

function buildUpiPaymentUri(total) {
    const amount = Number(total || 0).toFixed(2);

    return [
        "upi://pay",
        `pa=${encodeURIComponent(GAMEVAULT_UPI_ID)}`,
        `pn=${encodeURIComponent("PROJOYSTICK")}`,
        `am=${encodeURIComponent(amount)}`,
        "cu=INR"
    ].join("?");
}


// ------------------------------------------------------------
// QR GENERATION
// ------------------------------------------------------------

function generateUpiQr(total) {
    const upiQr = getQrElement("upiQr");

    if (!upiQr) {
        return;
    }

    const upiUri = buildUpiPaymentUri(total);

    const qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/" +
        `?size=260x260&margin=10&data=${encodeURIComponent(upiUri)}`;

    upiQr.innerHTML = "";

    const image = document.createElement("img");
    image.src = qrUrl;
    image.alt = "PROJOYSTICK UPI payment QR code";
    image.width = 260;
    image.height = 260;
    image.loading = "eager";

    upiQr.appendChild(image);

    upiQr.classList.remove("hidden");
}


// ------------------------------------------------------------
// TIMER DISPLAY
// ------------------------------------------------------------

function updateQrTimer() {
    const paymentTimer = getQrElement("paymentTimer");

    if (!paymentTimer || !qrPaymentStartedAt) {
        return;
    }

    const elapsed =
        Date.now() - qrPaymentStartedAt;

    const remaining =
        Math.max(0, PAYMENT_TIMEOUT - elapsed);

    const totalSeconds =
        Math.ceil(remaining / 1000);

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        totalSeconds % 60;

    paymentTimer.textContent =
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`;

    if (remaining <= 0) {
        stopQrPaymentTimer();

        notifyQrPaymentTimeout();
    }
}


// ------------------------------------------------------------
// TIMER CONTROL
// ------------------------------------------------------------

function stopQrPaymentTimer() {
    if (qrTimerInterval) {
        clearInterval(qrTimerInterval);
        qrTimerInterval = null;
    }
}

function startQrPaymentTimer(startTimestamp) {
    stopQrPaymentTimer();

    qrPaymentStartedAt = Number(startTimestamp);

    if (
        !Number.isFinite(qrPaymentStartedAt) ||
        qrPaymentStartedAt <= 0
    ) {
        qrPaymentStartedAt = Date.now();
    }

    updateQrTimer();

    qrTimerInterval = setInterval(
        updateQrTimer,
        1000
    );
}


// ------------------------------------------------------------
// REVEAL / ACTIVATE UPI
// ------------------------------------------------------------

function activateUpiPayment(orderId, total) {
    ({ orderId, total } = resolvePaymentDetails(orderId, total));

    if (!orderId) {
        return;
    }

    qrCurrentOrderId = orderId;
    qrCurrentTotal = Number(total || 0);

    const upiReveal = getQrElement("upiReveal");
    const upiActive = getQrElement("upiActive");
    const upiRevealBtn = getQrElement("upiRevealBtn");
    const upiId = getQrElement("upiId");

    if (upiReveal) {
        upiReveal.classList.add("hidden");
    }

    if (upiActive) {
        upiActive.classList.remove("hidden");
    }

    if (upiRevealBtn) {
        upiRevealBtn.disabled = true;
    }

    if (upiId) {
        upiId.textContent = GAMEVAULT_UPI_ID;
    }

    generateUpiQr(qrCurrentTotal);

    const existingStart =
        getStoredPaymentStart(orderId);

    const startTimestamp =
        existingStart || Date.now();

    if (!existingStart) {
        savePaymentStart(
            orderId,
            startTimestamp
        );
    }

    startQrPaymentTimer(startTimestamp);
}


// ------------------------------------------------------------
// PREPARE LOCKED UPI
// ------------------------------------------------------------

function prepareQrPayment(orderId, total) {
    ({ orderId, total } = resolvePaymentDetails(orderId, total));

    qrCurrentOrderId = orderId;
    qrCurrentTotal = Number(total || 0);

    stopQrPaymentTimer();

    const upiReveal = getQrElement("upiReveal");
    const upiActive = getQrElement("upiActive");
    const upiQr = getQrElement("upiQr");
    const paymentTimer = getQrElement("paymentTimer");
    const upiRevealBtn = getQrElement("upiRevealBtn");
    const upiId = getQrElement("upiId");

    if (upiReveal) {
        upiReveal.classList.remove("hidden");
    }

    if (upiActive) {
        upiActive.classList.add("hidden");
    }

    if (upiQr) {
        upiQr.classList.add("hidden");
        upiQr.innerHTML = "";
    }

    if (paymentTimer) {
        paymentTimer.textContent = "04:00";
    }

    if (upiRevealBtn) {
        upiRevealBtn.disabled = false;
    }

    if (upiId) {
        upiId.textContent = GAMEVAULT_UPI_ID;
    }

    const existingStart =
        getStoredPaymentStart(orderId);

    if (existingStart) {
        activateUpiPayment(
            orderId,
            total
        );
    }
}


// ------------------------------------------------------------
// RESTORE AFTER PAGE REFRESH
// ------------------------------------------------------------

function restoreQrPayment(orderId, total) {
    ({ orderId, total } = resolvePaymentDetails(orderId, total));

    if (!orderId) {
        return false;
    }

    const startedAt =
        getStoredPaymentStart(orderId);

    if (!startedAt) {
        prepareQrPayment(
            orderId,
            total
        );

        return false;
    }

    const elapsed =
        Date.now() - startedAt;

    if (elapsed >= PAYMENT_TIMEOUT) {
        stopQrPaymentTimer();

        notifyQrPaymentTimeout();

        return true;
    }

    qrCurrentOrderId = orderId;
    qrCurrentTotal = Number(total || 0);

    const upiReveal = getQrElement("upiReveal");
    const upiActive = getQrElement("upiActive");
    const upiId = getQrElement("upiId");

    if (upiReveal) {
        upiReveal.classList.add("hidden");
    }

    if (upiActive) {
        upiActive.classList.remove("hidden");
    }

    if (upiId) {
        upiId.textContent = GAMEVAULT_UPI_ID;
    }

    generateUpiQr(qrCurrentTotal);

    startQrPaymentTimer(startedAt);

    return true;
}


// ------------------------------------------------------------
// STOP UPI PAYMENT
// ------------------------------------------------------------

function stopQrPayment() {
    stopQrPaymentTimer();

    qrPaymentStartedAt = null;
    qrCurrentOrderId = null;
    qrCurrentTotal = 0;
}


// ------------------------------------------------------------
// COPY UPI ID
// ------------------------------------------------------------

async function copyUpiId() {
    const upiId = getQrElement("upiId");
    const copyUpiBtn = getQrElement("copyUpiBtn");

    if (!upiId) {
        return;
    }

    const value =
        upiId.textContent.trim();

    if (!value) {
        return;
    }

    try {
        await navigator.clipboard.writeText(value);

        if (copyUpiBtn) {
            const originalText =
                copyUpiBtn.textContent;

            copyUpiBtn.textContent =
                "COPIED";

            setTimeout(() => {
                copyUpiBtn.textContent =
                    originalText;
            }, 1500);
        }
    } catch (error) {
        console.error(
            "Unable to copy UPI ID:",
            error
        );
    }
}


// ------------------------------------------------------------
// INITIALIZE UPI MODULE
// ------------------------------------------------------------

function initQrPayment(options = {}) {
    getCurrentOrder =
        typeof options.getOrder === "function"
            ? options.getOrder
            : null;

    getCurrentOrderId =
        typeof options.getOrderId === "function"
            ? options.getOrderId
            : null;

    onPaymentTimeout =
        typeof options.onTimeout === "function"
            ? options.onTimeout
            : null;

    const upiRevealBtn =
        getQrElement("upiRevealBtn");

    const copyUpiBtn =
        getQrElement("copyUpiBtn");

    if (upiRevealBtn) {
        upiRevealBtn.addEventListener(
            "click",
            () => {
                const orderId = getCurrentOrderId?.();

                if (!orderId) {
                    return;
                }

                let total = 0;

                total = Number(getCurrentOrder?.()?.total) || 0;

                activateUpiPayment(
                    orderId,
                    total
                );
            }
        );
    }

    if (copyUpiBtn) {
        copyUpiBtn.addEventListener(
            "click",
            copyUpiId
        );
    }
}


// ------------------------------------------------------------
// ES MODULE EXPORTS
// ------------------------------------------------------------

export {
    initQrPayment,
    prepareQrPayment,
    restoreQrPayment,
    activateUpiPayment,
    stopQrPayment,
    stopQrPaymentTimer,
    clearQrPaymentStorage,
    generateUpiQr
};
