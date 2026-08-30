/* ==========================================
   GAMEVAULT ADMIN
========================================== */

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   HELPERS
========================================== */

const $ = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(timestamp, includeTime = true) {
    if (!timestamp) {
        return "-";
    }

    try {
        let date;

        if (timestamp && typeof timestamp.toDate === "function") {
            date = timestamp.toDate();
        } else if (timestamp instanceof Date) {
            date = timestamp;
        } else if (typeof timestamp === "string") {
            date = new Date(timestamp);
        } else if (typeof timestamp === "number") {
            date = new Date(timestamp);
        } else {
            return "-";
        }

        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return date.toLocaleString(
            "en-IN",
            includeTime
                ? {}
                : {
                    dateStyle: "medium"
                }
        );
    } catch (error) {
        console.error("Date formatting error:", error);
        return "-";
    }
}

function showError(message) {
    console.error(message);

    alert(
        "Something went wrong.\n\n" +
        (message || "Unknown error.")
    );
}

function showSuccess(message) {
    const existing =
        document.querySelector(
            ".admin-toast"
        );

    if (existing) {
        existing.remove();
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        "admin-toast";

    toast.setAttribute(
        "role",
        "status"
    );

    toast.textContent =
        message;

    document.body.appendChild(
        toast
    );

    setTimeout(() => {
        toast.classList.add(
            "hide"
        );

        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}


/* ==========================================
   ELEMENTS
========================================== */

/* Access */
const accessDenied = $("accessDenied");
const adminUsername = $("adminUsername");
const adminLogout = $("adminLogout");

/* Navigation */
const menuButtons =
    document.querySelectorAll(
        ".admin-menu[data-section]"
    );

const sections =
    document.querySelectorAll(
        ".admin-section"
    );

/* Buttons */
const addGameBtn = $("addGameBtn");
const addProductBtn = $("addProductBtn");

/* Tables */
const gamesTableBody = $("gamesTableBody");
const productsTableBody = $("productsTableBody");
const ordersTableBody = $("ordersTableBody");
const usersTableBody = $("usersTableBody");

/* Loading */
const gamesLoading = $("gamesLoading");
const productsLoading = $("productsLoading");
const ordersLoading = $("ordersLoading");
const usersLoading = $("usersLoading");

/* Orders */
const ordersTableWrapper =
    $("ordersTableWrapper");

const ordersEmpty =
    $("ordersEmpty");

const refreshOrdersBtn =
    $("refreshOrdersBtn");

/* Game Modal */
const gameModal =
    $("gameModal");

const closeGameModal =
    $("closeGameModal");

const cancelGame =
    $("cancelGame");

const gameForm =
    $("gameForm");

/* Product Modal */
const productModal =
    $("productModal");

const closeProductModal =
    $("closeProductModal");

const cancelProduct =
    $("cancelProduct");

const productForm =
    $("productForm");

/* Order Modal */
const orderModal =
    $("orderModal");

const closeOrderModal =
    $("closeOrderModal");

const cancelOrder =
    $("cancelOrder");

const orderForm =
    $("orderForm");

/* User Details Modal */
const userModal =
    $("userModal");

const closeUserModal =
    $("closeUserModal");

const userDetailsContent =
    $("userDetailsContent");

/* Delivery Fields */
const addDeliveryFieldBtn =
    $("addDeliveryFieldBtn");

const deliveryFieldsContainer =
    $("deliveryFieldsContainer");

function formatDeliveryLabel(key) {

    return String(key || "")
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, letter =>
            letter.toUpperCase()
        );
}

function formatDeliveryValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    if (Array.isArray(value)) {
        return value
            .map(item => formatDeliveryValue(item))
            .join(", ");
    }

    if (typeof value === "object") {
        return Object.entries(value)
            .map(([key, nestedValue]) =>
                `${formatDeliveryLabel(key)}: ${formatDeliveryValue(nestedValue)}`
            )
            .join(" | ");
    }

    return String(value);
}


/* ==========================================
   CACHE / STATE
========================================== */

let gamesCache = [];
let usersCache = [];

let currentAdminUser = null;
let currentOrder = null;


/* ==========================================
   ACCESS DENIED
========================================== */

function denyAccess() {
    accessDenied?.classList.add("show");

    if (adminUsername) {
        adminUsername.textContent =
            "Access Denied";
    }
}


/* ==========================================
   DELIVERY FIELD EDITOR
========================================== */

function renderDeliveryFieldEmpty() {
    if (!deliveryFieldsContainer) {
        return;
    }

    const rows =
        deliveryFieldsContainer.querySelectorAll(
            ".delivery-field-row"
        );

    if (rows.length > 0) {
        return;
    }

    deliveryFieldsContainer.innerHTML = `
        <div class="delivery-field-empty">
            No delivery fields added yet.
            Click "+ Add Field" to create one.
        </div>
    `;
}


function setFieldEditorMode(row, editing) {
    if (!row) {
        return;
    }

    const preview =
        row.querySelector(
            ".delivery-field-preview"
        );

    const editor =
        row.querySelector(
            ".delivery-field-editor"
        );

    if (!preview || !editor) {
        return;
    }

    row.dataset.editing =
        editing ? "true" : "false";

    preview.style.display =
        editing ? "none" : "flex";

    editor.style.display =
        editing ? "grid" : "none";
}


function updateDeliveryPreview(row) {
    if (!row) {
        return;
    }

    const label =
        row.querySelector(
            ".delivery-field-label"
        )?.value.trim() ||
        "Unnamed Field";

    const key =
        row.querySelector(
            ".delivery-field-key"
        )?.value ||
        "-";

    const type =
        row.querySelector(
            ".delivery-field-type"
        )?.value ||
        "text";

    const required =
        row.querySelector(
            ".delivery-field-required"
        )?.checked === true;

    const labelElement =
        row.querySelector(
            ".delivery-preview-label"
        );

    const keyElement =
        row.querySelector(
            ".delivery-preview-key"
        );

    const typeElement =
        row.querySelector(
            ".delivery-preview-type"
        );

    const statusElement =
        row.querySelector(
            ".delivery-preview-status"
        );

    if (labelElement) {
        labelElement.textContent =
            label;
    }

    if (keyElement) {
        keyElement.textContent =
            `Key: ${key}`;
    }

    if (typeElement) {
        typeElement.textContent =
            `Type: ${type}`;
    }

    if (statusElement) {
        statusElement.textContent =
            required
                ? "Required"
                : "Optional";

        statusElement.className =
            required
                ? "delivery-preview-status delivery-preview-required"
                : "delivery-preview-status delivery-preview-optional";
    }
}


function updateDeliveryOptionsVisibility(row) {
    if (!row) {
        return;
    }

    const type =
        row.querySelector(
            ".delivery-field-type"
        )?.value || "text";

    const optionsWrap =
        row.querySelector(
            ".delivery-options-wrap"
        );

    if (!optionsWrap) {
        return;
    }

    optionsWrap.classList.toggle(
        "hidden",
        type !== "select"
    );
}


function createDeliveryFieldRow(
    field = {},
    startEditing = false
) {
    if (!deliveryFieldsContainer) {
        return null;
    }

    const row =
        document.createElement("div");

    row.className =
        "delivery-field-row";

    const fieldLabel =
        field.label || "";

    const fieldKey =
        field.key || "";

    const fieldType =
        field.type || "text";

    const required =
        field.required === true;

    const options =
        Array.isArray(field.options)
            ? field.options.join(", ")
            : "";

    row.innerHTML = `
        <div class="delivery-field-preview">

            <div class="delivery-field-preview-main">

                <strong class="delivery-preview-label">
                    ${escapeHTML(
                        fieldLabel ||
                        "Unnamed Field"
                    )}
                </strong>

                <span class="delivery-preview-key">
                    Key: ${escapeHTML(
                        fieldKey ||
                        "-"
                    )}
                </span>

                <span class="delivery-preview-type">
                    Type: ${escapeHTML(
                        fieldType
                    )}
                </span>

                <span
                    class="delivery-preview-status ${
                        required
                            ? "delivery-preview-required"
                            : "delivery-preview-optional"
                    }"
                >
                    ${
                        required
                            ? "Required"
                            : "Optional"
                    }
                </span>

            </div>

            <div class="delivery-field-actions">

                <button
                    type="button"
                    class="admin-action-btn delivery-edit-btn"
                >
                    Edit
                </button>

                <button
                    type="button"
                    class="admin-action-btn danger delivery-delete-btn"
                >
                    Delete
                </button>

            </div>

        </div>


        <div class="delivery-field-editor">

            <div class="delivery-field-group">

                <label>
                    Field Label
                </label>

                <input
                    type="text"
                    class="delivery-field-label"
                    value="${escapeHTML(
                        fieldLabel
                    )}"
                    placeholder="e.g. Player UID"
                >

            </div>


            <div class="delivery-field-group">

                <label>
                    Field Key
                </label>

                <input
                    type="text"
                    class="delivery-field-key"
                    value="${escapeHTML(
                        fieldKey
                    )}"
                    placeholder="e.g. playerUid"
                >

            </div>


            <div class="delivery-field-group">

                <label>
                    Type
                </label>

                <select class="delivery-field-type">

                    <option value="text">
                        Text
                    </option>

                    <option value="number">
                        Number
                    </option>

                    <option value="select">
                        Dropdown
                    </option>

                </select>

            </div>


            <div class="delivery-field-group delivery-options-wrap">

                <label>
                    Dropdown Options
                </label>

                <input
                    type="text"
                    class="delivery-field-options"
                    value="${escapeHTML(
                        options
                    )}"
                    placeholder="Asia, Europe, America"
                >

            </div>


            <label class="delivery-required">

                <input
                    type="checkbox"
                    class="delivery-field-required"
                    ${
                        required
                            ? "checked"
                            : ""
                    }
                >

                Required

            </label>


            <div class="delivery-edit-actions">

                <button
                    type="button"
                    class="admin-secondary-btn delivery-cancel-edit-btn"
                >
                    Cancel
                </button>

                <button
                    type="button"
                    class="admin-primary-btn delivery-save-edit-btn"
                >
                    Save Field
                </button>

            </div>

        </div>
    `;

    deliveryFieldsContainer.appendChild(
        row
    );

    const typeSelect =
        row.querySelector(
            ".delivery-field-type"
        );

    typeSelect.value =
        fieldType;

    typeSelect.addEventListener(
        "change",
        () => {
            updateDeliveryOptionsVisibility(
                row
            );
        }
    );


    row
        .querySelector(
            ".delivery-edit-btn"
        )
        ?.addEventListener(
            "click",
            () => {

                setFieldEditorMode(
                    row,
                    true
                );

            }
        );


    row
        .querySelector(
            ".delivery-cancel-edit-btn"
        )
        ?.addEventListener(
            "click",
            () => {

                updateDeliveryPreview(
                    row
                );

                updateDeliveryOptionsVisibility(
                    row
                );

                setFieldEditorMode(
                    row,
                    false
                );

            }
        );


    row
        .querySelector(
            ".delivery-save-edit-btn"
        )
        ?.addEventListener(
            "click",
            () => {

                try {

                    const label =
                        row
                            .querySelector(
                                ".delivery-field-label"
                            )
                            ?.value
                            .trim() || "";

                    const key =
                        row
                            .querySelector(
                                ".delivery-field-key"
                            )
                            ?.value || "";

                    const type =
                        row
                            .querySelector(
                                ".delivery-field-type"
                            )
                            ?.value ||
                        "text";

                    const optionsText =
                        row
                            .querySelector(
                                ".delivery-field-options"
                            )
                            ?.value
                            .trim() || "";

                    if (!label) {
                        throw new Error(
                            "Field label is required."
                        );
                    }

                    if (!key) {
                        throw new Error(
                            "Field key is required."
                        );
                    }

                    if (type === "select") {

                        const options =
                            optionsText
                                .split(",")
                                .map(
                                    item =>
                                        item.trim()
                                )
                                .filter(Boolean);

                        if (
                            options.length === 0
                        ) {
                            throw new Error(
                                "Please enter dropdown options."
                            );
                        }
                    }

                    updateDeliveryPreview(
                        row
                    );

                    updateDeliveryOptionsVisibility(
                        row
                    );

                    setFieldEditorMode(
                        row,
                        false
                    );

                } catch (error) {

                    showError(
                        error.message
                    );
                }
            }
        );


    row
        .querySelector(
            ".delivery-delete-btn"
        )
        ?.addEventListener(
            "click",
            () => {

                if (
                    !confirm(
                        "Delete this delivery field?"
                    )
                ) {
                    return;
                }

                row.remove();

                renderDeliveryFieldEmpty();

            }
        );


    updateDeliveryPreview(
        row
    );

    updateDeliveryOptionsVisibility(
        row
    );

    setFieldEditorMode(
        row,
        startEditing
    );

    return row;
}


function loadDeliveryFields(
    fields = []
) {
    if (!deliveryFieldsContainer) {
        return;
    }

    deliveryFieldsContainer.innerHTML =
        "";

    if (
        !Array.isArray(fields) ||
        fields.length === 0
    ) {
        renderDeliveryFieldEmpty();
        return;
    }

    fields.forEach(field => {
        createDeliveryFieldRow(
            field,
            false
        );
    });
}


function getDeliveryFields() {
    if (!deliveryFieldsContainer) {
        return [];
    }

    const rows =
        deliveryFieldsContainer.querySelectorAll(
            ".delivery-field-row"
        );

    const fields = [];

    rows.forEach((row, index) => {

        const label =
            row.querySelector(
                ".delivery-field-label"
            )?.value.trim() || "";

        const key =
            row.querySelector(
                ".delivery-field-key"
            )?.value || "";

        const type =
            row.querySelector(
                ".delivery-field-type"
            )?.value || "text";

        const required =
            row.querySelector(
                ".delivery-field-required"
            )?.checked === true;

        const optionsText =
            row.querySelector(
                ".delivery-field-options"
            )?.value.trim() || "";

        if (!label) {
            throw new Error(
                `Delivery field ${index + 1}: Field label is required.`
            );
        }

        if (!key) {
            throw new Error(
                `Delivery field ${index + 1}: Field key is required.`
            );
        }

        const field = {
            label,
            key,
            type,
            required
        };

        if (
            type === "select"
        ) {

            const options =
                optionsText
                    .split(",")
                    .map(
                        option =>
                            option.trim()
                    )
                    .filter(Boolean);

            if (
                options.length === 0
            ) {
                throw new Error(
                    `Please add dropdown options for "${label}".`
                );
            }

            field.options =
                [...new Set(options)];
        }

        fields.push(field);
    });


    const keys =
        fields.map(
            field =>
                field.key
        );

    if (
        new Set(keys).size !==
        keys.length
    ) {
        throw new Error(
            "Delivery field keys must be unique."
        );
    }

    return fields;
}


addDeliveryFieldBtn?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        const empty =
            deliveryFieldsContainer?.querySelector(
                ".delivery-field-empty"
            );

        if (empty) {
            empty.remove();
        }

        createDeliveryFieldRow(
            {
                label: "",
                key: "",
                type: "text",
                required: true
            },
            true
        );
    }
);


/* ==========================================
   ORDER CUSTOMER MESSAGE
========================================== */

function createOrderMessageField() {
    if (!orderForm) {
        return;
    }

    if ($("orderAdminMessage")) {
        return;
    }

    const statusGroup =
        $("orderPaymentVerified")
            ?.closest(".form-group");

    const group =
        document.createElement("div");

    group.className =
        "form-group";

    group.innerHTML = `
        <label for="orderAdminMessage">
            Message for Customer
        </label>

        <textarea
            id="orderAdminMessage"
            rows="4"
            placeholder="Write a message for the customer..."
        ></textarea>

        <small>
            This message will be shown on the customer's order page.
        </small>
    `;

    if (statusGroup) {
        statusGroup.after(group);
    } else {
        orderForm.appendChild(group);
    }
}

createOrderMessageField();


/* ==========================================
   GAME MODAL
========================================== */

function openGameModal(game = null) {

    if (!gameModal) {
        return;
    }

    const editing =
        Boolean(game);

    $("gameModalTitle").textContent =
        editing
            ? "Edit Game"
            : "Add Game";

    $("gameId").value =
        editing
            ? game.id
            : "";

    $("gameName").value =
        editing
            ? game.name || ""
            : "";

    $("gameCategory").value =
        editing
            ? game.category || ""
            : "";

    $("gameDescription").value =
        editing
            ? game.description || ""
            : "";

    $("gameImage").value =
        editing
            ? game.image || ""
            : "";

    $("gameActive").checked =
        !editing ||
        game.active !== false;

    $("gamePopular").checked =
        editing &&
        game.popular === true;


    /* IMPORTANT:
       Load existing fields.
    */

    loadDeliveryFields(
        editing
            ? game.deliveryFields || []
            : []
    );


    gameModal.classList.add(
        "show"
    );

    document.body.classList.add(
        "modal-open"
    );

    setTimeout(() => {
        $("gameName")?.focus();
    }, 50);
}


function closeGameModalWindow() {

    gameModal?.classList.remove(
        "show"
    );

    document.body.classList.remove(
        "modal-open"
    );

    gameForm?.reset();

    if ($("gameId")) {
        $("gameId").value = "";
    }

    if ($("gameActive")) {
        $("gameActive").checked = true;
    }

    if ($("gamePopular")) {
        $("gamePopular").checked = false;
    }

    renderDeliveryFieldEmpty();
}


/* ==========================================
   PRODUCT MODAL
========================================== */

function openProductModal(product = null) {

    if (!productModal) {
        return;
    }

    const editing =
        Boolean(product);

    $("productModalTitle").textContent =
        editing
            ? "Edit Product"
            : "Add Product";

    $("productId").value =
        editing
            ? product.id
            : "";

    $("productName").value =
        editing
            ? product.name || ""
            : "";

    $("productType").value =
        editing
            ? product.type || "currency"
            : "currency";

    $("productAmount").value =
        editing
            ? product.amount ?? ""
            : "";

    $("productPrice").value =
        editing
            ? product.price ?? ""
            : "";

    $("productDealPrice").value =
        editing
            ? product.dealPrice ?? ""
            : "";

    $("productStock").value =
        editing
            ? product.stock ?? 0
            : 0;

    $("productImage").value =
        editing
            ? product.image || ""
            : "";

    $("productActive").checked =
        !editing ||
        product.active !== false;

    $("productPinned").checked =
        editing &&
        product.pinned === true;

    $("productDeal").checked =
        editing &&
        product.deal === true;

    populateGameSelect(
        editing
            ? product.gameId || ""
            : ""
    );

    productModal.classList.add(
        "show"
    );

    document.body.classList.add(
        "modal-open"
    );

    setTimeout(() => {
        $("productName")?.focus();
    }, 50);
}


function closeProductModalWindow() {

    productModal?.classList.remove(
        "show"
    );

    document.body.classList.remove(
        "modal-open"
    );

    productForm?.reset();

    if ($("productId")) {
        $("productId").value = "";
    }

    if ($("productActive")) {
        $("productActive").checked = true;
    }

    if ($("productPinned")) {
        $("productPinned").checked = false;
    }

    if ($("productDeal")) {
        $("productDeal").checked = false;
    }
}


/* ==========================================
   ORDER MODAL
========================================== */

async function openOrderModal(orderId) {

    if (!orderId || !orderModal) {
        return;
    }

    try {

        const orderRef =
            doc(
                db,
                "orders",
                orderId
            );

        const snapshot =
            await getDoc(orderRef);

        if (!snapshot.exists()) {

            showError(
                "This order no longer exists."
            );

            await loadOrders();

            return;
        }

        currentOrder = {
            id:
                snapshot.id,

            ...snapshot.data()
        };

        const order =
            currentOrder;


        const customer =
            order.customerName ||
            order.username ||
            order.name ||
            order.userEmail ||
            order.email ||
            "Unknown";


        const email =
            order.userEmail ||
            order.email ||
            "-";


        const items =
            Array.isArray(order.items)
                ? order.items
                : [];


        let itemText = "";

        if (items.length > 0) {

            const groupedItems =
                new Map();

            items.forEach(item => {

                const gameId =
                    item?.gameId ||
                    item?.game ||
                    "other";

                if (!groupedItems.has(gameId)) {
                    groupedItems.set(
                        gameId,
                        []
                    );
                }

                groupedItems.get(gameId).push(item);
            });

            itemText =
                [...groupedItems.entries()]
                    .map(([gameId, gameItems]) => {

                        const gameName =
                            gameItems[0]?.game ||
                            gamesCache.find(
                                game => game.id === gameId
                            )?.name ||
                            "Other Products";

                        const products =
                            gameItems
                                .map(item => {

                                    const name =
                                        item?.name ||
                                        item?.productName ||
                                        "Unknown Product";

                                    const quantity =
                                        Math.max(
                                            1,
                                            Number(
                                                item?.quantity
                                            ) || 1
                                        );

                                    return `- ${name} × ${quantity}`;
                                })
                                .join("\n");

                        return `${gameName}\n${products}`;
                    })
                    .join("\n\n");

        } else {

            itemText =
                order.productName ||
                order.product ||
                order.itemName ||
                "Unknown Product";
        }


        const amount =
            Number(
                order.total ??
                order.amount ??
                order.price ??
                0
            );


        $("orderId").value =
            order.id;

        $("orderCustomer").value =
            customer;

        $("orderEmail").value =
            email;

        $("orderItems").value =
            itemText;

        $("orderAmount").value =
            `₹${
                Number.isFinite(amount)
                    ? amount.toLocaleString(
                        "en-IN"
                    )
                    : "0"
            }`;


        /*
         * PAYMENT STATUS
         */

        let paymentStatus =
            String(
                order.paymentStatus ||
                "pending"
            ).toLowerCase();

        const paymentStatuses = [
            "pending",
            "paid",
            "failed",
            "refunded"
        ];

        if (
            !paymentStatuses.includes(
                paymentStatus
            )
        ) {
            paymentStatus =
                "pending";
        }


        /*
         * ORDER STATUS
         */

        let orderStatus =
            String(
                order.orderStatus ||
                "pending"
            ).toLowerCase();

        const orderStatuses = [
            "pending",
            "processing",
            "completed",
            "cancelled"
        ];

        if (
            !orderStatuses.includes(
                orderStatus
            )
        ) {
            orderStatus =
                "pending";
        }


        $("orderPaymentStatus").value =
            paymentStatus;

        $("orderStatus").value =
            orderStatus;


        /*
         * PAYMENT VERIFIED
         */

        $("orderPaymentVerified").checked =
            order.paymentVerified === true;


        /*
         * CUSTOMER MESSAGE
         */

        if ($("orderAdminMessage")) {
            $("orderAdminMessage").value =
                order.adminMessage ||
                "";
        }

        /* ==========================================
        DELIVERY INFORMATION
        ========================================== */

            const deliveryInfoContainer =
                $("orderDeliveryInfo");

            if (deliveryInfoContainer) {

                const deliveryInfo =
                    order.deliveryInfo ||
                    order.deliveryDetails ||
                    {};

                if (
                    deliveryInfo &&
                    typeof deliveryInfo === "object" &&
                    Object.keys(deliveryInfo).length > 0
                ) {

                    deliveryInfoContainer.innerHTML =
                        Object.entries(deliveryInfo)
                            .map(([key, value], index) => {

                                if (
                                    value &&
                                    typeof value === "object" &&
                                    !Array.isArray(value)
                                ) {
                                    const fields =
                                        Object.entries(value.fields || value);

                                    const gameName =
                                        gamesCache.find(
                                            game => game.id === key
                                        )?.name ||
                                        value.gameName ||
                                        `Game ${index + 1}`;

                                    return `
                                        <section class="order-delivery-group">
                                            <h3 class="order-delivery-group-title">
                                                ${escapeHTML(gameName)}
                                            </h3>

                                            <div class="order-delivery-fields">
                                                ${fields
                                                    .map(([fieldKey, fieldValue]) => `
                                                        <div class="order-delivery-item">
                                                            <strong>
                                                                ${escapeHTML(
                                                                    formatDeliveryLabel(fieldKey)
                                                                )}
                                                            </strong>

                                                            <span>
                                                                ${escapeHTML(
                                                                    formatDeliveryValue(fieldValue)
                                                                )}
                                                            </span>
                                                        </div>
                                                    `)
                                                    .join("")}
                                            </div>
                                        </section>
                                    `;
                                }

                                return `
                                    <div class="order-delivery-item">
                                        <strong>
                                            ${escapeHTML(
                                                formatDeliveryLabel(key)
                                            )}
                                        </strong>

                                        <span>
                                            ${escapeHTML(
                                                formatDeliveryValue(value)
                                            )}
                                        </span>
                                    </div>
                                `;
                            })
                            .join("");

                } else {

                    deliveryInfoContainer.innerHTML = `
                        <div class="order-delivery-empty">
                            No delivery information submitted.
                        </div>
                    `;
                }
            }


        orderModal.classList.add(
            "show"
        );

        document.body.classList.add(
            "modal-open"
        );

    } catch (error) {

        console.error(
            "Open order error:",
            error
        );

        showError(
            error.message ||
            "Unable to open this order."
        );
    }
}


function closeOrderModalWindow() {

    orderModal?.classList.remove(
        "show"
    );

    document.body.classList.remove(
        "modal-open"
    );

    orderForm?.reset();

    currentOrder = null;
}


/* ==========================================
   USER DETAILS MODAL
========================================== */

function openUserModal(user) {

    if (!userModal || !userDetailsContent) {
        return;
    }


    const details = [
        ["Username", user.username || "-"],
        ["Email", user.email || "-"],
        ["Role", user.role || "user"],
        ["UID", user.uid || user.id || "-"],
        ["Created", formatDate(user.createdAt)],
        ["Updated", formatDate(user.updatedAt)]
    ];


    userDetailsContent.innerHTML =
        details
            .map(([label, value]) => `
                <div class="user-detail-row">
                    <span>${escapeHTML(label)}</span>
                    <strong>${escapeHTML(value)}</strong>
                </div>
            `)
            .join("");


    userModal.classList.add(
        "show"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function closeUserModalWindow() {

    userModal?.classList.remove(
        "show"
    );

    document.body.classList.remove(
        "modal-open"
    );
}


/* ==========================================
   MODAL EVENTS
========================================== */

closeGameModal?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        closeGameModalWindow();
    }
);

cancelGame?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        closeGameModalWindow();
    }
);

closeProductModal?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        closeProductModalWindow();
    }
);

cancelProduct?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        closeProductModalWindow();
    }
);

closeOrderModal?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        closeOrderModalWindow();
    }
);

cancelOrder?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        closeOrderModalWindow();
    }
);

closeUserModal?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        closeUserModalWindow();
    }
);

gameModal?.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            gameModal
        ) {
            closeGameModalWindow();
        }
    }
);

productModal?.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            productModal
        ) {
            closeProductModalWindow();
        }
    }
);

orderModal?.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            orderModal
        ) {
            closeOrderModalWindow();
        }
    }
);

userModal?.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            userModal
        ) {
            closeUserModalWindow();
        }
    }
);

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Escape"
        ) {
            return;
        }

        if (
            gameModal?.classList.contains(
                "show"
            )
        ) {
            closeGameModalWindow();
        }

        if (
            productModal?.classList.contains(
                "show"
            )
        ) {
            closeProductModalWindow();
        }

        if (
            orderModal?.classList.contains(
                "show"
            )
        ) {
            closeOrderModalWindow();
        }

        if (
            userModal?.classList.contains(
                "show"
            )
        ) {
            closeUserModalWindow();
        }
    }
);


/* ==========================================
   DASHBOARD
========================================== */

async function loadDashboard() {

    try {

        const [
            games,
            products,
            orders,
            users
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
            ),

            getDocs(
                collection(
                    db,
                    "orders"
                )
            ).catch(() => null),

            getDocs(
                collection(
                    db,
                    "users"
                )
            )
        ]);


        if ($("totalGames")) {
            $("totalGames").textContent =
                games.size;
        }

        if ($("totalProducts")) {
            $("totalProducts").textContent =
                products.size;
        }


        if ($("totalOrders")) {
            $("totalOrders").textContent =
                orders?.size ||
                0;
        }

        if ($("totalUsers")) {
            $("totalUsers").textContent =
                users.size;
        }

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );
    }

    }


/* ==========================================
   LOAD GAMES
========================================== */

async function loadGames() {

    if (!gamesTableBody) {
        return;
    }

    try {

        if (gamesLoading) {
            gamesLoading.style.display =
                "block";

            gamesLoading.textContent =
                "Loading games...";
        }


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "games"
                )
            );


        gamesCache =
            snapshot.docs.map(
                gameDoc => ({
                    id:
                        gameDoc.id,

                    ...gameDoc.data()
                })
            );


        renderGames();

        populateGameSelect();


        if (gamesLoading) {
            gamesLoading.style.display =
                "none";
        }

    } catch (error) {

        console.error(
            "Games loading error:",
            error
        );

        if (gamesLoading) {
            gamesLoading.textContent =
                "Unable to load games.";
        }
    }
}


/* ==========================================
   RENDER GAMES
========================================== */

function renderGames() {

    if (!gamesTableBody) {
        return;
    }

    gamesTableBody.innerHTML =
        "";


    if (!gamesCache.length) {

        gamesTableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    No games found.
                </td>
            </tr>
        `;

        return;
    }


    gamesCache.forEach(game => {

        const row =
            document.createElement(
                "tr"
            );


        const hasDeliveryFields =
            Array.isArray(
                game.deliveryFields
            ) &&
            game.deliveryFields.length > 0;


        row.innerHTML = `
            <td>
                <strong>
                    ${escapeHTML(
                        game.name ||
                        "Unnamed Game"
                    )}
                </strong>

                ${
                    hasDeliveryFields
                        ? `
                            <small
                                style="
                                    display:block;
                                    margin-top:4px;
                                    color:#777;
                                "
                            >
                                ${game.deliveryFields.length}
                                delivery field${
                                    game.deliveryFields.length !== 1
                                        ? "s"
                                        : ""
                                }
                            </small>
                        `
                        : ""
                }
            </td>


            <td>
                ${escapeHTML(
                    game.category ||
                    "-"
                )}
            </td>


            <td>

                <span
                    class="admin-status ${
                        game.active === false
                            ? "inactive"
                            : "active"
                    }"
                >
                    ${
                        game.active === false
                            ? "Inactive"
                            : "Active"
                    }
                </span>


                ${
                    game.popular === true
                        ? `
                            <span class="admin-status active">
                                Popular
                            </span>
                        `
                        : ""
                }

            </td>


            <td>

                <button
                    type="button"
                    class="admin-action-btn"
                    data-edit-game="${escapeHTML(
                        game.id
                    )}"
                >
                    Edit
                </button>


                <button
                    type="button"
                    class="admin-action-btn danger"
                    data-delete-game="${escapeHTML(
                        game.id
                    )}"
                >
                    Delete
                </button>

            </td>
        `;


        gamesTableBody.appendChild(
            row
        );
    });
}


/* ==========================================
   GAME ACTIONS
========================================== */

gamesTableBody?.addEventListener(
    "click",
    event => {

        const edit =
            event.target.closest(
                "[data-edit-game]"
            );

        if (edit) {

            const game =
                gamesCache.find(
                    item =>
                        item.id ===
                        edit.dataset.editGame
                );

            if (game) {
                openGameModal(
                    game
                );
            }

            return;
        }


        const remove =
            event.target.closest(
                "[data-delete-game]"
            );

        if (remove) {

            deleteGame(
                remove.dataset.deleteGame
            );
        }
    }
);


/* ==========================================
   SAVE GAME
========================================== */

gameForm?.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const button =
            event.submitter;

        if (button) {
            button.disabled =
                true;

            button.textContent =
                "Saving...";
        }


        try {

            const gameId =
                $("gameId")
                    ?.value
                    .trim() ||
                "";


            const deliveryFields =
                getDeliveryFields();


            const data = {

                name:
                    $("gameName")
                        ?.value
                        .trim() ||
                    "",

                category:
                    $("gameCategory")
                        ?.value
                        .trim() ||
                    "",

                description:
                    $("gameDescription")
                        ?.value
                        .trim() ||
                    "",

                image:
                    $("gameImage")
                        ?.value
                        .trim() ||
                    "",

                active:
                    $("gameActive")
                        ?.checked ??
                    true,

                popular:
                    $("gamePopular")
                        ?.checked ??
                    false,

                deliveryFields:
                    deliveryFields
            };


            if (!data.name) {
                throw new Error(
                    "Game name is required."
                );
            }


            if (!data.category) {
                throw new Error(
                    "Game category is required."
                );


            }


            if (gameId) {

                await updateDoc(
                    doc(
                        db,
                        "games",
                        gameId
                    ),
                    data
                );

            } else {

                await addDoc(
                    collection(
                        db,
                        "games"
                    ),
                    {
                        ...data,
                        createdAt:
                            serverTimestamp()
                    }
                );
            }


            closeGameModalWindow();

            await loadGames();

            await loadDashboard();

            if (!gameId) {
                showSuccess(
                    "Game added successfully."
                );
            }

        } catch (error) {

            console.error(
                "Game save error:",
                error
            );

            showError(
                error.message ||
                "Unable to save game."
            );

        } finally {

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Save Game";
            }
        }
    }
);


/* ==========================================
   DELETE GAME
========================================== */

async function deleteGame(gameId) {

    if (!gameId) {
        return;
    }


    if (
        !confirm(
            "Are you sure you want to delete this game?"
        )
    ) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "games",
                gameId
            )
        );


        await loadGames();

        await loadProducts();

        await loadDashboard();

        showSuccess(
            "Game deleted successfully."
        );

    } catch (error) {

        console.error(
            "Delete game error:",
            error
        );

        showError(
            error.message ||
            "Unable to delete game."
        );
    }
}


/* ==========================================
   GAME SELECT
========================================== */

function populateGameSelect(
    selectedGameId = ""
) {

    const select =
        $("productGame");

    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select Game
        </option>
    `;


    gamesCache.forEach(game => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            game.id;

        option.textContent =
            game.name ||
            "Unnamed Game";

        if (
            game.id ===
            selectedGameId
        ) {
            option.selected =
                true;
        }

        select.appendChild(
            option
        );
    });
}


/* ==========================================
   LOAD PRODUCTS
========================================== */

async function loadProducts() {

    if (!productsTableBody) {
        return;
    }


    try {

        if (productsLoading) {

            productsLoading.style.display =
                "block";

            productsLoading.textContent =
                "Loading products...";
        }


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "products"
                )
            );


        productsTableBody.innerHTML =
            "";


        if (snapshot.empty) {

            productsTableBody.innerHTML = `
                <tr>
                    <td colspan="6">
                        No products found.
                    </td>
                </tr>
            `;

        } else {

            const productsByGame =
                new Map();

            snapshot.forEach(productDoc => {

                const product =
                    productDoc.data();

                const gameId =
                    product.gameId ||
                    "other";

                if (!productsByGame.has(gameId)) {
                    productsByGame.set(
                        gameId,
                        []
                    );
                }

                productsByGame.get(gameId).push({
                    id:
                        productDoc.id,
                    data:
                        product
                });
            });

            productsByGame.forEach(
                (products, gameId) => {

                    const game =
                        gamesCache.find(
                            item => item.id === gameId
                        );

                    const categoryRow =
                        document.createElement("tr");

                    categoryRow.className =
                        "product-game-category";

                    categoryRow.innerHTML = `
                        <td colspan="6">
                            <span class="product-game-category-label">
                                GAME CATEGORY
                            </span>
                            <strong>
                                ${escapeHTML(
                                    game?.name ||
                                    products[0].data.gameName ||
                                    "Other Products"
                                )}
                            </strong>
                        </td>
                    `;

                    productsTableBody.appendChild(
                        categoryRow
                    );

                    products.forEach(product => {
                        renderProductRow(
                            product.id,
                            product.data
                        );
                    });
                }
            );
        }


        if (productsLoading) {
            productsLoading.style.display =
                "none";
        }

    } catch (error) {

        console.error(
            "Products loading error:",
            error
        );

        if (productsLoading) {
            productsLoading.textContent =
                "Unable to load products.";
        }
    }
}


/* ==========================================
   RENDER PRODUCT
========================================== */

function renderProductRow(
    productId,
    product
) {

    if (!productsTableBody) {
        return;
    }


    const game =
        gamesCache.find(
            item =>
                item.id ===
                product.gameId
        );


    const price =
        Number(
            product.price ?? 0
        );


    const row =
        document.createElement(
            "tr"
        );


    row.innerHTML = `
        <td>
            <strong>
                ${escapeHTML(
                    product.name ||
                    "Unnamed Product"
                )}
            </strong>
        </td>


        <td>
            ${escapeHTML(
                game?.name ||
                product.gameName ||
                "-"
            )}
        </td>


        <td>
            ${escapeHTML(
                product.type ||
                "-"
            )}
        </td>


        <td>
            ₹${
                Number.isFinite(price)
                    ? price.toLocaleString(
                        "en-IN"
                    )
                    : "0"
            }
        </td>


        <td>
            ${escapeHTML(
                product.stock ??
                0
            )}
        </td>


        <td>

            <button
                type="button"
                class="admin-action-btn"
                data-edit-product="${escapeHTML(
                    productId
                )}"
            >
                Edit
            </button>


            <button
                type="button"
                class="admin-action-btn danger"
                data-delete-product="${escapeHTML(
                    productId
                )}"
            >
                Delete
            </button>

        </td>
    `;


    productsTableBody.appendChild(
        row
    );
}


/* ==========================================
   PRODUCT ACTIONS
========================================== */

productsTableBody?.addEventListener(
    "click",
    async event => {

        const edit =
            event.target.closest(
                "[data-edit-product]"
            );

        if (edit) {

            await editProduct(
                edit.dataset.editProduct
            );

            return;
        }


        const remove =
            event.target.closest(
                "[data-delete-product]"
            );

        if (remove) {

            await deleteProduct(
                remove.dataset.deleteProduct
            );
        }
    }
);


/* ==========================================
   EDIT PRODUCT
========================================== */

async function editProduct(productId) {

    if (!productId) {
        return;
    }


    try {

        const snapshot =
            await getDoc(
                doc(
                    db,
                    "products",
                    productId
                )
            );


        if (!snapshot.exists()) {

            showError(
                "Product no longer exists."
            );

            await loadProducts();

            return;
        }


        openProductModal({
            id:
                snapshot.id,

            ...snapshot.data()
        });

    } catch (error) {

        console.error(
            "Load product error:",
            error
        );

        showError(
            error.message ||
            "Unable to load product."
        );
    }
}


/* ==========================================
   SAVE PRODUCT
========================================== */

productForm?.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const button =
            event.submitter;

        if (button) {
            button.disabled =
                true;

            button.textContent =
                "Saving...";
        }


        try {

            const productId =
                $("productId")
                    ?.value
                    .trim() ||
                "";


            const gameId =
                $("productGame")
                    ?.value ||
                "";


            const selectedGame =
                gamesCache.find(
                    game =>
                        game.id ===
                        gameId
                );


            const price =
                Number(
                    $("productPrice")
                        ?.value
                );


            const stock =
                Number(
                    $("productStock")
                        ?.value
                );


            const deal =
                $("productDeal")
                    ?.checked ??
                false;


            const dealPriceInput =
                $("productDealPrice")
                    ?.value
                    .trim() ||
                "";


            const dealPrice =
                dealPriceInput === ""
                    ? null
                    : Number(
                        dealPriceInput
                    );


            const data = {

                name:
                    $("productName")
                        ?.value
                        .trim() ||
                    "",

                gameId:

                    gameId,

                gameName:
                    selectedGame?.name ||
                    "",

                type:
                    $("productType")
                        ?.value ||
                    "currency",

                amount:
                    $("productAmount")
                        ?.value
                        .trim() ||
                    "",

                price:
                    price,

                deal:
                    deal,

                dealPrice:
                    deal
                        ? dealPrice
                        : null,

                stock:
                    stock,

                image:
                    $("productImage")
                        ?.value
                        .trim() ||
                    "",

                active:
                    $("productActive")
                        ?.checked ??
                    true,

                pinned:
                    $("productPinned")
                        ?.checked ??
                    false
            };


            if (!data.name) {
                throw new Error(
                    "Product name is required."
                );
            }


            if (!data.gameId) {
                throw new Error(
                    "Please select a game."
                );
            }


            if (
                !Number.isFinite(
                    data.price
                ) ||
                data.price < 0
            ) {
                throw new Error(
                    "Please enter a valid price."
                );
            }


            if (data.deal) {

                if (
                    !Number.isFinite(
                        data.dealPrice
                    ) ||
                    data.dealPrice < 0
                ) {
                    throw new Error(
                        "Please enter a valid deal price."
                    );
                }


                if (
                    data.dealPrice >=
                    data.price
                ) {
                    throw new Error(
                        "Deal price must be lower than the original price."
                    );
                }
            }


            if (
                !Number.isFinite(
                    data.stock
                ) ||
                data.stock < 0 ||
                !Number.isInteger(
                    data.stock
                )
            ) {
                throw new Error(
                    "Please enter a valid stock quantity."
                );
            }


            if (productId) {

                await updateDoc(
                    doc(
                        db,
                        "products",
                        productId
                    ),
                    data
                );

            } else {

                await addDoc(
                    collection(
                        db,
                        "products"
                    ),
                    {
                        ...data,

                        createdAt:
                            serverTimestamp()
                    }
                );
            }


            closeProductModalWindow();

            await loadProducts();

            await loadDashboard();

            if (!productId) {
                showSuccess(
                    "Product added successfully."
                );
            }

        } catch (error) {

            console.error(
                "Product save error:",
                error
            );

            showError(
                error.message ||
                "Unable to save product."
            );

        } finally {

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Save Product";
            }
        }
    }
);


/* ==========================================
   DELETE PRODUCT
========================================== */

async function deleteProduct(
    productId
) {

    if (!productId) {
        return;
    }


    if (
        !confirm(
            "Are you sure you want to delete this product?"
        )
    ) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "products",
                productId
            )
        );


        await loadProducts();

        await loadDashboard();

        showSuccess(
            "Product deleted successfully."
        );

    } catch (error) {

        console.error(
            "Delete product error:",
            error
        );

        showError(
            error.message ||
            "Unable to delete product."
        );
    }
}


/* ==========================================
   LOAD ORDERS
========================================== */

async function loadOrders() {

    if (!ordersTableBody) {
        return;
    }


    try {

        if (ordersLoading) {

            ordersLoading.style.display =
                "block";

            ordersLoading.textContent =
                "Loading orders...";
        }


        if (ordersTableWrapper) {
            ordersTableWrapper.style.display =
                "none";
        }


        if (ordersEmpty) {
            ordersEmpty.style.display =
                "none";
        }


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "orders"
                )
            );


        ordersTableBody.innerHTML =
            "";


        if (snapshot.empty) {

            if (ordersEmpty) {
                ordersEmpty.style.display =
                    "block";
            }

        } else {

            const orders =
                snapshot.docs.map(
                    orderDoc => ({
                        id:
                            orderDoc.id,

                        ...orderDoc.data()
                    })
                );


            /*
             * NEWEST FIRST
             */

            orders.sort(
                (a, b) => {

                    const timeA =
                        a.createdAt?.toMillis
                            ? a.createdAt.toMillis()
                            : new Date(
                                a.createdAt ||
                                0
                            ).getTime();

                    const timeB =
                        b.createdAt?.toMillis
                            ? b.createdAt.toMillis()
                            : new Date(
                                b.createdAt ||
                                0
                            ).getTime();

                    return timeB - timeA;
                }
            );


            orders.forEach(
                order => {

                    renderOrderRow(
                        order.id,
                        order
                    );
                }
            );


            if (ordersTableWrapper) {
                ordersTableWrapper.style.display =
                    "block";
            }
        }


        if (ordersLoading) {
            ordersLoading.style.display =
                "none";
        }

    } catch (error) {

        console.error(
            "Orders loading error:",
            error
        );

        if (ordersLoading) {

            ordersLoading.style.display =
                "block";

            ordersLoading.textContent =
                "Unable to load orders.";
        }
    }
}


/* ==========================================
   ORDER STATUS
========================================== */

function isOrderPaid(order) {

    return (
        order?.paymentVerified === true ||
        order?.paymentStatus === "paid" ||
        order?.paymentStatus === "verified"
    );
}


function getPaymentStatus(order) {

    if (isOrderPaid(order)) {
        return "paid";
    }

    return String(
        order?.paymentStatus ||
        "pending"
    ).toLowerCase();
}


function getOrderStatusOnly(order) {

    return String(
        order?.orderStatus ||
        "pending"
    ).toLowerCase();
}


/* ==========================================
   RENDER ORDER
========================================== */

function renderOrderRow(
    orderId,
    order
) {

    if (!ordersTableBody) {
        return;
    }


    const row =
        document.createElement(
            "tr"
        );


    const customer =
        order.customerName ||
        order.userEmail ||
        order.email ||
        order.username ||
        order.name ||
        "Unknown";


    const items =
        Array.isArray(order.items)
            ? order.items
            : [];


    let productName =
        "Unknown Product";


    if (items.length > 0) {

        productName =
            items
                .map(
                    item =>
                        item?.name ||
                        "Unknown Product"
                )
                .join(", ");

    } else {

        productName =
            order.productName ||
            order.product ||
            order.itemName ||
            "Unknown Product";
    }


    const amount =
        Number(
            order.total ??
            order.amount ??
            order.price ??
            0
        );


    const paymentStatus =
        getPaymentStatus(
            order
        );


    const orderStatus =
        getOrderStatusOnly(
            order
        );


    const orderDate =
        formatDate(
            order.createdAt
        );


    row.innerHTML = `
        <td>
            <strong>
                ${escapeHTML(
                    String(orderId)
                        .substring(0, 8)
                        .toUpperCase()
                )}
            </strong>
        </td>


        <td>
            ${escapeHTML(
                customer
            )}

            ${
                order.userEmail ||
                order.email
                    ? `
                        <small>
                            ${escapeHTML(
                                order.userEmail ||
                                order.email
                            )}
                        </small>
                    `
                    : ""
            }
        </td>


        <td>
            ${escapeHTML(
                productName
            )}

            ${
                items.length > 1
                    ? `
                        <small>
                            ${items.length}
                            items
                        </small>
                    `
                    : ""
            }
        </td>


        <td>
            ₹${
                Number.isFinite(amount)
                    ? amount.toLocaleString(
                        "en-IN"
                    )
                    : "0"
            }
        </td>


        <td>

            <span
                class="admin-status ${
                    paymentStatus === "paid"
                        ? "active"
                        : paymentStatus === "failed"
                            ? "inactive"
                            : ""
                }"
            >
                ${escapeHTML(
                    paymentStatus
                )}
            </span>

        </td>


        <td>

            <span
                class="admin-status ${
                    orderStatus === "completed"
                        ? "active"
                        : orderStatus === "cancelled"
                            ? "inactive"
                            : ""
                }"
            >
                ${escapeHTML(
                    orderStatus
                )}
            </span>

        </td>


        <td>

            ${escapeHTML(
                orderDate
            )}

        </td>


        <td>

            <button
                type="button"
                class="admin-action-btn"
                data-view-order="${escapeHTML(
                    orderId
                )}"
            >
                Open Order
            </button>


            <button
                type="button"
                class="admin-action-btn danger"
                data-delete-order="${escapeHTML(
                    orderId
                )}"
            >
                Delete
            </button>

        </td>
    `;


    ordersTableBody.appendChild(
        row
    );
}


/* ==========================================
   SAVE ORDER
========================================== */

orderForm?.addEventListener(
    "submit",
    async event => {

        event.preventDefault();

        const button =
            event.submitter;

        if (button) {
            button.disabled =
                true;

            button.textContent =
                "Saving...";
        }


        try {

            const orderId =
                $("orderId")
                    ?.value
                    .trim() ||
                "";


            if (!orderId) {
                throw new Error(
                    "Order ID is missing."
                );
            }


            const paymentStatus =
                $("orderPaymentStatus")
                    ?.value ||
                "pending";


            const orderStatus =
                $("orderStatus")
                    ?.value ||
                "pending";


            let paymentVerified =
                $("orderPaymentVerified")
                    ?.checked === true;


            /*
             * PAID = VERIFIED
             */

            if (
                paymentStatus ===
                "paid"
            ) {
                paymentVerified =
                    true;
            }


            /*
             * NON-PAID = NOT VERIFIED
             */

            if (
                paymentStatus !==
                "paid"
            ) {
                paymentVerified =
                    false;
            }


            const adminMessage =
                $("orderAdminMessage")
                    ?.value
                    .trim() ||
                "";


            const updateData = {

                paymentStatus:

                    paymentStatus,

                paymentVerified:

                    paymentVerified,

                orderStatus:

                    orderStatus,

                adminMessage:

                    adminMessage,

                updatedAt:

                    serverTimestamp()
            };


            /*
             * PAID INFORMATION
             */

            if (
                paymentStatus ===
                "paid"
            ) {

                updateData.paidAt =
                    currentOrder?.paidAt ||
                    serverTimestamp();

                updateData.paidBy =
                    currentOrder?.paidBy ||
                    currentAdminUser?.uid ||
                    "";

            } else {

                updateData.paidAt =
                    null;

                updateData.paidBy =
                    "";
            }


            await updateDoc(
                doc(
                    db,
                    "orders",
                    orderId
                ),
                updateData
            );


            closeOrderModalWindow();

            await loadOrders();

            await loadDashboard();


            showSuccess(
                "Order updated successfully."
            );

        } catch (error) {

            console.error(
                "Order update error:",
                error
            );

            showError(
                error.message ||
                "Unable to update order."
            );

        } finally {

            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Save Order";
            }
        }
    }
);


/* ==========================================
   ORDER ACTIONS
========================================== */

ordersTableBody?.addEventListener(
    "click",
    async event => {

        const openButton =
            event.target.closest(
                "[data-view-order]"
            );


        if (openButton) {

            await openOrderModal(
                openButton.dataset.viewOrder
            );

            return;
        }


        const deleteButton =
            event.target.closest(
                "[data-delete-order]"
            );


        if (deleteButton) {

            await deleteOrder(
                deleteButton.dataset.deleteOrder
            );
        }
    }
);


/* ==========================================
   REFRESH ORDERS
========================================== */

refreshOrdersBtn?.addEventListener(
    "click",
    async () => {

        await loadOrders();

        await loadDashboard();
    }
);


/* ==========================================
   DELETE ORDER
========================================== */

async function deleteOrder(orderId) {

    if (!orderId) {
        return;
    }


    if (
        !confirm(
            "Are you sure you want to delete this order?"
        )
    ) {
        return;
    }


    try {

        await deleteDoc(
            doc(
                db,
                "orders",
                orderId
            )
        );


        await loadOrders();

        await loadDashboard();

        showSuccess(
            "Order deleted successfully."
        );

    } catch (error) {

        console.error(
            "Delete order error:",
            error
        );

        showError(
            error.message ||
            "Unable to delete order."
        );
    }
}


/* ==========================================
   LOAD USERS
========================================== */

async function loadUsers() {

    if (!usersTableBody) {
        return;
    }


    try {

        if (usersLoading) {

            usersLoading.style.display =
                "block";

            usersLoading.textContent =
                "Loading users...";
        }


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "users"
                )
            );


        usersCache =
            snapshot.docs.map(
                userDoc => ({
                    id:
                        userDoc.id,

                    ...userDoc.data()
                })
            );


        renderUsers();


        if (usersLoading) {
            usersLoading.style.display =
                "none";
        }

    } catch (error) {

        console.error(
            "Users loading error:",
            error
        );

        if (usersLoading) {
            usersLoading.textContent =
                "Unable to load users.";
        }
    }
}


/* ==========================================
   RENDER USERS
========================================== */

function renderUsers() {

    if (!usersTableBody) {
        return;
    }


    usersTableBody.innerHTML =
        "";


    if (!usersCache.length) {

        usersTableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    No users found.
                </td>
            </tr>
        `;

        return;
    }


    usersCache.forEach(
        user => {

            const row =
                document.createElement(
                    "tr"
                );


            const createdDate =
                formatDate(
                    user.createdAt,
                    false
                );


            const role =
                String(
                    user.role ||
                    "user"
                ).toLowerCase();


            row.innerHTML = `
                <td>
                    <strong>
                        ${escapeHTML(
                            user.username ||
                            "Unknown"
                        )}
                    </strong>
                </td>


                <td>
                    ${escapeHTML(
                        user.email ||
                        "-"
                    )}
                </td>


                <td>

                    <span
                        class="admin-status ${
                            role === "admin"
                                ? "active"
                                : "inactive"
                        }"
                    >
                        ${escapeHTML(
                            role
                        )}
                    </span>

                </td>


                <td>
                    ${escapeHTML(
                        createdDate
                    )}
                </td>


                <td>

                    <button
                        type="button"
                        class="admin-action-btn"
                        data-view-user="${escapeHTML(
                            user.id
                        )}"
                    >
                        View
                    </button>

                </td>
            `;


            usersTableBody.appendChild(
                row
            );
        }
    );
}


/* ==========================================
   USER ACTIONS
========================================== */

usersTableBody?.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                "[data-view-user]"
            );

        if (!button) {
            return;
        }


        const user =
            usersCache.find(
                item =>
                    item.id ===
                    button.dataset.viewUser
            );


        if (!user) {
            return;
        }


        openUserModal(user);
    }
);


/* ==========================================
   ADD GAME
========================================== */

addGameBtn?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        openGameModal();
    }
);


/* ==========================================
   ADD PRODUCT
========================================== */

addProductBtn?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        populateGameSelect();

        openProductModal();
    }
);


/* ==========================================
   SIDEBAR
========================================== */

menuButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const sectionName =
                    button.dataset.section;

                if (!sectionName) {
                    return;
                }


                menuButtons.forEach(
                    item => {
                        item.classList.remove(
                            "active"
                        );
                    }
                );


                sections.forEach(
                    section => {
                        section.classList.remove(
                            "active"
                        );
                    }
                );


                button.classList.add(
                    "active"
                );


                const target =
                    document.getElementById(
                        `${sectionName}Section`
                    );


                target?.classList.add(
                    "active"
                );
            }
        );
    }
);


/* ==========================================
   LOGOUT
========================================== */

adminLogout?.addEventListener(
    "click",
    async () => {

        try {

            await signOut(
                auth
            );

            window.location.href =
                "login.html";

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

            showError(
                error.message ||
                "Unable to logout."
            );
        }
    }
);


/* ==========================================
   AUTHENTICATION
========================================== */

onAuthStateChanged(
    auth,
    async user => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }


        currentAdminUser =
            user;


        try {

            const userRef =
                doc(
                    db,
                    "users",
                    user.uid
                );


            const userSnapshot =
                await getDoc(
                    userRef
                );


            if (
                !userSnapshot.exists()
            ) {

                denyAccess();

                return;
            }


            const userData =
                userSnapshot.data();


            const role =
                String(
                    userData.role ||
                    ""
                ).toLowerCase();


            if (
                role !== "admin"
            ) {

                denyAccess();

                return;
            }


            if (adminUsername) {

                adminUsername.textContent =
                    userData.username ||
                    user.email ||
                    "Admin";
            }


            await loadGames();

            await loadProducts();

            await loadOrders();

            await loadUsers();

            await loadDashboard();

        } catch (error) {

            console.error(
                "Admin verification error:",
                error
            );

            denyAccess();
        }
    }
);