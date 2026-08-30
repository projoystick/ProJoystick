/* ==========================================
   GAMEVAULT — WISHLIST PAGE
   Fully synchronized with shop.js
========================================== */

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDocs,
    getDoc,
    deleteDoc
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   ELEMENTS
========================================== */

const wishlistGrid =
    document.getElementById("wishlistGrid");

const wishlistLoading =
    document.getElementById("wishlistLoading");

const wishlistEmpty =
    document.getElementById("wishlistEmpty");

const wishlistError =
    document.getElementById("wishlistError");

const wishlistCount =
    document.getElementById("wishlistCount");

const wishlistRetryBtn =
    document.getElementById("wishlistRetryBtn");


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
   LOAD WISHLIST
   SAME PATH AS shop.js

   wishlist/{uid}/items/{productId}
========================================== */

async function loadWishlist() {

    if (!currentUser) {

        wishlistProducts = [];

        renderWishlist();

        return;

    }

    showLoading();

    hideError();

    try {

        const wishlistRef =
            collection(
                db,
                "wishlist",
                currentUser.uid,
                "items"
            );

        const wishlistSnapshot =
            await getDocs(
                wishlistRef
            );

        wishlistProducts = [];

        for (
            const wishlistDoc
            of wishlistSnapshot.docs
        ) {

            const productId =
                wishlistDoc.id;

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

            if (!productSnapshot.exists()) {

                /*
                 * Product was deleted from the shop.
                 * Remove the orphan wishlist document.
                 */

                await deleteDoc(
                    wishlistDoc.ref
                );

                continue;

            }

            wishlistProducts.push({

                id:
                    productSnapshot.id,

                ...productSnapshot.data(),

                wishlistId:
                    wishlistDoc.id

            });

        }

        console.log(
            "Wishlist loaded:",
            wishlistProducts
        );

        renderWishlist();

    } catch (error) {

        console.error(
            "Wishlist loading error:",
            error
        );

        wishlistProducts = [];

        showError();

    }

}


/* ==========================================
   RENDER WISHLIST
========================================== */

function renderWishlist() {

    hideLoading();

    if (wishlistGrid) {

        wishlistGrid.innerHTML = "";

    }

    const count =
        wishlistProducts.length;

    if (wishlistCount) {

        wishlistCount.textContent =
            `${count} ${
                count === 1
                    ? "Item"
                    : "Items"
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

            const card =
                createWishlistCard(
                    product
                );

            wishlistGrid?.appendChild(
                card
            );

        }
    );

}


/* ==========================================
   CREATE WISHLIST CARD
========================================== */

function createWishlistCard(product) {

    const card =
        document.createElement("article");

    card.className =
        "wishlist-card";

    const name =
        product.name ||
        "Unnamed Product";

    const game =
        product.gameName ||
        "GAME";

    const amount =
        product.amount ||
        "";

    const image =
        product.image ||
        "../assets/games/default.jpg";

    const originalPrice =
        Number(product.price) || 0;

    const finalPrice =
        getFinalPrice(product);

    const dealPrice =
        getDealPrice(product);

    const hasDeal =
        product.deal === true &&
        dealPrice !== null &&
        dealPrice < originalPrice;

    const stock =
        Number(product.stock);

    const validStock =
        Number.isFinite(stock)
            ? stock
            : 0;

    const outOfStock =
        validStock <= 0;

    let priceHTML = `
        <strong class="wishlist-price">
            ${formatPrice(finalPrice)}
        </strong>
    `;

    if (hasDeal) {

        const savings =
            originalPrice -
            finalPrice;

        const percentage =
            originalPrice > 0
                ? Math.round(
                    (savings / originalPrice) * 100
                )
                : 0;

        priceHTML = `

            <div class="wishlist-price-area">

                <strong class="wishlist-price">
                    ${formatPrice(finalPrice)}
                </strong>

                <span class="wishlist-old-price">
                    ${formatPrice(originalPrice)}
                </span>

                <span class="wishlist-discount">
                    ${percentage}% OFF
                </span>

            </div>

        `;

    }

    card.innerHTML = `

        <div class="wishlist-image">

            <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(name)}"
                loading="lazy"
            >

        </div>

        <div class="wishlist-content">

            <span class="wishlist-game">
                ${escapeHTML(game)}
            </span>

            <h2>
                ${escapeHTML(name)}
            </h2>

            ${
                amount
                    ? `
                        <div class="wishlist-amount">
                            ${escapeHTML(amount)}
                        </div>
                      `
                    : ""
            }

            <div class="wishlist-bottom">

                ${priceHTML}

                <div class="wishlist-actions">

                    <button
                        type="button"
                        class="wishlist-remove-btn"
                        data-wishlist-remove="${escapeHTML(product.id)}"
                    >
                        Remove
                    </button>

                    ${
                        outOfStock

                            ? `
                                <button
                                    type="button"
                                    class="wishlist-cart-btn"
                                    disabled
                                >
                                    Out of Stock
                                </button>
                              `

                            : `
                                <button
                                    type="button"
                                    class="wishlist-cart-btn"
                                    data-wishlist-cart="${escapeHTML(product.id)}"
                                >
                                    Add to Cart
                                </button>
                              `
                    }

                </div>

            </div>

        </div>

    `;


    const imageElement =
        card.querySelector("img");

    imageElement?.addEventListener(
        "error",
        () => {

            const placeholder =
                document.createElement("div");

            placeholder.className =
                "wishlist-image-placeholder";

            placeholder.textContent =
                "◈";

            imageElement.replaceWith(
                placeholder
            );

        }
    );


    return card;

}


/* ==========================================
   REMOVE FROM WISHLIST

   IMPORTANT:
   Uses SAME Firestore PATH as shop.js
========================================== */

async function removeFromWishlist(
    productId
) {

    if (
        !currentUser ||
        !productId
    ) {

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

        console.log(
            "Removed from wishlist:",
            productId
        );

        wishlistProducts =
            wishlistProducts.filter(
                product =>
                    product.id !==
                    productId
            );

        renderWishlist();

    } catch (error) {

        console.error(
            "Remove wishlist error:",
            error
        );

        alert(
            "Unable to remove this item from your wishlist."
        );

    }

}


/* ==========================================
   ADD WISHLIST PRODUCT TO CART
========================================== */

function addWishlistProductToCart(
    productId
) {

    const product =
        wishlistProducts.find(
            item =>
                item.id ===
                productId
        );

    if (!product) {
        return;
    }

    const storageKey =
        "gamevault_cart";

    let cart = [];

    try {

        const stored =
            localStorage.getItem(
                storageKey
            );

        const parsed =
            stored
                ? JSON.parse(stored)
                : [];

        cart =
            Array.isArray(parsed)
                ? parsed
                : [];

    } catch (error) {

        cart = [];

    }

    const alreadyExists =
        cart.some(
            item =>
                item.id ===
                product.id
        );

    if (alreadyExists) {

        alert(
            "This product is already in your cart."
        );

        return;

    }

    const price =
        getFinalPrice(product);

    cart.push({

        id:
            product.id,

        name:
            product.name ||
            "Unnamed Product",

        game:
            product.gameName ||
            "GAME",

        amount:
            product.amount ||
            "",

        price:
            Number.isFinite(price)
                ? price
                : 0,

        image:
            product.image ||
            "",

        addedAt:
            Date.now()

    });

    localStorage.setItem(
        storageKey,
        JSON.stringify(cart)
    );

    document
        .querySelectorAll(".cart-count")
        .forEach(
            element => {

                element.textContent =
                    cart.length;

            }
        );

    alert(
        `${product.name} added to cart.`
    );

}


/* ==========================================
   EVENTS
========================================== */

wishlistGrid?.addEventListener(
    "click",
    async event => {

        const removeButton =
            event.target.closest(
                "[data-wishlist-remove]"
            );

        if (removeButton) {

            removeButton.disabled =
                true;

            await removeFromWishlist(
                removeButton.dataset
                    .wishlistRemove
            );

            return;

        }

        const cartButton =
            event.target.closest(
                "[data-wishlist-cart]"
            );

        if (cartButton) {

            addWishlistProductToCart(
                cartButton.dataset
                    .wishlistCart
            );

        }

    }
);


/* ==========================================
   RETRY
========================================== */

wishlistRetryBtn?.addEventListener(
    "click",
    loadWishlist
);


/* ==========================================
   LOADING
========================================== */

function showLoading() {

    wishlistLoading?.classList.add(
        "show"
    );

    wishlistEmpty?.classList.remove(
        "show"
    );

}


function hideLoading() {

    wishlistLoading?.classList.remove(
        "show"
    );

}


/* ==========================================
   ERROR
========================================== */

function showError() {

    hideLoading();

    wishlistGrid?.replaceChildren();

    wishlistEmpty?.classList.remove(
        "show"
    );

    wishlistError?.classList.add(
        "show"
    );

}


function hideError() {

    wishlistError?.classList.remove(
        "show"
    );

}


/* ==========================================
   AUTHENTICATION
========================================== */

onAuthStateChanged(
    auth,
    async user => {

        currentUser =
            user;

        if (!user) {

            window.location.href =
                "login.html";

            return;

        }

        await loadWishlist();

    }
);