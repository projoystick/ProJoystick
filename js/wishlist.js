/* ==========================================
   GAMEVAULT — WISHLIST PAGE
   Fully Synchronized With Shop + Cart
========================================== */

import { auth, db } from "./firebase.js";

import {
    collection,
    doc,
    getDocs,
    getDoc,
    deleteDoc
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* ==========================================
   ELEMENTS
========================================== */

const wishlistGrid =
    document.getElementById(
        "wishlistGrid"
    );

const wishlistLoading =
    document.getElementById(
        "wishlistLoading"
    );

const wishlistEmpty =
    document.getElementById(
        "wishlistEmpty"
    );

const wishlistError =
    document.getElementById(
        "wishlistError"
    );

const wishlistCount =
    document.getElementById(
        "wishlistCount"
    );

const wishlistRetryBtn =
    document.getElementById(
        "wishlistRetryBtn"
    );


/* ==========================================
   STATE
========================================== */

let currentUser = null;

let wishlistProducts = [];


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


function getDealPrice(product) {

    const dealPrice =
        Number(product.dealPrice);

    if (
        Number.isFinite(dealPrice) &&
        dealPrice >= 0
    ) {

        return dealPrice;

    }

    return null;

}


function getFinalPrice(product) {

    const price =
        Number(product.price) || 0;

    const dealPrice =
        getDealPrice(product);

    if (
        product.deal === true &&
        dealPrice !== null &&
        dealPrice < price
    ) {

        return dealPrice;

    }

    return price;

}


/* ==========================================
   CART HELPERS
========================================== */

function getCartItems() {

    try {

        const stored =
            localStorage.getItem(
                "gamevault_cart"
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
            "Cart reading error:",
            error
        );

        return [];

    }

}


function isProductInCart(productId) {

    if (!productId) {
        return false;
    }

    const cart =
        getCartItems();

    return cart.some(
        item =>
            item &&
            item.id === productId
    );

}


/* ==========================================
   UPDATE CART COUNT
========================================== */

function updateCartCount() {

    const cart =
        getCartItems();

    const cartCountElements =
        document.querySelectorAll(
            ".cart-count"
        );

    cartCountElements.forEach(
        element => {

            element.textContent =
                cart.length;

            element.classList.toggle(
                "show",
                cart.length > 0
            );

        }
    );

}


/* ==========================================
   CART NOTIFICATION
   Uses the MASTER stylesheet:
   .notification
   .notification-icon
========================================== */

function showCartNotification(
    message
) {

    const existingNotification =
        document.querySelector(
            ".notification"
        );

    if (existingNotification) {

        existingNotification.remove();

    }

    const notification =
        document.createElement(
            "div"
        );

    notification.className =
        "notification";

    notification.innerHTML = `

        <span class="notification-icon">
            ✓
        </span>

        <span>
            ${escapeHTML(message)}
        </span>

    `;

    document.body.appendChild(
        notification
    );

    setTimeout(
        () => {

            notification.classList.add(
                "hide"
            );

            setTimeout(
                () => {

                    notification.remove();

                },
                300
            );

        },
        2500
    );

}


/* ==========================================
   UPDATE WISHLIST CART BUTTONS
========================================== */

function updateWishlistCartButtons() {

    if (!wishlistGrid) {
        return;
    }

    wishlistGrid
        .querySelectorAll(
            "[data-wishlist-cart]"
        )
        .forEach(
            button => {

                const productId =
                    button.dataset.wishlistCart;

                if (!productId) {
                    return;
                }

                if (
                    isProductInCart(
                        productId
                    )
                ) {

                    button.textContent =
                        "GO TO CART";

                    button.dataset.inCart =
                        "true";

                } else {

                    button.textContent =
                        "ADD TO CART";

                    button.dataset.inCart =
                        "false";

                }

            }
        );

}


/* ==========================================
   GO TO CART
========================================== */

function goToCart() {

    window.location.href =
        "cart.html";

}


/* ==========================================
   LOAD WISHLIST
========================================== */

async function loadWishlist() {

    if (!currentUser) {

        wishlistProducts = [];

        renderWishlist();

        return;

    }

    showWishlistLoading();

    hideWishlistError();

    try {

        const wishlistRef =
            collection(
                db,
                "wishlist",
                currentUser.uid,
                "items"
            );

        const snapshot =
            await getDocs(
                wishlistRef
            );

        wishlistProducts = [];

        for (
            const wishlistDoc
            of snapshot.docs
        ) {

            const productId =
                wishlistDoc.id;

            try {

                const productRef =
                    doc(
                        db,
                        "products",
                        productId
                    );

                const productSnapshot =
                    await getDoc(
                        productRef
                    );

                if (
                    !productSnapshot.exists()
                ) {

                    console.warn(
                        "Wishlist product no longer exists:",
                        productId
                    );

                    await deleteDoc(
                        wishlistDoc.ref
                    );

                    continue;

                }

                const productData =
                    productSnapshot.data();

                wishlistProducts.push({

                    id:
                        productId,

                    ...productData,

                    wishlistId:
                        wishlistDoc.id

                });

            } catch (productError) {

                console.error(
                    "Wishlist product loading error:",
                    productId,
                    productError
                );

            }

        }

        renderWishlist();

        hideWishlistLoading();

    } catch (error) {

        console.error(
            "Wishlist loading error:",
            error
        );

        wishlistProducts = [];

        hideWishlistLoading();

        showWishlistError();

    }

}


/* ==========================================
   RENDER WISHLIST
========================================== */

function renderWishlist() {

    if (!wishlistGrid) {
        return;
    }

    wishlistGrid.innerHTML = "";

    const count =
        wishlistProducts.length;

    if (wishlistCount) {

        wishlistCount.textContent =
            `${count} ${
                count === 1
                    ? "Product"
                    : "Products"
            }`;

    }

    if (count === 0) {

        wishlistEmpty?.classList.add(
            "show"
        );

        return;

    }

    wishlistEmpty?.classList.remove(
        "show"
    );

    wishlistProducts.forEach(
        product => {

            wishlistGrid.appendChild(
                createWishlistCard(
                    product
                )
            );

        }
    );

}


/* ==========================================
   CREATE WISHLIST CARD
========================================== */

function createWishlistCard(
    product
) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "wishlist-card";

    const name =
        product.name ||
        "Unnamed Product";

    const gameName =
        product.gameName ||
        "GAME";

    const amount =
        product.amount ||
        "";

    const image =
        product.image ||
        "../assets/games/default.jpg";

    const price =
        Number(product.price) || 0;

    const stock =
        Number(product.stock);

    const validStock =
        Number.isFinite(stock)
            ? stock
            : 0;

    const outOfStock =
        validStock <= 0;

    const dealPrice =
        getDealPrice(product);

    const hasValidDeal =
        product.deal === true &&
        dealPrice !== null &&
        dealPrice < price;

    const finalPrice =
        hasValidDeal
            ? dealPrice
            : price;

    const alreadyInCart =
        isProductInCart(
            product.id
        );


    /* ==========================================
       DEAL INFORMATION
    ========================================== */

    let dealHTML = "";

    if (hasValidDeal) {

        const savings =
            price - dealPrice;

        const percentage =
            price > 0
                ? Math.round(
                    (savings / price) * 100
                )
                : 0;

        dealHTML = `

            <div class="wishlist-deal">

                <span class="wishlist-old-price">
                    ${formatPrice(price)}
                </span>

                <span class="wishlist-discount">
                    ${percentage}% OFF
                </span>

            </div>

        `;

    }


    /* ==========================================
       STOCK
    ========================================== */

    let stockHTML = "";

    if (outOfStock) {

        stockHTML = `

            <span class="wishlist-stock out">
                OUT OF STOCK
            </span>

        `;

    } else if (validStock < 10) {

        stockHTML = `

            <span class="wishlist-stock low">
                ${validStock} LEFT
            </span>

        `;

    }


    /* ==========================================
       CARD HTML
    ========================================== */

    card.classList.toggle(
        "out-of-stock",
        outOfStock
    );

    card.classList.toggle(
        "on-deal",
        hasValidDeal
    );

    card.innerHTML = `

        <div class="wishlist-image">

            <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(name)}"
                loading="lazy"
            >

            ${
                hasValidDeal
                    ? `
                        <span class="wishlist-deal-tag">
                            DEAL
                        </span>
                      `
                    : ""
            }

            ${stockHTML}

        </div>


        <div class="wishlist-content">

            <span class="wishlist-game">
                ${escapeHTML(gameName)}
            </span>

            <h3>
                ${escapeHTML(name)}
            </h3>

            ${
                amount
                    ? `
                        <span class="wishlist-amount">
                            ${escapeHTML(amount)}
                        </span>
                      `
                    : ""
            }

            <div class="wishlist-price-area">

                <span class="wishlist-price-label">
                    PRICE
                </span>

                <strong class="wishlist-price">
                    ${formatPrice(finalPrice)}
                </strong>

                ${dealHTML}

            </div>

            <div class="wishlist-bottom">

                <button
                    type="button"
                    class="wishlist-remove-btn"
                    data-wishlist-remove="${escapeHTML(product.id)}"
                >
                    REMOVE
                </button>

                ${
                    outOfStock

                        ? `
                            <button
                                type="button"
                                class="wishlist-cart-btn"
                                disabled
                            >
                                OUT OF STOCK
                            </button>
                          `

                        : `
                            <button
                                type="button"
                                class="wishlist-cart-btn"
                                data-wishlist-cart="${escapeHTML(product.id)}"
                                data-in-cart="${
                                    alreadyInCart
                                        ? "true"
                                        : "false"
                                }"
                            >
                                ${
                                    alreadyInCart
                                        ? "GO TO CART"
                                        : "ADD TO CART"
                                }
                            </button>
                          `
                }

            </div>

        </div>

    `;


    /* ==========================================
       IMAGE FALLBACK
    ========================================== */

    const imageElement =
        card.querySelector(
            "img"
        );

    if (imageElement) {

        imageElement.addEventListener(
            "error",
            () => {

                const placeholder =
                    document.createElement(
                        "div"
                    );

                placeholder.className =
                    "wishlist-image-placeholder";

                placeholder.textContent =
                    "◈";

                imageElement.replaceWith(
                    placeholder
                );

            }
        );

    }


    return card;

}


/* ==========================================
   REMOVE FROM WISHLIST
========================================== */

async function removeFromWishlist(
    productId
) {

    if (!currentUser) {

        alert(
            "Please login to manage your wishlist."
        );

        return;

    }

    if (!productId) {
        return;
    }

    try {

        const wishlistItemRef =
            doc(
                db,
                "wishlist",
                currentUser.uid,
                "items",
                productId
            );

        await deleteDoc(
            wishlistItemRef
        );

        wishlistProducts =
            wishlistProducts.filter(
                product =>
                    product.id !==
                    productId
            );

        renderWishlist();

        console.log(
            "Removed from wishlist:",
            productId
        );

    } catch (error) {

        console.error(
            "Wishlist removal error:",
            error
        );

        alert(
            "Could not remove this product from your wishlist. Please try again."
        );

    }

}


/* ==========================================
   ADD WISHLIST PRODUCT TO CART
========================================== */

function addWishlistProductToCart(
    productId
) {

    if (!productId) {
        return;
    }


    /* ==========================================
       ALREADY IN CART
    ========================================== */

    if (
        isProductInCart(
            productId
        )
    ) {

        goToCart();

        return;

    }


    const product =
        wishlistProducts.find(
            item =>
                item.id === productId
        );

    if (!product) {

        console.error(
            "Wishlist product not found:",
            productId
        );

        return;

    }


    /* ==========================================
       STOCK CHECK
    ========================================== */

    const stock =
        Number(product.stock);

    const validStock =
        Number.isFinite(stock)
            ? stock
            : 0;

    if (validStock <= 0) {

        showCartNotification(
            "This product is out of stock."
        );

        return;

    }


    /* ==========================================
       GET CART
    ========================================== */

    const cart =
        getCartItems();


    /* ==========================================
       FINAL PRICE
    ========================================== */

    const finalPrice =
        getFinalPrice(
            product
        );


    /* ==========================================
       CART ITEM
    ========================================== */

    const cartItem = {

        id:
            product.id,

        name:
            product.name ||
            "Unnamed Product",

        game:
            product.gameName ||
            "",

        amount:
            product.amount ||
            "",

        price:
            finalPrice,

        image:
            product.image ||
            "",

        addedAt:
            Date.now()

    };


    /* ==========================================
       ADD TO CART
    ========================================== */

    cart.push(
        cartItem
    );

    try {

        localStorage.setItem(
            "gamevault_cart",
            JSON.stringify(cart)
        );

    } catch (error) {

        console.error(
            "Cart saving error:",
            error
        );

        showCartNotification(
            "Could not add product to cart."
        );

        return;

    }


    /* ==========================================
       UPDATE UI
    ========================================== */

    updateCartCount();

    updateWishlistCartButtons();


    /* ==========================================
       INFORM OTHER GAMEVAULT COMPONENTS
    ========================================== */

    window.dispatchEvent(
        new CustomEvent(
            "gamevault-cart-updated"
        )
    );


    /* ==========================================
       SHOW CUSTOM NOTIFICATION
    ========================================== */

    showCartNotification(
        `${product.name || "Product"} added to cart.`
    );


    console.log(
        "Wishlist product added to cart:",
        productId
    );

}


/* ==========================================
   WISHLIST CLICK EVENTS
========================================== */

wishlistGrid?.addEventListener(
    "click",
    event => {

        /* ==========================================
           REMOVE BUTTON
        ========================================== */

        const removeButton =
            event.target.closest(
                "[data-wishlist-remove]"
            );

        if (removeButton) {

            event.preventDefault();

            const productId =
                removeButton.dataset
                    .wishlistRemove;

            if (!productId) {
                return;
            }

            removeButton.disabled =
                true;

            removeFromWishlist(
                productId
            ).finally(
                () => {

                    removeButton.disabled =
                        false;

                }
            );

            return;

        }


        /* ==========================================
           CART BUTTON
        ========================================== */

        const cartButton =
            event.target.closest(
                "[data-wishlist-cart]"
            );

        if (cartButton) {

            event.preventDefault();

            const productId =
                cartButton.dataset
                    .wishlistCart;

            if (!productId) {
                return;
            }

            /*
             * If already in cart,
             * go directly to cart.
             */

            if (
                isProductInCart(
                    productId
                )
            ) {

                goToCart();

                return;

            }

            addWishlistProductToCart(
                productId
            );

        }

    }
);


/* ==========================================
   LOADING
========================================== */

function showWishlistLoading() {

    wishlistLoading?.classList.add(
        "show"
    );

    wishlistEmpty?.classList.remove(
        "show"
    );

}


function hideWishlistLoading() {

    wishlistLoading?.classList.remove(
        "show"
    );

}


/* ==========================================
   ERROR
========================================== */

function showWishlistError() {

    wishlistError?.classList.add(
        "show"
    );

    wishlistEmpty?.classList.remove(
        "show"
    );

}


function hideWishlistError() {

    wishlistError?.classList.remove(
        "show"
    );

}


/* ==========================================
   RETRY
========================================== */

wishlistRetryBtn?.addEventListener(
    "click",
    () => {

        loadWishlist();

    }
);


/* ==========================================
   CART UPDATED IN THIS TAB
========================================== */

window.addEventListener(
    "gamevault-cart-updated",
    () => {

        updateCartCount();

        updateWishlistCartButtons();

    }
);


/* ==========================================
   CART UPDATED FROM ANOTHER TAB
========================================== */

window.addEventListener(
    "storage",
    event => {

        if (
            event.key ===
            "gamevault_cart"
        ) {

            updateCartCount();

            updateWishlistCartButtons();

        }

    }
);


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(
    auth,
    async user => {

        currentUser =
            user;

        if (!user) {

            wishlistProducts =
                [];

            hideWishlistLoading();

            renderWishlist();

            return;

        }

        await loadWishlist();

    }
);


/* ==========================================
   INITIAL CART STATE
========================================== */

updateCartCount();