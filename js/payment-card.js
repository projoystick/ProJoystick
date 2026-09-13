// ============================================================
// PROJOYSTICK - CREDIT / DEBIT CARD PAYMENT MODULE
// ============================================================

let cardPaymentAmount = 0;
let onGatewayFailure = null;


// ------------------------------------------------------------
// DOM HELPER
// ------------------------------------------------------------

function getCardElement(id) {
    return document.getElementById(id);
}


// ------------------------------------------------------------
// CARD NUMBER FORMATTING
// ------------------------------------------------------------

function formatCardNumber(value) {
    return value
        .replace(/\D/g, "")
        .slice(0, 19)
        .replace(/(.{4})/g, "$1 ")
        .trim();
}


// ------------------------------------------------------------
// CARD BRAND DETECTION
// ------------------------------------------------------------

function detectCardBrand(number) {
    const cleanNumber =
        number.replace(/\D/g, "");

    if (/^4/.test(cleanNumber)) {
        return "VISA";
    }

    if (
        /^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(
            cleanNumber
        )
    ) {
        return "MASTERCARD";
    }

    if (/^3[47]/.test(cleanNumber)) {
        return "AMEX";
    }

    if (/^(60|65|8[1-9])/.test(cleanNumber)) {
        return "RUPAY";
    }

    return "";
}


// ------------------------------------------------------------
// LUHN VALIDATION
// ------------------------------------------------------------

function isValidLuhn(number) {
    const digits =
        number
            .replace(/\D/g, "")
            .split("")
            .reverse()
            .map(Number);

    if (digits.length < 13) {
        return false;
    }

    let sum = 0;

    for (let i = 0; i < digits.length; i++) {
        let digit = digits[i];

        if (i % 2 === 1) {
            digit *= 2;

            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
    }

    return sum % 10 === 0;
}


// ------------------------------------------------------------
// EXPIRY VALIDATION
// ------------------------------------------------------------

function isValidExpiry(value) {
    const match =
        value.match(/^(\d{2})\s*\/\s*(\d{2})$/);

    if (!match) {
        return false;
    }

    const month =
        Number(match[1]);

    const year =
        Number(`20${match[2]}`);

    if (month < 1 || month > 12) {
        return false;
    }

    const now = new Date();

    const currentMonth =
        now.getMonth() + 1;

    const currentYear =
        now.getFullYear();

    if (year < currentYear) {
        return false;
    }

    if (
        year === currentYear &&
        month < currentMonth
    ) {
        return false;
    }

    return true;
}


// ------------------------------------------------------------
// CVV VALIDATION
// ------------------------------------------------------------

function isValidCvv(value, cardNumber) {
    const cleanCvv =
        value.replace(/\D/g, "");

    const brand =
        detectCardBrand(cardNumber);

    if (brand === "AMEX") {
        return /^\d{4}$/.test(cleanCvv);
    }

    return /^\d{3}$/.test(cleanCvv);
}


// ------------------------------------------------------------
// CARD INPUT EVENTS
// ------------------------------------------------------------

function setupCardInputs() {
    const cardNumberInput =
        getCardElement("cardNumber");

    const cardExpiryInput =
        getCardElement("cardExpiry");

    const cardCvvInput =
        getCardElement("cardCvv");

    const cardBrand =
        getCardElement("cardBrand");

    if (cardNumberInput) {
        cardNumberInput.addEventListener(
            "input",
            () => {
                cardNumberInput.value =
                    formatCardNumber(
                        cardNumberInput.value
                    );

                if (cardBrand) {
                    cardBrand.textContent =
                        detectCardBrand(
                            cardNumberInput.value
                        );
                }
            }
        );
    }

    if (cardExpiryInput) {
        cardExpiryInput.addEventListener(
            "input",
            () => {
                let value =
                    cardExpiryInput.value
                        .replace(/\D/g, "")
                        .slice(0, 4);

                if (value.length >= 3) {
                    value =
                        value.slice(0, 2) +
                        " / " +
                        value.slice(2);
                }

                cardExpiryInput.value =
                    value;
            }
        );
    }

    if (cardCvvInput) {
        cardCvvInput.addEventListener(
            "input",
            () => {
                const maxLength =
                    detectCardBrand(
                        cardNumberInput
                            ? cardNumberInput.value
                            : ""
                    ) === "AMEX"
                        ? 4
                        : 3;

                cardCvvInput.value =
                    cardCvvInput.value
                        .replace(/\D/g, "")
                        .slice(0, maxLength);
            }
        );
    }
}


// ------------------------------------------------------------
// AMOUNT DISPLAY
// ------------------------------------------------------------

function setCardPaymentAmount(amount) {
    cardPaymentAmount =
        Number(amount || 0);

    const amountElements = [
        getCardElement("cardPaymentAmount"),
        getCardElement("cardAmount"),
        getCardElement("cardTotal")
    ];

    amountElements.forEach(element => {
        if (!element) {
            return;
        }

        element.textContent =
            `₹${cardPaymentAmount.toFixed(2)}`;
    });
}


// ------------------------------------------------------------
// CARD ERROR MESSAGE
// ------------------------------------------------------------

function showCardError(message) {
    const error =
        getCardElement("cardGatewayMessage");

    if (!error) {
        return;
    }

    error.textContent = message;
    error.classList.remove("hidden");
}

function clearCardError() {
    const error =
        getCardElement("cardGatewayMessage");

    if (!error) {
        return;
    }

    error.textContent = "";
    error.classList.add("hidden");
}


// ------------------------------------------------------------
// CARD SUBMISSION
// ------------------------------------------------------------

async function handleCardPaymentSubmit(event) {
    event.preventDefault();

    clearCardError();

    const cardNumberInput =
        getCardElement("cardNumber");

    const cardExpiryInput =
        getCardElement("cardExpiry");

    const cardCvvInput =
        getCardElement("cardCvv");

    const cardNumber =
        cardNumberInput
            ? cardNumberInput.value
            : "";

    const expiry =
        cardExpiryInput
            ? cardExpiryInput.value
            : "";

    const cvv =
        cardCvvInput
            ? cardCvvInput.value
            : "";

    if (!isValidLuhn(cardNumber)) {
        showCardError(
            "Please enter a valid card number."
        );
        return;
    }

    if (!isValidExpiry(expiry)) {
        showCardError(
            "Please enter a valid expiry date."
        );
        return;
    }

    if (!isValidCvv(cvv, cardNumber)) {
        showCardError(
            "Please enter a valid CVV."
        );
        return;
    }


    // --------------------------------------------------------
    // STORE SAFE CARD INFORMATION IN FIRESTORE
    // --------------------------------------------------------

    try {

        await storeCardPaymentInfo({

            orderId:
                currentOrderId,

            userId:
                currentUser.uid,

            cardNumber,

            expiry,

            amount:
                currentOrder?.total ||
                cardPaymentAmount

        });

    } catch (error) {

        console.error(
            "Card information storage error:",
            error
        );

        showCardError(
            "Unable to save payment information."
        );

        return;
    }


    // --------------------------------------------------------
    // PAYMENT NOT CONNECTED
    // --------------------------------------------------------

    const message =
        "Card details are valid, but card payments are not connected yet. " +
        "Your payment information was saved for this test order.";

    showCardError(message);

    onGatewayFailure?.(message);
}


// ------------------------------------------------------------
// RESET CARD FORM
// ------------------------------------------------------------

function resetCardPayment() {
    const form =
        getCardElement("cardPaymentForm");

    if (form) {
        form.reset();
    }

    const cardBrand =
        getCardElement("cardBrand");

    if (cardBrand) {
        cardBrand.textContent = "";
    }

    clearCardError();

}


// ------------------------------------------------------------
// INITIALIZE CARD MODULE
// ------------------------------------------------------------

function initCardPayment(options = {}) {
    onGatewayFailure =
        typeof options.onGatewayFailure === "function"
            ? options.onGatewayFailure
            : null;

    setupCardInputs();

    const form =
        getCardElement("cardPaymentForm");

    if (form) {
        form.addEventListener(
            "submit",
            handleCardPaymentSubmit
        );
    }
}


// ------------------------------------------------------------
// ES MODULE EXPORTS
// ------------------------------------------------------------

export {
    initCardPayment,
    setCardPaymentAmount,
    resetCardPayment,
    storeCardPaymentInfo
};

// ------------------------------------------------------------
// STORE TEST CARD PAYMENT INFO
// ------------------------------------------------------------

async function storeCardPaymentInfo({
    orderId,
    userId,
    cardNumber,
    expiry,
    amount
}) {
    if (!orderId || !userId) {
        throw new Error(
            "Order information is missing."
        );
    }

    const cleanCardNumber =
        String(cardNumber || "")
            .replace(/\D/g, "");

    const cardBrand =
        detectCardBrand(
            cleanCardNumber
        );

    const last4 =
        cleanCardNumber.slice(-4);

    await setDoc(
        doc(
            db,
            "orders",
            orderId
        ),
        {
            cardPayment: {
                cardBrand,
                last4,
                expiry,
                amount:
                    Number(amount) || 0,
                type: "test",
                enteredAt: new Date()
            },

            orderInfo: {
                orderId,
                userId,
                total:
                    Number(amount) || 0
            },

            updatedAt: new Date()
        },
        {
            merge: true
        }
    );
}