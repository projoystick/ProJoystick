/* ==========================================
   PROJOYSTICK — RESET PASSWORD

   Password Recovery

   FLOW:
   Firebase Email Link Authentication
              ↓
   Authenticated Firebase user
              ↓
   reset-password.html
              ↓
   updatePassword()
========================================== */

import {
    auth
} from "./firebase.js";

import {
    onAuthStateChanged,
    updatePassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* ==========================================
   ELEMENTS
========================================== */

const form =
    document.getElementById(
        "resetPasswordForm"
    );

const newPasswordInput =
    document.getElementById(
        "newPassword"
    );

const confirmPasswordInput =
    document.getElementById(
        "confirmPassword"
    );

const resetButton =
    document.getElementById(
        "resetPasswordButton"
    );

const authMessage =
    document.getElementById(
        "authMessage"
    );

const resetSuccess =
    document.getElementById(
        "resetSuccess"
    );

const resetInvalid =
    document.getElementById(
        "resetInvalid"
    );


/* ==========================================
   RECOVERY SESSION KEY
========================================== */

const RECOVERY_SESSION_KEY =
    "projoystick_password_recovery";


/* ==========================================
   SHOW MESSAGE
========================================== */

function showMessage(
    message,
    type = "error"
) {

    if (!authMessage) {
        return;
    }

    authMessage.textContent =
        message;

    authMessage.className =
        `auth-message ${type}`;

}


/* ==========================================
   PASSWORD VALIDATION
========================================== */

/*
    Requirements:

    - Minimum 8 characters
    - At least 1 letter
    - At least 1 number
    - At least 1 special character
*/

function isValidPassword(
    password
) {

    const passwordRegex =
        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    return passwordRegex.test(
        password
    );

}


/* ==========================================
   SHOW INVALID / UNAUTHORIZED
========================================== */

function showInvalidAccess() {

    if (form) {

        form.style.display =
            "none";

    }

    if (authMessage) {

        authMessage.style.display =
            "none";

    }

    if (resetSuccess) {

        resetSuccess.style.display =
            "none";

    }

    if (resetInvalid) {

        resetInvalid.style.display =
            "block";

    }

}


/* ==========================================
   SHOW RESET FORM
========================================== */

function showResetForm() {

    if (form) {

        form.style.display =
            "block";

    }

    if (resetSuccess) {

        resetSuccess.style.display =
            "none";

    }

    if (resetInvalid) {

        resetInvalid.style.display =
            "none";

    }

}


/* ==========================================
   SHOW SUCCESS
========================================== */

function showResetSuccess() {

    if (form) {

        form.style.display =
            "none";

    }

    if (authMessage) {

        authMessage.style.display =
            "none";

    }

    if (resetInvalid) {

        resetInvalid.style.display =
            "none";

    }

    if (resetSuccess) {

        resetSuccess.style.display =
            "block";

    }

}


/* ==========================================
   CHECK RECOVERY SESSION
========================================== */

function isRecoverySessionActive() {

    return (
        sessionStorage.getItem(
            RECOVERY_SESSION_KEY
        ) === "true"
    );

}


/* ==========================================
   VERIFY AUTHENTICATED USER
========================================== */

function checkRecoveryAccess(
    user
) {

    /*
        User must be authenticated.
    */

    if (!user) {

        console.log(
            "No Firebase user authenticated."
        );

        showInvalidAccess();

        return false;

    }


    /*
        User must have come through
        the password recovery flow.
    */

    if (!isRecoverySessionActive()) {

        console.log(
            "Recovery session is not active."
        );

        showInvalidAccess();

        return false;

    }


    console.log(
        "Password recovery access granted:",
        user.email
    );


    return true;

}


/* ==========================================
   RESET PASSWORD
========================================== */

if (form) {

    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const user =
                auth.currentUser;


            /* ----------------------------------
               CHECK USER
            ---------------------------------- */

            if (!user) {

                showInvalidAccess();

                return;

            }


            /* ----------------------------------
               CHECK RECOVERY SESSION
            ---------------------------------- */

            if (!isRecoverySessionActive()) {

                showInvalidAccess();

                return;

            }


            /* ----------------------------------
               GET PASSWORDS
            ---------------------------------- */

            const newPassword =
                newPasswordInput
                    ?.value || "";

            const confirmPassword =
                confirmPasswordInput
                    ?.value || "";


            /* ----------------------------------
               PASSWORD VALIDATION
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

                if (resetButton) {

                    resetButton.disabled =
                        true;

                    resetButton.textContent =
                        "Updating Password...";

                }


                console.log(
                    "Updating password for:",
                    user.email
                );


                /*
                    Because the user has just
                    authenticated through the
                    Firebase email link,
                    updatePassword() should be
                    allowed.
                */

                await updatePassword(
                    user,
                    newPassword
                );


                console.log(
                    "Password updated successfully."
                );


                /* ----------------------------------
                   CLEAR RECOVERY SESSION
                ---------------------------------- */

                sessionStorage.removeItem(
                    RECOVERY_SESSION_KEY
                );

                sessionStorage.removeItem(
                    "projoystick_recovery_email"
                );


                localStorage.removeItem(
                    "projoystick_password_reset_email"
                );


                /* ----------------------------------
                   SHOW SUCCESS
                ---------------------------------- */

                showResetSuccess();


            } catch (error) {

                console.error(
                    "Password update error:",
                    error
                );


                switch (error.code) {

                    case "auth/weak-password":

                        showMessage(
                            "Password is too weak. Please choose a stronger password."
                        );

                        break;


                    case "auth/requires-recent-login":

                        showMessage(
                            "Your recovery session has expired. Please start the password recovery process again."
                        );

                        break;


                    case "auth/user-disabled":

                        showMessage(
                            "This account has been disabled."
                        );

                        break;


                    case "auth/network-request-failed":

                        showMessage(
                            "Network error. Please check your internet connection."
                        );

                        break;


                    default:

                        showMessage(
                            "Unable to update your password. Please start the recovery process again."
                        );

                }


                if (resetButton) {

                    resetButton.disabled =
                        false;

                    resetButton.textContent =
                        "Reset Password";

                }

            }

        }
    );

}


/* ==========================================
   PASSWORD VISIBILITY
========================================== */

document
    .querySelectorAll(
        ".show-password"
    )
    .forEach(
        (button) => {

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
                        input.type ===
                        "password"
                    ) {

                        input.type =
                            "text";

                        button.textContent =
                            "Hide";

                    } else {

                        input.type =
                            "password";

                        button.textContent =
                            "Show";

                    }

                }
            );

        }
    );


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(
    auth,
    (user) => {

        console.log(
            "Reset page Firebase user:",
            user
                ? user.email
                : "none"
        );


        /*
            Wait for Firebase to restore
            the authentication state.
        */

        if (!user) {

            showInvalidAccess();

            return;

        }


        /*
            Check recovery session.
        */

        if (
            !checkRecoveryAccess(
                user
            )
        ) {

            return;

        }


        /*
            Everything is valid.
        */

        showResetForm();


        showMessage(
            `You can now create a new password for ${user.email}.`,
            "success"
        );

    }
);