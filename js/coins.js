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


const coinsContent = document.getElementById("coinsContent");


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(auth, async (user) => {

    if (!user) {
        showLoginMessage();
        return;
    }

    await loadCoinsPage(user);

});


/* ==========================================
   SHOW LOGIN MESSAGE
========================================== */

function showLoginMessage() {

    if (!coinsContent) {
        return;
    }

    coinsContent.innerHTML = `
        <div class="login-message">

            <h2>Please log in</h2>

            <p>
                You need to be logged in to view your Fast Coins.
            </p>

            <br>

            <a href="login.html" class="btn">
                Login
            </a>

        </div>
    `;

}


/* ==========================================
   LOAD COINS PAGE
========================================== */

async function loadCoinsPage(user) {

    try {

        /*
         * IMPORTANT:
         *
         * Read the user's document directly:
         *
         * users/{user.uid}
         *
         * This matches the Firestore security rule:
         *
         * match /users/{userId}
         *
         * A normal user can therefore read
         * their own profile and coin balance.
         */

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


        /*
         * Build the Coins page.
         */

        coinsContent.innerHTML = `

            <!-- =========================
                 BALANCE
            ========================== -->

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


            <!-- =========================
                 WAYS TO EARN
            ========================== -->

            <section class="coins-section">

                <h2>Ways to Earn</h2>

                <div class="coin-card-grid">


                    <!-- ACCOUNT CREATION -->

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


                    <!-- FIRST PURCHASE -->

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


                    <!-- DAILY LOGIN -->

                    <div class="coin-card">

                        <div class="coin-card-icon">
                            📅
                        </div>

                        <h3>
                            Daily Login
                        </h3>

                        <p>
                            Log in regularly to receive the
                            daily Fast Coins reward.
                        </p>

                    </div>


                    <!-- PROMOTIONS -->

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


            <!-- =========================
                 REDEEM CODE
            ========================== -->

            <section class="coins-section">

                <h2>
                    Redeem a Code
                </h2>

                <div class="redeem-box">

                    <input
                        type="text"
                        id="redeemCode"
                        placeholder="Enter promotion code"
                        autocomplete="off"
                    >

                    <button
                        type="button"
                        class="redeem-btn"
                        id="redeemBtn"
                    >
                        Redeem
                    </button>

                </div>

                <div
                    class="coin-message"
                    id="redeemMessage"
                ></div>

            </section>


            <!-- =========================
                 TRANSACTION HISTORY
            ========================== -->

            <section class="coins-section">

                <h2>
                    Transaction History
                </h2>

                <div
                    class="transaction-list"
                    id="transactionList"
                >
                    Loading transactions...
                </div>

            </section>

        `;


        /*
         * Redeem button
         */

        const redeemButton =
            document.getElementById("redeemBtn");

        if (redeemButton) {

            redeemButton.addEventListener(
                "click",
                () => redeemPromotion(user)
            );

        }


        /*
         * Load transaction history.
         */

        await loadTransactions(user);


    } catch (error) {

        console.error(
            "Failed to load coins page:",
            error
        );

        if (coinsContent) {

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

}


/* ==========================================
   LOAD TRANSACTIONS
========================================== */

async function loadTransactions(user) {

    const transactionList =
        document.getElementById("transactionList");


    if (!transactionList) {
        return;
    }


    try {

        const transactionsRef =
            collection(
                db,
                "coinTransactions"
            );


        /*
         * Only request transactions belonging
         * to the currently logged-in user.
         */

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


        /*
         * No transactions yet.
         */

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


        /*
         * Clear loading message.
         */

        transactionList.innerHTML = "";


        /*
         * Display transactions.
         */

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
                        ${formattedDate}
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


/* ==========================================
   REDEEM PROMOTION
========================================== */

async function redeemPromotion(user) {

    const input =
        document.getElementById("redeemCode");


    const message =
        document.getElementById("redeemMessage");


    if (!input || !message) {
        return;
    }


    const code =
        input.value.trim();


    if (!code) {

        message.textContent =
            "Please enter a promotion code.";

        return;

    }


    /*
     * IMPORTANT:
     *
     * Do NOT change the user's coin balance
     * directly from browser JavaScript.
     *
     * Promotion redemption will eventually
     * be handled by trusted backend logic.
     */


    message.textContent =
        "Promotion redemption will be connected to the secure coin system next.";

}


/* ==========================================
   ESCAPE HTML
========================================== */

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
