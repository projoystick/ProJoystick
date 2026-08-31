/* ==========================================
   GAMEVAULT — PRODUCT DETAILS
========================================== */

import { db } from "./firebase.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const productPage = document.getElementById("productPage");

const productId = new URLSearchParams(
    window.location.search
).get("id");


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function formatPrice(price) {

    const value = Number(price);

    return Number.isFinite(value)
        ? `₹${value.toLocaleString("en-IN")}`
        : "₹0";

}


function getDealPrice(product) {

    const value = Number(product.dealPrice);

    return Number.isFinite(value) && value >= 0
        ? value
        : null;

}


function isProductInCart(productId) {

    try {

        const cart = JSON.parse(
            localStorage.getItem("gamevault_cart") || "[]"
        );

        return Array.isArray(cart) && cart.some(
            item => item.id === productId
        );

    } catch (error) {

        return false;

    }

}


function showError(title, message) {

    productPage.innerHTML = `
        <section class="product-error">
            <h1>${escapeHTML(title)}</h1>
            <p>${escapeHTML(message)}</p>
            <a href="shop.html">Browse Shop</a>
        </section>
    `;

}


function renderProduct(product) {

    const name = product.name || "Unnamed Product";
    const gameName = product.gameName || "Game";
    const type = product.type === "currency" ? "Currency" : "Item";
    const amount = product.amount || "";
    const description = product.description || "No description has been added yet.";
    const image = product.image || "";
    const price = Number(product.price) || 0;
    const stock = Number(product.stock);
    const availableStock = Number.isFinite(stock) ? stock : 0;
    const outOfStock = availableStock <= 0;
    const dealPrice = getDealPrice(product);
    const hasDeal = product.deal === true && dealPrice !== null && dealPrice < price;
    const finalPrice = hasDeal ? dealPrice : price;
    const gameHref = product.gameId
        ? `game.html?game=${encodeURIComponent(product.gameId)}`
        : "shop.html";
    const alreadyInCart = isProductInCart(product.id);

    document.title = `${name} — GameVault`;

    productPage.innerHTML = `
        <a class="product-back" href="${gameHref}">← Back to ${escapeHTML(gameName)}</a>

        <section class="product-details">
            <div class="product-media">
                ${
                    image
                        ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(name)}">`
                        : `<div class="product-image-placeholder">◈</div>`
                }
                <div class="product-tags">
                    ${product.pinned === true ? `<span>FEATURED</span>` : ""}
                    ${hasDeal ? `<span class="deal">DEAL</span>` : ""}
                </div>
            </div>

            <div class="product-info">
                <a class="product-game" href="${gameHref}">${escapeHTML(gameName)}</a>
                <span class="product-type">${escapeHTML(type)}</span>
                <h1>${escapeHTML(name)}</h1>
                ${amount ? `<p class="product-amount">${escapeHTML(amount)}</p>` : ""}
                <p class="product-description">${escapeHTML(description)}</p>

                <div class="product-price-area">
                    <span class="product-price-label">PRICE</span>
                    <strong class="product-current-price">${formatPrice(finalPrice)}</strong>
                    ${hasDeal ? `<span class="product-old-price">${formatPrice(price)}</span>` : ""}
                </div>

                <p class="product-stock ${outOfStock ? "out" : ""}">
                    ${outOfStock ? "Out of stock" : `${availableStock} available`}
                </p>

                <div class="product-actions">
                    ${
                        outOfStock
                            ? `<button type="button" class="product-add-btn" disabled>OUT OF STOCK</button>`
                            : `<button type="button" class="product-add-btn add-to-cart-btn" data-product-id="${escapeHTML(product.id)}" data-stock="${availableStock}" data-in-cart="${alreadyInCart}">${alreadyInCart ? "GO TO CART" : "ADD TO CART"}</button>`
                    }
                    <a class="product-game-btn" href="${gameHref}">VIEW GAME</a>
                </div>
            </div>
        </section>
    `;

}


async function loadProduct() {

    if (!productId) {
        showError("Product not found", "No product was selected.");
        return;
    }

    try {

        const snapshot = await getDoc(
            doc(db, "products", productId)
        );

        if (!snapshot.exists() || snapshot.data().active === false) {
            showError("Product not found", "This product is unavailable.");
            return;
        }

        renderProduct({
            id: snapshot.id,
            ...snapshot.data()
        });

    } catch (error) {

        console.error("Product loading error:", error);
        showError("Unable to load product", "Please try again later.");

    }

}


loadProduct();
