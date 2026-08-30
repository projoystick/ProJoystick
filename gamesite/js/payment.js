/* ==========================================
   PROJOYSTICK — PAYMENT PAGE

   Firebase Auth + Firestore only
   NO Firebase Cloud Functions

   IMPORTANT:
   Stock is NOT deducted by the customer.

   Customer:
   - Creates pending order
   - Pays using QR
   - Waits for admin verification

   Admin:
   - Manually verifies payment
   - Checks stock
   - Deducts stock
   - Marks order as paid
========================================== */

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


/* ==========================================
   CONSTANTS
========================================== */

const CART_STORAGE_KEY =
    "gamevault_cart";

const CHECKOUT_STORAGE_KEY =
    "gamevault_checkout";

const DELIVERY_STORAGE_KEY =
    "gamevault_delivery";

const PAYMENT_TIMEOUT =
    2 * 60 * 1000;

const GAMEVAULT_UPI_ID =
    "fullmast592@okhdfcbank";


/* ==========================================
   ELEMENTS
========================================== */

const paymentLoading =
    document.getElementById("paymentLoading");

const paymentSection =
    document.getElementById("paymentSection");

const paymentSuccess =
    document.getElementById("paymentSuccess");

const paymentRedirecting =
    document.getElementById("paymentRedirecting");

const paymentError =
    document.getElementById("paymentError");

const paymentErrorMessage =
    document.getElementById("paymentErrorMessage");

const paymentOrderId =
    document.getElementById("paymentOrderId");

const paymentItemCount =
    document.getElementById("paymentItemCount");

const paymentTotal =
    document.getElementById("paymentTotal");

const upiId =
    document.getElementById("upiId");

const copyUpiBtn =
    document.getElementById("copyUpiBtn");

const paymentTimer =
    document.getElementById("paymentTimer");

const successOrderId =
    document.getElementById("successOrderId");

const successOrderTotal =
    document.getElementById("successOrderTotal");

const viewOrderBtn =
    document.getElementById("viewOrderBtn");

const paymentErrorBackBtn =
    document.getElementById(
        "paymentErrorBackBtn"
    );


/* ==========================================
   STATE
========================================== */

let currentOrderId = null;

let currentOrder = null;

let unsubscribeOrder = null;

let timerInterval = null;

let paymentTimeout = null;

let paymentFinished = false;


/*
 * Prevent initializePayment from creating
 * multiple orders if Firebase auth state
 * fires more than once.
 */
let paymentInitialized = false;


/* ==========================================
   HELPERS
========================================== */

function formatPrice(value) {

    const price =
        Number(value);

    if (!Number.isFinite(price)) {
        return "₹0";
    }

    return `₹${price.toLocaleString(
        "en-IN"
    )}`;
}


/* ==========================================
   CART
========================================== */

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
            JSON.parse(stored);

        return Array.isArray(parsed)
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


/* ==========================================
   CHECKOUT DATA
========================================== */

function getCheckoutData() {

    try {

        const stored =
            sessionStorage.getItem(
                CHECKOUT_STORAGE_KEY
            );

        if (!stored) {
            return null;
        }

        return JSON.parse(stored);

    } catch (error) {

        console.error(
            "Checkout data error:",
            error
        );

        return null;
    }
}


/* ==========================================
   DELIVERY DATA
========================================== */

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
            JSON.parse(stored);

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


/* ==========================================
   CLEAR CHECKOUT SESSION
========================================== */

function clearCheckoutSession() {

    sessionStorage.removeItem(
        CHECKOUT_STORAGE_KEY
    );

    sessionStorage.removeItem(
        DELIVERY_STORAGE_KEY
    );
}


/* ==========================================
   CART TOTAL
========================================== */

function getCartTotal(cart) {

    return cart.reduce(
        (total, item) => {

            const price =
                Number(item.price) || 0;

            const quantity =
                Math.max(
                    1,
                    Number(item.quantity) || 1
                );

            return total +
                price * quantity;

        },
        0
    );
}


/* ==========================================
   ITEM COUNT
========================================== */

function getCartItemCount(cart) {

    return cart.reduce(
        (total, item) => {

            return total +
                Math.max(
                    1,
                    Number(item.quantity) || 1
                );

        },
        0
    );
}


/* ==========================================
   ORDER ID
========================================== */

function generateOrderId() {

    const random =
        Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase();

    const timestamp =
        Date.now()
            .toString(36)
            .slice(-5)
            .toUpperCase();

    return `GV-${timestamp}${random}`;
}


/* ==========================================
   PAGE STATE
========================================== */

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


/* ==========================================
   ERROR
========================================== */

function showPaymentError(message) {

    if (paymentErrorMessage) {

        paymentErrorMessage.textContent =
            message;
    }

    showOnly(
        paymentError
    );
}


/* ==========================================
   VERIFY PRODUCTS
==========================================

   IMPORTANT:

   This checks current product information
   before creating the order.

   It does NOT modify stock.

   The admin performs the final stock
   deduction when approving the order.
========================================== */

async function refreshCartProducts(cart) {

    if (cart.length === 0) {

        throw new Error(
            "Your cart is empty."
        );
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
        productDoc => {

            products.set(
                productDoc.id,
                {
                    id:
                        productDoc.id,

                    ...productDoc.data()
                }
            );
        }
    );


    const updatedCart = [];


    for (
        const cartItem
        of cart
    ) {

        const product =
            products.get(
                cartItem.id
            );


        if (!product) {

            throw new Error(
                `${cartItem.name || "A product"} is no longer available.`
            );
        }


        const stockNumber =
            Number(product.stock);


        const stock =
            Number.isFinite(
                stockNumber
            )
                ? Math.max(
                    0,
                    Math.floor(
                        stockNumber
                    )
                )
                : 0;


        if (stock <= 0) {

            throw new Error(
                `${product.name || "A product"} is currently out of stock.`
            );
        }


        const quantity =
            Math.max(
                1,
                Number(
                    cartItem.quantity
                ) || 1
            );


        if (quantity > stock) {

            throw new Error(
                `Only ${stock} ${product.name || "item"} available.`
            );
        }


        /*
         * Use the CURRENT database price.
         */
        let price =
            Number(product.price) || 0;


        const dealPrice =
            Number(
                product.dealPrice
            );


        if (
            product.deal === true &&
            Number.isFinite(
                dealPrice
            ) &&
            dealPrice >= 0 &&
            dealPrice < price
        ) {

            price =
                dealPrice;
        }


        updatedCart.push({

            id:
                product.id,

            name:
                product.name ||
                "Unnamed Product",

            game:
                product.gameName ||
                cartItem.game ||
                "GAME",

            gameId:
                product.gameId ||
                "",

            amount:
                product.amount ||
                "",

            type:
                product.type ||
                "currency",

            image:
                product.image ||
                "",

            price:
                price,

            quantity:
                quantity,

            /*
             * This is informational only.
             *
             * It is NOT considered a stock
             * reservation.
             */
            stock:
                stock
        });
    }


    return updatedCart;
}


/* ==========================================
   CREATE ORDER
==========================================

   NO STOCK MODIFICATION HERE.

   This is intentional.

   Firestore rules prevent the customer
   from modifying products.

========================================== */

async function createOrder(user) {

    const cart =
        getCart();


    if (cart.length === 0) {

        throw new Error(
            "Your cart is empty."
        );
    }


    /*
     * Get the latest product information.
     */
    const verifiedCart =
        await refreshCartProducts(
            cart
        );


    const checkoutData =
        getCheckoutData();


    const deliveryInfo =
        getDeliveryData();


    const total =
        getCartTotal(
            verifiedCart
        );


    const itemCount =
        getCartItemCount(
            verifiedCart
        );


    const orderId =
        generateOrderId();


    /*
     * Store a snapshot of the products
     * and prices at checkout.
     */
    const orderItems =
        verifiedCart.map(
            item => ({

                productId:
                    item.id,

                name:
                    item.name,

                game:
                    item.game,

                gameId:
                    item.gameId,

                amount:
                    item.amount,

                type:
                    item.type,

                image:
                    item.image,

                price:
                    item.price,

                quantity:
                    item.quantity
            })
        );


    const orderRef =
        doc(
            db,
            "orders",
            orderId
        );


    /*
     * IMPORTANT:
     *
     * setDoc is allowed by the new rules
     * only when:
     *
     * request.auth.uid == order.userId
     * paymentStatus == pending
     * paymentVerified == false
     * orderStatus == pending
     */
    const order = {

        orderId:
            orderId,

        userId:
            user.uid,

        userEmail:
            user.email || "",

        customerName:
            checkoutData?.name ||
            user.displayName ||
            "",

        items:
            orderItems,

        itemCount:
            itemCount,

        subtotal:
            total,

        total:
            total,

        currency:
            "INR",

        paymentMethod:
            checkoutData?.paymentMethod ||
            "upi",

        deliveryInfo:
            deliveryInfo,

        /*
         * PAYMENT
         */
        paymentStatus:
            "pending",

        paymentVerified:
            false,

        /*
         * ORDER
         */
        orderStatus:
            "pending",

        /*
         * STOCK
         *
         * No stock has been deducted.
         */
        stockHeld:
            false,

        stockReleased:
            false,

        stockReleaseReason:
            "",

        /*
         * Admin message
         */
        adminMessage:
            "",

        /*
         * Created client-side.
         */
        createdAt:
            new Date(),

        updatedAt:
            new Date()
    };


    await setDoc(
        orderRef,
        order
    );


    return {

        orderId:
            orderId,

        orderItems:
            orderItems,

        itemCount:
            itemCount,

        total:
            total,

        cart:
            verifiedCart,

        deliveryInfo:
            deliveryInfo
    };
}


/* ==========================================
   PAYMENT DETAILS
========================================== */

function updatePaymentDetails(order) {

    if (paymentOrderId) {

        paymentOrderId.textContent =
            order.orderId ||
            currentOrderId ||
            "—";
    }


    if (paymentItemCount) {

        paymentItemCount.textContent =
            order.itemCount || 0;
    }


    if (paymentTotal) {

        paymentTotal.textContent =
            formatPrice(
                order.total
            );
    }


    if (upiId) {

        upiId.textContent =
            GAMEVAULT_UPI_ID;
    }
}


/* ==========================================
   COPY UPI
========================================== */

copyUpiBtn?.addEventListener(
    "click",
    async () => {

        try {

            await navigator.clipboard.writeText(
                GAMEVAULT_UPI_ID
            );


            copyUpiBtn.textContent =
                "COPIED";


            setTimeout(
                () => {

                    copyUpiBtn.textContent =
                        "COPY";

                },
                1500
            );


        } catch (error) {

            console.error(
                "Unable to copy UPI ID:",
                error
            );

        }
    }
);


/* ==========================================
   PAYMENT STATUS
========================================== */

function isPaymentVerified(data) {

    return (
        data?.paymentVerified === true ||
        data?.paymentStatus === "paid" ||
        data?.paymentStatus === "verified"
    );
}


function isPaymentFailed(data) {

    return (
        data?.paymentStatus === "failed" ||
        data?.paymentStatus === "cancelled" ||
        data?.paymentStatus === "canceled"
    );
}


/* ==========================================
   ORDER UPDATE
========================================== */

function handleOrderUpdate(snapshot) {

    if (!snapshot.exists()) {

        showPaymentError(
            "Your order could not be found."
        );

        return;
    }


    const data =
        snapshot.data();


    currentOrder = {

        orderId:
            currentOrderId,

        ...data
    };


    updatePaymentDetails(
        currentOrder
    );


    /*
     * PAYMENT SUCCESS
     */

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


    /*
     * PAYMENT FAILED
     */

    if (
        isPaymentFailed(
            data
        )
    ) {

        handlePaymentFailed(
            currentOrder
        );

        return;
    }
}


/* ==========================================
   PAYMENT SUCCESS
========================================== */

function handlePaymentVerified(order) {

    if (paymentFinished) {
        return;
    }


    paymentFinished =
        true;


    stopPaymentTimers();


    /*
     * Payment succeeded.
     *
     * The admin has already verified
     * and handled stock.
     */

    clearCart();

    clearCheckoutSession();


    if (successOrderId) {

        successOrderId.textContent =
            order.orderId ||
            currentOrderId;
    }


    if (successOrderTotal) {

        successOrderTotal.textContent =
            formatPrice(
                order.total
            );
    }


    showOnly(
        paymentSuccess
    );
}


/* ==========================================
   PAYMENT FAILED
========================================== */

function handlePaymentFailed(order) {

    if (paymentFinished) {
        return;
    }


    paymentFinished =
        true;


    stopPaymentTimers();


    showPaymentError(
        order.adminMessage ||
        "Payment was not successful. Please contact support if you believe this is incorrect."
    );
}


/* ==========================================
   PAYMENT TIMEOUT
==========================================

   IMPORTANT:

   We cannot cancel the order here because
   the customer is not allowed to modify
   orders after creation.

   The admin can later cancel unpaid orders.

========================================== */

function handlePaymentTimeout() {

    if (paymentFinished) {
        return;
    }


    paymentFinished =
        true;


    stopPaymentTimers();


    showOnly(
        paymentRedirecting
    );


    setTimeout(
        () => {

            if (!currentOrderId) {

                window.location.href =
                    "orders.html";

                return;
            }


            window.location.href =
                `orders.html?order=${encodeURIComponent(
                    currentOrderId
                )}`;

        },
        1800
    );
}


/* ==========================================
   TIMER
========================================== */

function startPaymentTimer() {

    stopPaymentTimers();


    const startTime =
        Date.now();


    function updateTimer() {

        const elapsed =
            Date.now() -
            startTime;


        const remaining =
            Math.max(
                0,
                PAYMENT_TIMEOUT -
                elapsed
            );


        const totalSeconds =
            Math.ceil(
                remaining / 1000
            );


        const minutes =
            Math.floor(
                totalSeconds / 60
            );


        const seconds =
            totalSeconds % 60;


        if (paymentTimer) {

            paymentTimer.textContent =
                `${String(minutes).padStart(
                    2,
                    "0"
                )}:${String(seconds).padStart(
                    2,
                    "0"
                )}`;
        }


        if (
            remaining <= 0
        ) {

            clearInterval(
                timerInterval
            );

            timerInterval =
                null;
        }
    }


    updateTimer();


    timerInterval =
        setInterval(
            updateTimer,
            1000
        );


    paymentTimeout =
        setTimeout(
            handlePaymentTimeout,
            PAYMENT_TIMEOUT
        );
}


/* ==========================================
   STOP TIMERS
========================================== */

function stopPaymentTimers() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;
    }


    if (paymentTimeout) {

        clearTimeout(
            paymentTimeout
        );

        paymentTimeout =
            null;
    }
}


/* ==========================================
   FIRESTORE LISTENER
========================================== */

function listenToOrder(orderId) {

    if (!orderId) {
        return;
    }


    if (unsubscribeOrder) {

        unsubscribeOrder();

        unsubscribeOrder =
            null;
    }


    const orderRef =
        doc(
            db,
            "orders",
            orderId
        );


    unsubscribeOrder =
        onSnapshot(

            orderRef,

            snapshot => {

                handleOrderUpdate(
                    snapshot
                );
            },

            error => {

                console.error(
                    "Order listener error:",
                    error
                );

                /*
                 * Do not automatically mark
                 * the payment failed just because
                 * the listener had a temporary
                 * connection problem.
                 */
            }
        );
}


/* ==========================================
   VIEW ORDER
========================================== */

viewOrderBtn?.addEventListener(
    "click",
    () => {

        if (!currentOrderId) {

            window.location.href =
                "orders.html";

            return;
        }


        window.location.href =
            `orders.html?order=${encodeURIComponent(
                currentOrderId
            )}`;
    }
);


/* ==========================================
   ERROR BACK
========================================== */

paymentErrorBackBtn?.addEventListener(
    "click",
    () => {

        window.location.href =
            "cart.html";
    }
);


/* ==========================================
   INITIALIZE PAYMENT
========================================== */

async function initializePayment(user) {

    if (paymentInitialized) {
        return;
    }


    paymentInitialized =
        true;


    showOnly(
        paymentLoading
    );


    try {

        const cart =
            getCart();


        if (cart.length === 0) {

            throw new Error(
                "Your cart is empty."
            );
        }


        const params =
            new URLSearchParams(
                window.location.search
            );


        const existingOrderId =
            params.get("order");


        /* ======================================
           EXISTING ORDER
        ====================================== */

        if (existingOrderId) {

            currentOrderId =
                existingOrderId;


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

                throw new Error(
                    "This order could not be found."
                );
            }


            const orderData =
                orderSnapshot.data();


            /*
             * SECURITY
             *
             * Firestore rules also enforce
             * this ownership check.
             */
            if (
                orderData.userId !==
                user.uid
            ) {

                throw new Error(
                    "You do not have access to this order."
                );
            }


            currentOrder = {

                orderId:
                    currentOrderId,

                ...orderData
            };


            /*
             * ALREADY PAID
             */

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


            /*
             * ALREADY FAILED
             */

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


            /*
             * Listen for admin verification.
             */

            listenToOrder(
                currentOrderId
            );


            showOnly(
                paymentSection
            );


            updatePaymentDetails(
                currentOrder
            );


            startPaymentTimer();

            return;
        }


        /* ======================================
           CREATE NEW ORDER
        ====================================== */

        const order =
            await createOrder(
                user
            );


        currentOrderId =
            order.orderId;


        currentOrder = {

            orderId:
                order.orderId,

            userId:
                user.uid,

            itemCount:
                order.itemCount,

            total:
                order.total,

            items:
                order.orderItems,

            deliveryInfo:
                order.deliveryInfo,

            paymentStatus:
                "pending",

            paymentVerified:
                false,

            orderStatus:
                "pending",

            stockHeld:
                false,

            stockReleased:
                false
        };


        /*
         * Put order ID in URL.
         */

        const newURL =
            `${window.location.pathname}?order=${encodeURIComponent(
                currentOrderId
            )}`;


        window.history.replaceState(
            {},
            "",
            newURL
        );


        updatePaymentDetails(
            currentOrder
        );


        listenToOrder(
            currentOrderId
        );


        showOnly(
            paymentSection
        );


        startPaymentTimer();


    } catch (error) {

        console.error(
            "Payment initialization error:",
            error
        );


        showPaymentError(
            error?.message ||
            "Unable to prepare your payment."
        );
    }
}


/* ==========================================
   AUTHENTICATION
========================================== */

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


        await initializePayment(
            user
        );
    }
);


/* ==========================================
   CLEANUP
========================================== */

window.addEventListener(
    "beforeunload",
    () => {

        stopPaymentTimers();


        if (unsubscribeOrder) {

            unsubscribeOrder();
        }
    }
);