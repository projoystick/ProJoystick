/* ==========================================
   GAMEVAULT - HOMEPAGE FIRESTORE LOADER
========================================== */

import { db } from "./firebase.js";

import {
    collection,
    query,
    where,
    getDocs,
    limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   ELEMENTS
========================================== */

const popularGamesGrid =
    document.getElementById("popularGamesGrid");

const popularGamesLoading =
    document.getElementById("popularGamesLoading");

const pinnedProductsGrid =
    document.getElementById("pinnedProductsGrid");

const pinnedProductsLoading =
    document.getElementById("pinnedProductsLoading");


/* ==========================================
   SECURITY / HTML HELPERS
========================================== */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function safeImage(url) {

    if (!url) {
        return "";
    }

    return escapeHTML(url);

}


/* ==========================================
   LOADING / MESSAGE HELPERS
========================================== */

function hideLoading(element) {

    if (element) {
        element.style.display = "none";
    }

}


function showMessage(element, message) {

    if (!element) {
        return;
    }

    element.innerHTML = `
        <p class="home-loading">
            ${escapeHTML(message)}
        </p>
    `;

}


/* ==========================================
   PRICE FORMAT
========================================== */

function formatPrice(price) {

    const value = Number(price);

    if (!Number.isFinite(value)) {
        return "₹0";
    }

    return `₹${value.toLocaleString("en-IN")}`;

}


/* ==========================================
   POPULAR GAMES
========================================== */

async function loadPopularGames() {

    if (!popularGamesGrid) {
        return;
    }


    try {

        popularGamesGrid.innerHTML = "";


        const gamesQuery = query(

            collection(db, "games"),

            where(
                "active",
                "==",
                true
            ),

            where(
                "popular",
                "==",
                true
            ),

            limit(6)

        );


        const snapshot =
            await getDocs(gamesQuery);


        hideLoading(
            popularGamesLoading
        );


        if (snapshot.empty) {

            showMessage(
                popularGamesGrid,
                "No popular games available yet."
            );

            return;

        }


        snapshot.forEach(gameDoc => {

            const game =
                gameDoc.data();

            const id =
                gameDoc.id;


            const name =
                game.name ||
                "Unnamed Game";


            const category =
                game.category ||
                "GAME";


            const description =
                game.description ||
                "Explore available products.";


            const image =
                safeImage(game.image);


            const card =
                document.createElement("article");


            card.className =
                "home-game-card";


            card.innerHTML = `

                <a
                    href="pages/game.html?game=${encodeURIComponent(id)}"
                >

                    <div class="home-game-image">

                        ${
                            image

                                ? `
                                    <img
                                        src="${image}"
                                        alt="${escapeHTML(name)}"
                                        loading="lazy"
                                    >
                                  `

                                : `
                                    <div class="home-image-placeholder">
                                        🎮
                                    </div>
                                  `
                        }

                    </div>


                    <div class="home-game-content">

                        <span class="home-game-category">
                            ${escapeHTML(category)}
                        </span>


                        <h3>
                            ${escapeHTML(name)}
                        </h3>


                        <p>
                            ${escapeHTML(description)}
                        </p>


                        <div class="home-game-link">

                            <span>
                                View Products
                            </span>

                            <span>
                                →
                            </span>

                        </div>

                    </div>

                </a>

            `;


            popularGamesGrid.appendChild(
                card
            );

        });


    } catch (error) {

        console.error(
            "Popular games error:",
            error
        );


        hideLoading(
            popularGamesLoading
        );


        showMessage(
            popularGamesGrid,
            "Unable to load popular games."
        );

    }

}


/* ==========================================
   PINNED PRODUCTS
========================================== */

async function loadPinnedProducts() {

    if (!pinnedProductsGrid) {
        return;
    }


    try {

        pinnedProductsGrid.innerHTML = "";


        const productsQuery = query(

            collection(db, "products"),

            where(
                "active",
                "==",
                true
            ),

            where(
                "pinned",
                "==",
                true
            ),

            limit(8)

        );


        const snapshot =
            await getDocs(productsQuery);


        hideLoading(
            pinnedProductsLoading
        );


        if (snapshot.empty) {

            showMessage(
                pinnedProductsGrid,
                "No featured products available yet."
            );

            return;

        }


        snapshot.forEach(productDoc => {

            const product =
                productDoc.data();

            const id =
                productDoc.id;


            const name =
                product.name ||
                "Unnamed Product";


            const gameName =
                product.gameName ||
                "GAME";


            const type =
                product.type === "currency"
                    ? "CURRENCY"
                    : "ITEM";


            const image =
                safeImage(product.image);


            const price =
                formatPrice(product.price);


            const amount =
                product.amount ||
                "";


            const stock =
                Number(product.stock) || 0;


            const card =
                document.createElement("article");


            card.className =
                "home-product-card";


            /*
             * IMPORTANT
             *
             * The Add to Cart button is inside
             * the product card.
             *
             * script.js detects:
             *
             * .add-to-cart-btn
             *
             * and reads:
             *
             * data-product-id
             */

            card.innerHTML = `

                <div class="home-product-link-wrapper">


                    <a
                        href="pages/product.html?id=${encodeURIComponent(id)}"
                        class="home-product-main-link"
                    >

                        <div class="home-product-image">

                            ${
                                image

                                    ? `
                                        <img
                                            src="${image}"
                                            alt="${escapeHTML(name)}"
                                            loading="lazy"
                                        >
                                      `

                                    : `
                                        <div class="home-image-placeholder">
                                            ◈
                                        </div>
                                      `
                            }

                        </div>


                        <span class="home-product-type">
                            ${escapeHTML(type)}
                        </span>


                        <h3>
                            ${escapeHTML(name)}
                        </h3>


                        ${
                            amount

                                ? `
                                    <div class="home-product-amount">
                                        ${escapeHTML(amount)}
                                    </div>
                                  `

                                : ""
                        }


                        <div class="home-product-game">
                            ${escapeHTML(gameName)}
                        </div>

                    </a>


                    <div class="home-product-bottom">


                        <span class="home-product-price">
                            ${price}
                        </span>


                        <button
                            type="button"
                            class="home-product-buy add-to-cart-btn"
                            data-product-id="${escapeHTML(id)}"
                            data-stock="${stock}"
                            ${stock <= 0 ? "disabled" : ""}
                        >
                            ${
                                stock <= 0
                                    ? "OUT OF STOCK"
                                    : "ADD TO CART"
                            }
                        </button>


                    </div>


                </div>

            `;


            pinnedProductsGrid.appendChild(
                card
            );

        });


    } catch (error) {

        console.error(
            "Pinned products error:",
            error
        );


        hideLoading(
            pinnedProductsLoading
        );


        showMessage(
            pinnedProductsGrid,
            "Unable to load featured products."
        );

    }

}


/* ==========================================
   IMAGE ERROR HANDLING
========================================== */

function setupImageFallbacks() {

    const images =
        document.querySelectorAll(
            ".home-game-image img, .home-product-image img"
        );


    images.forEach(image => {

        image.addEventListener(
            "error",
            () => {

                const placeholder =
                    document.createElement("div");


                placeholder.className =
                    "home-image-placeholder";


                placeholder.textContent =
                    image.closest(
                        ".home-game-image"
                    )

                        ? "🎮"

                        : "◈";


                image.replaceWith(
                    placeholder
                );

            }
        );

    });

}


/* ==========================================
   INITIALIZE HOMEPAGE
========================================== */

async function initializeHomepage() {

    await Promise.allSettled([

        loadPopularGames(),

        loadPinnedProducts()

    ]);


    setupImageFallbacks();

}


initializeHomepage();
