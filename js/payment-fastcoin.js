// ============================================================
// PROJOYSTICK - FAST COIN PAYMENT MODULE
// ============================================================

import { auth } from "./firebase.js";


// ------------------------------------------------------------
// FAST COIN PAYMENT WORKER
// ------------------------------------------------------------

const FAST_COIN_WORKER_URL =
    "https://projoystick-payment.servng8.workers.dev";


// ------------------------------------------------------------
// MODULE STATE
// ------------------------------------------------------------

let fastCoinBalance = 0;
let fastCoinPaymentAmount = 0;
let fastCoinUserId = null;
let fastCoinConversionRate = 0;

let currentUser = null;
let paymentInProgress = false;
let initialized = false;


// ------------------------------------------------------------
// DOM HELPER
// ------------------------------------------------------------

function getFastCoinElement(id) {
    return document.getElementById(id);
}


// ------------------------------------------------------------
// FORMAT FAST COINS
// ------------------------------------------------------------

function formatFastCoin(value) {
    const amount = Number(value || 0);

    return amount.toLocaleString("en-IN");
}


// ------------------------------------------------------------
// GET CURRENT FIREBASE USER
// ------------------------------------------------------------

function getCurrentFirebaseUser() {
    /*
     * payment.js passes the authenticated Firebase user
     * into this module.
     *
     * Firebase auth.currentUser is preferred when available.
     */

    return auth?.currentUser || currentUser || null;
}


// ------------------------------------------------------------
// GET FIREBASE ID TOKEN
// ------------------------------------------------------------

async function getFirebaseIdToken() {

    let user = getCurrentFirebaseUser();

    /*
     * Firebase Auth can take a moment to finish restoring
     * the session. Wait briefly instead of immediately failing.
     */

    if (!user) {

        for (let attempt = 0; attempt < 30; attempt++) {

            await new Promise(resolve =>
                setTimeout(resolve, 150)
            );

            user = getCurrentFirebaseUser();

            if (user) {
                break;
            }
        }
    }

    if (!user) {
        throw new Error(
            "Please sign in before using Fast Coin."
        );
    }

    currentUser = user;
    fastCoinUserId = user.uid;

    if (typeof user.getIdToken !== "function") {
        throw new Error(
            "Firebase authentication is not ready."
        );
    }

    return await user.getIdToken();
}


// ------------------------------------------------------------
// UPDATE ALL FAST COIN DISPLAYS
// ------------------------------------------------------------

function updateFastCoinDisplay() {

    updateFastCoinBalanceDisplay();
    updateFastCoinConversionDisplay();
    updateRequiredFastCoinDisplay();
    updateFastCoinPaymentState();
}


// ------------------------------------------------------------
// LOAD FAST COIN BALANCE + ADMIN RATE
// ------------------------------------------------------------

async function loadFastCoinBalance(user = null) {

    /*
     * If payment.js supplies the authenticated user,
     * remember it.
     */

    if (user) {
        currentUser = user;
        fastCoinUserId = user.uid;
    }

    /*
     * IMPORTANT:
     * Do not call the Worker until Firebase authentication
     * has actually produced a user.
     */

    let firebaseUser =
        getCurrentFirebaseUser();

    if (!firebaseUser) {

        try {
            await getFirebaseIdToken();
            firebaseUser =
                getCurrentFirebaseUser();
        } catch (error) {

            console.warn(
                "Fast Coin waiting for Firebase authentication:",
                error
            );

            return 0;
        }
    }

    if (!firebaseUser) {
        return 0;
    }

    try {

        const token =
            await getFirebaseIdToken();


        const response =
            await fetch(
                `${FAST_COIN_WORKER_URL}/fastcoin/info`,
                {
                    method: "GET",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json",

                        "Accept":
                            "application/json"
                    }
                }
            );


        let result = null;


        try {
            result =
                await response.json();
        } catch {
            result = null;
        }


        if (
            !response.ok ||
            !result?.success
        ) {

            throw new Error(
                result?.error ||
                result?.message ||
                `Fast Coin Worker returned HTTP ${response.status}.`
            );
        }


        // ----------------------------------------------------
        // BALANCE
        // ----------------------------------------------------

        const receivedBalance =
            Number(result.balance);


        if (
            !Number.isSafeInteger(
                receivedBalance
            ) ||
            receivedBalance < 0
        ) {

            throw new Error(
                "Invalid Fast Coin balance received from Worker."
            );
        }


        fastCoinBalance =
            receivedBalance;


        // ----------------------------------------------------
        // ADMIN CONVERSION RATE
        // ----------------------------------------------------

        const receivedRate =
            Number(
                result.coinsPerRupee
            );


        if (
            !Number.isSafeInteger(
                receivedRate
            ) ||
            receivedRate <= 0
        ) {

            throw new Error(
                "Invalid Fast Coin conversion rate received from Worker."
            );
        }


        fastCoinConversionRate =
            receivedRate;


        // ----------------------------------------------------
        // UPDATE UI
        // ----------------------------------------------------

        updateFastCoinDisplay();


        console.log(
            "Fast Coin information loaded:",
            {
                balance: fastCoinBalance,
                coinsPerRupee:
                    fastCoinConversionRate
            }
        );


        return fastCoinBalance;


    } catch (error) {

        console.error(
            "Failed to load Fast Coin information:",
            error
        );


        /*
         * Reset displayed values when the Worker request fails.
         */

        fastCoinBalance = 0;
        fastCoinConversionRate = 0;


        updateFastCoinDisplay();


        return 0;
    }
}


// ------------------------------------------------------------
// BALANCE DISPLAY
// ------------------------------------------------------------

function updateFastCoinBalanceDisplay() {

    const elements = [
        getFastCoinElement("fastCoinBalance"),
        getFastCoinElement("fastcoinBalance"),
        getFastCoinElement("fastCoinAvailable")
    ];


    elements.forEach(element => {

        if (!element) {
            return;
        }


        element.textContent =
            formatFastCoin(
                fastCoinBalance
            );
    });
}


// ------------------------------------------------------------
// CONVERSION DISPLAY
// ------------------------------------------------------------

function updateFastCoinConversionDisplay() {

    const elements = [
        getFastCoinElement(
            "fastCoinConversionRate"
        ),

        getFastCoinElement(
            "fastcoinConversionRate"
        ),

        getFastCoinElement(
            "fastCoinRate"
        )
    ];


    elements.forEach(element => {

        if (!element) {
            return;
        }


        if (
            !fastCoinConversionRate ||
            fastCoinConversionRate <= 0
        ) {

            element.textContent =
                "Not configured";

            return;
        }


        element.textContent =
            `${formatFastCoin(
                fastCoinConversionRate
            )} Fast Coins = ₹1`;
    });


    const rateText =
        getFastCoinElement(
            "fastCoinRateText"
        );


    if (!rateText) {
        return;
    }


    if (
        fastCoinConversionRate > 0
    ) {

        rateText.textContent =
            `${formatFastCoin(
                fastCoinConversionRate
            )} Fast Coins = ₹1`;

    } else {

        rateText.textContent =
            "Conversion rate unavailable";
    }
}


// ------------------------------------------------------------
// REQUIRED FAST COINS
// ------------------------------------------------------------

function getRequiredFastCoins() {

    if (
        !Number.isFinite(
            fastCoinPaymentAmount
        ) ||
        fastCoinPaymentAmount <= 0
    ) {
        return 0;
    }


    if (
        !Number.isFinite(
            fastCoinConversionRate
        ) ||
        fastCoinConversionRate <= 0
    ) {
        return 0;
    }


    return Math.ceil(
        fastCoinPaymentAmount *
        fastCoinConversionRate
    );
}


// ------------------------------------------------------------
// REQUIRED COINS DISPLAY
// ------------------------------------------------------------

function updateRequiredFastCoinDisplay() {

    const requiredCoins =
        getRequiredFastCoins();


    const elements = [
        getFastCoinElement(
            "fastCoinRequired"
        ),

        getFastCoinElement(
            "fastcoinRequired"
        ),

        getFastCoinElement(
            "fastCoinCoinsRequired"
        ),

        getFastCoinElement(
            "fastCoinCost"
        )
    ];


    elements.forEach(element => {

        if (!element) {
            return;
        }


        element.textContent =
            formatFastCoin(
                requiredCoins
            );
    });
}


// ------------------------------------------------------------
// PAYMENT AMOUNT
// ------------------------------------------------------------

function setFastCoinAmount(amount) {

    fastCoinPaymentAmount =
        Number(amount || 0);


    const elements = [
        getFastCoinElement(
            "fastCoinPaymentAmount"
        ),

        getFastCoinElement(
            "fastCoinAmount"
        ),

        getFastCoinElement(
            "fastCoinTotal"
        )
    ];


    elements.forEach(element => {

        if (!element) {
            return;
        }


        element.textContent =
            `₹${fastCoinPaymentAmount.toFixed(2)}`;
    });


    updateRequiredFastCoinDisplay();
    updateFastCoinPaymentState();
}


// ------------------------------------------------------------
// PAYMENT STATE
// ------------------------------------------------------------

function updateFastCoinPaymentState() {

    const payButton =
        getFastCoinElement(
            "fastCoinPayBtn"
        );


    const requiredCoins =
        getRequiredFastCoins();


    const invalidAmount =
        !Number.isFinite(
            fastCoinPaymentAmount
        ) ||
        fastCoinPaymentAmount <= 0;


    const invalidRate =
        !Number.isFinite(
            fastCoinConversionRate
        ) ||
        fastCoinConversionRate <= 0;


    const insufficient =
        requiredCoins >
        fastCoinBalance;


    if (payButton) {

        payButton.disabled =
            paymentInProgress ||
            invalidAmount ||
            invalidRate ||
            insufficient;


        payButton.textContent =
            paymentInProgress
                ? "PROCESSING..."
                : "PAY WITH FAST COIN";
    }


    const warning =
        getFastCoinElement(
            "fastCoinInsufficient"
        );


    if (!warning) {
        return;
    }


    if (invalidRate) {

        warning.classList.remove(
            "hidden"
        );

        warning.textContent =
            "Fast Coin conversion is not configured by Admin.";

    } else if (insufficient) {

        warning.classList.remove(
            "hidden"
        );

        warning.textContent =
            `Insufficient Fast Coins. Required: ${formatFastCoin(
                requiredCoins
            )}`;

    } else {

        warning.classList.add(
            "hidden"
        );
    }
}


// ------------------------------------------------------------
// ERROR DISPLAY
// ------------------------------------------------------------

function showFastCoinError(message) {

    const error =
        getFastCoinElement(
            "fastCoinMessage"
        );


    if (!error) {
        return;
    }


    error.textContent =
        message;


    error.classList.remove(
        "hidden"
    );
}


function clearFastCoinError() {

    const error =
        getFastCoinElement(
            "fastCoinMessage"
        );


    if (!error) {
        return;
    }


    error.textContent = "";


    error.classList.add(
        "hidden"
    );
}


// ------------------------------------------------------------
// FAST COIN PAYMENT
// ------------------------------------------------------------

async function handleFastCoinPayment() {

    if (paymentInProgress) {
        return;
    }


    clearFastCoinError();


    const firebaseUser =
        getCurrentFirebaseUser();


    if (!firebaseUser) {

        showFastCoinError(
            "Please sign in before using Fast Coin."
        );

        return;
    }


    currentUser =
        firebaseUser;

    fastCoinUserId =
        firebaseUser.uid;


    if (
        !Number.isFinite(
            fastCoinPaymentAmount
        ) ||
        fastCoinPaymentAmount <= 0
    ) {

        showFastCoinError(
            "Invalid payment amount."
        );

        return;
    }


    if (
        !Number.isFinite(
            fastCoinConversionRate
        ) ||
        fastCoinConversionRate <= 0
    ) {

        showFastCoinError(
            "Fast Coin conversion is not configured by Admin."
        );

        return;
    }


    const requiredCoins =
        getRequiredFastCoins();


    if (requiredCoins <= 0) {

        showFastCoinError(
            "Unable to calculate the Fast Coin payment."
        );

        return;
    }


    if (
        requiredCoins >
        fastCoinBalance
    ) {

        showFastCoinError(
            `Insufficient Fast Coins. You need ${formatFastCoin(
                requiredCoins
            )} Fast Coins.`
        );

        updateFastCoinPaymentState();

        return;
    }


    // --------------------------------------------------------
    // GET ORDER ID
    // --------------------------------------------------------

    const urlParams =
        new URLSearchParams(
            window.location.search
        );


    const orderId =
        urlParams.get("order");


    if (!orderId) {

        showFastCoinError(
            "Payment order could not be found. Please refresh the page and try again."
        );

        return;
    }


    paymentInProgress = true;

    updateFastCoinPaymentState();


    try {

        const token =
            await getFirebaseIdToken();


        // ----------------------------------------------------
        // SECURE WORKER PAYMENT
        // ----------------------------------------------------

        const response =
            await fetch(
                `${FAST_COIN_WORKER_URL}/fastcoin/pay`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`,

                        "Accept":
                            "application/json"
                    },

                    body: JSON.stringify({
                        orderId
                    })
                }
            );


        let result = null;


        try {
            result =
                await response.json();
        } catch {
            result = null;
        }


        if (
            !response.ok ||
            !result?.success
        ) {

            throw new Error(
                result?.error ||
                result?.message ||
                `Fast Coin payment failed. HTTP ${response.status}.`
            );
        }


        // ----------------------------------------------------
        // WORKER SUCCESS
        // ----------------------------------------------------

        paymentInProgress = false;


        /*
         * The Worker returns the authoritative balance.
         */

        if (
            Number.isFinite(
                Number(result.balance)
            )
        ) {

            fastCoinBalance =
                Math.max(
                    0,
                    Number(result.balance)
                );
        }


        if (
            Number.isFinite(
                Number(result.coinsPerRupee)
            ) &&
            Number(result.coinsPerRupee) > 0
        ) {

            fastCoinConversionRate =
                Number(
                    result.coinsPerRupee
                );
        }


        updateFastCoinDisplay();


        /*
         * Do not clear the cart here. payment.js receives this
         * verified Worker result and owns the final success flow.
         */

        window.dispatchEvent(
            new CustomEvent(
                "fastcoin-payment-success",
                {
                    detail: result
                }
            )
        );


    } catch (error) {

        console.error(
            "Fast Coin payment failed:",
            error
        );


        paymentInProgress = false;


        showFastCoinError(
            error instanceof Error
                ? error.message
                : "Fast Coin payment failed."
        );


        updateFastCoinPaymentState();
    }
}


// ------------------------------------------------------------
// RESET PAYMENT
// ------------------------------------------------------------

function resetFastCoinPayment() {
    paymentInProgress = false;

    clearFastCoinError();


    updateRequiredFastCoinDisplay();
    updateFastCoinPaymentState();
}


// ------------------------------------------------------------
// INITIALIZE FAST COIN
// ------------------------------------------------------------

function initFastCoinPayment() {

    /*
     * payment.js supplies the authenticated Firebase user.
     */

    /*
     * Register the button only once.
     */

    if (!initialized) {

        initialized = true;


        const payButton =
            getFastCoinElement(
                "fastCoinPayBtn"
            );


        if (payButton) {

            payButton.addEventListener(
                "click",
                handleFastCoinPayment
            );
        }
    }


    /*
     * IMPORTANT:
     *
     * If payment.js called this before Firebase Auth
     * finished restoring the session, do NOT make a
     * premature Worker request.
     *
     * If an authenticated user was supplied, load now.
     */

    const firebaseUser =
        getCurrentFirebaseUser();


    if (firebaseUser) {

        currentUser =
            firebaseUser;

        fastCoinUserId =
            firebaseUser.uid;


        loadFastCoinBalance(
            firebaseUser
        );

    } else {

        /*
         * Firebase authentication will be handled by
         * payment.js. Once payment.js has the user it
         * calls this function again.
         */

        updateFastCoinDisplay();
    }
}


// ------------------------------------------------------------
// RESET MODULE STATE
// ------------------------------------------------------------

function resetFastCoinPaymentState() {

    fastCoinBalance = 0;

    fastCoinPaymentAmount = 0;

    fastCoinUserId = null;

    fastCoinConversionRate = 0;

    currentUser = null;

    paymentInProgress = false;


    clearFastCoinError();


    updateFastCoinBalanceDisplay();
    updateFastCoinConversionDisplay();
    updateRequiredFastCoinDisplay();
    updateFastCoinPaymentState();
}


// ------------------------------------------------------------
// ES MODULE EXPORTS
// ------------------------------------------------------------

export {
    initFastCoinPayment,
    loadFastCoinBalance,
    setFastCoinAmount,
    resetFastCoinPayment,
    resetFastCoinPaymentState
};
