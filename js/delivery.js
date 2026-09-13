/* ==========================================
   PROJOYSTICK - DELIVERY INFORMATION
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

const CART_STORAGE_KEY = "gamevault_cart";
const CHECKOUT_STORAGE_KEY = "gamevault_checkout";
const DELIVERY_STORAGE_KEY = "gamevault_delivery";

/*
 * Payment session created only after successful
 * delivery form submission.
 */
const PAYMENT_SESSION_KEY = "gamevault_payment_session";

/*
 * Optional safety timeout.
 * Payment page should reject sessions older
 * than this amount.
 *
 * 10 minutes.
 */
const PAYMENT_SESSION_MAX_AGE = 10 * 60 * 1000;


/* ==========================================
   ELEMENTS
========================================== */

const deliveryGames =
    document.getElementById("deliveryGames");

const deliveryForm =
    document.getElementById("deliveryForm");

const deliverySubmit =
    document.getElementById("deliverySubmit");


/* ==========================================
   INITIALIZATION STATE
========================================== */

let deliveryReady = false;
let deliveryInitializing = true;
let submissionInProgress = false;


/* ==========================================
   INITIAL BUTTON STATE
========================================== */

if (deliverySubmit) {
    deliverySubmit.disabled = true;
    deliverySubmit.textContent =
        "Loading delivery information...";
}


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
   PAYMENT SESSION
========================================== */

/*
 * Creates a temporary payment session.
 *
 * IMPORTANT:
 * This is a client-side navigation/session guard.
 * It is NOT a secure payment authorization mechanism.
 *
 * Your backend/payment provider must still validate
 * the actual order and payment.
 */
function createPaymentSession() {

    const session = {
        createdAt: Date.now(),
        source: "delivery"
    };

    sessionStorage.setItem(
        PAYMENT_SESSION_KEY,
        JSON.stringify(session)
    );
}


/*
 * Optional helper if you ever need to check the
 * payment session from another page.
 */
function getPaymentSession() {

    try {

        const stored =
            sessionStorage.getItem(
                PAYMENT_SESSION_KEY
            );

        if (!stored) {
            return null;
        }

        const session =
            JSON.parse(stored);

        if (
            !session ||
            typeof session !== "object"
        ) {
            return null;
        }

        return session;

    } catch (error) {

        console.error(
            "Payment session error:",
            error
        );

        return null;
    }
}


/* ==========================================
   OPTION VALUE GENERATOR
========================================== */

function createOptionValue(label) {

    return String(label || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}


/* ==========================================
   NORMALIZE DELIVERY OPTIONS
========================================== */

function normalizeDropdownOption(option) {

    if (typeof option === "string") {

        return {
            label: option.trim(),
            value: createOptionValue(option),
            conditionalFields: []
        };
    }

    const label =
        String(
            option?.label ??
            option?.name ??
            ""
        ).trim();

    const value =
        String(
            option?.value ??
            option?.id ??
            createOptionValue(label)
        ).trim();

    const conditionalFields =
        Array.isArray(
            option?.conditionalFields
        )
            ? option.conditionalFields
            : Array.isArray(
                option?.fields
            )
                ? option.fields
                : [];

    return {
        label,
        value,
        conditionalFields
    };
}


function normalizeDropdownOptions(options) {

    if (!Array.isArray(options)) {
        return [];
    }

    return options
        .map(normalizeDropdownOption)
        .filter(
            option =>
                option.label
        );
}


/* ==========================================
   CREATE DELIVERY FIELD
========================================== */

function createDeliveryFieldElement(
    field,
    namePrefix,
    parentContainer
) {

    if (!field || !parentContainer) {
        return null;
    }

    const fieldKey =
        String(
            field.key ??
            field.id ??
            ""
        ).trim();

    const fieldLabel =
        String(
            field.label ??
            fieldKey ??
            "Field"
        ).trim();

    if (!fieldKey) {
        return null;
    }

    const fieldType =
        String(
            field.type ??
            "text"
        ).toLowerCase();

    const required =
        field.required === true;

    const fieldName =
        `${namePrefix}.${fieldKey}`;

    const fieldWrapper =
        document.createElement("div");

    fieldWrapper.className =
        "delivery-field";

    const labelElement =
        document.createElement("label");

    labelElement.innerHTML =
        `${escapeHTML(fieldLabel)}
         ${required ? "<span>*</span>" : ""}`;

    fieldWrapper.appendChild(
        labelElement
    );


    /* ==========================================
       SELECT FIELD
    ========================================== */

    if (fieldType === "select") {

        const select =
            document.createElement("select");

        select.name =
            fieldName;

        select.required =
            required;

        const placeholder =
            document.createElement("option");

        placeholder.value = "";

        placeholder.textContent =
            `Select ${fieldLabel}`;

        select.appendChild(
            placeholder
        );

        const options =
            normalizeDropdownOptions(
                field.options
            );

        const conditionalContainer =
            document.createElement("div");

        conditionalContainer.className =
            "nested-conditional-fields";

        conditionalContainer.dataset.parentField =
            fieldKey;

        options.forEach(option => {

            const optionElement =
                document.createElement("option");

            optionElement.value =
                option.value ||
                createOptionValue(
                    option.label
                );

            optionElement.textContent =
                option.label;

            select.appendChild(
                optionElement
            );
        });

        select.addEventListener(
            "change",
            () => {

                conditionalContainer.innerHTML =
                    "";

                const selectedValue =
                    select.value;

                if (!selectedValue) {
                    return;
                }

                const selectedOption =
                    options.find(
                        option =>
                            option.value ===
                            selectedValue
                    );

                if (
                    !selectedOption ||
                    !Array.isArray(
                        selectedOption.conditionalFields
                    )
                ) {
                    return;
                }

                selectedOption
                    .conditionalFields
                    .forEach(
                        conditionalField => {

                            createDeliveryFieldElement(
                                conditionalField,
                                fieldName,
                                conditionalContainer
                            );
                        }
                    );
            }
        );

        fieldWrapper.appendChild(
            select
        );

        fieldWrapper.appendChild(
            conditionalContainer
        );

        parentContainer.appendChild(
            fieldWrapper
        );

        return fieldWrapper;
    }


    /* ==========================================
       NUMBER FIELD
    ========================================== */

    if (fieldType === "number") {

        const input =
            document.createElement("input");

        input.type =
            "number";

        input.name =
            fieldName;

        input.placeholder =
            `Enter ${fieldLabel}`;

        input.required =
            required;

        fieldWrapper.appendChild(
            input
        );

        parentContainer.appendChild(
            fieldWrapper
        );

        return fieldWrapper;
    }


    /* ==========================================
       TEXT FIELD
    ========================================== */

    const input =
        document.createElement("input");

    input.type =
        "text";

    input.name =
        fieldName;

    input.placeholder =
        `Enter ${fieldLabel}`;

    input.required =
        required;

    fieldWrapper.appendChild(
        input
    );

    parentContainer.appendChild(
        fieldWrapper
    );

    return fieldWrapper;
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
                    id: productDoc.id,
                    ...productDoc.data()
                }
            );
        }
    );


    /* ==========================================
       FIND GAMES IN CART
    ========================================== */

    const gameIds = [];

    const gameNames =
        new Map();

    cart.forEach(
        item => {

            const product =
                products.get(
                    item.id
                );

            const gameId =
                product?.gameId ||
                item.gameId ||
                "";

            if (!gameId) {
                return;
            }

            if (
                !gameIds.includes(
                    gameId
                )
            ) {

                gameIds.push(
                    gameId
                );

                gameNames.set(
                    gameId,
                    product?.gameName ||
                    item.game ||
                    "GAME"
                );
            }
        }
    );


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
                    id: gameDoc.id,
                    ...gameDoc.data()
                }
            );
        }
    );


    if (deliveryGames) {
        deliveryGames.innerHTML = "";
    }


    /* ==========================================
       CONDITIONAL PRODUCTS
    ========================================== */

    const conditionalProducts = [];

    const legacyGameProducts =
        new Map();

    cart.forEach(
        item => {

            const product =
                products.get(
                    item.id
                );

            if (
                product?.deliveryConfig?.type ===
                "conditional"
            ) {

                conditionalProducts.push({
                    item,
                    product
                });

            } else {

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
        }
    );


    /* ==========================================
       RENDER CONDITIONAL PRODUCTS
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
                        opt => {

                            const optionId =
                                opt.id ||
                                opt.value ||
                                createOptionValue(
                                    opt.name ||
                                    opt.label
                                );

                            const optionName =
                                opt.name ||
                                opt.label ||
                                "Option";

                            return `
                                <option
                                    value="${escapeAttribute(
                                        optionId
                                    )}"
                                >
                                    ${escapeHTML(
                                        optionName
                                    )}
                                </option>
                            `;
                        }
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

            selectEl?.addEventListener(
                "change",
                event => {

                    const selectedOptionId =
                        event.target.value;

                    fieldsContainer.innerHTML =
                        "";

                    const selectedOption =
                        options.find(
                            opt =>
                                String(
                                    opt.id ||
                                    opt.value ||
                                    ""
                                ) ===
                                String(
                                    selectedOptionId
                                )
                        );

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

                            createDeliveryFieldElement(
                                field,
                                `product.${product.id}`,
                                fieldsContainer
                            );
                        }
                    );
                }
            );


            /* Automatically select first option */

            if (options.length > 0) {

                const firstOption =
                    options[0];

                selectEl.value =
                    firstOption.id ||
                    firstOption.value ||
                    createOptionValue(
                        firstOption.name ||
                        firstOption.label
                    );

                selectEl.dispatchEvent(
                    new Event("change")
                );
            }
        }
    );


    /* ==========================================
       LEGACY GAME DELIVERY
    ========================================== */

    let fieldCount = 0;

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
            `;

            deliveryGames.appendChild(
                box
            );

            const fieldsContainer =
                document.createElement(
                    "div"
                );

            fieldsContainer.className =
                "game-delivery-fields";

            box.appendChild(
                fieldsContainer
            );

            fields.forEach(
                field => {

                    createDeliveryFieldElement(
                        field,
                        gameId,
                        fieldsContainer
                    );
                }
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
}


/* ==========================================
   SUBMIT / SAVE DELIVERY
========================================== */

deliveryForm?.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        /* ==========================================
           INITIALIZATION GUARD
        ========================================== */

        if (
            deliveryInitializing ||
            !deliveryReady
        ) {

            console.warn(
                "Delivery form submitted before initialization completed."
            );

            alert(
                "Please wait until the delivery information has finished loading."
            );

            return;
        }


        /* ==========================================
           PREVENT DOUBLE SUBMISSION
        ========================================== */

        if (submissionInProgress) {
            return;
        }


        /* ==========================================
           BROWSER FORM VALIDATION
        ========================================== */

        if (
            !deliveryForm.checkValidity()
        ) {

            deliveryForm.reportValidity();

            return;
        }


        submissionInProgress = true;


        try {

            const data = {};


            /* ==========================================
               COLLECT DELIVERY FIELDS
            ========================================== */

            const inputs =
                deliveryForm.querySelectorAll(
                    "input[name], select[name], textarea[name]"
                );

            inputs.forEach(
                input => {

                    const name =
                        input.name;

                    if (!name) {
                        return;
                    }

                    let gameId;
                    let key;
                    let fieldValue;


                    /* ==========================================
                       LEGACY GAME DELIVERY

                       "gameId.fieldKey"
                    ========================================== */

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

                        fieldValue =
                            input.value.trim();

                        if (
                            !data[gameId]
                        ) {

                            data[gameId] = {
                                fields: {}
                            };
                        }

                        data[gameId]
                            .fields[key] =
                            fieldValue;


                    } else {

                        /* ==========================================
                           CONDITIONAL PRODUCT DELIVERY

                           "product.productId.fieldId"
                        ========================================== */

                        const parts =
                            name.split(".");

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
                                fields: {}
                            };
                        }

                        data[dataKey]
                            .fields[fieldId] =
                            fieldValue;
                    }
                }
            );


            /* ==========================================
               CAPTURE SELECTED PRODUCT OPTIONS
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
                        select.selectedOptions[0]
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
                            !data[key]
                        ) {

                            data[key] = {
                                type:
                                    "conditional",
                                fields: {}
                            };
                        }

                        data[key].optionId =
                            selectedOptionId;

                        data[key].optionName =
                            selectedOptionText;
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
               CREATE PAYMENT SESSION
            ========================================== */

            createPaymentSession();


            /* ==========================================
               CONTINUE TO PAYMENT
            ========================================== */

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

            submissionInProgress = false;

            if (deliverySubmit) {

                deliverySubmit.disabled =
                    false;

                deliverySubmit.textContent =
                    "Continue to Payment →";
            }

            alert(
                error.message ||
                "Unable to save delivery information."
            );
        }
    }
);


/* ==========================================
   AUTHENTICATION + INITIALIZATION
========================================== */

onAuthStateChanged(
    auth,
    async user => {

        /*
         * Every auth-state callback starts
         * with the page locked.
         */

        deliveryReady = false;
        deliveryInitializing = true;

        if (deliverySubmit) {

            deliverySubmit.disabled =
                true;

            deliverySubmit.textContent =
                "Loading delivery information...";
        }


        /* ==========================================
           NOT LOGGED IN
        ========================================== */

        if (!user) {

            window.location.href =
                "login.html?redirect=delivery.html";

            return;
        }


        /* ==========================================
           LOAD FIRESTORE DATA
        ========================================== */

        try {

            await loadDeliveryFields(
                user
            );


            /*
             * ONLY HERE does the form become
             * ready for submission.
             */

            deliveryReady = true;

            if (deliverySubmit) {

                deliverySubmit.disabled =
                    false;

                deliverySubmit.textContent =
                    "Continue to Payment →";
            }


        } catch (error) {

            console.error(
                "Delivery initialization error:",
                error
            );

            deliveryReady = false;

            showError(
                error.message ||
                "Unable to load delivery information."
            );

            if (deliverySubmit) {

                deliverySubmit.disabled =
                    true;

                deliverySubmit.textContent =
                    "Unable to continue";
            }

        } finally {

            deliveryInitializing =
                false;
        }
    }
);


/* ==========================================
   UNSAVED DELIVERY DATA
========================================== */

function hasUnsavedDeliveryData() {

    const inputs =
        document.querySelectorAll(
            "#deliveryForm input, #deliveryForm textarea, #deliveryForm select"
        );

    let hasData = false;

    inputs.forEach(
        input => {

            if (
                input.type !== "submit" &&
                input.type !== "button" &&
                input.value.trim() !== ""
            ) {

                hasData = true;
            }
        }
    );

    return hasData;
}


/* ==========================================
   LOGO / LEAVE WARNING
========================================== */

const logoLink =
    document.getElementById(
        "logo-link"
    );

logoLink?.addEventListener(
    "click",
    function(event) {

        if (
            !hasUnsavedDeliveryData()
        ) {
            return;
        }

        const confirmLeave =
            confirm(
                "You have unsaved changes. Are you sure you want to leave this page and lose your data?"
            );

        if (!confirmLeave) {
            event.preventDefault();
        }
    }
);


/* ==========================================
   CART TRANSITION WARNING
========================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const cartLink =
            document.getElementById(
                "logo-link2"
            );

        if (!cartLink) {
            return;
        }

        cartLink.addEventListener(
            "click",
            function(event) {

                event.preventDefault();

                const inputs =
                    document.querySelectorAll(
                        "#deliveryForm input, #deliveryForm textarea, #deliveryForm select"
                    );

                let hasUnsavedData =
                    false;

                inputs.forEach(
                    input => {

                        if (
                            input.type !== "submit" &&
                            input.type !== "button" &&
                            input.value.trim() !== ""
                        ) {

                            hasUnsavedData =
                                true;
                        }
                    }
                );

                if (hasUnsavedData) {

                    const confirmLeave =
                        confirm(
                            "You have unsaved delivery information. Are you sure you want to go to your cart and lose this data?"
                        );

                    if (confirmLeave) {

                        window.location.href =
                            this.getAttribute(
                                "href"
                            );
                    }

                } else {

                    window.location.href =
                        this.getAttribute(
                            "href"
                        );
                }
            }
        );
    }
);


/* ==========================================
   BACK BUTTON NAVIGATION
========================================== */

history.pushState(
    null,
    document.title,
    location.href
);

window.addEventListener(
    "popstate",
    function() {

        if (
            hasUnsavedDeliveryData()
        ) {

            const confirmLeave =
                confirm(
                    "You have unsaved changes. Are you sure you want to go back and lose your data?"
                );

            if (!confirmLeave) {

                history.pushState(
                    null,
                    document.title,
                    location.href
                );

            } else {

                history.back();
            }

        } else {

            history.back();
        }
    }
);