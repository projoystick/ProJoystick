/* ==========================================
   GAMEVAULT
========================================== */


import { auth, db } from "./firebase.js";


import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";



/* ==========================================
   ELEMENTS
========================================== */

const gameHeader =
    document.getElementById("gameHeader");


const productsGrid =
    document.getElementById("productsGrid");


const productsEmpty =
    document.getElementById("productsEmpty");


const productsCount =
    document.getElementById("productsCount");


const shopGameLink =
    document.getElementById("shopGameLink");


let currentUser = null;

let wishlistItems = new Set();

let loadedProducts = [];


/* ==========================================
   WISHLIST
   Keeps this page on the same Firestore path
   used by the shop and wishlist pages.
========================================== */

async function loadWishlist() {

    if (!currentUser) {
        wishlistItems = new Set();
        return;
    }

    try {

        const snapshot = await getDocs(
            collection(
                db,
                "wishlist",
                currentUser.uid,
                "items"
            )
        );

        wishlistItems = new Set(
            snapshot.docs.map(
                wishlistDoc => wishlistDoc.id
            )
        );

    } catch (error) {

        console.error(
            "Game wishlist loading error:",
            error
        );

        wishlistItems = new Set();

    }

}


async function toggleWishlist(product, button) {

    if (!currentUser) {
        alert(
            "Please login to add products to your wishlist."
        );
        return;
    }

    button.disabled = true;

    const wishlistItemRef = doc(
        db,
        "wishlist",
        currentUser.uid,
        "items",
        product.id
    );

    try {

        if (wishlistItems.has(product.id)) {

            await deleteDoc(wishlistItemRef);
            wishlistItems.delete(product.id);

        } else {

            await setDoc(
                wishlistItemRef,
                {
                    productId: product.id,
                    name: product.name || "",
                    price: Number(product.price) || 0,
                    deal: product.deal === true,
                    dealPrice: Number(product.dealPrice) || 0,
                    image: product.image || "",
                    gameId: product.gameId || gameId,
                    gameName: product.gameName || "",
                    amount: product.amount || "",
                    type: product.type || "currency",
                    description: product.description || "",
                    stock: Number(product.stock) || 0,
                    active: product.active !== false,
                    addedAt: serverTimestamp()
                }
            );

            wishlistItems.add(product.id);

        }

        renderProducts(loadedProducts);

    } catch (error) {

        console.error("Wishlist update error:", error);

        alert(
            "Could not update your wishlist. Please try again."
        );

        button.disabled = false;

    }

}


onAuthStateChanged(
    auth,
    async user => {

        currentUser = user;
        await loadWishlist();

        if (loadedProducts.length > 0) {
            renderProducts(loadedProducts);
        }

    }
);



/* ==========================================
   GET GAME ID FROM URL
========================================== */

const urlParams =
    new URLSearchParams(
        window.location.search
    );


const gameId =
    urlParams.get("game");



/* ==========================================
   CHECK GAME ID
========================================== */

if (!gameId) {

    showPageError(
        "Game not found",
        "No game was selected."
    );

} else {

    loadGame();

}



/* ==========================================
   LOAD GAME
========================================== */

async function loadGame() {

    try {

        /* --------------------------------------
           Get game document
        -------------------------------------- */

        const gameRef =
            doc(
                db,
                "games",
                gameId
            );


        const gameSnapshot =
            await getDoc(gameRef);



        /* --------------------------------------
           Game doesn't exist
        -------------------------------------- */

        if (!gameSnapshot.exists()) {

            showPageError(
                "Game not found",
                "This game does not exist."
            );

            return;

        }



        /* --------------------------------------
           Game data
        -------------------------------------- */

        const game = {

            id:
                gameSnapshot.id,

            ...gameSnapshot.data()

        };



        console.log(
            "Game loaded:",
            game
        );



        /* --------------------------------------
           Page title
        -------------------------------------- */

        document.title =
            `${game.name || "Game"} — GameVault`;



        /* --------------------------------------
           Render game
        -------------------------------------- */

        renderGame(
            game
        );

        if (shopGameLink) {
            shopGameLink.href =
                `shop.html?category=${
                    encodeURIComponent(game.id)
                }`;
        }



        /* --------------------------------------
           Load products
        -------------------------------------- */

        await loadProducts(
            game.id
        );


    } catch (error) {

        console.error(
            "Error loading game:",
            error
        );


        showPageError(
            "Unable to load game",
            "Something went wrong while loading this game."
        );

    }

}



/* ==========================================
   RENDER GAME HEADER
========================================== */

function renderGame(game) {

    const gameName =
        game.name ||
        "Unnamed Game";


    const gameDescription =
        game.description ||
        "Browse available products for this game.";


    const gameImage =
        game.image ||
        game.imageUrl ||
        "../assets/games/default.jpg";


    const category =
        String(
            game.category ||
            "other"
        )
        .replace(/-/g, " ")
        .toUpperCase();



    gameHeader.innerHTML = `

        <div class="game-cover">

            <img
                src="${escapeHTML(gameImage)}"
                alt="${escapeHTML(gameName)}"
            >

        </div>


        <div class="game-info">

            <span class="game-category">

                ${escapeHTML(category)}

            </span>


            <h1>

                ${escapeHTML(gameName)}

            </h1>


            <p>

                ${escapeHTML(gameDescription)}

            </p>


            ${
                game.popular === true
                    ? `
                        <span class="game-popular">
                            ★ POPULAR
                        </span>
                    `
                    : ""
            }

        </div>

    `;

}



/* ==========================================
   LOAD PRODUCTS
========================================== */

async function loadProducts(gameId) {

    try {

        productsGrid.innerHTML = `

            <div class="products-loading">

                Loading products...

            </div>

        `;



        /* --------------------------------------
           Find products using gameId
        -------------------------------------- */

        const productsQuery =
            query(
                collection(
                    db,
                    "products"
                ),

                where(
                    "gameId",
                    "==",
                    gameId
                )
            );



        const snapshot =
            await getDocs(
                productsQuery
            );



        /* --------------------------------------
           Convert documents
        -------------------------------------- */

        let products =
            snapshot.docs.map(
                productDoc => ({

                    id:
                        productDoc.id,

                    ...productDoc.data()

                })
            );



        /* --------------------------------------
           Only active products
        -------------------------------------- */

        products =
            products.filter(
                product =>
                    product.active !== false
            );



        /* --------------------------------------
           Sort pinned products first
        -------------------------------------- */

        products.sort(
            (a, b) => {

                if (
                    a.pinned === true &&
                    b.pinned !== true
                ) {

                    return -1;

                }


                if (
                    a.pinned !== true &&
                    b.pinned === true
                ) {

                    return 1;

                }


                return 0;

            }
        );



        console.log(
            "Products loaded:",
            products
        );



        /* --------------------------------------
           Update count
        -------------------------------------- */

        if (productsCount) {

            productsCount.textContent =
                products.length;

        }



        /* --------------------------------------
           No products
        -------------------------------------- */

        if (products.length === 0) {

            productsGrid.innerHTML = "";


            if (productsEmpty) {

                productsEmpty.classList.add(
                    "show"
                );

            }

            return;

        }



        if (productsEmpty) {

            productsEmpty.classList.remove(
                "show"
            );

        }



        /* --------------------------------------
           Render products
        -------------------------------------- */

        loadedProducts = products;

        await loadWishlist();

        renderProducts(loadedProducts);


    } catch (error) {

        console.error(
            "Error loading products:",
            error
        );


        productsGrid.innerHTML = `

            <div class="products-error">

                <h3>
                    Unable to load products
                </h3>

                <p>
                    Something went wrong while
                    loading the products.
                </p>

            </div>

        `;

    }

}



/* ==========================================
   RENDER PRODUCTS
========================================== */

function renderProducts(products) {

    productsGrid.innerHTML = "";


    products.forEach(
        product => {

            const card =
                document.createElement(
                    "article"
                );


            card.className =
                "product-card";



            /* ----------------------------------
               PRODUCT DATA
            ---------------------------------- */

            const name =
                product.name ||
                "Unnamed Product";


            const gameName =
                product.gameName ||
                "GAME";


            const amount =
                product.amount ||
                "";


            const description =
                product.description ||
                "GameVault product.";


            const image =
                product.image ||
                "../assets/games/default.jpg";


            const price =
                Number(
                    product.price
                ) || 0;


            const stock =
                Number(
                    product.stock
                ) || 0;



            /* ----------------------------------
               PINNED TAG
            ---------------------------------- */

            const pinnedHTML =
                product.pinned === true
                    ? `
                        <span class="product-tag">
                            FEATURED
                        </span>
                    `
                    : "";



            /* ----------------------------------
               STOCK
            ---------------------------------- */

            const outOfStock =
                stock <= 0;


            const isWishlisted =
                wishlistItems.has(product.id);



            /* ----------------------------------
               CARD HTML
            ---------------------------------- */

            card.innerHTML = `

                <div class="product-image">

                    <button
                        type="button"
                        class="game-wishlist-btn ${
                            isWishlisted
                                ? "active"
                                : ""
                        }"
                        aria-label="${
                            isWishlisted
                                ? "Remove from wishlist"
                                : "Add to wishlist"
                        }"
                    >
                        ${
                            isWishlisted
                                ? "♥"
                                : "♡"
                        }
                    </button>

                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(name)}"
                        loading="lazy"
                    >

                    ${pinnedHTML}

                </div>


                <div class="product-content">


                    <span class="product-game">

                        ${escapeHTML(gameName)}

                    </span>


                    <h3>

                        ${escapeHTML(name)}

                    </h3>


                    ${
                        amount
                            ? `
                                <div class="product-amount">

                                    ${escapeHTML(amount)}

                                </div>
                            `
                            : ""
                    }


                    <p class="product-description">

                        ${escapeHTML(description)}

                    </p>


                    <div class="product-bottom">


                        <div class="product-price">

                            <span class="price">

                                ₹${price.toLocaleString("en-IN")}

                            </span>

                        </div>


                        ${
                            outOfStock
                                ? `
                                    <button
                                        type="button"
                                        class="add-to-cart-btn"
                                        disabled
                                    >
                                        OUT OF STOCK
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="add-to-cart-btn"
                                        data-product-id="${escapeHTML(product.id)}"
                                        data-stock="${stock}"
                                    >
                                        ADD TO CART
                                    </button>
                                `
                        }

                    </div>


                </div>

            `;


            const wishlistButton =
                card.querySelector(".game-wishlist-btn");

            wishlistButton.addEventListener(
                "click",
                () => toggleWishlist(product, wishlistButton)
            );


            card.tabIndex = 0;

            card.setAttribute("role", "link");

            const openProductPage = event => {

                if (event.target.closest("button, a")) {
                    return;
                }

                window.location.href =
                    `product.html?id=${
                        encodeURIComponent(product.id)
                    }`;

            };

            card.addEventListener("click", openProductPage);

            card.addEventListener(
                "keydown",
                event => {

                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openProductPage(event);
                    }

                }
            );


            productsGrid.appendChild(
                card
            );

        }
    );

}



/* ==========================================
   PAGE ERROR
========================================== */

function showPageError(
    title,
    message
) {

    if (gameHeader) {

        gameHeader.innerHTML = `

            <div class="game-page-error">

                <h1>
                    ${escapeHTML(title)}
                </h1>

                <p>
                    ${escapeHTML(message)}
                </p>

                <a
                    href="games.html"
                    class="game-back-button"
                >
                    ← Back to Games
                </a>

            </div>

        `;

    }


    if (productsGrid) {

        productsGrid.innerHTML =
            "";

    }

}



/* ==========================================
   ESCAPE HTML
========================================== */

function escapeHTML(value) {

    return String(
        value ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}
