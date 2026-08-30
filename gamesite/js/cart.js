/* ==========================================
   GAMEVAULT - CART PAGE
   Current Firestore Price + Stock Sync
========================================== */

import { db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const CART_STORAGE_KEY = "gamevault_cart";


/* ==========================================
   ELEMENTS
========================================== */

const cartContent =
    document.getElementById("cartContent");


/* ==========================================
   HELPERS
========================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


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
            "Cart loading error:",
            error
        );

        return [];

    }

}


function saveCart(cart) {

    try {

        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(cart)
        );

    } catch (error) {

        console.error(
            "Cart saving error:",
            error
        );

    }

}


function formatPrice(price) {

    const value =
        Number(price);

    if (!Number.isFinite(value)) {
        return "₹0";
    }

    return `₹${value.toLocaleString("en-IN")}`;

}


/* ==========================================
   CURRENT PRODUCT PRICE
========================================== */

function getDealPrice(product) {

    const dealPrice =
        Number(product.dealPrice);

    if (
        product.deal === true &&
        Number.isFinite(dealPrice) &&
        dealPrice >= 0
    ) {

        const regularPrice =
            Number(product.price) || 0;

        if (
            dealPrice < regularPrice
        ) {

            return dealPrice;

        }

    }

    return null;

}


function getFinalPrice(product) {

    const regularPrice =
        Number(product.price);

    const validRegularPrice =
        Number.isFinite(regularPrice)
            ? regularPrice
            : 0;

    const dealPrice =
        getDealPrice(product);

    if (dealPrice !== null) {

        return dealPrice;

    }

    return validRegularPrice;

}


/* ==========================================
   CART TOTAL
========================================== */

function getCartTotal(cart) {

    return cart.reduce(
        (total, item) => {

            const price =
                Number(item.price) || 0;

            const quantity =
                Math.max(
                    1,
                    Number(item.quantity) || 1
                );

            return total +
                price * quantity;

        },
        0
    );

}


/* ==========================================
   NOTIFICATION
========================================== */

function showCartNotification(message) {

    const existing =
        document.querySelector(
            ".cart-notification"
        );

    if (existing) {
        existing.remove();
    }


    const notification =
        document.createElement("div");

    notification.className =
        "cart-notification";

    notification.textContent =
        message;


    document.body.appendChild(
        notification
    );


    setTimeout(() => {

        notification.remove();

    }, 2500);

}


/* ==========================================
   UPDATE NAV CART COUNT
========================================== */

function updateCartCount() {

    const cart =
        getCart();

    const itemCount =
        cart.reduce(
            (total, item) => {

                return total +
                    Math.max(
                        1,
                        Number(item.quantity) || 1
                    );

            },
            0
        );


    document
        .querySelectorAll(".cart-count")
        .forEach(element => {

            element.textContent =
                itemCount;

        });

}


/* ==========================================
   SYNC CART WITH FIRESTORE
========================================== */

async function syncCartWithFirestore() {

    const cart =
        getCart();

    if (cart.length === 0) {
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


        const updatedCart = [];

        let stockChanged = false;

        let priceChanged = false;


        cart.forEach(item => {

            const product =
                products.get(item.id);


            /*
             * Product no longer exists
             */

            if (!product) {

                stockChanged = true;

                return;

            }


            /*
             * CURRENT STOCK
             */

            const currentStock =
                Math.max(
                    0,
                    Number(product.stock) || 0
                );


            /*
             * CURRENT PRICE
             */

            const currentPrice =
                getFinalPrice(product);


            /*
             * CURRENT PRODUCT INFORMATION
             */

            const currentName =
                product.name ||
                item.name ||
                "Unnamed Product";


            const currentGame =
                product.gameName ||
                item.game ||
                "GAME";


            const currentAmount =
                product.amount ||
                item.amount ||
                "";


            const currentImage =
                product.image ||
                item.image ||
                "";


            /*
             * CHECK PRICE CHANGE
             */

            if (
                Number(item.price) !==
                currentPrice
            ) {

                priceChanged = true;

            }


            /*
             * CHECK STOCK CHANGE
             */

            if (
                Number(item.stock) !==
                currentStock
            ) {

                stockChanged = true;

            }


            /*
             * KEEP CURRENT QUANTITY
             */

            let quantity =
                Math.max(
                    1,
                    Number(item.quantity) || 1
                );


            /*
             * LIMIT QUANTITY TO CURRENT STOCK
             *
             * If stock is 0, keep quantity as 1
             * temporarily so the item remains visible
             * as OUT OF STOCK.
             */

            if (
                currentStock > 0 &&
                quantity > currentStock
            ) {

                quantity =
                    currentStock;

                stockChanged = true;

            }


            updatedCart.push({

                id:
                    item.id,

                name:
                    currentName,

                game:
                    currentGame,

                amount:
                    currentAmount,

                price:
                    currentPrice,

                image:
                    currentImage,

                stock:
                    currentStock,

                quantity:
                    quantity,

                addedAt:
                    item.addedAt ||
                    Date.now()

            });

        });


        /*
         * Save if anything changed
         */

        if (
            stockChanged ||
            priceChanged ||
            updatedCart.length !== cart.length
        ) {

            saveCart(
                updatedCart
            );

        }

    } catch (error) {

        console.error(
            "Cart Firestore sync error:",
            error
        );

    }

}


/* ==========================================
   QUANTITY
========================================== */

function updateItemQuantity(
    index,
    requestedQuantity
) {

    const cart =
        getCart();


    if (
        index < 0 ||
        index >= cart.length
    ) {

        return;

    }


    const item =
        cart[index];


    const stock =
        Math.max(
            0,
            Number(item.stock) || 0
        );


    /*
     * OUT OF STOCK
     */

    if (stock <= 0) {

        showCartNotification(
            `${item.name || "This product"} is out of stock`
        );

        renderCart();

        return;

    }


    let quantity =
        Number(requestedQuantity);


    if (!Number.isFinite(quantity)) {

        quantity = 1;

    }


    quantity =
        Math.floor(quantity);


    if (quantity < 1) {

        quantity = 1;

    }


    /*
     * STOCK LIMIT
     */

    if (quantity > stock) {

        item.quantity =
            stock;

        saveCart(cart);

        updateCartCount();

        renderCart();


        showCartNotification(
            `Only ${stock} available for ${item.name || "this product"}`
        );

        return;

    }


    item.quantity =
        quantity;


    saveCart(cart);

    updateCartCount();

    renderCart();

}


/* ==========================================
   REMOVE ITEM
========================================== */

function removeCartItem(index) {

    const cart =
        getCart();


    if (
        index < 0 ||
        index >= cart.length
    ) {

        return;

    }


    const removed =
        cart[index];


    cart.splice(
        index,
        1
    );


    saveCart(cart);

    updateCartCount();

    renderCart();


    showCartNotification(
        `${removed.name || "Item"} removed`
    );

}


/* ==========================================
   EMPTY CART
========================================== */

function renderEmptyCart() {

    if (!cartContent) {
        return;
    }


    cartContent.innerHTML = `

        <div class="cart-empty">

            <h2>
                Your cart is empty
            </h2>

            <p>
                You haven't added any products yet.
            </p>

            <a
                href="shop.html"
                class="primary-btn cart-empty-btn"
            >
                Browse Products →
            </a>

        </div>

    `;

}


/* ==========================================
   RENDER CART
========================================== */

function renderCart() {

    if (!cartContent) {
        return;
    }


    const cart =
        getCart();


    if (cart.length === 0) {

        renderEmptyCart();

        return;

    }


    const total =
        getCartTotal(cart);


    const itemCount =
        cart.reduce(
            (count, item) => {

                return count +
                    Math.max(
                        1,
                        Number(item.quantity) || 1
                    );

            },
            0
        );


    let itemsHTML = "";


    cart.forEach(
        (item, index) => {

            const quantity =
                Math.max(
                    1,
                    Number(item.quantity) || 1
                );


            const unitPrice =
                Number(item.price) || 0;


            const stock =
                Math.max(
                    0,
                    Number(item.stock) || 0
                );


            const outOfStock =
                stock <= 0;


            const atStockLimit =
                stock > 0 &&
                quantity >= stock;


            itemsHTML += `

                <div
                    class="cart-page-item ${
                        outOfStock
                            ? "cart-item-out-of-stock"
                            : ""
                    }"
                >

                    <div
                        class="cart-page-item-info"
                    >

                        <h3>
                            ${escapeHTML(
                                item.name ||
                                "Unnamed Product"
                            )}
                        </h3>


                        <span
                            class="cart-page-item-game"
                        >
                            ${escapeHTML(
                                item.game ||
                                "GAME"
                            )}
                        </span>


                        ${
                            item.amount
                                ? `
                                    <span
                                        class="cart-page-item-amount"
                                    >
                                        ${escapeHTML(
                                            item.amount
                                        )}
                                    </span>
                                  `
                                : ""
                        }


                        ${
                            outOfStock
                                ? `
                                    <span
                                        class="cart-stock-warning"
                                    >
                                        OUT OF STOCK
                                    </span>
                                  `
                                : `
                                    <span
                                        class="cart-stock-info"
                                    >
                                        ${stock} available
                                    </span>
                                  `
                        }

                    </div>


                    <div
                        class="cart-page-item-right"
                    >

                        <strong
                            class="cart-page-item-price"
                        >
                            ${formatPrice(
                                unitPrice * quantity
                            )}
                        </strong>


                        <div
                            class="cart-quantity-control"
                        >

                            <button
                                type="button"
                                data-quantity-change="-1"
                                data-quantity-index="${index}"
                                aria-label="Decrease quantity"
                                ${
                                    quantity <= 1 ||
                                    outOfStock
                                        ? "disabled"
                                        : ""
                                }
                            >
                                −
                            </button>


                            <input
                                type="number"
                                min="1"
                                max="${
                                    stock > 0
                                        ? stock
                                        : 1
                                }"
                                value="${quantity}"
                                data-quantity-input
                                data-quantity-index="${index}"
                                aria-label="Quantity for ${escapeHTML(
                                    item.name ||
                                    "product"
                                )}"
                                ${
                                    outOfStock
                                        ? "disabled"
                                        : ""
                                }
                            >


                            <button
                                type="button"
                                data-quantity-change="1"
                                data-quantity-index="${index}"
                                aria-label="Increase quantity"
                                ${
                                    atStockLimit ||
                                    outOfStock
                                        ? "disabled"
                                        : ""
                                }
                            >
                                +
                            </button>

                        </div>


                        <button
                            type="button"
                            class="cart-remove-btn"
                            data-remove-index="${index}"
                            aria-label="Remove item"
                        >
                            ×
                        </button>

                    </div>

                </div>

            `;

        }
    );


    cartContent.innerHTML = `

        <div class="cart-layout">


            <div
                class="cart-items-container"
            >

                ${itemsHTML}

            </div>


            <aside
                class="cart-summary"
            >

                <h2>
                    Order Summary
                </h2>


                <div
                    class="cart-summary-row"
                >

                    <span>
                        Items
                    </span>

                    <strong>
                        ${itemCount}
                    </strong>

                </div>


                <div
                    class="cart-summary-total"
                >

                    <span>
                        Total
                    </span>

                    <strong>
                        ${formatPrice(total)}
                    </strong>

                </div>


                <button
                    type="button"
                    class="primary-btn cart-checkout-btn"
                    id="cartCheckoutBtn"
                >
                    Proceed to Checkout →
                </button>


                <a
                    href="shop.html"
                    class="cart-continue-btn"
                >
                    Continue Shopping
                </a>

            </aside>


        </div>

    `;


    /* ======================================
       REMOVE BUTTONS
    ====================================== */

    cartContent
        .querySelectorAll(
            "[data-remove-index]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    removeCartItem(
                        Number(
                            button.dataset.removeIndex
                        )
                    );

                }
            );

        });


    /* ======================================
       QUANTITY BUTTONS
    ====================================== */

    cartContent
        .querySelectorAll(
            "[data-quantity-change]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const index =
                        Number(
                            button.dataset.quantityIndex
                        );


                    const currentQuantity =
                        Math.max(
                            1,
                            Number(
                                getCart()[index]?.quantity
                            ) || 1
                        );


                    const change =
                        Number(
                            button.dataset.quantityChange
                        );


                    updateItemQuantity(
                        index,
                        currentQuantity + change
                    );

                }
            );

        });


    /* ======================================
       QUANTITY INPUT
    ====================================== */

    cartContent
        .querySelectorAll(
            "[data-quantity-input]"
        )
        .forEach(input => {

            input.addEventListener(
                "change",
                () => {

                    updateItemQuantity(
                        Number(
                            input.dataset.quantityIndex
                        ),
                        input.value
                    );

                }
            );

        });


    /* ======================================
       CHECKOUT
    ====================================== */

    const checkoutButton =
        document.getElementById(
            "cartCheckoutBtn"
        );


    checkoutButton?.addEventListener(
        "click",
        async () => {

            const cart =
                getCart();


            if (cart.length === 0) {

                showCartNotification(
                    "Your cart is empty"
                );

                return;

            }


            /*
             * Sync one more time before checkout.
             */

            await syncCartWithFirestore();


            const updatedCart =
                getCart();


            const outOfStock =
                updatedCart.some(
                    item =>
                        Number(item.stock) <= 0
                );


            if (outOfStock) {

                renderCart();


                showCartNotification(
                    "Remove out-of-stock products before checkout"
                );

                return;

            }


            const exceedsStock =
                updatedCart.some(
                    item =>
                        Number(item.quantity) >
                        Number(item.stock)
                );


            if (exceedsStock) {

                renderCart();


                showCartNotification(
                    "Please check product quantities"
                );

                return;

            }


            window.location.href =
                "checkout.html";

        }
    );

}


/* ==========================================
   INITIALIZE
========================================== */

async function initializeCart() {

    /*
     * Show existing cart immediately.
     */

    renderCart();

    updateCartCount();


    /*
     * Get current prices and stock
     * from Firestore.
     */

    await syncCartWithFirestore();


    /*
     * Render again using fresh data.
     */

    renderCart();

    updateCartCount();

}


initializeCart();


/* ==========================================
   STORAGE CHANGES
========================================== */

window.addEventListener(
    "storage",
    async event => {

        if (
            event.key ===
            CART_STORAGE_KEY
        ) {

            await syncCartWithFirestore();

            renderCart();

            updateCartCount();

        }

    }
);