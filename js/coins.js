import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ======================================================
// ELEMENTS
// ======================================================

const coinsContent = document.getElementById("coinsContent");


// ======================================================
// STATE
// ======================================================

let currentUser = null;
let isRedeeming = false;


// ======================================================
// REDEEM SPINNER SVG
// ======================================================

const redeemSpinnerSVG = `
    <svg
        class="redeem-spinner-svg"
        stroke="hsl(228, 97%, 42%)"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <g>
            <circle
                cx="12"
                cy="12"
                r="9.5"
                fill="none"
                stroke-width="3"
                stroke-linecap="round"
            >
                <animate
                    attributeName="stroke-dasharray"
                    dur="1.5s"
                    calcMode="spline"
                    values="0 150;42 150;42 150;42 150"
                    keyTimes="0;0.475;0.95;1"
                    keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1"
                    repeatCount="indefinite"
                />

                <animate
                    attributeName="stroke-dashoffset"
                    dur="1.5s"
                    calcMode="spline"
                    values="0;-16;-59;-59"
                    keyTimes="0;0.475;0.95;1"
                    keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1"
                    repeatCount="indefinite"
                />
            </circle>

            <animateTransform
                attributeName="transform"
                type="rotate"
                dur="2s"
                values="0 12 12;360 12 12"
                repeatCount="indefinite"
            />
        </g>
    </svg>
`;


// ======================================================
// AUTH STATE
// ======================================================

onAuthStateChanged(auth, async (user) => {

    currentUser = user;

    if (!user) {
        showLoginMessage();
        return;
    }

    await loadCoinsPage(user);

});


// ======================================================
// LOGIN MESSAGE
// ======================================================

function showLoginMessage() {

    if (!coinsContent) return;

    coinsContent.innerHTML = `
        <div class="login-message">

            <h2>Please log in</h2>

            <p>
                You need to be logged in to view
                your Fast Coins.
            </p>

            <br>

            <a href="login.html" class="btn">
                Login
            </a>

        </div>
    `;

}


// ======================================================
// LOAD COINS PAGE
// ======================================================

async function loadCoinsPage(user) {

    if (!coinsContent) return;

    try {

        // ==================================================
        // GET USER BALANCE
        // ==================================================

        const userRef = doc(
            db,
            "users",
            user.uid
        );

        const userSnapshot = await getDoc(userRef);

        let coins = 0;

        if (userSnapshot.exists()) {

            const userData = userSnapshot.data();

            coins = Number(userData.coins) || 0;

        }


        // ==================================================
        // BUILD PAGE
        // ==================================================

        coinsContent.innerHTML = `

            <section class="coin-balance-card">

                <div class="balance-label">
                    YOUR FAST COINS BALANCE
                </div>

                <div class="balance-value">

                    <span class="balance-coin">
                        🪙
                    </span>

                    <span>
                        ${coins.toLocaleString()}
                    </span>

                </div>

            </section>


            <section class="coins-section">

                <h2>Ways to Earn</h2>

                <div class="coin-card-grid">

                    <div class="coin-card">

                        <div class="coin-card-icon">
                            🎮
                        </div>

                        <h3>
                            Create an Account
                        </h3>

                        <p>
                            Receive the Fast Coins configured
                            by PROJOYSTICK when you create
                            your account.
                        </p>

                    </div>


                    <div class="coin-card">

                        <div class="coin-card-icon">
                            🛒
                        </div>

                        <h3>
                            Make Your First Purchase
                        </h3>

                        <p>
                            Your first eligible purchase can
                            earn the configured Fast Coins reward.
                        </p>

                    </div>



                    <div class="coin-card">

                        <div class="coin-card-icon">
                            🎁
                        </div>

                        <h3>
                            Special Promotions
                        </h3>

                        <p>
                            Redeem active promotion codes to
                            receive bonus Fast Coins.
                        </p>

                    </div>

                </div>

            </section>


            <section class="coins-section">

                <h2>Redeem a Code</h2>

                <div class="redeem-box">

                    <input
                        type="text"
                        id="redeemCode"
                        placeholder="Enter promotion code"
                        autocomplete="off"
                        maxlength="100"
                    >

                    <button
                        type="button"
                        class="redeem-btn"
                        id="redeemBtn"
                    >
                        Redeem
                    </button>

                </div>

            </section>


            <section class="coins-section">

                <h2>Transaction History</h2>

                <div
                    class="transaction-list"
                    id="transactionList"
                >
                    Loading transactions...
                </div>

            </section>

        `;


        // ==================================================
        // REDEEM BUTTON
        // ==================================================

        const redeemButton =
            document.getElementById("redeemBtn");

        if (redeemButton) {

            redeemButton.addEventListener(
                "click",
                () => redeemPromotion(user)
            );

        }


        // ==================================================
        // ENTER KEY
        // ==================================================

        const redeemInput =
            document.getElementById("redeemCode");

        if (redeemInput) {

            redeemInput.addEventListener(
                "keydown",
                (event) => {

                    if (event.key === "Enter") {

                        event.preventDefault();

                        redeemPromotion(user);

                    }

                }
            );

        }


        // ==================================================
        // TRANSACTIONS
        // ==================================================

        await loadTransactions(user);

    } catch (error) {

        console.error(
            "Failed to load coins page:",
            error
        );

        coinsContent.innerHTML = `
            <div class="login-message">

                <h2>
                    Unable to load Fast Coins
                </h2>

                <p>
                    Please try again later.
                </p>

            </div>
        `;

    }

}


// ======================================================
// LOAD TRANSACTIONS
// ======================================================

async function loadTransactions(user) {

    const transactionList =
        document.getElementById("transactionList");

    if (!transactionList) return;

    try {

        const transactionsRef =
            collection(db, "coinTransactions");

        const transactionQuery = query(
            transactionsRef,

            where(
                "userId",
                "==",
                user.uid
            ),

            orderBy(
                "createdAt",
                "desc"
            ),

            limit(20)
        );

        const snapshot =
            await getDocs(transactionQuery);


        if (snapshot.empty) {

            transactionList.innerHTML = `
                <div class="transaction">

                    <div class="transaction-info">

                        <strong>
                            No transactions yet
                        </strong>

                        <span>
                            Your Fast Coins activity
                            will appear here.
                        </span>

                    </div>

                </div>
            `;

            return;

        }


        transactionList.innerHTML = "";


        snapshot.forEach((transactionDoc) => {

            const data =
                transactionDoc.data();

            const amount =
                Number(data.amount) || 0;

            const positive =
                amount >= 0;

            const date =
                data.createdAt?.toDate
                    ? data.createdAt.toDate()
                    : null;

            const formattedDate =
                date
                    ? date.toLocaleString()
                    : "Date unavailable";


            const transactionElement =
                document.createElement("div");

            transactionElement.className =
                "transaction";


            transactionElement.innerHTML = `

                <div class="transaction-info">

                    <strong>
                        ${escapeHtml(
                            data.description ||
                            data.type ||
                            "Coin transaction"
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(formattedDate)}
                    </span>

                </div>


                <div
                    class="transaction-amount ${
                        positive
                            ? "positive"
                            : "negative"
                    }"
                >

                    ${positive ? "+" : ""}

                    ${amount.toLocaleString()}

                    🪙

                </div>

            `;


            transactionList.appendChild(
                transactionElement
            );

        });

    } catch (error) {

        console.error(
            "Failed to load transactions:",
            error
        );

        transactionList.innerHTML = `
            <div class="transaction">
                Unable to load transaction history.
            </div>
        `;

    }

}


// ======================================================
// REDEEM PROMOTION
// ======================================================

async function redeemPromotion(user) {

    if (isRedeeming) return;


    const input =
        document.getElementById("redeemCode");

    if (!input) return;


    const code =
        input.value.trim().toUpperCase();


    // ==================================================
    // EMPTY CODE
    // ==================================================

    if (!code) {

        openRedeemModal(
            "error",
            "Enter a promotion code",
            "Please enter a promotion code before continuing.",
            true
        );

        return;

    }


    // ==================================================
    // USER CHECK
    // ==================================================

    if (!user) {

        openRedeemModal(
            "error",
            "Login required",
            "Please log in before redeeming a promotion code.",
            true
        );

        return;

    }


    // ==================================================
    // START REDEEM
    // ==================================================

    isRedeeming = true;


    const redeemButton =
        document.getElementById("redeemBtn");


    if (redeemButton) {

        redeemButton.disabled = true;

        redeemButton.textContent =
            "Processing...";

    }


    // ==================================================
    // SHOW POPUP
    // ==================================================

    openRedeemModal(
        "loading",
        "Verifying your code...",
        "Please wait while we securely process your redemption.",
        false
    );


    try {

        // ==================================================
        // GET FRESH TOKEN
        // ==================================================

        updateRedeemModal(
            "loading",
            "Verifying your account...",
            "Securing your redemption request."
        );


        const idToken =
            await user.getIdToken(true);


        // ==================================================
        // UPDATE POPUP
        // ==================================================

        updateRedeemModal(
            "loading",
            "Redeeming your code...",
            "Your Fast Coins are being added securely."
        );


        // ==================================================
        // API REQUEST
        // ==================================================

        const response = await fetch(
            "https://projoystick-api.servng8.workers.dev/redeem",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${idToken}`
                },

                body: JSON.stringify({
                    code: code
                })
            }
        );


        // ==================================================
        // RESPONSE
        // ==================================================

        let result = null;


        try {

            result =
                await response.json();

        } catch (error) {

            result = {
                success: false,
                message:
                    "The redemption server returned an invalid response."
            };

        }


        console.log(
            "Redeem API response:",
            result
        );


        // ==================================================
        // FAILED
        // ==================================================

        if (
            !response.ok ||
            !result ||
            !result.success
        ) {

            openRedeemModal(
                "error",
                "Redemption failed",
                result?.message ||
                    "Unable to redeem this promotion.",
                true
            );


            resetRedeemButton();

            return;

        }


        // ==================================================
        // SUCCESS
        // ==================================================

        const awardedCoins =
            Number(result.coinsAwarded) || 0;


        const newBalance =
            Number(result.balance);


        let successMessage =
            `You received ${awardedCoins.toLocaleString()} Fast Coins.`;


        if (!Number.isNaN(newBalance)) {

            successMessage +=
                ` Your new balance is ${newBalance.toLocaleString()} coins.`;

        }


        openRedeemModal(
            "success",
            "Redemption successful!",
            successMessage,
            false
        );


        // ==================================================
        // RELOAD PAGE
        // ==================================================

        setTimeout(() => {

            window.location.reload();

        }, 1800);

    } catch (error) {

        console.error(
            "Redeem API error:",
            error
        );


        openRedeemModal(
            "error",
            "Connection failed",
            "Unable to connect to the secure redemption system. Please try again.",
            true
        );


        resetRedeemButton();

    }

}


// ======================================================
// REDEEM MODAL
// ======================================================

function openRedeemModal(
    type,
    title,
    message,
    showClose = false
) {

    const modal =
        document.getElementById("redeemModal");


    if (!modal) {

        console.error(
            "Redeem modal #redeemModal was not found."
        );

        return;

    }


    updateRedeemModal(
        type,
        title,
        message
    );


    const closeButton =
        document.getElementById(
            "redeemModalClose"
        );


    if (closeButton) {

        closeButton.hidden =
            !showClose;

    }


    modal.hidden = false;

    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add(
        "redeem-modal-open"
    );

}


// ======================================================
// UPDATE MODAL
// ======================================================

function updateRedeemModal(
    type,
    title,
    message
) {

    const icon =
        document.getElementById(
            "redeemModalIcon"
        );

    const titleElement =
        document.getElementById(
            "redeemModalTitle"
        );

    const messageElement =
        document.getElementById(
            "redeemModalMessage"
        );


    if (
        !icon ||
        !titleElement ||
        !messageElement
    ) {

        console.error(
            "Redeem modal elements are missing."
        );

        return;

    }


    // ==================================================
    // LOADING
    // ==================================================

    if (type === "loading") {

        icon.className =
            "redeem-modal-icon loading";

        icon.innerHTML =
            redeemSpinnerSVG;

    }


    // ==================================================
    // SUCCESS
    // ==================================================

    if (type === "success") {

        icon.className =
            "redeem-modal-icon success";

        icon.textContent =
            "✓";

    }


    // ==================================================
    // ERROR
    // ==================================================

    if (type === "error") {

        icon.className =
            "redeem-modal-icon error";

        icon.textContent =
            "×";

    }


    titleElement.textContent =
        title;

    messageElement.textContent =
        message;

}


// ======================================================
// CLOSE MODAL
// ======================================================

function closeRedeemModal() {

    const modal =
        document.getElementById(
            "redeemModal"
        );


    if (!modal) return;


    modal.hidden = true;

    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.classList.remove(
        "redeem-modal-open"
    );

}


// ======================================================
// CLOSE BUTTON
// ======================================================

document.addEventListener(
    "click",
    (event) => {

        if (
            event.target.closest(
                "#redeemModalClose"
            )
        ) {

            if (isRedeeming) return;

            closeRedeemModal();

            resetRedeemButton();

        }

    }
);


// ======================================================
// BACKDROP
// ======================================================

document.addEventListener(
    "click",
    (event) => {

        if (
            event.target.closest(
                "#redeemModalBackdrop"
            )
        ) {

            if (isRedeeming) return;

            closeRedeemModal();

            resetRedeemButton();

        }

    }
);


// ======================================================
// ESCAPE
// ======================================================

document.addEventListener(
    "keydown",
    (event) => {

        if (
            event.key === "Escape" &&
            !isRedeeming
        ) {

            const modal =
                document.getElementById(
                    "redeemModal"
                );


            if (
                modal &&
                !modal.hidden
            ) {

                closeRedeemModal();

                resetRedeemButton();

            }

        }

    }
);


// ======================================================
// RESET BUTTON
// ======================================================

function resetRedeemButton() {

    isRedeeming = false;


    const redeemButton =
        document.getElementById(
            "redeemBtn"
        );


    if (redeemButton) {

        redeemButton.disabled = false;

        redeemButton.textContent =
            "Redeem";

    }

}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}
