import {
    auth,
    db
} from "./firebase.js";

import {
    collection,
    getDocs,
    doc,
    setDoc,
    getDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    initQrPayment,
    prepareQrPayment,
    restoreQrPayment,
    stopQrPayment,
    clearQrPaymentStorage
} from "./payment-qr.js";

import {
    initFastCoinPayment,
    loadFastCoinBalance,
    setFastCoinAmount,
    resetFastCoinPayment
} from "./payment-fastcoin.js";


/* =========================================================
   STORAGE / CONFIG
========================================================= */

const CART_STORAGE_KEY =
    "gamevault_cart";

const CHECKOUT_STORAGE_KEY =
    "gamevault_checkout";

const DELIVERY_STORAGE_KEY =
    "gamevault_delivery";

const PAYMENT_SESSION_KEY =
    "gamevault_payment_session";

const PAYMENT_SESSION_MAX_AGE =
    10 * 60 * 1000;

const GAMEVAULT_UPI_ID =
    "fullmast592@okhdfcbank";


/* =========================================================
   DOM
========================================================= */

const paymentLoading =
    document.getElementById(
        "paymentLoading"
    );

const paymentSection =
    document.getElementById(
        "paymentSection"
    );

const paymentSuccess =
    document.getElementById(
        "paymentSuccess"
    );

const paymentRedirecting =
    document.getElementById(
        "paymentRedirecting"
    );

const paymentError =
    document.getElementById(
        "paymentError"
    );

const paymentErrorMessage =
    document.getElementById(
        "paymentErrorMessage"
    );

const paymentOrderId =
    document.getElementById(
        "paymentOrderId"
    );

const paymentItemCount =
    document.getElementById(
        "paymentItemCount"
    );

const paymentTotal =
    document.getElementById(
        "paymentTotal"
    );

const successOrderId =
    document.getElementById(
        "successOrderId"
    );

const successOrderTotal =
    document.getElementById(
        "successOrderTotal"
    );

const viewOrderBtn =
    document.getElementById(
        "viewOrderBtn"
    );

const paymentErrorBackBtn =
    document.getElementById(
        "paymentErrorBackBtn"
    );

const upiId =
    document.getElementById(
        "upiId"
    );

const fastCoinTotal =
    document.getElementById(
        "fastCoinTotal"
    );

const summaryMrp =
    document.getElementById(
        "summaryMrp"
    );

const summaryTotal =
    document.getElementById(
        "summaryTotal"
    );

const paymentMethodButtons =
    document.querySelectorAll(
        ".payment-method"
    );

const paymentMethodPanels =
    document.querySelectorAll(
        ".method-panel"
    );


/* =========================================================
   STATE
========================================================= */

let currentUser =
    null;

let currentOrderId =
    null;

let currentOrder =
    null;

let unsubscribeOrder =
    null;

let paymentFinished =
    false;

let paymentInitialized =
    false;

let selectedPaymentMethod =
    "upi";

let paymentTimeoutRedirect =
    null;


/* =========================================================
   PAYMENT SESSION GUARD
========================================================= */

/*
 * Delivery page creates this session only after
 * successful delivery form submission.
 *
 * This protects the navigation flow:
 *
 * delivery.html
 *      ↓
 * payment session
 *      ↓
 * payment.html
 *
 * IMPORTANT:
 * This is NOT secure payment authorization.
 * Real payment/order authorization must still happen
 * on the server / Firebase security rules.
 */

function getPaymentSession() {

    try {

        const stored =
            sessionStorage.getItem(
                PAYMENT_SESSION_KEY
            );

        if (!stored) {
            return null;
        }

        const session =
            JSON.parse(stored);

        if (
            !session ||
            typeof session !== "object"
        ) {
            return null;
        }

        const createdAt =
            Number(
                session.createdAt
            );

        if (
            !Number.isFinite(
                createdAt
            )
        ) {
            return null;
        }

        const age =
            Date.now() -
            createdAt;

        if (
            age < 0 ||
            age > PAYMENT_SESSION_MAX_AGE
        ) {

            sessionStorage.removeItem(
                PAYMENT_SESSION_KEY
            );

            return null;
        }

        if (
            session.source !==
            "delivery"
        ) {
            return null;
        }

        return session;

    } catch (error) {

        console.error(
            "Payment session error:",
            error
        );

        return null;
    }
}


function requirePaymentSession() {

    const session =
        getPaymentSession();

    if (session) {
        return true;
    }

    console.warn(
        "Payment page opened without a valid delivery session."
    );

    showPaymentError(
        "Please complete the delivery information before continuing to payment."
    );

    setTimeout(
        () => {

            window.location.href =
                "cart.html";

        },
        1200
    );

    return false;
}


function clearPaymentSession() {

    sessionStorage.removeItem(
        PAYMENT_SESSION_KEY
    );

}


/* =========================================================
   HELPERS
========================================================= */

function formatPrice(value) {

    const number =
        Number(value);

    if (
        !Number.isFinite(
            number
        )
    ) {

        return "₹0";
    }

    return `₹${number.toLocaleString(
        "en-IN"
    )}`;
}


/* =========================================================
   CART
========================================================= */

function getCart() {

    try {

        const stored =
            localStorage.getItem(
                CART_STORAGE_KEY
            );

        if (!stored) {
            return [];
        }

        const parsed =
            JSON.parse(
                stored
            );

        return Array.isArray(
            parsed
        )
            ? parsed
            : [];

    } catch (error) {

        console.error(
            "Cart loading error:",
            error
        );

        return [];
    }
}


function clearCart() {

    localStorage.removeItem(
        CART_STORAGE_KEY
    );
}


function getCartTotal(cart) {

    if (
        !Array.isArray(
            cart
        )
    ) {

        return 0;
    }

    return cart.reduce(
        (
            total,
            item
        ) => {

            const price =
                getEffectiveItemPrice(
                    item
                );

            const quantity =
                Math.max(
                    1,
                    Number(
                        item.quantity
                    ) || 1
                );

            return (
                total +
                price *
                quantity
            );

        },
        0
    );
}


function getCartItemCount(cart) {

    if (
        !Array.isArray(
            cart
        )
    ) {

        return 0;
    }

    return cart.reduce(
        (
            count,
            item
        ) => {

            return (
                count +
                Math.max(
                    1,
                    Number(
                        item.quantity
                    ) || 1
                )
            );

        },
        0
    );
}


function getEffectiveItemPrice(item) {

    const basePrice =
        Number(
            item?.price ?? 0
        );

    const dealPrice =
        Number(
            item?.dealPrice ?? 0
        );

    if (
        Number.isFinite(
            dealPrice
        ) &&
        dealPrice > 0
    ) {

        return dealPrice;
    }

    return Number.isFinite(
        basePrice
    )
        ? basePrice
        : 0;
}


/* =========================================================
   DELIVERY
========================================================= */

function getDeliveryData() {

    try {

        const stored =
            sessionStorage.getItem(
                DELIVERY_STORAGE_KEY
            );

        if (!stored) {
            return {};
        }

        const parsed =
            JSON.parse(
                stored
            );

        return (
            parsed &&
            typeof parsed === "object"
        )
            ? parsed
            : {};

    } catch (error) {

        console.error(
            "Delivery data error:",
            error
        );

        return {};
    }
}


function clearCheckoutSession() {

    sessionStorage.removeItem(
        CHECKOUT_STORAGE_KEY
    );

    sessionStorage.removeItem(
        DELIVERY_STORAGE_KEY
    );

    if (
        currentOrderId
    ) {

        clearQrPaymentStorage(
            currentOrderId
        );
    }
}


/* =========================================================
   ORDER ID
========================================================= */

function generateOrderId() {

    const timestamp =
        Date.now()
            .toString(36)
            .toUpperCase();

    const random =
        Math.random()
            .toString(36)
            .slice(
                2,
                8
            )
            .toUpperCase();

    return (
        `PJ-${timestamp}-${random}`
    );
}


/* =========================================================
   UI
========================================================= */

function showOnly(element) {

    const sections = [

        paymentLoading,
        paymentSection,
        paymentSuccess,
        paymentRedirecting,
        paymentError

    ];

    sections.forEach(
        section => {

            if (section) {

                section.classList.add(
                    "hidden"
                );
            }

        }
    );

    if (element) {

        element.classList.remove(
            "hidden"
        );
    }
}


function showPaymentError(message) {

    if (
        paymentErrorMessage
    ) {

        paymentErrorMessage.textContent =
            message ||
            "Something went wrong while preparing your payment.";
    }

    showOnly(
        paymentError
    );
}


/* =========================================================
   REFRESH PRODUCTS
========================================================= */

async function refreshCartProducts(cart) {

    if (
        !Array.isArray(
            cart
        ) ||
        cart.length === 0
    ) {

        return [];
    }

    const snapshot =
        await getDocs(
            collection(
                db,
                "products"
            )
        );

    const products =
        new Map();

    snapshot.forEach(
        item => {

            products.set(
                item.id,
                {
                    id:
                        item.id,

                    ...item.data()
                }
            );

        }
    );

    const refreshed = [];

    for (
        const item of cart
    ) {

        const productId =
            item.productId ||
            item.id;

        if (!productId) {
            continue;
        }

        const product =
            products.get(
                productId
            );

        if (!product) {

            throw new Error(
                `The product "${item.name || productId}" is no longer available.`
            );
        }

        const stock =
            Number(
                product.stock
            );

        const quantity =
            Math.max(
                1,
                Number(
                    item.quantity
                ) || 1
            );

        if (
            Number.isFinite(
                stock
            ) &&
            stock <= 0
        ) {

            throw new Error(
                `${product.name || item.name || "A product"} is out of stock.`
            );
        }

        if (
            Number.isFinite(
                stock
            ) &&
            quantity > stock
        ) {

            throw new Error(
                `Only ${stock} unit(s) of ${product.name || item.name || "this product"} are available.`
            );
        }

        const price =
            Number(
                product.price ??
                item.price ??
                0
            );

        const dealPrice =
            Number(
                product.dealPrice ??
                item.dealPrice ??
                0
            );

        refreshed.push({

            ...item,

            productId,

            id:
                productId,

            name:
                product.name ??
                item.name ??
                "Product",

            price:
                Number.isFinite(
                    price
                )
                    ? price
                    : 0,

            dealPrice:
                Number.isFinite(
                    dealPrice
                )
                    ? dealPrice
                    : 0,

            quantity

        });
    }

    return refreshed;
}


/* =========================================================
   CREATE ORDER
========================================================= */

async function createOrder(user) {

    const cart =
        getCart();

    if (
        cart.length === 0
    ) {

        throw new Error(
            "Your cart is empty."
        );
    }

    const items =
        await refreshCartProducts(
            cart
        );

    if (
        items.length === 0
    ) {

        throw new Error(
            "No valid products were found in your cart."
        );
    }

    const deliveryInfo =
        getDeliveryData();

    const subtotal =
        getCartTotal(
            items
        );

    if (
        !Number.isFinite(
            subtotal
        ) ||
        subtotal <= 0
    ) {

        throw new Error(
            "Unable to calculate the order total."
        );
    }

    const orderId =
        generateOrderId();

    const order = {

        orderId,

        userId:
            user.uid,

        userEmail:
            user.email ||
            "",

        customerName:
            user.displayName ||
            deliveryInfo.fullName ||
            deliveryInfo.name ||
            "",

        items,

        itemCount:
            getCartItemCount(
                items
            ),

        subtotal,

        total:
            subtotal,

        currency:
            "INR",

        paymentMethod:
            "upi",

        deliveryInfo,

        paymentStatus:
            "pending",

        paymentVerified:
            false,

        orderStatus:
            "pending",

        stockHeld:
            false,

        stockReleased:
            false,

        stockReleaseReason:
            "",

        adminMessage:
            "",

        createdAt:
            new Date(),

        updatedAt:
            new Date()

    };

    await setDoc(

        doc(
            db,
            "orders",
            orderId
        ),

        order
    );

    return order;
}


/* =========================================================
   SUMMARY
========================================================= */

function updateOrderSummary(order) {

    if (!order) {
        return;
    }

    const total =
        Number(
            order.total
        ) || 0;

    if (
        paymentOrderId
    ) {

        paymentOrderId.textContent =
            order.orderId ||
            currentOrderId ||
            "—";
    }

    if (
        paymentItemCount
    ) {

        paymentItemCount.textContent =
            String(
                order.itemCount ||
                0
            );
    }

    if (
        paymentTotal
    ) {

        paymentTotal.textContent =
            formatPrice(
                total
            );
    }

    if (
        upiId
    ) {

        upiId.textContent =
            GAMEVAULT_UPI_ID;
    }

    if (
        fastCoinTotal
    ) {

        fastCoinTotal.textContent =
            formatPrice(
                total
            );
    }

    if (
        summaryTotal
    ) {

        summaryTotal.textContent =
            formatPrice(
                total
            );
    }

    if (
        summaryMrp
    ) {

        summaryMrp.textContent =
            formatPrice(
                getCartTotal(
                    getCart()
                )
            );
    }

    setFastCoinAmount(
        total
    );
}


/* =========================================================
   PAYMENT STATUS
========================================================= */

function isPaymentVerified(data) {

    const paymentStatus =
        String(
            data?.paymentStatus ||
            ""
        )
            .trim()
            .toLowerCase();

    return (

        data?.paymentVerified === true ||

        [
            "paid",
            "verified",
            "success",
            "successful",
            "complete",
            "completed"
        ].includes(
            paymentStatus
        )

    );
}


function isPaymentFailed(data) {

    return [

        "failed",
        "cancelled",
        "canceled"

    ].includes(
        String(
            data?.paymentStatus ||
            ""
        )
            .trim()
            .toLowerCase()
    );
}


/* =========================================================
   PAYMENT SUCCESS
========================================================= */

function handlePaymentVerified(order) {

    if (
        paymentFinished
    ) {

        return;
    }

    paymentFinished =
        true;

    if (
        paymentTimeoutRedirect
    ) {

        clearTimeout(
            paymentTimeoutRedirect
        );

        paymentTimeoutRedirect =
            null;
    }

    stopAllPaymentModules();

    clearCart();

    clearCheckoutSession();

    clearPaymentSession();

    if (
        successOrderId
    ) {

        successOrderId.textContent =
            order.orderId ||
            currentOrderId ||
            "—";
    }

    if (
        successOrderTotal
    ) {

        successOrderTotal.textContent =
            formatPrice(
                order.total
            );
    }

    showOnly(
        paymentSuccess
    );

    setTimeout(
        () => {

            window.location.href =
                currentOrderId
                    ? `orders.html?order=${encodeURIComponent(
                        currentOrderId
                    )}`
                    : "orders.html";

        },
        2200
    );
}


/* =========================================================
   PAYMENT FAILED
========================================================= */

function handlePaymentFailed(order) {

    if (
        paymentFinished
    ) {

        return;
    }

    paymentFinished =
        true;

    if (
        paymentTimeoutRedirect
    ) {

        clearTimeout(
            paymentTimeoutRedirect
        );

        paymentTimeoutRedirect =
            null;
    }

    stopAllPaymentModules();

    showPaymentError(

        order.adminMessage ||

        "Payment was not successful. Please contact support."

    );
}


/* =========================================================
   FAST COIN PAYMENT SUCCESS
========================================================= */

window.addEventListener(
    "fastcoin-payment-success",
    event => {

        if (
            paymentFinished ||
            !currentOrderId ||
            !currentOrder
        ) {

            return;
        }

        const result =
            event?.detail ||
            {};

        if (
            result.orderId &&
            result.orderId !== currentOrderId
        ) {

            return;
        }

        currentOrder = {

            ...currentOrder,

            paymentMethod:
                "fastcoin",

            paymentStatus:
                "paid",

            paymentVerified:
                true,

            orderStatus:
                "processing",

            fastCoinAmount:
                Number(
                    result.coinsUsed
                ) || 0,

            fastCoinConversionRate:
                Number(
                    result.coinsPerRupee
                ) || 0

        };

        handlePaymentVerified(
            currentOrder
        );

    }
);


/* =========================================================
   FIRESTORE ORDER LISTENER
========================================================= */

function listenToOrder(orderId) {

    if (
        unsubscribeOrder
    ) {

        unsubscribeOrder();

        unsubscribeOrder =
            null;
    }

    if (!orderId) {
        return;
    }

    unsubscribeOrder =
        onSnapshot(

            doc(
                db,
                "orders",
                orderId
            ),

            snapshot => {

                if (
                    paymentFinished
                ) {

                    return;
                }

                if (
                    !snapshot.exists()
                ) {

                    showPaymentError(
                        "Your order could not be found."
                    );

                    return;
                }

                const data =
                    snapshot.data();

                if (
                    currentUser &&
                    data.userId &&
                    data.userId !==
                    currentUser.uid
                ) {

                    showPaymentError(
                        "You do not have access to this order."
                    );

                    return;
                }

                currentOrder = {

                    orderId,

                    ...data

                };

                updateOrderSummary(
                    currentOrder
                );

                if (
                    isPaymentVerified(
                        data
                    )
                ) {

                    handlePaymentVerified(
                        currentOrder
                    );

                    return;
                }

                if (
                    isPaymentFailed(
                        data
                    )
                ) {

                    handlePaymentFailed(
                        currentOrder
                    );
                }

            },

            error => {

                console.error(
                    "Order listener error:",
                    error
                );

                if (
                    !paymentFinished
                ) {

                    showPaymentError(
                        "Unable to check payment status. Please try again."
                    );
                }

            }

        );
}


/* =========================================================
   PAYMENT METHOD SWITCHING
========================================================= */

function setPaymentMethod(method) {

    /*
     * Card payment has been disabled.
     *
     * Only UPI and FastCoin are allowed.
     */

    const allowedMethods = [

        "upi",
        "fastcoin"

    ];

    if (
        !allowedMethods.includes(
            method
        )
    ) {

        return;
    }

    selectedPaymentMethod =
        method;

    paymentMethodButtons.forEach(
        button => {

            const active =
                button.dataset.method ===
                method;

            button.classList.toggle(
                "active",
                active
            );

            button.setAttribute(
                "aria-selected",
                String(
                    active
                )
            );

        }
    );

    paymentMethodPanels.forEach(
        panel => {

            const panelMethod =
                panel.dataset.method ??
                panel.dataset.panel;

            const active =
                panelMethod ===
                method;

            panel.classList.toggle(
                "active",
                active
            );

            panel.classList.toggle(
                "hidden",
                !active
            );

        }
    );


    /* -----------------------------------------
       UPI
    ----------------------------------------- */

    if (
        method === "upi"
    ) {

        prepareQrPayment({

            order:
                currentOrder,

            orderId:
                currentOrderId

        });
    }


    /* -----------------------------------------
       FAST COIN
    ----------------------------------------- */

    if (
        method === "fastcoin"
    ) {

        resetFastCoinPayment();

        if (
            currentUser
        ) {

            loadFastCoinBalance(
                currentUser
            );
        }
    }

}


/* =========================================================
   STOP PAYMENT MODULES
========================================================= */

function stopAllPaymentModules() {

    stopQrPayment();

}


/* =========================================================
   METHOD BUTTONS
========================================================= */

paymentMethodButtons.forEach(
    button => {

        /*
         * Extra protection:
         * Card buttons are disabled even if
         * accidentally left in the HTML.
         */

        if (
            button.dataset.method ===
            "card"
        ) {

            button.classList.add(
                "hidden"
            );

            button.setAttribute(
                "aria-hidden",
                "true"
            );

            button.disabled =
                true;

            return;
        }

        button.addEventListener(
            "click",
            event => {

                event.preventDefault();

                setPaymentMethod(
                    button.dataset.method
                );

            }
        );

    }
);


/* =========================================================
   HIDE CARD PANEL
========================================================= */

paymentMethodPanels.forEach(
    panel => {

        const panelMethod =
            panel.dataset.method ??
            panel.dataset.panel;

        if (
            panelMethod ===
            "card"
        ) {

            panel.classList.add(
                "hidden"
            );

            panel.setAttribute(
                "aria-hidden",
                "true"
            );
        }

    }
);


/* =========================================================
   VIEW ORDER
========================================================= */

viewOrderBtn?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        window.location.href =
            currentOrderId
                ? `orders.html?order=${encodeURIComponent(
                    currentOrderId
                )}`
                : "orders.html";

    }
);


/* =========================================================
   BACK BUTTON
========================================================= */

paymentErrorBackBtn?.addEventListener(
    "click",
    event => {

        event.preventDefault();

        window.location.href =
            "cart.html";

    }
);


/* =========================================================
   QR MODULE
========================================================= */

initQrPayment({

    getOrder:
        () =>
            currentOrder,

    getOrderId:
        () =>
            currentOrderId,

    onTimeout:
        () => {

            if (
                paymentFinished
            ) {

                return;
            }

            stopAllPaymentModules();

            showOnly(
                paymentRedirecting
            );

            paymentTimeoutRedirect =
                setTimeout(
                    () => {

                        window.location.href =
                            currentOrderId
                                ? `orders.html?order=${encodeURIComponent(
                                    currentOrderId
                                )}`
                                : "orders.html";

                    },
                    5000
                );

        }

});


/* =========================================================
   FAST COIN MODULE
========================================================= */

initFastCoinPayment();


/* =========================================================
   INITIALIZE PAYMENT
========================================================= */

async function initializePayment(user) {

    if (
        paymentInitialized
    ) {

        return;
    }

    paymentInitialized =
        true;

    currentUser =
        user;

    paymentFinished =
        false;

    showOnly(
        paymentLoading
    );

    try {

        const cart =
            getCart();

        if (
            cart.length === 0
        ) {

            showPaymentError(
                "Your cart is empty."
            );

            return;
        }

        const params =
            new URLSearchParams(
                window.location.search
            );

        const orderFromUrl =
            params.get(
                "order"
            );


        /* =============================================
           EXISTING ORDER
        ============================================= */

        if (
            orderFromUrl
        ) {

            currentOrderId =
                orderFromUrl;

            const orderSnapshot =
                await getDoc(

                    doc(
                        db,
                        "orders",
                        currentOrderId
                    )

                );

            if (
                !orderSnapshot.exists()
            ) {

                showPaymentError(
                    "Your order could not be found."
                );

                return;
            }

            const orderData =
                orderSnapshot.data();

            if (
                orderData.userId !==
                user.uid
            ) {

                showPaymentError(
                    "You do not have access to this order."
                );

                return;
            }

            currentOrder = {

                orderId:
                    currentOrderId,

                ...orderData

            };

            if (
                isPaymentVerified(
                    orderData
                )
            ) {

                handlePaymentVerified(
                    currentOrder
                );

                return;
            }

            if (
                isPaymentFailed(
                    orderData
                )
            ) {

                handlePaymentFailed(
                    currentOrder
                );

                return;
            }

            updateOrderSummary(
                currentOrder
            );

            showOnly(
                paymentSection
            );

            listenToOrder(
                currentOrderId
            );

            const qrPaymentExpired =
                restoreQrPayment({

                    order:
                        currentOrder,

                    orderId:
                        currentOrderId

                });

            await loadFastCoinBalance(
                user
            );

            if (
                qrPaymentExpired
            ) {

                return;
            }

            setPaymentMethod(
                selectedPaymentMethod
            );

            return;
        }


        /* =============================================
           NEW ORDER
        ============================================= */

        currentOrder =
            await createOrder(
                user
            );

        currentOrderId =
            currentOrder.orderId;


        const newUrl =
            new URL(
                window.location.href
            );

        newUrl.searchParams.set(
            "order",
            currentOrderId
        );

        window.history.replaceState(
            {},
            "",
            newUrl
        );


        updateOrderSummary(
            currentOrder
        );

        showOnly(
            paymentSection
        );

        listenToOrder(
            currentOrderId
        );

        await loadFastCoinBalance(
            user
        );

        setPaymentMethod(
            "upi"
        );


    } catch (error) {

        console.error(
            "Payment initialization error:",
            error
        );

        showPaymentError(

            error?.message ||

            "Unable to prepare your payment. Please try again."

        );
    }

}


/* =========================================================
   AUTH
========================================================= */

onAuthStateChanged(

    auth,

    async user => {

        if (!user) {

            showPaymentError(
                "Please login before making a payment."
            );

            setTimeout(
                () => {

                    window.location.href =
                        "login.html?redirect=payment.html";

                },
                1500
            );

            return;
        }


        /*
         * If this is an existing order URL,
         * allow the existing-order flow to continue.
         *
         * Otherwise require the delivery-created
         * payment session before creating a new order.
         */

        const params =
            new URLSearchParams(
                window.location.search
            );

        const orderFromUrl =
            params.get(
                "order"
            );

        if (!orderFromUrl) {

            if (
                !requirePaymentSession()
            ) {

                return;
            }
        }

        await initializePayment(
            user
        );

    }

);


/* =========================================================
   CLEANUP
========================================================= */

window.addEventListener(
    "beforeunload",
    () => {

        if (
            unsubscribeOrder
        ) {

            unsubscribeOrder();

            unsubscribeOrder =
                null;
        }

        stopAllPaymentModules();

    }
);


/* =========================================================
   INITIAL UI
========================================================= */

showOnly(
    paymentLoading
);

if (
    upiId
) {

    upiId.textContent =
        GAMEVAULT_UPI_ID;

}
