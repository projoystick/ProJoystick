/* ==========================================
   GLOBAL SEARCH
   PROJOYSTICK
   FIRESTORE COLLECTION SEARCH
========================================== */

import { db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const searchButton =
    document.querySelector(".search-btn");


if (searchButton) {

    searchButton.addEventListener(
        "click",
        openSearch
    );


    /* ==========================================
       OPEN SEARCH
    ========================================== */

    async function openSearch() {

        const existingSearch =
            document.querySelector(
                ".search-overlay"
            );


        if (existingSearch) {

            existingSearch
                .querySelector(".search-input")
                ?.focus();

            return;

        }


        /* ==========================================
           SEARCH OVERLAY
        ========================================== */

        const overlay =
            document.createElement("div");


        overlay.className =
            "search-overlay";


        overlay.innerHTML = `

            <div class="search-box">

                <button
                    class="close-search"
                    type="button"
                    aria-label="Close search"
                >
                    ×
                </button>


                <span class="search-label">
                    SEARCH PROJOYSTICK
                </span>


                <input
                    type="text"
                    class="search-input"
                    placeholder="Search games, currency, items..."
                    autocomplete="off"
                    spellcheck="false"
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


        let selectedIndex = -1;


        input.focus();


        /* ==========================================
           LOAD COMPLETE COLLECTION
        ========================================== */

        results.innerHTML = `

            <div class="search-loading">
                Searching...
            </div>

        `;


        let searchIndex = [];


        try {

            searchIndex =
                await buildSearchIndex();


            if (!overlay.isConnected) {

                return;

            }


            results.innerHTML = "";


        } catch (error) {

            console.error(
                "Search loading error:",
                error
            );


            results.innerHTML = `

                <div class="search-no-results">
                    Unable to load search results.
                </div>

            `;

        }


        /* ==========================================
           CLOSE SEARCH
        ========================================== */

        function closeSearch() {

            overlay.classList.remove(
                "active"
            );


            document.removeEventListener(
                "keydown",
                handleKeyboard
            );


            setTimeout(() => {

                if (
                    overlay.isConnected
                ) {

                    overlay.remove();

                }

            }, 250);

        }


        closeButton.addEventListener(
            "click",
            closeSearch
        );


        /* ==========================================
           CLICK OUTSIDE
        ========================================== */

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


        /* ==========================================
           KEYBOARD
        ========================================== */

        document.addEventListener(
            "keydown",
            handleKeyboard
        );


        function handleKeyboard(event) {

            if (
                !document.body.contains(
                    overlay
                )
            ) {

                document.removeEventListener(
                    "keydown",
                    handleKeyboard
                );

                return;

            }


            /* ESC */

            if (
                event.key === "Escape"
            ) {

                event.preventDefault();

                closeSearch();

                return;

            }


            /* DOWN */

            if (
                event.key === "ArrowDown"
            ) {

                event.preventDefault();

                moveSelection(1);

                return;

            }


            /* UP */

            if (
                event.key === "ArrowUp"
            ) {

                event.preventDefault();

                moveSelection(-1);

                return;

            }


            /* ENTER */

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                openSelectedResult();

            }

        }


        /* ==========================================
           SEARCH INPUT
        ========================================== */

        input.addEventListener(
            "input",
            () => {

                /*
                 * Normalize the user's search.
                 *
                 * Example:
                 *
                 * "  mine  "
                 *
                 * becomes:
                 *
                 * "mine"
                 */

                const query =
                    normalizeText(
                        input.value
                    );


                selectedIndex = -1;


                if (!query) {

                    results.innerHTML =
                        "";

                    return;

                }


                const matches =
                    searchIndex
                        .filter(
                            item => {

                                const searchable =
                                    normalizeText(
                                        item.searchText
                                    );


                                return searchable.includes(
                                    query
                                );

                            }
                        )
                        .sort(
                            (a, b) => {

                                return (
                                    getSearchScore(
                                        b,
                                        query
                                    ) -
                                    getSearchScore(
                                        a,
                                        query
                                    )
                                );

                            }
                        );


                renderResults(
                    matches,
                    query
                );

            }
        );


        /* ==========================================
           BUILD COMPLETE SEARCH INDEX
        ========================================== */

        async function buildSearchIndex() {

            const index = [];

            const seen =
                new Set();


            /* ==========================================
               GAMES COLLECTION
            ========================================== */

            const gamesSnapshot =
                await getDocs(
                    collection(
                        db,
                        "games"
                    )
                );


            gamesSnapshot.forEach(
                gameDoc => {

                    const data =
                        gameDoc.data();


                    /*
                     * Don't show disabled games.
                     */

                    if (
                        data.active === false
                    ) {

                        return;

                    }


                    const id =
                        gameDoc.id;


                    const name =
                        normalizeDisplayText(
                            data.name
                        );


                    const category =
                        normalizeDisplayText(
                            data.category
                        );


                    const description =
                        normalizeDisplayText(
                            data.description
                        );


                    if (!name) {

                        return;

                    }


                    const uniqueKey =
                        `game-${id}`;


                    if (
                        seen.has(
                            uniqueKey
                        )
                    ) {

                        return;

                    }


                    seen.add(
                        uniqueKey
                    );


                    index.push({

                        type: "game",

                        id,

                        name,

                        category,

                        description,

                        href:
                            `/pages/game.html?game=${encodeURIComponent(id)}`,

                        searchText:
                            [
                                name,
                                category,
                                description
                            ]
                                .join(" ")
                                .toLowerCase()

                    });

                }
            );


            /* ==========================================
               PRODUCTS COLLECTION
            ========================================== */

            const productsSnapshot =
                await getDocs(
                    collection(
                        db,
                        "products"
                    )
                );


            productsSnapshot.forEach(
                productDoc => {

                    const data =
                        productDoc.data();


                    /*
                     * Don't show disabled products.
                     */

                    if (
                        data.active === false
                    ) {

                        return;

                    }


                    const id =
                        productDoc.id;


                    const name =
                        normalizeDisplayText(
                            data.name
                        );


                    const gameName =
                        normalizeDisplayText(
                            data.gameName
                        );


                    const amount =
                        normalizeDisplayText(
                            data.amount
                        );


                    const type =
                        normalizeDisplayText(
                            data.type
                        );


                    const description =
                        normalizeDisplayText(
                            data.description
                        );


                    if (!name) {

                        return;

                    }


                    const uniqueKey =
                        `product-${id}`;


                    if (
                        seen.has(
                            uniqueKey
                        )
                    ) {

                        return;

                    }


                    seen.add(
                        uniqueKey
                    );


                    index.push({

                        type: "product",

                        id,

                        name,

                        category:
                            gameName,

                        amount,

                        productType:
                            type,

                        description,

                        href:
                            `/pages/product.html?id=${encodeURIComponent(id)}`,

                        searchText:
                            [
                                name,
                                gameName,
                                amount,
                                type,
                                description
                            ]
                                .join(" ")
                                .toLowerCase()

                    });

                }
            );


            return index;

        }


        /* ==========================================
           SEARCH SCORE
        ========================================== */

        function getSearchScore(
            item,
            query
        ) {

            const name =
                normalizeText(
                    item.name
                );


            const category =
                normalizeText(
                    item.category
                );


            const description =
                normalizeText(
                    item.description
                );


            const amount =
                normalizeText(
                    item.amount
                );


            let score = 0;


            /* ==========================================
               GAME PRIORITY
            ========================================== */

            if (
                item.type === "game"
            ) {

                score += 1000;

            }


            /* ==========================================
               EXACT NAME
            ========================================== */

            if (
                name === query
            ) {

                score += 10000;

            }


            /* ==========================================
               NAME STARTS WITH QUERY
            ========================================== */

            else if (
                name.startsWith(
                    query
                )
            ) {

                score += 7000;

            }


            /* ==========================================
               NAME CONTAINS QUERY
            ========================================== */

            else if (
                name.includes(
                    query
                )
            ) {

                score += 5000;

            }


            /* ==========================================
               PRODUCT GAME MATCH
            ========================================== */

            if (
                category.includes(
                    query
                )
            ) {

                score += 3000;

            }


            /* ==========================================
               AMOUNT MATCH
            ========================================== */

            if (
                amount.includes(
                    query
                )
            ) {

                score += 2000;

            }


            /* ==========================================
               DESCRIPTION MATCH
            ========================================== */

            if (
                description.includes(
                    query
                )
            ) {

                score += 1000;

            }


            return score;

        }


        /* ==========================================
           RENDER RESULTS
        ========================================== */

        function renderResults(
            matches,
            query
        ) {

            if (
                !matches.length
            ) {

                results.innerHTML = `

                    <div class="search-no-results">
                        No results found
                    </div>

                `;

                return;

            }


            /*
             * Keep the result list manageable.
             */

            const limited =
                matches.slice(
                    0,
                    20
                );


            const games =
                limited.filter(
                    item =>
                        item.type === "game"
                );


            const products =
                limited.filter(
                    item =>
                        item.type === "product"
                );


            let html = "";


            /* ==========================================
               GAME
            ========================================== */

            if (
                games.length
            ) {

                html += `

                    <div class="search-section">

                        <div class="search-section-title">
                            GAME
                        </div>

                `;


                games.forEach(
                    (item, index) => {

                        html +=
                            createSimpleResult(
                                item,
                                query,
                                index
                            );

                    }
                );


                html += `

                    </div>

                `;

            }


            /* ==========================================
               PRODUCT
            ========================================== */

            if (
                products.length
            ) {

                html += `

                    <div class="search-section">

                        <div class="search-section-title">
                            PRODUCT
                        </div>

                `;


                products.forEach(
                    (item, index) => {

                        html +=
                            createSimpleResult(
                                item,
                                query,
                                games.length + index
                            );

                    }
                );


                html += `

                    </div>

                `;

            }


            results.innerHTML =
                html;


            /* ==========================================
               RESULT CLICK
            ========================================== */

            results
                .querySelectorAll(
                    ".search-result"
                )
                .forEach(
                    result => {

                        result.addEventListener(
                            "click",
                            () => {

                                const href =
                                    result.dataset.href;


                                if (href) {

                                    window.location.href =
                                        href;

                                }

                            }
                        );

                    }
                );

        }


        /* ==========================================
           SIMPLE RESULT
        ========================================== */

        function createSimpleResult(
            item,
            query,
            index
        ) {

            /*
             * Normalize the actual displayed name.
             *
             * This prevents strange spacing such as:
             *
             * Mine          craft
             *
             * and displays:
             *
             * Minecraft
             *
             * or:
             *
             * Mine Craft
             */

            const displayName =
                normalizeDisplayText(
                    item.name
                );


            return `

                <div
                    class="search-result"
                    role="option"
                    tabindex="0"
                    data-index="${index}"
                    data-href="${escapeAttribute(item.href)}"
                >

                    ${highlightText(
                        displayName,
                        query
                    )}

                </div>

            `;

        }


        /* ==========================================
           KEYBOARD SELECTION
        ========================================== */

        function moveSelection(
            direction
        ) {

            const items =
                results.querySelectorAll(
                    ".search-result"
                );


            if (
                !items.length
            ) {

                return;

            }


            selectedIndex +=
                direction;


            if (
                selectedIndex < 0
            ) {

                selectedIndex =
                    items.length - 1;

            }


            if (
                selectedIndex >=
                items.length
            ) {

                selectedIndex = 0;

            }


            items.forEach(
                item => {

                    item.classList.remove(
                        "selected"
                    );

                }
            );


            const selected =
                items[
                    selectedIndex
                ];


            selected.classList.add(
                "selected"
            );


            selected.scrollIntoView({
                block: "nearest"
            });

        }


        /* ==========================================
           OPEN SELECTED RESULT
        ========================================== */

        function openSelectedResult() {

            const items =
                results.querySelectorAll(
                    ".search-result"
                );


            if (
                !items.length
            ) {

                return;

            }


            const index =
                selectedIndex >= 0
                    ? selectedIndex
                    : 0;


            const result =
                items[index];


            const href =
                result.dataset.href;


            if (href) {

                window.location.href =
                    href;

            }

        }


        /* ==========================================
           NORMALIZE DISPLAY TEXT
        ========================================== */

        function normalizeDisplayText(
            value
        ) {

            return String(
                value ?? ""
            )
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();

        }


        /* ==========================================
           NORMALIZE SEARCH TEXT
        ========================================== */

        function normalizeText(
            value
        ) {

            return normalizeDisplayText(
                value
            )
                .toLowerCase();

        }


        /* ==========================================
           HIGHLIGHT SEARCH MATCH
        ========================================== */

        function highlightText(
            text,
            query
        ) {

            const cleanText =
                normalizeDisplayText(
                    text
                );


            if (
                !cleanText ||
                !query
            ) {

                return escapeHTML(
                    cleanText
                );

            }


            const escapedText =
                escapeHTML(
                    cleanText
                );


            const escapedQuery =
                escapeRegExp(
                    normalizeText(
                        query
                    )
                );


            return escapedText.replace(
                new RegExp(
                    `(${escapedQuery})`,
                    "gi"
                ),
                "<mark>$1</mark>"
            );

        }


        /* ==========================================
           ESCAPE REGEX
        ========================================== */

        function escapeRegExp(
            text
        ) {

            return String(
                text
            ).replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        }


        /* ==========================================
           ESCAPE HTML
        ========================================== */

        function escapeHTML(
            text
        ) {

            return String(
                text
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


        /* ==========================================
           ESCAPE ATTRIBUTE
        ========================================== */

        function escapeAttribute(
            text
        ) {

            return escapeHTML(
                text
            );

        }

    }

}