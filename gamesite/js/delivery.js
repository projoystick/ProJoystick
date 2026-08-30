/* ==========================================
   GAMEVAULT - DELIVERY INFORMATION
========================================== */

import {
    auth,
    db
} from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* ==========================================
   CONSTANTS
========================================== */

const CART_STORAGE_KEY =
    "gamevault_cart";

const CHECKOUT_STORAGE_KEY =
    "gamevault_checkout";

const DELIVERY_STORAGE_KEY =
    "gamevault_delivery";


/* ==========================================
   ELEMENTS
========================================== */

const deliveryGames =
    document.getElementById(
        "deliveryGames"
    );

const deliveryForm =
    document.getElementById(
        "deliveryForm"
    );

const deliverySubmit =
    document.getElementById(
        "deliverySubmit"
    );


/* ==========================================
   HELPERS
========================================== */

function getCart() {

    try {

        const stored =
            localStorage.getItem(
                CART_STORAGE_KEY
            );

        if (!stored) {
            return [];
        }

        const parsed =
            JSON.parse(stored);

        return Array.isArray(parsed)
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "Cart error:",
            error
        );

        return [];
    }
}


function getCheckoutData() {

    try {

        const stored =
            sessionStorage.getItem(
                CHECKOUT_STORAGE_KEY
            );

        if (!stored) {
            return null;
        }

        return JSON.parse(stored);

    } catch (error) {

        console.error(
            "Checkout data error:",
            error
        );

        return null;
    }
}


function saveDeliveryData(data) {

    sessionStorage.setItem(
        DELIVERY_STORAGE_KEY,
        JSON.stringify(data)
    );
}


/* ==========================================
   LOAD DELIVERY FIELDS
========================================== */

async function loadDeliveryFields(user) {

    const cart =
        getCart();


    if (!cart.length) {

        showError(
            "Your cart is empty."
        );

        return;
    }


    const checkout =
        getCheckoutData();


    if (
        !checkout ||
        checkout.userId !== user.uid
    ) {

        showError(
            "Your checkout session has expired."
        );

        return;
    }


    try {

        const productsSnapshot =
            await getDocs(
                collection(
                    db,
                    "products"
                )
            );


        const products =
            new Map();


        productsSnapshot.forEach(
            productDoc => {

                products.set(
                    productDoc.id,
                    {
                        id:
                            productDoc.id,
                        ...productDoc.data()
                    }
                );

            }
        );


        const gameIds =
            [];


        const gameNames =
            new Map();


        /*
         * Get unique games from cart.
         */

        cart.forEach(item => {

            const product =
                products.get(item.id);


            const gameId =
                product?.gameId ||
                item.gameId ||
                "";


            if (!gameId) {
                return;
            }


            if (!gameIds.includes(gameId)) {

                gameIds.push(gameId);

                gameNames.set(
                    gameId,
                    product?.gameName ||
                    item.game ||
                    "GAME"
                );
            }

        });


        if (!gameIds.length) {

            deliveryGames.innerHTML = `
                <div class="delivery-empty">
                    No delivery information is required
                    for these products.
                </div>
            `;

            return;
        }


        const gamesSnapshot =
            await getDocs(
                collection(
                    db,
                    "games"
                )
            );


        const games =
            new Map();


        gamesSnapshot.forEach(
            gameDoc => {

                games.set(
                    gameDoc.id,
                    {
                        id:
                            gameDoc.id,
                        ...gameDoc.data()
                    }
                );

            }
        );


        deliveryGames.innerHTML =
            "";


        let fieldCount = 0;


        gameIds.forEach(gameId => {

            const game =
                games.get(gameId);


            if (!game) {
                return;
            }


            const fields =
                Array.isArray(
                    game.deliveryFields
                )
                    ? game.deliveryFields
                    : [];


            if (!fields.length) {
                return;
            }


            fieldCount +=
                fields.length;


            const box =
                document.createElement(
                    "section"
                );


            box.className =
                "delivery-game-box";


            const fieldsHTML =
                fields.map(
                    field => {

                        const key =
                            field.key;


                        const label =
                            field.label ||
                            key;


                        const required =
                            field.required === true;


                        let inputHTML =
                            "";


                        if (
                            field.type ===
                            "select"
                        ) {

                            const options =
                                Array.isArray(
                                    field.options
                                )
                                    ? field.options
                                    : [];


                            inputHTML = `
                                <select
                                    name="${escapeAttribute(
                                        gameId
                                    )}.${escapeAttribute(
                                        key
                                    )}"
                                    ${
                                        required
                                            ? "required"
                                            : ""
                                    }
                                >

                                    <option
                                        value=""
                                    >
                                        Select ${escapeHTML(
                                            label
                                        )}
                                    </option>

                                    ${options.map(
                                        option => `
                                            <option
                                                value="${escapeAttribute(
                                                    option
                                                )}"
                                            >
                                                ${escapeHTML(
                                                    option
                                                )}
                                            </option>
                                        `
                                    ).join("")}

                                </select>
                            `;

                        } else {

                            inputHTML = `
                                <input
                                    type="${field.type === "number"
                                        ? "number"
                                        : "text"}"
                                    name="${escapeAttribute(
                                        gameId
                                    )}.${escapeAttribute(
                                        key
                                    )}"
                                    placeholder="Enter ${escapeAttribute(
                                        label
                                    )}"
                                    ${
                                        required
                                            ? "required"
                                            : ""
                                    }
                                >
                            `;
                        }


                        return `
                            <div class="delivery-field">

                                <label>

                                    ${escapeHTML(
                                        label
                                    )}

                                    ${
                                        required
                                            ? `<span>*</span>`
                                            : ""
                                    }

                                </label>

                                ${inputHTML}

                            </div>
                        `;
                    }
                ).join("");


            box.innerHTML = `
                <div class="delivery-game-header">

                    <span>
                        GAME ACCOUNT
                    </span>

                    <h2>
                        ${escapeHTML(
                            game.name ||
                            gameNames.get(gameId) ||
                            "Game"
                        )}
                    </h2>

                </div>

                ${fieldsHTML}
            `;


            deliveryGames.appendChild(
                box
            );

        });


        if (!fieldCount) {

            deliveryGames.innerHTML = `
                <div class="delivery-empty">
                    No account information is required
                    for these products.
                </div>
            `;

        }

    } catch (error) {

        console.error(
            "Delivery fields loading error:",
            error
        );


        showError(
            error.message ||
            "Unable to load delivery information."
        );
    }
}


/* ==========================================
   SAVE DELIVERY
========================================== */

deliveryForm?.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        try {

            const data = {};


            const inputs =
                deliveryForm.querySelectorAll(
                    "input[name], select[name]"
                );


            inputs.forEach(input => {

                const name =
                    input.name;


                const separator =
                    name.indexOf(".");


                if (
                    separator === -1
                ) {
                    return;
                }


                const gameId =
                    name.substring(
                        0,
                        separator
                    );


                const key =
                    name.substring(
                        separator + 1
                    );


                if (!data[gameId]) {

                    data[gameId] = {
                        fields: {}
                    };

                }


                data[gameId].fields[key] =
                    input.value.trim();

            });


            saveDeliveryData(
                data
            );


            if (deliverySubmit) {

                deliverySubmit.disabled =
                    true;

                deliverySubmit.textContent =
                    "Preparing Payment...";

            }


            window.location.href =
                "payment.html";

        } catch (error) {

            console.error(
                "Delivery save error:",
                error
            );


            alert(
                error.message ||
                "Unable to save delivery information."
            );

        }

    }
);


/* ==========================================
   UTILITY
========================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function escapeAttribute(value) {
    return escapeHTML(value);
}


function showError(message) {

    if (deliveryGames) {

        deliveryGames.innerHTML = `
            <div class="delivery-empty">
                ${escapeHTML(message)}
            </div>
        `;

    }
}


/* ==========================================
   AUTH
========================================== */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "login.html?redirect=delivery.html";

            return;
        }


        await loadDeliveryFields(user);

    }
);