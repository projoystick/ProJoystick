/* ==========================================
   GAMEVAULT — GAMES PAGE
   Loads games from Firebase Firestore
========================================== */

import { db } from "./firebase.js";

import {
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   ELEMENTS
========================================== */

const searchInput =
    document.getElementById("gameSearch");

const filterButtons =
    document.querySelectorAll(".filter-btn");

const gamesGrid =
    document.getElementById("gamesGrid");

const gamesEmpty =
    document.getElementById("gamesEmpty");


/* ==========================================
   STATE
========================================== */

let games = [];

let currentFilter = "all";


/* ==========================================
   LOAD GAMES FROM FIREBASE
========================================== */

async function loadGames() {

    if (!gamesGrid) {
        console.error("Game grid not found.");
        return;
    }

    try {

        gamesGrid.innerHTML = `
            <div class="games-loading">
                Loading games...
            </div>
        `;


        const gamesRef =
            collection(db, "games");


        const snapshot =
            await getDocs(gamesRef);


        games = snapshot.docs.map(
            gameDoc => ({

                id: gameDoc.id,

                ...gameDoc.data()

            })
        );


        console.log(
            "Games loaded from Firebase:",
            games
        );


        renderGames();


    } catch (error) {

        console.error(
            "Error loading games:",
            error
        );


        gamesGrid.innerHTML = `
            <div class="games-error">

                <h3>
                    Unable to load games
                </h3>

                <p>
                    Something went wrong while
                    loading the games.
                </p>

            </div>
        `;

    }

}


/* ==========================================
   RENDER GAMES
========================================== */

function renderGames() {

    if (!gamesGrid) {
        return;
    }


    /* --------------------------------------
       SEARCH VALUE
    -------------------------------------- */

    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    /* --------------------------------------
       FILTER GAMES
    -------------------------------------- */

    const filteredGames =
        games.filter(game => {

            const gameName =
                String(
                    game.name || ""
                )
                .trim()
                .toLowerCase();


            const gameCategory =
                String(
                    game.category || ""
                )
                .trim()
                .toLowerCase();


            const searchMatch =
                gameName.includes(search);


            const categoryMatch =
                currentFilter === "all" ||
                gameCategory === currentFilter;


            return (
                searchMatch &&
                categoryMatch
            );

        });


    /* --------------------------------------
       CLEAR GRID
    -------------------------------------- */

    gamesGrid.innerHTML = "";


    /* --------------------------------------
       EMPTY STATE
    -------------------------------------- */

    if (filteredGames.length === 0) {

        if (gamesEmpty) {

            gamesEmpty.classList.add(
                "show"
            );

        }

        return;

    }


    if (gamesEmpty) {

        gamesEmpty.classList.remove(
            "show"
        );

    }


    /* --------------------------------------
       CREATE CARDS
    -------------------------------------- */

    filteredGames.forEach(game => {

        const card =
            document.createElement("article");


        card.className =
            "game-card";


        /* ----------------------------------
           GAME DATA
        ---------------------------------- */

        const gameName =
            game.name ||
            "Unnamed Game";


        const gameCategory =
            String(
                game.category ||
                "other"
            )
            .trim()
            .toLowerCase();


        const gameDescription =
            game.description ||
            "Browse available products and in-game items.";


        const gameImage =
            game.image ||
            game.imageUrl ||
            "../assets/games/default.jpg";


        /* ----------------------------------
           CATEGORY DISPLAY
        ---------------------------------- */

        const categoryDisplay =
            gameCategory
                .replace(/-/g, " ")
                .toUpperCase();


        /* ----------------------------------
           POPULAR TAG
        ---------------------------------- */

        let popularHTML = "";


        if (game.popular === true) {

            popularHTML = `

                <span class="game-tag">
                    POPULAR
                </span>

            `;

        }


        /* ----------------------------------
           CARD
        ---------------------------------- */

        card.innerHTML = `

            <div class="game-image">

                <img
                    src="${escapeHTML(gameImage)}"
                    alt="${escapeHTML(gameName)}"
                    loading="lazy"
                >

                ${popularHTML}

            </div>


            <div class="game-content">

                <span class="game-category">

                    ${escapeHTML(categoryDisplay)}

                </span>


                <h2>

                    ${escapeHTML(gameName)}

                </h2>


                <p>

                    ${escapeHTML(gameDescription)}

                </p>


                <a
                    href="game.html?game=${encodeURIComponent(game.id)}"
                    class="game-btn"
                >

                    View Products

                    <span>
                        →
                    </span>

                </a>

            </div>

        `;


        gamesGrid.appendChild(card);

    });

}


/* ==========================================
   SEARCH
========================================== */

if (searchInput) {

    searchInput.addEventListener(
        "input",
        () => {

            renderGames();

        }
    );

}


/* ==========================================
   CATEGORY FILTER
========================================== */

filterButtons.forEach(button => {

    button.addEventListener(
        "click",
        () => {

            /* ------------------------------
               REMOVE ACTIVE
            ------------------------------ */

            filterButtons.forEach(
                filterButton => {

                    filterButton.classList.remove(
                        "active"
                    );

                }
            );


            /* ------------------------------
               ACTIVATE CLICKED BUTTON
            ------------------------------ */

            button.classList.add(
                "active"
            );


            /* ------------------------------
               GET CATEGORY
            ------------------------------ */

            currentFilter =
                String(
                    button.dataset.filter ||
                    "all"
                )
                .trim()
                .toLowerCase();


            console.log(
                "Current category:",
                currentFilter
            );


            /* ------------------------------
               RENDER
            ------------------------------ */

            renderGames();

        }
    );

});


/* ==========================================
   ESCAPE HTML
========================================== */

function escapeHTML(value) {

    return String(value ?? "")

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


/* ==========================================
   START
========================================== */

loadGames();