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

        /* ==========================================
           LOAD PRODUCTS
        ========================================== */

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


        /* ==========================================
           GET GAME IDS
        ========================================== */

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


        /* ==========================================
           LOAD GAMES
        ========================================== */

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


        /* ==========================================
           CLEAR DELIVERY AREA
        ========================================== */

        deliveryGames.innerHTML =
            "";


        /* ==========================================
           CONDITIONAL DELIVERY PRODUCTS
        ========================================== */

        const conditionalProducts =
            [];


        const legacyGameProducts =
            new Map();


        cart.forEach(item => {

            const product =
                products.get(item.id);


            /*
             * Product uses the new conditional
             * delivery configuration.
             */

            if (
                product?.deliveryConfig?.type ===
                "conditional"
            ) {

                conditionalProducts.push({
                    item:
                        item,

                    product:
                        product
                });

            } else {

                /*
                 * Legacy game-based delivery.
                 */

                const gameId =
                    product?.gameId ||
                    item.gameId ||
                    "";


                if (gameId) {

                    if (
                        !legacyGameProducts.has(
                            gameId
                        )
                    ) {

                        legacyGameProducts.set(
                            gameId,
                            []
                        );
                    }


                    legacyGameProducts
                        .get(gameId)
                        .push(item);
                }
            }

        });


        /* ==========================================
           RENDER CONDITIONAL DELIVERY PRODUCTS
        ========================================== */

        conditionalProducts.forEach(
            ({
                item,
                product
            }) => {

                const config =
                    product.deliveryConfig ||
                    {};


                const options =
                    Array.isArray(
                        config.options
                    )
                        ? config.options
                        : [];


                /*
                 * If the product has no options,
                 * do not render it.
                 */

                if (!options.length) {
                    return;
                }


                const box =
                    document.createElement(
                        "section"
                    );


                box.className =
                    "delivery-product-box";


                const optionsHTML =
                    options
                        .map(
                            option => `
                                <option
                                    value="${escapeAttribute(
                                        option.id
                                    )}"
                                >
                                    ${escapeHTML(
                                        option.name ||
                                        "Option"
                                    )}
                                </option>
                            `
                        )
                        .join("");


                box.innerHTML = `

                    <div class="delivery-product-header">

                        <span>
                            DELIVERY OPTION
                        </span>

                        <h2>
                            ${escapeHTML(
                                product.name ||
                                "Product"
                            )}
                        </h2>

                    </div>


                    <div class="delivery-field">

                        <label>
                            Select Delivery Option
                        </label>

                        <select
                            class="conditional-delivery-select"
                            data-product-id="${escapeAttribute(
                                product.id
                            )}"
                            required
                        >

                            <option value="">
                                Choose an option...
                            </option>

                            ${optionsHTML}

                        </select>

                    </div>


                    <div
                        class="conditional-fields-container"
                        data-product-id="${escapeAttribute(
                            product.id
                        )}"
                    ></div>

                `;


                deliveryGames.appendChild(
                    box
                );


                const selectEl =
                    box.querySelector(
                        ".conditional-delivery-select"
                    );


                const fieldsContainer =
                    box.querySelector(
                        ".conditional-fields-container"
                    );


                /* ==========================================
                   CONDITIONAL OPTION CHANGE
                ========================================== */

                selectEl?.addEventListener(
                    "change",
                    event => {

                        const selectedOptionId =
                            event.target.value;


                        const selectedOption =
                            options.find(
                                option =>
                                    option.id ===
                                    selectedOptionId
                            );


                        fieldsContainer.innerHTML =
                            "";


                        if (
                            !selectedOption ||
                            !Array.isArray(
                                selectedOption.fields
                            )
                        ) {

                            return;
                        }


                        selectedOption.fields.forEach(
                            field => {

                                const fieldEl =
                                    document.createElement(
                                        "div"
                                    );


                                fieldEl.className =
                                    "delivery-field";


                                const fieldType =
                                    field.type ||
                                    "text";


                                const fieldInputType =
                                    fieldType === "email"
                                        ? "email"
                                        : fieldType === "number"
                                            ? "number"
                                            : fieldType === "textarea"
                                                ? "textarea"
                                                : "text";


                                let inputHTML =
                                    "";


                                /* ==========================================
                                   TEXTAREA
                                ========================================== */

                                if (
                                    fieldType ===
                                    "textarea"
                                ) {

                                    inputHTML = `

                                        <textarea
                                            name="product.${escapeAttribute(
                                                product.id
                                            )}.${escapeAttribute(
                                                field.id
                                            )}"
                                            placeholder="${escapeAttribute(
                                                field.placeholder ||
                                                field.label ||
                                                ""
                                            )}"
                                            ${
                                                field.required
                                                    ? "required"
                                                    : ""
                                            }
                                        ></textarea>

                                    `;

                                } else {

                                    /* ==========================================
                                       INPUT
                                    ========================================== */

                                    inputHTML = `

                                        <input
                                            type="${fieldInputType}"
                                            name="product.${escapeAttribute(
                                                product.id
                                            )}.${escapeAttribute(
                                                field.id
                                            )}"
                                            placeholder="${escapeAttribute(
                                                field.placeholder ||
                                                field.label ||
                                                ""
                                            )}"
                                            ${
                                                field.required
                                                    ? "required"
                                                    : ""
                                            }
                                        >

                                    `;
                                }


                                fieldEl.innerHTML = `

                                    <label>

                                        ${escapeHTML(
                                            field.label ||
                                            "Field"
                                        )}

                                        ${
                                            field.required
                                                ? "<span>*</span>"
                                                : ""
                                        }

                                    </label>

                                    ${inputHTML}

                                `;


                                fieldsContainer.appendChild(
                                    fieldEl
                                );

                            }
                        );

                    }
                );


                /*
                 * Automatically show the first option's
                 * fields when the product has options.
                 */

                if (options.length > 0) {

                    selectEl.value =
                        options[0].id;


                    selectEl.dispatchEvent(
                        new Event(
                            "change"
                        )
                    );
                }

            }
        );


        /* ==========================================
           RENDER LEGACY GAME DELIVERY FIELDS
        ========================================== */

        let fieldCount =
            0;


        gameIds.forEach(
            gameId => {

                if (
                    !legacyGameProducts.has(
                        gameId
                    )
                ) {

                    return;
                }


                const game =
                    games.get(
                        gameId
                    );


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
                    fields
                        .map(
                            field => {

                                const key =
                                    field.key;


                                const label =
                                    field.label ||
                                    key;


                                const required =
                                    field.required ===
                                    true;


                                let inputHTML =
                                    "";


                                /* ==========================================
                                   SELECT FIELD
                                ========================================== */

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

                                            <option value="">
                                                Select ${escapeHTML(
                                                    label
                                                )}
                                            </option>

                                            ${options
                                                .map(
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
                                                )
                                                .join("")}

                                        </select>

                                    `;

                                } else {

                                    /* ==========================================
                                       NORMAL INPUT
                                    ========================================== */

                                    inputHTML = `

                                        <input
                                            type="${
                                                field.type ===
                                                "number"
                                                    ? "number"
                                                    : "text"
                                            }"
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
                                                    ? "<span>*</span>"
                                                    : ""
                                            }

                                        </label>

                                        ${inputHTML}

                                    </div>

                                `;

                            }
                        )
                        .join("");


                box.innerHTML = `

                    <div class="delivery-game-header">

                        <span>
                            GAME ACCOUNT
                        </span>

                        <h2>
                            ${escapeHTML(
                                game.name ||
                                gameNames.get(
                                    gameId
                                ) ||
                                "Game"
                            )}
                        </h2>

                    </div>

                    ${fieldsHTML}

                `;


                deliveryGames.appendChild(
                    box
                );

            }
        );


        /* ==========================================
           NO DELIVERY INFORMATION
        ========================================== */

        if (
            !conditionalProducts.length &&
            !fieldCount
        ) {

            deliveryGames.innerHTML = `

                <div class="delivery-empty">

                    No delivery information is required
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

            const data =
                {};


            const inputs =
                deliveryForm.querySelectorAll(
                    "input[name], select[name], textarea[name]"
                );


            /* ==========================================
               SAVE ALL DELIVERY INPUTS
            ========================================== */

            inputs.forEach(
                input => {

                    const name =
                        input.name;


                    if (!name) {
                        return;
                    }


                    let gameId;
                    let key;
                    let fieldType;
                    let fieldValue;


                    /*
                     * LEGACY GAME DELIVERY
                     *
                     * Format:
                     *
                     * gameId.fieldKey
                     */

                    if (
                        name.indexOf(
                            "product."
                        ) === -1
                    ) {

                        const separator =
                            name.indexOf(
                                "."
                            );


                        if (
                            separator === -1
                        ) {

                            return;
                        }


                        gameId =
                            name.substring(
                                0,
                                separator
                            );


                        key =
                            name.substring(
                                separator + 1
                            );


                        fieldType =
                            "game";


                        fieldValue =
                            input.value.trim();


                        if (
                            !data[gameId]
                        ) {

                            data[gameId] = {

                                fields:
                                    {}

                            };
                        }


                        data[gameId]
                            .fields[key] =
                            fieldValue;


                    } else {

                        /*
                         * CONDITIONAL DELIVERY
                         *
                         * Format:
                         *
                         * product.productId.fieldId
                         */

                        const parts =
                            name.split(
                                "."
                            );


                        if (
                            parts.length < 3
                        ) {

                            return;
                        }


                        const productId =
                            parts[1];


                        const fieldId =
                            parts
                                .slice(2)
                                .join(".");


                        fieldValue =
                            input.value.trim();


                        const dataKey =
                            `product_${productId}`;


                        if (
                            !data[dataKey]
                        ) {

                            data[dataKey] = {

                                type:
                                    "conditional",

                                fields:
                                    {}

                            };
                        }


                        data[dataKey]
                            .fields[fieldId] =
                            fieldValue;
                    }

                }
            );


            /* ==========================================
               SAVE SELECTED CONDITIONAL OPTIONS
            ========================================== */

            const optionSelects =
                deliveryForm.querySelectorAll(
                    ".conditional-delivery-select"
                );


            optionSelects.forEach(
                select => {

                    const productId =
                        select.dataset.productId;


                    const selectedOptionId =
                        select.value;


                    const selectedOptionText =
                        select
                            .selectedOptions[0]
                            ?.textContent
                            ?.trim() ||
                        "";


                    if (
                        productId &&
                        selectedOptionId
                    ) {

                        const key =
                            `product_${productId}`;


                        if (
                            data[key]
                        ) {

                            data[key]
                                .optionId =
                                selectedOptionId;


                            data[key]
                                .optionName =
                                selectedOptionText;
                        }
                    }

                }
            );


            /* ==========================================
               SAVE DELIVERY DATA
            ========================================== */

            saveDeliveryData(
                data
            );


            /* ==========================================
               DISABLE SUBMIT BUTTON
            ========================================== */

            if (
                deliverySubmit
            ) {

                deliverySubmit.disabled =
                    true;


                deliverySubmit.textContent =
                    "Preparing Payment...";
            }


            /* ==========================================
               GO TO PAYMENT
            ========================================== */

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


        await loadDeliveryFields(
            user
        );

    }
);
