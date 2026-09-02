/* ==========================================
   PROJOYSTICK — PASSWORD VERIFICATION

   Firebase Email Link Authentication
   Used for password recovery

   FLOW:
   Login
      ↓
   password-verification.html
      ↓
   User enters email
      ↓
   Firebase sends email link
      ↓
   User clicks link
      ↓
   Firebase authenticates user
      ↓
   reset-password.html
========================================== */

import {
    auth
} from "./firebase.js";

import {
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* ==========================================
   ELEMENTS
========================================== */

const verificationForm =
    document.getElementById(
        "verificationForm"
    );

const verificationEmail =
    document.getElementById(
        "verificationEmail"
    );

const verificationButton =
    document.getElementById(
        "verificationButton"
    );

const verificationMessage =
    document.getElementById(
        "verificationMessage"
    );

const verificationWaiting =
    document.getElementById(
        "verificationWaiting"
    );

const checkVerificationButton =
    document.getElementById(
        "checkVerificationButton"
    );

const resendVerificationButton =
    document.getElementById(
        "resendVerificationButton"
    );

const verificationSuccess =
    document.getElementById(
        "verificationSuccess"
    );

const verificationInvalid =
    document.getElementById(
        "verificationInvalid"
    );

const tryAgainButton =
    document.getElementById(
        "tryAgainButton"
    );


/* ==========================================
   STORAGE KEYS
========================================== */

/*
    Email is stored temporarily because
    Firebase requires the email address
    when completing an email-link sign-in.
*/

const RECOVERY_EMAIL_KEY =
    "projoystick_password_reset_email";


/*
    This flag tells reset-password.html
    that the user arrived through the
    password recovery flow.
*/

const RECOVERY_SESSION_KEY =
    "projoystick_password_recovery";


/* ==========================================
   PRODUCTION ACTION URL
========================================== */

const RECOVERY_ACTION_URL =
    "https://pro-joystick.vercel.app/pages/password-verification.html";


/* ==========================================
   SHOW MESSAGE
========================================== */

function showMessage(
    message,
    type = "error"
) {

    if (!verificationMessage) {
        return;
    }

    verificationMessage.textContent =
        message;

    verificationMessage.className =
        `auth-message ${type}`;

}


/* ==========================================
   SHOW NORMAL FORM
========================================== */

function showVerificationForm() {

    if (verificationForm) {
        verificationForm.style.display =
            "block";
    }

    if (verificationWaiting) {
        verificationWaiting.style.display =
            "none";
    }


    if (verificationInvalid) {
        verificationInvalid.style.display =
            "none";
    }

}


/* ==========================================
   SHOW WAITING
========================================== */

function showWaiting() {

    if (verificationForm) {
        verificationForm.style.display =
            "none";
    }

    if (verificationWaiting) {
        verificationWaiting.style.display =
            "block";
    }

    if (verificationSuccess) {
        verificationSuccess.style.display =
            "none";
    }

    if (verificationInvalid) {
        verificationInvalid.style.display =
            "none";
    }

}


/* ==========================================
   SHOW SUCCESS
========================================== */

function showSuccess() {

    if (verificationForm) {
        verificationForm.style.display =
            "none";
    }

    if (verificationWaiting) {
        verificationWaiting.style.display =
            "none";
    }

    if (verificationInvalid) {
        verificationInvalid.style.display =
            "none";
    }

    if (verificationSuccess) {
        verificationSuccess.style.display =
            "block";
    }

}


/* ==========================================
   SHOW INVALID LINK
========================================== */

function showInvalidLink() {

    if (verificationForm) {
        verificationForm.style.display =
            "none";
    }

    if (verificationWaiting) {
        verificationWaiting.style.display =
            "none";
    }

    if (verificationSuccess) {
        verificationSuccess.style.display =
            "none";
    }

    if (verificationInvalid) {
        verificationInvalid.style.display =
            "block";
    }


}


/* ==========================================
   SEND RECOVERY EMAIL
========================================== */

async function sendVerificationEmail(
    email
) {

    email =
        email.trim();

    /* --------------------------------------
       EMAIL REQUIRED
    -------------------------------------- */

    if (!email) {

        showMessage(
            "Enter your email address first."
        );

        return;

    }


    try {

        /* ----------------------------------
           BUTTON STATE
        ---------------------------------- */

        if (verificationButton) {

            verificationButton.disabled =
                true;

            verificationButton.textContent =
                "Sending...";

        }


        /* ----------------------------------
           SAVE EMAIL
        ---------------------------------- */

        localStorage.setItem(
            RECOVERY_EMAIL_KEY,
            email
        );


        /* ----------------------------------
           FIREBASE EMAIL LINK SETTINGS
        ---------------------------------- */

        const actionCodeSettings = {

            url:
                RECOVERY_ACTION_URL,

            handleCodeInApp:
                true

        };


        console.log(
            "Sending recovery email to:",
            email
        );

        console.log(
            "Recovery action URL:",
            RECOVERY_ACTION_URL
        );


        /* ----------------------------------
           SEND FIREBASE EMAIL LINK
        ---------------------------------- */

        await sendSignInLinkToEmail(
            auth,
            email,
            actionCodeSettings
        );


        /* ----------------------------------
           SHOW WAITING PAGE
        ---------------------------------- */

        showWaiting();


        showMessage(
            "Verification email sent. Check your inbox.",
            "success"
        );


        console.log(
            "Recovery email sent successfully."
        );


    } catch (error) {

        console.error(
            "Firebase recovery email error:",
            error
        );


        switch (error.code) {

            case "auth/invalid-email":

                showMessage(
                    "Please enter a valid email address."
                );

                break;


            case "auth/unauthorized-continue-uri":

                showMessage(
                    "This website is not authorized in Firebase."
                );

                console.error(
                    "Make sure pro-joystick.vercel.app is added to Firebase Authorized Domains."
                );

                break;


            case "auth/operation-not-allowed":

                showMessage(
                    "Email Link Authentication is not enabled in Firebase."
                );

                break;


            case "auth/quota-exceeded":

                showMessage(
                    "Firebase's daily email-link limit has been reached. Please try again later."
                );

                break;


            case "auth/too-many-requests":

                showMessage(
                    "Too many requests. Please try again later."
                );

                break;


            default:

                showMessage(
                    "Unable to send the verification email. Please try again."
                );

        }


        if (verificationButton) {

            verificationButton.disabled =
                false;

            verificationButton.textContent =
                "Send Verification Email";

        }

    }

}


/* ==========================================
   FORM SUBMIT
========================================== */

if (verificationForm) {

    verificationForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                verificationEmail
                    ?.value
                    .trim() || "";

            await sendVerificationEmail(
                email
            );

        }
    );

}


/* ==========================================
   COMPLETE FIREBASE EMAIL LINK
========================================== */

async function handleEmailLink() {

    const currentURL =
        window.location.href;


    /*
        Check whether the current URL
        contains a Firebase email-link
        authentication code.
    */

    const isEmailLink =
        isSignInWithEmailLink(
            auth,
            currentURL
        );


    console.log(
        "Is Firebase email link:",
        isEmailLink
    );


    /* --------------------------------------
       NORMAL PAGE VISIT
    -------------------------------------- */

    if (!isEmailLink) {

        console.log(
            "Normal password verification page visit."
        );

        return;

    }


    console.log(
        "Firebase recovery email link detected."
    );


    /* --------------------------------------
       GET STORED EMAIL
    -------------------------------------- */

    let email =
        localStorage.getItem(
            RECOVERY_EMAIL_KEY
        );


    /*
        If localStorage does not contain
        the email, ask the user.

        This can happen if the email link
        was opened on another browser/device.
    */

    if (!email) {

        email =
            window.prompt(
                "Enter the email address you used for password recovery:"
            );

        if (!email) {

            showInvalidLink();

            return;

        }

        email =
            email.trim();

    }


    if (!email) {

        showInvalidLink();

        return;

    }


    /* --------------------------------------
       SHOW PROCESSING MESSAGE
    -------------------------------------- */

    showWaiting();

    showMessage(
        "Verifying your email...",
        "success"
    );


    /* --------------------------------------
       COMPLETE EMAIL LINK SIGN-IN
    -------------------------------------- */

    try {

        console.log(
            "Completing Firebase email-link authentication..."
        );


        const result =
            await signInWithEmailLink(
                auth,
                email,
                currentURL
            );


        const user =
            result.user;


        console.log(
            "Firebase email-link authentication successful."
        );

        console.log(
            "Authenticated recovery user:",
            user.email
        );


        /* ----------------------------------
           SAVE RECOVERY SESSION
        ---------------------------------- */

        sessionStorage.setItem(
            RECOVERY_SESSION_KEY,
            "true"
        );


        /*
            Save the authenticated email
            temporarily in case it is useful
            on the next page.
        */

        sessionStorage.setItem(
            "projoystick_recovery_email",
            user.email || email
        );


        /* ----------------------------------
           REMOVE STORED EMAIL
        ---------------------------------- */

        localStorage.removeItem(
            RECOVERY_EMAIL_KEY
        );


        /* ----------------------------------
           REMOVE FIREBASE PARAMETERS
           FROM THE VISIBLE URL
        ---------------------------------- */

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );


        /* ----------------------------------
           SHOW SUCCESS
        ---------------------------------- */

        showSuccess();

        showMessage(
            "Email verified successfully. Redirecting...",
            "success"
        );


        /* ----------------------------------
           GO TO RESET PASSWORD PAGE
        ---------------------------------- */

        setTimeout(() => {

            window.location.href =
                "reset-password.html";

        }, 800);


    } catch (error) {

        console.error(
            "Firebase email-link authentication error:",
            error
        );


        switch (error.code) {

            case "auth/invalid-action-code":

                showMessage(
                    "This verification link is invalid, expired, or has already been used."
                );

                break;


            case "auth/expired-action-code":

                showMessage(
                    "This verification link has expired. Please request a new one."
                );

                break;


            case "auth/invalid-email":

                showMessage(
                    "The email address is invalid."
                );

                break;


            case "auth/user-disabled":

                showMessage(
                    "This account has been disabled."
                );

                break;


            case "auth/too-many-requests":

                showMessage(
                    "Too many requests. Please try again later."
                );

                break;


            default:

                showMessage(
                    "Unable to verify the email link. Please request a new link."
                );

        }


        showInvalidLink();

    }

}


/* ==========================================
   I VERIFIED BUTTON
========================================== */

if (checkVerificationButton) {

    checkVerificationButton.addEventListener(
        "click",
        async () => {

            /*
                If Firebase already authenticated
                the user, continue immediately.
            */

            const user =
                auth.currentUser;


            if (user) {

                console.log(
                    "Recovery authentication found:",
                    user.email
                );


                sessionStorage.setItem(
                    RECOVERY_SESSION_KEY,
                    "true"
                );


                sessionStorage.setItem(
                    "projoystick_recovery_email",
                    user.email || ""
                );


                window.location.href =
                    "reset-password.html";


                return;

            }


            /*
                If there is still a Firebase
                email link in the URL, process it.
            */

            if (
                isSignInWithEmailLink(
                    auth,
                    window.location.href
                )
            ) {

                await handleEmailLink();

                return;

            }


            showMessage(
                "Please click the verification link in your email first."
            );

        }
    );

}


/* ==========================================
   RESEND VERIFICATION EMAIL
========================================== */

if (resendVerificationButton) {

    resendVerificationButton.addEventListener(
        "click",
        async () => {

            const email =
                localStorage.getItem(
                    RECOVERY_EMAIL_KEY
                );


            if (!email) {

                showVerificationForm();

                showMessage(
                    "Enter your email address again."
                );

                return;

            }


            await sendVerificationEmail(
                email
            );

        }
    );

}


/* ==========================================
   TRY AGAIN
========================================== */

if (tryAgainButton) {

    tryAgainButton.addEventListener(
        "click",
        () => {

            showVerificationForm();


            if (verificationEmail) {

                verificationEmail.value =
                    "";

            }


            showMessage(
                ""
            );

        }
    );

}


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(
    auth,
    (user) => {

        if (user) {

            console.log(
                "Firebase authenticated user:",
                user.email
            );

        } else {

            console.log(
                "No Firebase authenticated user."
            );

        }

    }
);


/* ==========================================
   START
========================================== */

handleEmailLink();
