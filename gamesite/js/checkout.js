/* ==========================================
   GAMEVAULT - CHECKOUT
========================================== */

import {
    auth
} from "./firebase.js";


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


/* ==========================================
   ELEMENTS
========================================== */

const checkoutLogin =
    document.getElementById(
        "checkoutLogin"
    );

const checkoutEmpty =
    document.getElementById(
        "checkoutEmpty"
    );

const checkoutContent =
    document.getElementById(
        "checkoutContent"
    );

const checkoutItems =
    document.getElementById(
        "checkoutItems"
    );

const checkoutSubtotal =
    document.getElementById(
        "checkoutSubtotal"
    );

const checkoutTotal =
    document.getElementById(
        "checkoutTotal"
    );

const checkoutForm =
    document.getElementById(
        "checkoutForm"
    );

const customerName =
    document.getElementById(
        "customerName"
    );

const customerEmail =
    document.getElementById(
        "customerEmail"
    );

const paymentMethod =
    document.getElementById(
        "paymentMethod"
    );

const checkoutSubmit =
    document.getElementById(
        "checkoutSubmit"
    );


/* ==========================================
   HELPERS
========================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatPrice(value) {

    const price =
        Number(value);

    if (!Number.isFinite(price)) {
        return "₹0";
    }

    return `₹${price.toLocaleString("en-IN")}`;
}


/* ==========================================
   CART
========================================== */

function getStoredCart() {

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
            "Unable to read cart:",
            error
        );

        return [];
    }
}


/* ==========================================
   CART TOTAL
========================================== */

function calculateCartTotal(cart) {

    return cart.reduce(
        (total, item) => {

            const price =
                Number(item.price) || 0;

            const quantity =
                Math.max(
                    1,
                    Number(item.quantity) || 1
                );

            return (
                total +
                price * quantity
            );

        },
        0
    );
}


/* ==========================================
   CART ITEM COUNT
========================================== */

function calculateCartItemCount(cart) {

    return cart.reduce(
        (total, item) => {

            return (
                total +
                Math.max(
                    1,
                    Number(item.quantity) || 1
                )
            );

        },
        0
    );
}


/* ==========================================
   NAV CART COUNT
========================================== */

function updateCartCount(cart) {

    const count =
        calculateCartItemCount(cart);

    document
        .querySelectorAll(".cart-count")
        .forEach(element => {

            element.textContent =
                count;

        });
}


/* ==========================================
   RENDER CHECKOUT ITEMS
========================================== */

function renderCheckoutCart(cart) {

    if (!checkoutItems) {
        return;
    }

    checkoutItems.innerHTML =
        "";


    cart.forEach(item => {

        const name =
            item.name ||
            "Unnamed Product";

        const game =
            item.game ||
            item.gameName ||
            "GAME";

        const amount =
            item.amount ||
            "";

        const price =
            Number(item.price) || 0;

        const quantity =
            Math.max(
                1,
                Number(item.quantity) || 1
            );


        const itemElement =
            document.createElement(
                "div"
            );


        itemElement.className =
            "checkout-item";


        itemElement.innerHTML = `
            <div class="checkout-item-info">

                <strong>
                    ${escapeHTML(name)}
                </strong>

                <span>
                    ${escapeHTML(game)}
                </span>

                ${
                    amount
                        ? `
                            <small>
                                ${escapeHTML(amount)}
                            </small>
                        `
                        : ""
                }

            </div>


            <div class="checkout-item-price">

                <span>
                    ×${quantity}
                </span>

                <strong>
                    ${formatPrice(
                        price * quantity
                    )}
                </strong>

            </div>
        `;


        checkoutItems.appendChild(
            itemElement
        );

    });


    const total =
        calculateCartTotal(cart);


    if (checkoutSubtotal) {

        checkoutSubtotal.textContent =
            formatPrice(total);

    }


    if (checkoutTotal) {

        checkoutTotal.textContent =
            formatPrice(total);

    }
}


/* ==========================================
   SHOW / HIDE STATES
========================================== */

function hideAllStates() {

    if (checkoutLogin) {
        checkoutLogin.style.display =
            "none";
    }

    if (checkoutEmpty) {
        checkoutEmpty.style.display =
            "none";
    }

    if (checkoutContent) {
        checkoutContent.style.display =
            "none";
    }
}


function showLogin() {

    hideAllStates();

    if (checkoutLogin) {
        checkoutLogin.style.display =
            "block";
    }
}


function showEmptyCart() {

    hideAllStates();

    if (checkoutEmpty) {
        checkoutEmpty.style.display =
            "block";
    }
}


function showCheckout() {

    if (checkoutContent) {
        checkoutContent.style.display =
            "grid";
    }
}


/* ==========================================
   CUSTOMER INFORMATION
========================================== */

function populateCustomer(user) {

    if (!user) {
        return;
    }


    if (customerEmail) {

        customerEmail.value =
            user.email || "";

    }


    if (customerName) {

        customerName.value =
            user.displayName || "";

    }
}


/* ==========================================
   PAYMENT METHOD
========================================== */

function getSelectedPaymentMethod() {

    if (!paymentMethod) {
        return "";
    }

    return paymentMethod.value.trim();
}


/* ==========================================
   SAVE CHECKOUT DATA
========================================== */

function saveCheckoutData(data) {

    try {

        sessionStorage.setItem(
            CHECKOUT_STORAGE_KEY,
            JSON.stringify(data)
        );

        return true;

    } catch (error) {

        console.error(
            "Unable to save checkout data:",
            error
        );

        return false;
    }
}


/* ==========================================
   VALIDATE CART
========================================== */

function validateCart(cart) {

    if (!Array.isArray(cart)) {
        return false;
    }

    if (cart.length === 0) {
        return false;
    }


    for (const item of cart) {

        const quantity =
            Math.max(
                1,
                Number(item.quantity) || 1
            );


        const stock =
            Number(item.stock);


        if (
            Number.isFinite(stock) &&
            stock >= 0 &&
            quantity > stock
        ) {

            alert(
                `Only ${stock} available for ${
                    item.name ||
                    "this product"
                }.`
            );

            return false;
        }


        if (
            Number.isFinite(stock) &&
            stock <= 0
        ) {

            alert(
                `${
                    item.name ||
                    "This product"
                } is out of stock.`
            );

            return false;
        }

    }


    return true;
}


/* ==========================================
   CONTINUE TO DELIVERY
========================================== */

function continueToDelivery(user) {

    if (!user) {

        showLogin();

        return;
    }


    const cart =
        getStoredCart();


    /*
     * CART CHECK
     */

    if (!validateCart(cart)) {

        if (cart.length === 0) {
            showEmptyCart();
        }

        return;
    }


    /*
     * CUSTOMER DETAILS
     */

    const name =
        customerName?.value.trim() || "";

    const email =
        customerEmail?.value.trim() || "";


    /*
     * PAYMENT METHOD
     */

    const selectedPaymentMethod =
        getSelectedPaymentMethod();


    /*
     * VALIDATE NAME
     */

    if (!name) {

        alert(
            "Please enter your full name."
        );

        customerName?.focus();

        return;
    }


    /*
     * VALIDATE EMAIL
     */

    if (!email) {

        alert(
            "Please enter your email address."
        );

        customerEmail?.focus();

        return;
    }


    /*
     * VALIDATE EMAIL FORMAT
     */

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (
        !emailPattern.test(email)
    ) {

        alert(
            "Please enter a valid email address."
        );

        customerEmail?.focus();

        return;
    }


    /*
     * VALIDATE PAYMENT METHOD
     */

    if (!selectedPaymentMethod) {

        alert(
            "Please select a payment method."
        );

        paymentMethod?.focus();

        return;
    }


    /*
     * TOTAL
     */

    const total =
        calculateCartTotal(cart);


    /*
     * CHECKOUT DATA
     */

    const checkoutData = {

        userId:
            user.uid,

        name:
            name,

        email:
            email,

        paymentMethod:
            selectedPaymentMethod,

        items:
            cart,

        total:
            total,

        itemCount:
            calculateCartItemCount(
                cart
            ),

        createdAt:
            Date.now()
    };


    /*
     * SAVE SESSION
     */

    const saved =
        saveCheckoutData(
            checkoutData
        );


    if (!saved) {

        alert(
            "Unable to continue to delivery. Please try again."
        );

        return;
    }


    /*
     * BUTTON STATE
     */

    if (checkoutSubmit) {

        checkoutSubmit.disabled =
            true;

        checkoutSubmit.textContent =
            "Preparing Delivery...";

    }


    /*
     * DELIVERY PAGE
     */

    window.location.href =
        "delivery.html";
}


/* ==========================================
   AUTHENTICATION
========================================== */

onAuthStateChanged(
    auth,
    user => {

        hideAllStates();


        /*
         * NOT LOGGED IN
         */

        if (!user) {

            updateCartCount(
                getStoredCart()
            );

            showLogin();

            return;
        }


        /*
         * CART
         */

        const cart =
            getStoredCart();


        updateCartCount(
            cart
        );


        /*
         * EMPTY CART
         */

        if (cart.length === 0) {

            showEmptyCart();

            return;
        }


        /*
         * SHOW CHECKOUT
         */

        populateCustomer(
            user
        );

        renderCheckoutCart(
            cart
        );

        showCheckout();

    }
);


/* ==========================================
   CHECKOUT FORM
========================================== */

checkoutForm?.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        const user =
            auth.currentUser;


        if (!user) {

            showLogin();

            return;
        }


        continueToDelivery(
            user
        );
    }
);


/* ==========================================
   PREVENT DOUBLE SUBMISSION
========================================== */

checkoutForm?.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            event.target.tagName !== "TEXTAREA"
        ) {

            /*
             * Let the form submit normally.
             * The submit handler handles validation.
             */

        }

    }
);


/* ==========================================
   INITIAL STATE
========================================== */

hideAllStates();

updateCartCount(
    getStoredCart()
);