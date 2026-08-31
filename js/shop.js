/* ==========================================
   GAMEVAULT — SHOP PAGE
   Firebase Firestore Marketplace
   Wishlist Fully Integrated
========================================== */

import { auth, db } from "./firebase.js";

import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   ELEMENTS
========================================== */

const shopSearch =
    document.getElementById("shopSearch");

const shopCategories =
    document.getElementById("shopCategories");

const shopContent =
    document.getElementById("shopContent");

const allProductsSection =
    document.getElementById("allProductsSection");

const allProductsCount =
    document.getElementById("allProductsCount");

const allCurrencyCount =
    document.getElementById("allCurrencyCount");

const allItemsCount =
    document.getElementById("allItemsCount");

const allCurrencyGrid =
    document.getElementById("allCurrencyGrid");

const allItemsGrid =
    document.getElementById("allItemsGrid");

const gameSections =
    document.getElementById("gameSections");

const dealsSection =
    document.getElementById("dealsSection");

const dealsCount =
    document.getElementById("dealsCount");

const dealGameSections =
    document.getElementById("dealGameSections");

const shopEmpty =
    document.getElementById("shopEmpty");

const shopError =
    document.getElementById("shopError");

const shopRetryBtn =
    document.getElementById("shopRetryBtn");


/* ==========================================
   STATE
========================================== */

let games = [];

let products = [];

let currentCategory =
    new URLSearchParams(
        window.location.search
    ).get("category") || "all";

let currentSearch = "";

let wishlistItems = new Set();

let currentUser = null;


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


function normalize(value) {

    return String(value ?? "")
        .trim()
        .toLowerCase();

}


function getProductType(product) {

    return normalize(product.type) === "item"
        ? "item"
        : "currency";

}


function isActiveProduct(product) {

    return product.active !== false;

}


function isDealProduct(product) {

    return product.deal === true;

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

        return [];

    }

}


function isProductInCart(productId) {

    const cart =
        getCartItems();

    return cart.some(
        item =>
            item.id === productId
    );

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


function getGameById(gameId) {

    return games.find(
        game =>
            game.id === gameId
    );

}


/* ==========================================
   SEARCH
========================================== */

function productMatchesSearch(product) {

    if (!currentSearch) {
        return true;
    }

    const name =
        normalize(product.name);

    const gameName =
        normalize(product.gameName);

    const amount =
        normalize(product.amount);

    const description =
        normalize(product.description);

    return (
        name.includes(currentSearch) ||
        gameName.includes(currentSearch) ||
        amount.includes(currentSearch) ||
        description.includes(currentSearch)
    );

}


function getVisibleProducts(productList) {

    return productList.filter(
        product =>
            isActiveProduct(product) &&
            productMatchesSearch(product)
    );

}


/* ==========================================
   WISHLIST
   IMPORTANT:
   SAME PATH USED BY wishlist.js

   wishlist/{uid}/items/{productId}
========================================== */

async function loadWishlist() {

    if (!currentUser) {

        wishlistItems =
            new Set();

        return;

    }

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

        wishlistItems =
            new Set(
                snapshot.docs.map(
                    wishlistDoc =>
                        wishlistDoc.id
                )
            );

        console.log(
            "Shop wishlist loaded:",
            [...wishlistItems]
        );

    } catch (error) {

        console.error(
            "Shop wishlist loading error:",
            error
        );

        wishlistItems =
            new Set();

    }

}


/* ==========================================
   UPDATE WISHLIST BUTTONS
========================================== */

function updateAllWishlistButtons() {

    document
        .querySelectorAll(".wishlist-btn")
        .forEach(
            button => {

                const productId =
                    button.dataset.productId;

                const isWishlisted =
                    wishlistItems.has(
                        productId
                    );

                button.classList.toggle(
                    "active",
                    isWishlisted
                );

                button.innerHTML =
                    isWishlisted
                        ? "♥"
                        : "♡";

                button.setAttribute(
                    "aria-label",
                    isWishlisted
                        ? "Remove from wishlist"
                        : "Add to wishlist"
                );

            }
        );

}


/* ==========================================
   TOGGLE WISHLIST
========================================== */

async function toggleWishlist(
    productId,
    button
) {

    if (!currentUser) {

        alert(
            "Please login to add products to your wishlist."
        );

        return;

    }

    if (!productId) {
        return;
    }

    const wishlistItemRef =
        doc(
            db,
            "wishlist",
            currentUser.uid,
            "items",
            productId
        );

    const alreadyWishlisted =
        wishlistItems.has(
            productId
        );

    button.disabled = true;

    try {

        if (alreadyWishlisted) {

            await deleteDoc(
                wishlistItemRef
            );

            wishlistItems.delete(
                productId
            );

            console.log(
                "Removed from wishlist:",
                productId
            );

        } else {

            const product =
                products.find(
                    item =>
                        item.id === productId
                );

            if (!product) {

                console.error(
                    "Product not found:",
                    productId
                );

                return;

            }

            const game =
                getGameById(
                    product.gameId
                );

            await setDoc(
                wishlistItemRef,
                {

                    productId:
                        productId,

                    name:
                        product.name || "",

                    price:
                        Number(product.price) || 0,

                    deal:
                        product.deal === true,

                    dealPrice:
                        getDealPrice(product),

                    image:
                        product.image || "",

                    gameId:
                        product.gameId || "",

                    gameName:
                        product.gameName ||
                        game?.name ||
                        "",

                    amount:
                        product.amount || "",

                    type:
                        product.type ||
                        "currency",

                    description:
                        product.description ||
                        "",

                    stock:
                        Number(product.stock) || 0,

                    active:
                        product.active !== false,

                    addedAt:
                        serverTimestamp()

                }
            );

            wishlistItems.add(
                productId
            );

            console.log(
                "Added to wishlist:",
                productId
            );

        }

        updateAllWishlistButtons();

    } catch (error) {

        console.error(
            "Wishlist update error:",
            error
        );

        alert(
            "Could not update your wishlist. Please try again."
        );

    } finally {

        button.disabled = false;

    }

}


/* ==========================================
   PRODUCT CARD
========================================== */

function createProductCard(product) {

    const card =
        document.createElement("article");

    card.className =
        "shop-product-card";

    const name =
        product.name ||
        "Unnamed Product";

    const gameName =
        product.gameName ||
        getGameById(product.gameId)?.name ||
        "GAME";

    const type =
        getProductType(product);

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

    let savingsHTML = "";

    if (hasValidDeal) {

        const savings =
            price - dealPrice;

        const percentage =
            price > 0
                ? Math.round(
                    (savings / price) * 100
                )
                : 0;

        savingsHTML = `

            <div class="shop-product-deal-info">

                <span class="shop-product-old-price">
                    ${formatPrice(price)}
                </span>

                <span class="shop-product-discount">
                    ${percentage}% OFF
                </span>

            </div>

        `;

    }

    const dealTag =
        hasValidDeal
            ? `
                <span class="shop-product-tag deal">
                    DEAL
                </span>
              `
            : "";

    const pinnedTag =
        product.pinned === true &&
        !hasValidDeal

            ? `
                <span class="shop-product-tag">
                    FEATURED
                </span>
              `
            : "";

    const stockTag =
        outOfStock

            ? `
                <span class="shop-product-stock out">
                    OUT OF STOCK
                </span>
              `

            : validStock < 10

                ? `
                    <span class="shop-product-stock low">
                        ${validStock} LEFT
                    </span>
                  `

                : "";

    const isWishlisted =
        wishlistItems.has(
            product.id
        );

    card.classList.toggle(
        "out-of-stock",
        outOfStock
    );

    card.classList.toggle(
        "on-deal",
        hasValidDeal
    );

    card.innerHTML = `

        <div class="shop-product-image">

            <button
                type="button"
                class="wishlist-btn ${
                    isWishlisted
                        ? "active"
                        : ""
                }"
                data-product-id="${escapeHTML(product.id)}"
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

            ${dealTag}

            ${pinnedTag}

            ${stockTag}

        </div>

        <div class="shop-product-content">

            <span class="shop-product-game">
                ${escapeHTML(gameName)}
            </span>

            <span class="shop-product-type">
                ${
                    type === "currency"
                        ? "CURRENCY"
                        : "ITEM"
                }
            </span>

            <h3>
                ${escapeHTML(name)}
            </h3>

            ${
                amount
                    ? `
                        <div class="shop-product-amount">
                            ${escapeHTML(amount)}
                        </div>
                      `
                    : ""
            }

            <p class="shop-product-description">
                ${escapeHTML(description)}
            </p>

            <div class="shop-product-bottom">

                <div class="shop-product-price-area">

                    <span class="shop-product-price-label">
                        PRICE
                    </span>

                    <strong class="shop-product-price">
                        ${formatPrice(finalPrice)}
                    </strong>

                    ${savingsHTML}

                </div>

                ${
                    outOfStock

                        ? `
                            <button
                                type="button"
                                class="shop-add-to-cart-btn"
                                disabled
                            >
                                OUT OF STOCK
                            </button>
                          `

                        : `
                            <button
                                type="button"
                                class="shop-add-to-cart-btn add-to-cart-btn"
                                data-product-id="${escapeHTML(product.id)}"
                                data-stock="${validStock}"
                            >
                                ADD TO CART
                            </button>
                          `
                }

            </div>

        </div>

    `;


    /* ==========================================
       CHECK IF PRODUCT IN CART
    ====================================== */

    const addBtn =
        card.querySelector(
            ".add-to-cart-btn"
        );

    if (addBtn && isProductInCart(product.id)) {

        addBtn.textContent =
            "GO TO CART";

        addBtn.dataset.inCart =
            "true";

    }


    /* ==========================================
       WISHLIST BUTTON
    ========================================== */

    const wishlistButton =
        card.querySelector(
            ".wishlist-btn"
        );

    if (wishlistButton) {

        wishlistButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                event.stopPropagation();

                await toggleWishlist(
                    product.id,
                    wishlistButton
                );

            }
        );

    }


    setupProductImageFallback(
        card
    );

    card.tabIndex = 0;

    card.setAttribute(
        "role",
        "link"
    );

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

    return card;

}


/* ==========================================
   IMAGE FALLBACK
========================================== */

function setupProductImageFallback(card) {

    const image =
        card.querySelector("img");

    if (!image) {
        return;
    }

    image.addEventListener(
        "error",
        () => {

            const placeholder =
                document.createElement("div");

            placeholder.className =
                "shop-product-image-placeholder";

            placeholder.textContent =
                "◈";

            image.replaceWith(
                placeholder
            );

        }
    );

}


/* ==========================================
   RENDER PRODUCT GRID
========================================== */

function renderProductGrid(
    grid,
    productsList,
    emptyMessage = ""
) {

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    if (productsList.length === 0) {

        if (emptyMessage) {

            grid.innerHTML = `

                <div class="shop-subsection-empty">

                    ${escapeHTML(
                        emptyMessage
                    )}

                </div>

            `;

        }

        return;

    }

    productsList.forEach(
        product => {

            grid.appendChild(
                createProductCard(
                    product
                )
            );

        }
    );

}


/* ==========================================
   RENDER ALL PRODUCTS
========================================== */

function renderAllProducts(
    filteredProducts
) {

    const currencyProducts =
        filteredProducts.filter(
            product =>
                getProductType(product) ===
                "currency"
        );

    const itemProducts =
        filteredProducts.filter(
            product =>
                getProductType(product) ===
                "item"
        );

    if (allProductsCount) {

        allProductsCount.textContent =
            `${filteredProducts.length} ${
                filteredProducts.length === 1
                    ? "Product"
                    : "Products"
            }`;

    }

    if (allCurrencyCount) {

        allCurrencyCount.textContent =
            currencyProducts.length;

    }

    if (allItemsCount) {

        allItemsCount.textContent =
            itemProducts.length;

    }

    renderProductGrid(
        allCurrencyGrid,
        currencyProducts,
        "No currency products found."
    );

    renderProductGrid(
        allItemsGrid,
        itemProducts,
        "No item products found."
    );

}


/* ==========================================
   GAME SECTION
========================================== */

function createGameSection(game) {

    const section =
        document.createElement("section");

    section.className =
        "shop-game-section";

    section.dataset.gameId =
        game.id;

    const title =
        game.name ||
        "Unnamed Game";

    const gameProducts =
        getVisibleProducts(
            products.filter(
                product =>
                    product.gameId ===
                    game.id
            )
        );

    const currencyProducts =
        gameProducts.filter(
            product =>
                getProductType(product) ===
                "currency"
        );

    const itemProducts =
        gameProducts.filter(
            product =>
                getProductType(product) ===
                "item"
        );

    section.innerHTML = `

        <div class="shop-section-header">

            <div>

                <span class="shop-section-label">
                    GAME
                </span>

                <h2>
                    ${escapeHTML(title)}
                </h2>

            </div>

            <span class="shop-section-count">

                ${gameProducts.length}

                ${
                    gameProducts.length === 1
                        ? "Product"
                        : "Products"
                }

            </span>

        </div>

        <div class="shop-product-category">

            <div class="shop-subsection-header">

                <h3>
                    Currency
                </h3>

                <span>
                    ${currencyProducts.length}
                </span>

            </div>

            <div
                class="shop-product-grid"
                data-currency-grid="${escapeHTML(game.id)}"
            ></div>

        </div>

        <div class="shop-product-category">

            <div class="shop-subsection-header">

                <h3>
                    Items
                </h3>

                <span>
                    ${itemProducts.length}
                </span>

            </div>

            <div
                class="shop-product-grid"
                data-items-grid="${escapeHTML(game.id)}"
            ></div>

        </div>

    `;

    const currencyGrid =
        section.querySelector(
            `[data-currency-grid="${CSS.escape(game.id)}"]`
        );

    const itemsGrid =
        section.querySelector(
            `[data-items-grid="${CSS.escape(game.id)}"]`
        );

    renderProductGrid(
        currencyGrid,
        currencyProducts,
        "No currency products found."
    );

    renderProductGrid(
        itemsGrid,
        itemProducts,
        "No item products found."
    );

    return section;

}


/* ==========================================
   RENDER GAME SECTIONS
========================================== */

function renderGameSections() {

    if (!gameSections) {
        return;
    }

    gameSections.innerHTML = "";

    const visibleGames =
        games.filter(
            game =>
                game.active !== false
        );

    visibleGames.forEach(
        game => {

            gameSections.appendChild(
                createGameSection(
                    game
                )
            );

        }
    );

}


/* ==========================================
   DEAL GAME SECTION
========================================== */

function createDealGameSection(
    game,
    dealProducts
) {

    const section =
        document.createElement("section");

    section.className =
        "shop-deal-game-section";

    section.dataset.gameId =
        game.id;

    section.innerHTML = `

        <div class="shop-deal-header">

            <h3>
                ${escapeHTML(
                    game.name ||
                    "Unnamed Game"
                )}
            </h3>

            <span>

                ${dealProducts.length}

                ${
                    dealProducts.length === 1
                        ? "Deal"
                        : "Deals"
                }

            </span>

        </div>

        <div class="shop-product-grid"></div>

    `;

    const grid =
        section.querySelector(
            ".shop-product-grid"
        );

    renderProductGrid(
        grid,
        dealProducts
    );

    return section;

}


/* ==========================================
   RENDER DEALS
========================================== */

function renderDeals(
    filteredProducts
) {

    if (!dealGameSections) {
        return;
    }

    dealGameSections.innerHTML = "";

    const dealProducts =
        filteredProducts.filter(
            product => {

                const dealPrice =
                    getDealPrice(product);

                const price =
                    Number(product.price) || 0;

                return (
                    product.deal === true &&
                    dealPrice !== null &&
                    dealPrice < price
                );

            }
        );

    if (dealsCount) {

        dealsCount.textContent =
            `${dealProducts.length} ${
                dealProducts.length === 1
                    ? "Product"
                    : "Products"
            }`;

    }

    games
        .filter(
            game =>
                game.active !== false
        )
        .forEach(
            game => {

                const gameDeals =
                    dealProducts.filter(
                        product =>
                            product.gameId ===
                            game.id
                    );

                if (gameDeals.length === 0) {
                    return;
                }

                dealGameSections.appendChild(
                    createDealGameSection(
                        game,
                        gameDeals
                    )
                );

            }
        );

}


/* ==========================================
   SECTION VISIBILITY
========================================== */

function updateSectionVisibility() {

    if (allProductsSection) {

        allProductsSection.style.display =
            currentCategory === "all"
                ? ""
                : "none";

    }

    const gameSectionElements =
        gameSections
            ? Array.from(
                gameSections.children
            )
            : [];

    gameSectionElements.forEach(
        section => {

            if (currentCategory === "all") {

                section.style.display = "";

                return;

            }

            if (currentCategory === "deals") {

                section.style.display = "none";

                return;

            }

            section.style.display =
                section.dataset.gameId ===
                currentCategory
                    ? ""
                    : "none";

        }
    );

    if (dealsSection) {

        dealsSection.style.display =
            currentCategory === "deals"
                ? ""
                : "none";

    }

}


/* ==========================================
   RENDER SHOP
========================================== */

function renderShop() {

    const filteredProducts =
        getVisibleProducts(
            products
        );

    renderAllProducts(
        filteredProducts
    );

    renderGameSections();

    renderDeals(
        filteredProducts
    );

    updateSectionVisibility();

    updateEmptyState(
        filteredProducts
    );

}


/* ==========================================
   EMPTY STATE
========================================== */

function updateEmptyState(
    filteredProducts
) {

    if (!shopEmpty) {
        return;
    }

    let hasProducts = false;

    if (currentCategory === "all") {

        hasProducts =
            filteredProducts.length > 0;

    } else if (
        currentCategory === "deals"
    ) {

        hasProducts =
            filteredProducts.some(
                product => {

                    const dealPrice =
                        getDealPrice(product);

                    const price =
                        Number(product.price) || 0;

                    return (
                        product.deal === true &&
                        dealPrice !== null &&
                        dealPrice < price
                    );

                }
            );

    } else {

        hasProducts =
            filteredProducts.some(
                product =>
                    product.gameId ===
                    currentCategory
            );

    }

    shopEmpty.classList.toggle(
        "show",
        !hasProducts
    );

}


/* ==========================================
   CATEGORY BUTTON
========================================== */

function createCategoryButton(
    label,
    category,
    active = false
) {

    const button =
        document.createElement("button");

    button.type =
        "button";

    button.className =
        "shop-category-btn";

    button.classList.toggle(
        "active",
        active
    );

    button.dataset.category =
        category;

    button.textContent =
        label;

    return button;

}


/* ==========================================
   RENDER CATEGORY BUTTONS
========================================== */

function renderCategoryButtons() {

    if (!shopCategories) {
        return;
    }

    shopCategories.innerHTML = "";

    shopCategories.appendChild(
        createCategoryButton(
            "All Products",
            "all",
            currentCategory === "all"
        )
    );

    games
        .filter(
            game =>
                game.active !== false
        )
        .forEach(
            game => {

                shopCategories.appendChild(
                    createCategoryButton(
                        game.name ||
                        "Unnamed Game",
                        game.id,
                        currentCategory ===
                            game.id
                    )
                );

            }
        );

    shopCategories.appendChild(
        createCategoryButton(
            "Deals",
            "deals",
            currentCategory === "deals"
        )
    );

}


/* ==========================================
   CATEGORY CLICK
========================================== */

shopCategories?.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".shop-category-btn"
            );

        if (!button) {
            return;
        }

        currentCategory =
            button.dataset.category ||
            "all";

        shopCategories
            .querySelectorAll(
                ".shop-category-btn"
            )
            .forEach(
                categoryButton => {

                    categoryButton.classList.toggle(
                        "active",
                        categoryButton ===
                            button
                    );

                }
            );

        updateSectionVisibility();

        const targetId =
            currentCategory === "all"
                ? "allProductsSection"
                : currentCategory === "deals"
                    ? "dealsSection"
                    : null;

        if (targetId) {

            document
                .getElementById(targetId)
                ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

            return;

        }

        const gameSection =
            gameSections?.querySelector(
                `[data-game-id="${CSS.escape(currentCategory)}"]`
            );

        gameSection?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }
);


/* ==========================================
   SEARCH
========================================== */

shopSearch?.addEventListener(
    "input",
    () => {

        currentSearch =
            normalize(
                shopSearch.value
            );

        renderShop();

    }
);


/* ==========================================
   LOAD SHOP DATA
========================================== */

async function loadShopData() {

    hideError();

    showInitialLoading();

    try {

        const [
            gamesSnapshot,
            productsSnapshot
        ] = await Promise.all([

            getDocs(
                collection(
                    db,
                    "games"
                )
            ),

            getDocs(
                collection(
                    db,
                    "products"
                )
            )

        ]);

        games =
            gamesSnapshot.docs.map(
                gameDoc => ({
                    id:
                        gameDoc.id,
                    ...gameDoc.data()
                })
            );

        const isValidCategory =
            currentCategory === "all" ||
            currentCategory === "deals" ||
            games.some(
                game => game.id === currentCategory
            );

        if (!isValidCategory) {
            currentCategory = "all";
        }

        products =
            productsSnapshot.docs.map(
                productDoc => ({
                    id:
                        productDoc.id,
                    ...productDoc.data()
                })
            );

        await loadWishlist();

        renderCategoryButtons();

        renderShop();

        hideInitialLoading();

    } catch (error) {

        console.error(
            "Shop loading error:",
            error
        );

        showError();

    }

}


/* ==========================================
   INITIAL LOADING
========================================== */

function showInitialLoading() {

    if (allCurrencyGrid) {

        allCurrencyGrid.innerHTML = `

            <div class="shop-loading">
                Loading products...
            </div>

        `;

    }

    if (allItemsGrid) {

        allItemsGrid.innerHTML = "";

    }

}


function hideInitialLoading() {

    allCurrencyGrid
        ?.querySelector(
            ".shop-loading"
        )
        ?.remove();

}


/* ==========================================
   ERROR
========================================== */

function showError() {

    shopContent?.classList.add(
        "hidden"
    );

    shopEmpty?.classList.remove(
        "show"
    );

    shopError?.classList.add(
        "show"
    );

}


function hideError() {

    shopContent?.classList.remove(
        "hidden"
    );

    shopError?.classList.remove(
        "show"
    );

}


/* ==========================================
   RETRY
========================================== */

shopRetryBtn?.addEventListener(
    "click",
    loadShopData
);


/* ==========================================
   AUTH STATE
========================================== */

auth.onAuthStateChanged(
    async user => {

        currentUser =
            user;

        wishlistItems =
            new Set();

        if (!user) {

            if (products.length > 0) {
                renderShop();
            }

            return;

        }

        await loadWishlist();

        if (products.length > 0) {

            renderShop();

        }

    }
);


/* ==========================================
   START
========================================== */

loadShopData();


/* ==========================================
   CART BUTTON STATE
========================================== */

function updateCartButtons() {

    document
        .querySelectorAll(".add-to-cart-btn")
        .forEach(button => {

            const productId =
                button.dataset.productId;

            if (!productId) {
                return;
            }

            if (isProductInCart(productId)) {

                button.textContent =
                    "GO TO CART";

                button.dataset.inCart =
                    "true";

                button.disabled =
                    false;

            } else {

                button.textContent =
                    "ADD TO CART";

                button.dataset.inCart =
                    "false";

                button.disabled =
                    false;

            }

        });

}


/* ==========================================
   CART UPDATED IN THIS TAB
========================================== */

window.addEventListener(
    "gamevault-cart-updated",
    () => {

        updateCartButtons();

    }
);


/* ==========================================
   CART UPDATED FROM ANOTHER TAB
========================================== */

window.addEventListener(
    "storage",
    event => {

        if (
            event.key === "gamevault_cart"
        ) {

            updateCartButtons();

        }

    }
);