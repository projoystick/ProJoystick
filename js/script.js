/* ==========================================
   GAMEVAULT - GLOBAL JAVASCRIPT
   CART + SEARCH + AUTHENTICATION
   Works from:
   /index.html
   /pages/*.html
========================================== */

import { auth } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* ==========================================
   PAGE LOCATION
========================================== */

const isInsidePages =
    window.location.pathname.includes("/pages/");


/* ==========================================
   PAGE PATHS
========================================== */

const paths = {

    home: isInsidePages
        ? "../index.html"
        : "index.html",

    games: isInsidePages
        ? "games.html"
        : "pages/games.html",

    cart: isInsidePages
        ? "cart.html"
        : "pages/cart.html",

    profile: isInsidePages
        ? "profile.html"
        : "pages/profile.html",

    orders: isInsidePages
        ? "orders.html"
        : "pages/orders.html",

    wishlist: isInsidePages
        ? "wishlist.html"
        : "pages/wishlist.html",

    login: isInsidePages
        ? "login.html"
        : "pages/login.html",

    register: isInsidePages
        ? "register.html"
        : "pages/register.html"

};


/* ==========================================
   CART STORAGE
========================================== */

const CART_STORAGE_KEY = "gamevault_cart";


function getStoredCart() {

    try {

        const stored =
            localStorage.getItem(CART_STORAGE_KEY);

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
            "Cart storage error:",
            error
        );

        return [];

    }

}


function saveStoredCart(cart) {

    try {

        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(cart)
        );

    } catch (error) {

        console.error(
            "Unable to save cart:",
            error
        );

    }

}


/* ==========================================
   CART COUNT
========================================== */

function updateCartCount() {

    const cart =
        getStoredCart();

    const itemCount =
        cart.reduce(
            (total, item) =>
                total + Math.max(
                    1,
                    Number(item.quantity) || 1
                ),
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
   NOTIFICATION
========================================== */

function showNotification(message) {

    const existing =
        document.querySelector(".notification");

    if (existing) {
        existing.remove();
    }


    const notification =
        document.createElement("div");

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


    setTimeout(() => {

        notification.classList.add(
            "hide"
        );


        setTimeout(() => {

            notification.remove();

        }, 300);

    }, 2500);

}


/* ==========================================
   HTML ESCAPE
========================================== */

function escapeHTML(value) {

    return String(value ?? "")

        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* ==========================================
   ADD PRODUCT TO CART
========================================== */

function addProductToCart(product) {

    if (!product.id) {

        console.error(
            "Cannot add product: Product ID missing."
        );

        return;

    }


    const cart =
        getStoredCart();


    const alreadyInCart =
        cart.some(
            item =>
                item.id === product.id
        );


    if (alreadyInCart) {

        showNotification(
            `${product.name} is already in your cart`
        );

        return false;

    }


    cart.push({

        id:
            product.id,

        name:
            product.name || "Unnamed Product",

        game:
            product.game || "GAME",

        amount:
            product.amount || "",

        price:
            Number.isFinite(
                Number(product.price)
            )
                ? Number(product.price)
                : 0,

        image:
            product.image || "",

        stock:
            Number.isFinite(Number(product.stock))
                ? Number(product.stock)
                : 0,

        quantity:
            1,

        addedAt:
            Date.now()

    });


    saveStoredCart(cart);

    updateCartCount();

    window.dispatchEvent(
    new CustomEvent("gamevault-cart-updated")
);


    showNotification(
        `${product.name} added to cart`
    );

    return true;

}


/* ==========================================
   ADD TO CART
========================================== */

document.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".add-to-cart-btn, .add-btn"
            );


        if (!button) {
            return;
        }


        event.preventDefault();
        event.stopPropagation();

        if (button.dataset.inCart === "true") {

            window.location.href = paths.cart;
            return;

        }


        const productId =
            button.dataset.productId ||
            button.dataset.id;


        if (!productId) {

            console.error(
                "Product ID missing from Add to Cart button."
            );

            showNotification(
                "Unable to add this product"
            );

            return;

        }


        const card =
        button.closest(
            ".home-product-card, .product-card, .shop-product-card, .product-details"
        );


        if (!card) {

            console.error(
                "Product card not found."
            );

            return;

        }


        const name =
            card.querySelector("h3, h1")
                ?.textContent
                .trim()
            ||
            "Unnamed Product";


        const game =
            card.querySelector(
                ".home-product-game, .product-game"
            )
                ?.textContent
                .trim()
            ||
            "GAME";


        const amount =
            card.querySelector(
                ".home-product-amount, .product-amount"
            )
                ?.textContent
                .trim()
            ||
            "";


        const priceElement =
            card.querySelector(
                ".home-product-price, .price, .product-current-price, .shop-product-price"
            );


        const priceText =
            priceElement
                ?.textContent
                .trim()
            ||
            "₹0";


        const price =
            Number(
                priceText.replace(
                    /[₹,\s]/g,
                    ""
                )
            );


        const imageElement =
            card.querySelector("img");


        const image =
            imageElement?.src || "";


        const stock =
            Number(button.dataset.stock);


        const wasAdded = addProductToCart({

            id:
                productId,

            name:
                name,

            game:
                game,

            amount:
                amount,

            price:
                Number.isFinite(price)
                    ? price
                    : 0,

            image:
                image,

            stock:
                Number.isFinite(stock)
                    ? stock
                    : 0

        });

        if (button.closest(".product-details")) {

            button.textContent = "GO TO CART";
            button.dataset.inCart = "true";
            button.disabled = false;

            return;

        }

        if (!wasAdded) {
            return;
        }


        const originalText =
            button.dataset.originalText ||
            button.textContent;


        button.dataset.originalText =
            originalText;


        button.textContent =
            "✓ ADDED";


        button.disabled =
            true;


        setTimeout(() => {

            button.textContent =
                originalText;

            button.disabled =
                false;

        }, 1200);

    }
);


/* ==========================================
   CART BUTTON
========================================== */

const cartButton =
    document.querySelector(".cart-btn");


if (cartButton) {

    cartButton.addEventListener(
        "click",
        event => {

            event.preventDefault();

            window.location.href =
                paths.cart;

        }
    );

}


/* ==========================================
   SEARCH BUTTON
========================================== */

const searchButton =
    document.querySelector(".search-btn");


if (searchButton) {

    searchButton.addEventListener(
        "click",
        () => {

            const existingSearch =
                document.querySelector(
                    ".search-overlay"
                );


            if (existingSearch) {

                existingSearch.classList.remove(
                    "active"
                );


                setTimeout(() => {

                    existingSearch.remove();

                }, 250);

                return;

            }


            const overlay =
                document.createElement("div");


            overlay.className =
                "search-overlay";


            overlay.innerHTML = `

                <div class="search-box">

                    <button
                        class="close-search"
                        type="button"
                    >
                        ×
                    </button>

                    <span class="search-label">
                        SEARCH GAMEVAULT
                    </span>

                    <input
                        type="text"
                        class="search-input"
                        placeholder="Search games, currency, items..."
                        autocomplete="off"
                    >

                    <div class="search-results"></div>

                </div>

            `;


            document.body.appendChild(
                overlay
            );


            requestAnimationFrame(() => {

                overlay.classList.add(
                    "active"
                );

            });


            const input =
                overlay.querySelector(
                    ".search-input"
                );


            const closeButton =
                overlay.querySelector(
                    ".close-search"
                );


            const results =
                overlay.querySelector(
                    ".search-results"
                );


            input.focus();


            function closeSearch() {

                overlay.classList.remove(
                    "active"
                );


                setTimeout(() => {

                    overlay.remove();

                }, 250);

            }


            closeButton.addEventListener(
                "click",
                closeSearch
            );


            overlay.addEventListener(
                "click",
                event => {

                    if (
                        event.target === overlay
                    ) {

                        closeSearch();

                    }

                }
            );


            input.addEventListener(
                "input",
                () => {

                    const query =
                        input.value
                            .trim()
                            .toLowerCase();


                    if (!query) {

                        results.innerHTML =
                            "";

                        return;

                    }


                    const products =
                        document.querySelectorAll(
                            ".product-card, .home-product-card"
                        );


                    const games =
                        document.querySelectorAll(
                            ".game-card, .home-game-card"
                        );


                    let resultHTML =
                        "";


                    /* PRODUCTS */

                    products.forEach(
                        product => {

                            const name =
                                product.querySelector(
                                    "h3"
                                )
                                    ?.textContent
                                    .trim()
                                ||
                                "";


                            const game =
                                product.querySelector(
                                    ".product-game, .home-product-game"
                                )
                                    ?.textContent
                                    .trim()
                                ||
                                "";


                            if (
                                name
                                    .toLowerCase()
                                    .includes(query)
                                ||
                                game
                                    .toLowerCase()
                                    .includes(query)
                            ) {

                                resultHTML += `

                                    <div class="search-result">

                                        <strong>
                                            ${escapeHTML(name)}
                                        </strong>

                                        <span>
                                            ${escapeHTML(game)}
                                        </span>

                                    </div>

                                `;

                            }

                        }
                    );


                    /* GAMES */

                    games.forEach(
                        game => {

                            const name =
                                game.querySelector(
                                    "h2, h3"
                                )
                                    ?.textContent
                                    .trim()
                                ||
                                "";


                            const description =
                                game.querySelector(
                                    "p"
                                )
                                    ?.textContent
                                    .trim()
                                ||
                                "";


                            if (
                                name
                                    .toLowerCase()
                                    .includes(query)
                                ||
                                description
                                    .toLowerCase()
                                    .includes(query)
                            ) {

                                resultHTML += `

                                    <div class="search-result">

                                        <strong>
                                            ${escapeHTML(name)}
                                        </strong>

                                        <span>
                                            ${escapeHTML(description)}
                                        </span>

                                    </div>

                                `;

                            }

                        }
                    );


                    if (!resultHTML) {

                        resultHTML = `

                            <div class="no-results">

                                No results found for
                                "${escapeHTML(query)}"

                            </div>

                        `;

                    }


                    results.innerHTML =
                        resultHTML;

                }
            );

        }
    );

}


/* ==========================================
   NAVBAR SCROLL EFFECT
========================================== */

const navbar =
    document.querySelector(".navbar");


if (navbar) {

    window.addEventListener(
        "scroll",
        () => {

            navbar.classList.toggle(
                "scrolled",
                window.scrollY > 40
            );

        }
    );

}


/* ==========================================
   AUTHENTICATED NAVBAR
========================================== */

const navActions =
    document.querySelector(".nav-actions");


function updateNavbar(user) {

    if (!navActions) {
        return;
    }


    const searchButton =
        navActions.querySelector(
            ".search-btn"
        );


    const cartButton =
        navActions.querySelector(
            ".cart-btn"
        );


    if (!searchButton ||
        !cartButton) {

        return;

    }


    /* ======================================
       LOGGED IN
    ====================================== */

    if (user) {

        navActions.innerHTML =
            "";


        navActions.appendChild(
            searchButton
        );


        navActions.appendChild(
            cartButton
        );


        const account =
            document.createElement(
                "div"
            );


        account.className =
            "account-menu";


        const accountButton =
            document.createElement(
                "button"
            );


        accountButton.type =
            "button";


        accountButton.className =
            "account-button";


        const displayName =
            user.displayName ||
            user.email?.split("@")[0] ||
            "User";


        const firstLetter =
            displayName
                .charAt(0)
                .toUpperCase();


        accountButton.innerHTML = `

            <span class="account-avatar">
                ${escapeHTML(firstLetter)}
            </span>

            <span class="account-name">
                ${escapeHTML(displayName)}
            </span>

            <span class="account-arrow">
                ▾
            </span>

        `;


        /* DROPDOWN */

        const dropdown =
            document.createElement(
                "div"
            );


        dropdown.className =
            "account-dropdown";


        dropdown.innerHTML = `

            <div class="account-dropdown-header">

                <span class="dropdown-avatar">
                    ${escapeHTML(firstLetter)}
                </span>

                <div>

                    <strong>
                        ${escapeHTML(displayName)}
                    </strong>

                    <span>
                        ${escapeHTML(user.email || "")}
                    </span>

                </div>

            </div>


            <div class="dropdown-divider"></div>


            <a href="${paths.profile}">
                <span>👤</span>
                Profile
            </a>


            <a href="${paths.orders}">
                <span>📦</span>
                My Orders
            </a>


            <a href="${paths.wishlist}">
                <span>♡</span>
                Wishlist
            </a>


            <div class="dropdown-divider"></div>


            <button
                class="logout-button"
                type="button"
            >

                <span>↪</span>
                Logout

            </button>

        `;


        account.appendChild(
            accountButton
        );


        account.appendChild(
            dropdown
        );


        navActions.appendChild(
            account
        );


        /* ACCOUNT TOGGLE */

        accountButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                account.classList.toggle(
                    "open"
                );

            }
        );


        /* CLOSE DROPDOWN */

        document.addEventListener(
            "click",
            () => {

                account.classList.remove(
                    "open"
                );

            }
        );


        /* LOGOUT */

        const logoutButton =
            dropdown.querySelector(
                ".logout-button"
            );


        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                async () => {

                    try {

                        await signOut(
                            auth
                        );


                        window.location.href =
                            paths.home;


                    } catch (error) {

                        console.error(
                            "Logout error:",
                            error
                        );


                        showNotification(
                            "Unable to log out"
                        );

                    }

                }
            );

        }

    }


    /* ======================================
       LOGGED OUT
    ====================================== */

    else {

        navActions.innerHTML =
            "";


        navActions.appendChild(
            searchButton
        );


        navActions.appendChild(
            cartButton
        );


        navActions.insertAdjacentHTML(
            "beforeend",
            `

                <a
                    href="${paths.login}"
                    class="login-btn"
                >
                    Login
                </a>


                <a
                    href="${paths.register}"
                    class="signup-btn"
                >
                    Sign Up
                </a>

            `
        );

    }

}


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(
    auth,
    user => {

        if (user) {

            console.log(
                "Logged in as:",
                user.email
            );

        } else {

            console.log(
                "User is logged out."
            );

        }


        updateNavbar(
            user
        );

    }
);


/* ==========================================
   INITIAL CART COUNT
========================================== */

updateCartCount();


/* ==========================================
   CART CHANGES FROM OTHER TABS
========================================== */

window.addEventListener(
    "storage",
    event => {

        if (
            event.key === CART_STORAGE_KEY
        ) {

            updateCartCount();

        }

    }
);
