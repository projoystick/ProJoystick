/* ==========================================
   PROJOYSTICK - ORDERS PAGE
========================================== */

import {
    auth,
    db
} from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   ELEMENTS
========================================== */

const refreshOrdersBtn =
    document.getElementById("refreshOrdersBtn");

const ordersLoading =
    document.getElementById("ordersLoading");

const ordersLogin =
    document.getElementById("ordersLogin");

const noOrders =
    document.getElementById("noOrders");

const ordersContainer =
    document.getElementById("ordersContainer");


/* ==========================================
   CURRENT USER
========================================== */

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
    const price = Number(value);

    if (!Number.isFinite(price)) {
        return "₹0";
    }

    return `₹${price.toLocaleString("en-IN")}`;
}


function formatDate(timestamp) {
    if (!timestamp) {
        return "Date unavailable";
    }

    try {
        const date =
            typeof timestamp.toDate === "function"
                ? timestamp.toDate()
                : new Date(timestamp);

        if (Number.isNaN(date.getTime())) {
            return "Date unavailable";
        }

        return date.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        );

    } catch (error) {

        console.error(
            "Date formatting error:",
            error
        );

        return "Date unavailable";
    }
}


/* ==========================================
   PAYMENT STATUS
========================================== */

function getPaymentStatus(order) {

    const status =
        String(
            order?.paymentStatus || "pending"
        ).toLowerCase();

    const validStatuses = [
        "pending",
        "paid",
        "failed",
        "refunded"
    ];

    if (
        validStatuses.includes(status)
    ) {
        return status;
    }

    if (
        order?.paymentVerified === true
    ) {
        return "paid";
    }

    return "pending";
}


/* ==========================================
   ORDER STATUS
========================================== */

function getOrderStatus(order) {

    const status =
        String(
            order?.orderStatus || "pending"
        ).toLowerCase();

    const validStatuses = [
        "pending",
        "processing",
        "completed",
        "cancelled"
    ];

    if (
        validStatuses.includes(status)
    ) {
        return status;
    }

    return "pending";
}


/* ==========================================
   ORDER STATUS CLASS
========================================== */

function getStatusClass(status) {

    switch (
        String(status || "pending").toLowerCase()
    ) {

        case "completed":
            return "order-status-completed";

        case "processing":
            return "order-status-processing";

        case "cancelled":
            return "order-status-cancelled";

        default:
            return "order-status-pending";
    }
}


/* ==========================================
   PAYMENT STATUS CLASS
========================================== */

function getPaymentStatusClass(status) {

    switch (
        String(status || "pending").toLowerCase()
    ) {

        case "paid":
            return "order-payment-paid";

        case "failed":
            return "order-payment-failed";

        case "refunded":
            return "order-payment-refunded";

        default:
            return "order-payment-pending";
    }
}


/* ==========================================
   ORDER ITEMS
========================================== */

function createItemsHTML(items) {

    if (
        !Array.isArray(items) ||
        items.length === 0
    ) {

        return `
            <div class="order-detail-empty">
                No item details available.
            </div>
        `;
    }


    return items.map(item => {

        const name =
            item?.name ||
            item?.productName ||
            "Unnamed Product";


        const game =
            item?.game ||
            item?.gameName ||
            "";


        const amount =
            item?.amount ||
            "";


        const quantity =
            Math.max(
                1,
                Number(item?.quantity) || 1
            );


        const price =
            Number(item?.price) || 0;


        return `
            <div class="order-detail-item">

                <div class="order-detail-item-info">

                    <strong>
                        ${escapeHTML(name)}
                    </strong>

                    ${
                        game
                            ? `
                                <span>
                                    ${escapeHTML(game)}
                                </span>
                            `
                            : ""
                    }

                    ${
                        amount
                            ? `
                                <small>
                                    ${escapeHTML(amount)}
                                </small>
                            `
                            : ""
                    }

                </div>


                <div class="order-detail-item-price">

                    <span>
                        ×${quantity}
                    </span>

                    <strong>
                        ${formatPrice(
                            price * quantity
                        )}
                    </strong>

                </div>

            </div>
        `;

    }).join("");
}


/* ==========================================
   ORDER MESSAGE
========================================== */

function createMessageHTML(order) {

    const message =
        String(
            order?.adminMessage || ""
        ).trim();


    if (!message) {
        return "";
    }


    return `
        <div class="order-message-box">

            <div class="order-message-title">
                Message from PROJOYSTICK
            </div>

            <p>
                ${escapeHTML(message)}
            </p>

        </div>
    `;
}


/* ==========================================
   CREATE ORDER CARD
========================================== */

function createOrderCard(orderId, order) {

    const orderStatus =
        getOrderStatus(order);


    const paymentStatus =
        getPaymentStatus(order);


    const total =
        order?.total ??
        order?.amount ??
        order?.price ??
        0;


    const items =
        Array.isArray(order?.items)
            ? order.items
            : [];


    const card =
        document.createElement("article");


    card.className =
        "order-card";


    card.dataset.orderId =
        orderId;


    card.innerHTML = `

        <!-- ==================================
             ORDER SUMMARY
        ================================== -->

        <div class="order-summary">

            <div class="order-summary-info">

                <div class="order-id-block">

                    <span>
                        ORDER ID
                    </span>

                    <strong>
                        #${escapeHTML(orderId)}
                    </strong>

                </div>


                <div class="order-date-block">

                    <span>
                        DATE
                    </span>

                    <strong>
                        ${escapeHTML(
                            formatDate(
                                order?.createdAt
                            )
                        )}
                    </strong>

                </div>


                <div class="order-status-block">

                    <span>
                        STATUS
                    </span>

                    <strong
                        class="${getStatusClass(
                            orderStatus
                        )}"
                    >
                        ${escapeHTML(
                            orderStatus.toUpperCase()
                        )}
                    </strong>

                </div>

            </div>


            <button
                type="button"
                class="order-dropdown-btn"
                aria-expanded="false"
                aria-label="Show order details"
            >

                <span class="order-arrow">
                    ↓
                </span>

            </button>

        </div>


        <!-- ==================================
             ORDER DETAILS
        ================================== -->

        <div class="order-details">

            <div class="order-details-inner">


                <!-- ORDERED ITEMS -->

                <div class="order-detail-section">

                    <h3>
                        Ordered Items
                    </h3>

                    <div class="order-detail-items">

                        ${createItemsHTML(items)}

                    </div>

                </div>


                <!-- PAYMENT STATUS -->

                <div class="order-detail-row">

                    <span>
                        Payment Status
                    </span>

                    <strong
                        class="${getPaymentStatusClass(
                            paymentStatus
                        )}"
                    >
                        ${escapeHTML(
                            paymentStatus.toUpperCase()
                        )}
                    </strong>

                </div>


                <!-- ORDER STATUS -->

                <div class="order-detail-row">

                    <span>
                        Order Status
                    </span>

                    <strong
                        class="${getStatusClass(
                            orderStatus
                        )}"
                    >
                        ${escapeHTML(
                            orderStatus.toUpperCase()
                        )}
                    </strong>

                </div>


                <!-- ORDER TOTAL -->

                <div
                    class="order-detail-row order-total-row"
                >

                    <span>
                        Order Total
                    </span>

                    <strong>
                        ${formatPrice(total)}
                    </strong>

                </div>


                <!-- ADMIN MESSAGE -->

                ${createMessageHTML(order)}

            </div>

        </div>
    `;


    /* ======================================
       DROPDOWN
    ====================================== */

    const dropdownButton =
        card.querySelector(
            ".order-dropdown-btn"
        );


    if (dropdownButton) {

        dropdownButton.addEventListener(
            "click",
            event => {

                event.preventDefault();
                event.stopPropagation();


                const expanded =
                    card.classList.contains(
                        "expanded"
                    );


                if (expanded) {

                    card.classList.remove(
                        "expanded"
                    );

                    dropdownButton.setAttribute(
                        "aria-expanded",
                        "false"
                    );

                } else {

                    card.classList.add(
                        "expanded"
                    );

                    dropdownButton.setAttribute(
                        "aria-expanded",
                        "true"
                    );
                }
            }
        );
    }


    return card;
}


/* ==========================================
   GET CURRENTLY EXPANDED ORDERS
========================================== */

function getExpandedOrders() {

    const expandedOrders =
        new Set();


    if (!ordersContainer) {
        return expandedOrders;
    }


    ordersContainer
        .querySelectorAll(
            ".order-card.expanded"
        )
        .forEach(card => {

            const orderId =
                card.dataset.orderId;


            if (orderId) {

                expandedOrders.add(
                    orderId
                );
            }
        });


    return expandedOrders;
}


/* ==========================================
   RESTORE EXPANDED ORDERS
========================================== */

function restoreExpandedOrders(
    expandedOrders
) {

    if (!ordersContainer) {
        return;
    }


    ordersContainer
        .querySelectorAll(
            ".order-card"
        )
        .forEach(card => {

            const orderId =
                card.dataset.orderId;


            if (
                expandedOrders.has(
                    orderId
                )
            ) {

                card.classList.add(
                    "expanded"
                );


                const button =
                    card.querySelector(
                        ".order-dropdown-btn"
                    );


                if (button) {

                    button.setAttribute(
                        "aria-expanded",
                        "true"
                    );
                }
            }
        });
}


/* ==========================================
   LOAD ORDERS
========================================== */

async function loadOrders(
    user,
    preserveExpanded = false
) {

    if (!user) {
        return;
    }


    /*
       IMPORTANT:

       Before removing the old cards,
       remember which cards are open.
    */

    const expandedOrders =
        preserveExpanded
            ? getExpandedOrders()
            : new Set();


    try {

        /* ======================================
           LOADING UI
        ====================================== */

        if (ordersLoading) {

            ordersLoading.style.display =
                "block";
        }


        if (ordersLogin) {

            ordersLogin.style.display =
                "none";
        }


        if (noOrders) {

            noOrders.style.display =
                "none";
        }


        if (ordersContainer) {

            ordersContainer.style.display =
                "none";

            ordersContainer.innerHTML =
                "";
        }


        /* ======================================
           FIRESTORE QUERY
        ====================================== */

        const ordersQuery =
            query(
                collection(
                    db,
                    "orders"
                ),

                where(
                    "userId",
                    "==",
                    user.uid
                ),

                orderBy(
                    "createdAt",
                    "desc"
                )
            );


        const snapshot =
            await getDocs(
                ordersQuery
            );


        /* ======================================
           STOP LOADING
        ====================================== */

        if (ordersLoading) {

            ordersLoading.style.display =
                "none";
        }


        /* ======================================
           NO ORDERS
        ====================================== */

        if (snapshot.empty) {

            if (noOrders) {

                noOrders.style.display =
                    "block";
            }

            return;
        }


        if (!ordersContainer) {
            return;
        }


        /* ======================================
           CREATE ORDER CARDS
        ====================================== */

        snapshot.forEach(
            orderDoc => {

                const order =
                    orderDoc.data();


                const orderId =
                    orderDoc.id;


                const card =
                    createOrderCard(
                        orderId,
                        order
                    );


                ordersContainer.appendChild(
                    card
                );
            }
        );


        /* ======================================
           SHOW ORDERS
        ====================================== */

        ordersContainer.style.display =
            "flex";


        /* ======================================
           RESTORE OPEN DROPDOWNS
        ====================================== */

        if (preserveExpanded) {

            restoreExpandedOrders(
                expandedOrders
            );
        }

    } catch (error) {

        console.error(
            "Orders loading error:",
            error
        );


        if (ordersLoading) {

            ordersLoading.style.display =
                "none";
        }


        if (ordersContainer) {

            ordersContainer.innerHTML = `

                <div class="orders-message">

                    <div class="orders-message-icon">
                        !
                    </div>

                    <h2>
                        Unable to Load Orders
                    </h2>

                    <p>
                        Something went wrong while
                        loading your orders.
                    </p>

                    <button
                        type="button"
                        id="ordersRetryBtn"
                    >
                        Try Again
                    </button>

                </div>
            `;


            ordersContainer.style.display =
                "block";


            const retryButton =
                document.getElementById(
                    "ordersRetryBtn"
                );


            if (retryButton) {

                retryButton.addEventListener(
                    "click",
                    () => {

                        loadOrders(
                            user,
                            true
                        );
                    }
                );
            }
        }
    }
}


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(
    auth,
    async user => {

        currentUser =
            user;


        if (!user) {

            if (ordersLoading) {

                ordersLoading.style.display =
                    "none";
            }


            if (ordersLogin) {

                ordersLogin.style.display =
                    "block";
            }


            if (noOrders) {

                noOrders.style.display =
                    "none";
            }


            if (ordersContainer) {

                ordersContainer.style.display =
                    "none";
            }


            if (refreshOrdersBtn) {

                refreshOrdersBtn.disabled =
                    true;
            }


            return;
        }


        if (ordersLogin) {

            ordersLogin.style.display =
                "none";
        }


        if (refreshOrdersBtn) {

            refreshOrdersBtn.disabled =
                false;
        }


        /*
           First page load.

           We do NOT need to preserve
           dropdown state here.
        */

        await loadOrders(
            user,
            false
        );
    }
);


/* ==========================================
   REFRESH ORDERS BUTTON
========================================== */

if (refreshOrdersBtn) {

    refreshOrdersBtn.addEventListener(
        "click",
        async () => {

            /*
               Make sure the user is logged in.
            */

            if (!currentUser) {
                return;
            }


            /*
               Prevent multiple clicks
               while refreshing.
            */

            if (
                refreshOrdersBtn.disabled
            ) {
                return;
            }


            refreshOrdersBtn.disabled =
                true;


            refreshOrdersBtn.textContent =
                "↻ Refreshing...";


            try {

                /*
                   TRUE is important.

                   It tells loadOrders() to:

                   1. Remember open order boxes.
                   2. Reload the orders.
                   3. Re-open the same boxes.
                */

                await loadOrders(
                    currentUser,
                    true
                );

            } catch (error) {

                console.error(
                    "Refresh error:",
                    error
                );

            } finally {

                refreshOrdersBtn.disabled =
                    false;


                refreshOrdersBtn.textContent =
                    "↻ Refresh Orders";
            }
        }
    );
}
