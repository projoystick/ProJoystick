/* ==========================================
   PROJOYSTICK — RESET PASSWORD
========================================== */

import { auth } from "./firebase.js";

import {
    verifyPasswordResetCode,
    confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* ==========================================
   ELEMENTS
========================================== */

const form = document.getElementById("resetPasswordForm");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const resetButton = document.getElementById("resetPasswordButton");
const authMessage = document.getElementById("authMessage");
const resetSuccess = document.getElementById("resetSuccess");
const resetInvalid = document.getElementById("resetInvalid");


/* ==========================================
   SHOW MESSAGE
========================================== */

function showMessage(message, type = "error") {

    if (!authMessage) {
        return;
    }

    authMessage.textContent = message;
    authMessage.className = `auth-message ${type}`;
    authMessage.style.display = "block";
}


/* ==========================================
   PASSWORD VALIDATION
========================================== */

function isValidPassword(password) {

    return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(
        password
    );
}


/* ==========================================
   SHOW INVALID LINK
========================================== */

function showInvalidLink() {

    if (form) {
        form.style.display = "none";
    }

    if (authMessage) {
        authMessage.style.display = "none";
    }

    if (resetInvalid) {
        resetInvalid.style.display = "block";
    }
}


/* ==========================================
   GET FIREBASE ACTION CODE
========================================== */

function getResetParameters() {

    const params = new URLSearchParams(
        window.location.search
    );

    const mode = params.get("mode");
    const actionCode = params.get("oobCode");

    console.log(
        "Reset page URL:",
        window.location.href
    );

    console.log(
        "Reset mode:",
        mode
    );

    console.log(
        "Reset code exists:",
        Boolean(actionCode)
    );

    return {
        mode,
        actionCode
    };
}


/* ==========================================
   VERIFY RESET LINK
========================================== */

async function verifyResetLink() {

    const {
        mode,
        actionCode
    } = getResetParameters();


    /* --------------------------------------
       CHECK PARAMETERS
    -------------------------------------- */

    if (
        mode !== "resetPassword" ||
        !actionCode
    ) {

        console.error(
            "Missing Firebase password reset parameters."
        );

        showInvalidLink();

        return;
    }


    /* --------------------------------------
       VERIFY CODE
    -------------------------------------- */

    try {

        const email =
            await verifyPasswordResetCode(
                auth,
                actionCode
            );


        console.log(
            "Password reset code is valid."
        );

        console.log(
            "Account:",
            email
        );


        showMessage(
            `Resetting password for ${email}`,
            "success"
        );


        if (form) {
            form.style.display = "block";
        }

    } catch (error) {

        console.error(
            "Password reset verification failed:",
            error
        );

        showInvalidLink();
    }
}


/* ==========================================
   RESET PASSWORD
========================================== */

if (form) {

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const {
                mode,
                actionCode
            } = getResetParameters();


            if (
                mode !== "resetPassword" ||
                !actionCode
            ) {

                showInvalidLink();

                return;
            }


            const newPassword =
                newPasswordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;


            /* ----------------------------------
               VALIDATE PASSWORD
            ---------------------------------- */

            if (
                !isValidPassword(
                    newPassword
                )
            ) {

                showMessage(
                    "Password must be at least 8 characters and contain at least one letter, one number, and one special character."
                );

                return;
            }


            /* ----------------------------------
               CONFIRM PASSWORD
            ---------------------------------- */

            if (
                newPassword !==
                confirmPassword
            ) {

                showMessage(
                    "Passwords do not match."
                );

                return;
            }


            /* ----------------------------------
               UPDATE PASSWORD
            ---------------------------------- */

            try {

                resetButton.disabled = true;

                resetButton.textContent =
                    "Updating Password...";


                await confirmPasswordReset(
                    auth,
                    actionCode,
                    newPassword
                );


                console.log(
                    "Password reset successful."
                );


                if (form) {
                    form.style.display = "none";
                }

                if (authMessage) {
                    authMessage.style.display = "none";
                }

                if (resetSuccess) {
                    resetSuccess.style.display = "block";
                }


            } catch (error) {

                console.error(
                    "Password reset failed:",
                    error
                );


                if (
                    error.code ===
                    "auth/expired-action-code"
                ) {

                    showMessage(
                        "This password reset link has expired. Please request a new one."
                    );

                } else if (
                    error.code ===
                    "auth/invalid-action-code"
                ) {

                    showInvalidLink();

                } else if (
                    error.code ===
                    "auth/weak-password"
                ) {

                    showMessage(
                        "Password is too weak."
                    );

                } else {

                    showMessage(
                        "Unable to reset your password. Please request a new reset link."
                    );
                }


                resetButton.disabled = false;

                resetButton.textContent =
                    "Reset Password";
            }
        }
    );
}


/* ==========================================
   PASSWORD VISIBILITY
========================================== */

document
    .querySelectorAll(".show-password")
    .forEach((button) => {

        button.addEventListener(
            "click",
            () => {

                const targetId =
                    button.dataset.target;

                const input =
                    document.getElementById(
                        targetId
                    );


                if (!input) {
                    return;
                }


                if (
                    input.type === "password"
                ) {

                    input.type = "text";

                    button.textContent =
                        "Hide";

                } else {

                    input.type = "password";

                    button.textContent =
                        "Show";
                }
            }
        );
    });


/* ==========================================
   START
========================================== */

verifyResetLink();