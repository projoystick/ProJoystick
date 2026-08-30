/* ==========================================
   PROJOYSTICK — PASSWORD VERIFICATION

   Firebase Email Link Authentication
========================================== */

import {
    auth
} from "./firebase.js";

import {
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    onAuthStateChanged
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
   STORAGE KEY
========================================== */

const RECOVERY_EMAIL_KEY =
    "projoystick_password_reset_email";


/* ==========================================
   GET VERIFICATION URL
========================================== */

function getVerificationURL() {

    return "https://pro-joystick.vercel.app/pages/password-verification.html";

}


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
   WAIT FOR FIREBASE AUTH STATE
========================================== */

function waitForAuthState() {

    return new Promise((resolve) => {

        const unsubscribe =
            onAuthStateChanged(
                auth,
                (user) => {

                    unsubscribe();

                    resolve(user);

                }
            );

    });

}


/* ==========================================
   SEND VERIFICATION EMAIL
========================================== */

async function sendVerificationEmail(
    email
) {

    if (!email) {

        showMessage(
            "Enter your email address first."
        );

        return;

    }


    try {

        verificationButton.disabled =
            true;


        verificationButton.textContent =
            "Sending...";


        /*
            Store the email.

            Firebase email-link authentication
            needs the email address when the
            link is opened.
        */

        localStorage.setItem(
            RECOVERY_EMAIL_KEY,
            email
        );


        /*
            Firebase Email Link settings.
        */

        const actionCodeSettings = {

            url:
                getVerificationURL(),

            handleCodeInApp:
                true

        };


        /*
            Send Firebase email link.
        */

        await sendSignInLinkToEmail(
            auth,
            email,
            actionCodeSettings
        );


        /*
            Hide email form.
        */

        if (verificationForm) {

            verificationForm.style.display =
                "none";

        }


        /*
            Show waiting state.
        */

        if (verificationWaiting) {

            verificationWaiting.style.display =
                "block";

        }


        showMessage(
            "Verification email sent. Check your inbox.",
            "success"
        );


        console.log(
            "Password recovery email sent to:",
            email
        );


    } catch (error) {

        console.error(
            "Firebase email-link error:",
            error
        );


        switch (error.code) {

            case "auth/invalid-email":

                showMessage(
                    "Please enter a valid email address."
                );

                break;


            case "auth/user-not-found":

                showMessage(
                    "No account was found with this email."
                );

                break;


            case "auth/too-many-requests":

                showMessage(
                    "Too many requests. Please try again later."
                );

                break;


            case "auth/unauthorized-continue-uri":

                showMessage(
                    "This website is not authorized in Firebase."
                );

                console.error(
                    "Add this domain to Firebase Authorized Domains:",
                    window.location.hostname
                );

                break;


            case "auth/operation-not-allowed":

                showMessage(
                    "Email link authentication is not enabled in Firebase."
                );

                break;


            default:

                showMessage(
                    "Unable to send the verification email. Please try again."
                );

        }


        verificationButton.disabled =
            false;


        verificationButton.textContent =
            "Send Verification Email";

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
                verificationEmail.value.trim();


            await sendVerificationEmail(
                email
            );

        }
    );

}


/* ==========================================
   COMPLETE RECOVERY
========================================== */

function completeRecovery() {

    console.log(
        "Recovery authentication confirmed."
    );


    /*
        Remove Firebase parameters from
        the visible browser URL.
    */

    window.history.replaceState(
        {},
        document.title,
        window.location.pathname
    );


    /*
        Hide email form.
    */

    if (verificationForm) {

        verificationForm.style.display =
            "none";

    }


    /*
        Hide waiting section.
    */

    if (verificationWaiting) {

        verificationWaiting.style.display =
            "none";

    }


    /*
        Hide invalid section.
    */

    if (verificationInvalid) {

        verificationInvalid.style.display =
            "none";

    }


    /*
        Show success section.
    */

    if (verificationSuccess) {

        verificationSuccess.style.display =
            "block";

    }


    showMessage(
        "Email verified successfully.",
        "success"
    );


    /*
        Go to custom password page.
    */

    setTimeout(() => {

        window.location.href =
            "reset-password.html";

    }, 800);

}


/* ==========================================
   INVALID LINK
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


    showMessage(
        "The verification link is invalid or has expired."
    );

}


/* ==========================================
   HANDLE FIREBASE EMAIL LINK
========================================== */

async function handleEmailLink() {

    /*
        Check whether this page was opened
        through a Firebase email link.
    */

    const isEmailLink =
        isSignInWithEmailLink(
            auth,
            window.location.href
        );


    console.log(
        "Is Firebase email link:",
        isEmailLink
    );


    /*
        Normal visit to the page.
    */

    if (!isEmailLink) {

        console.log(
            "Normal password verification page visit."
        );

        return;

    }


    console.log(
        "Firebase email verification link detected."
    );


    /*
        IMPORTANT:

        Firebase restores the authentication
        session asynchronously.

        We MUST wait for that process before
        deciding whether we need to consume
        the email link.
    */

    const currentUser =
        await waitForAuthState();


    console.log(
        "Authentication state after waiting:",
        currentUser
            ? currentUser.email
            : "No user"
    );


    /*
        --------------------------------------
        CASE 1
        --------------------------------------

        Firebase has already authenticated
        the user.

        DO NOT call signInWithEmailLink()
        again.

        Doing so would try to consume the
        same one-time oobCode again and cause:

        auth/invalid-action-code
    */

    if (currentUser) {

        console.log(
            "Recovery authentication already active:",
            currentUser.email
        );


        completeRecovery();

        return;

    }


    /*
        --------------------------------------
        CASE 2
        --------------------------------------

        Firebase has NOT authenticated the
        user yet.

        We need the email address stored
        before the email was sent.
    */

    let email =
        localStorage.getItem(
            RECOVERY_EMAIL_KEY
        );


    /*
        If no email is stored, ask the user.
    */

    if (!email) {

        email =
            window.prompt(
                "Enter your email address to continue:"
            );


        if (!email) {

            showInvalidLink();

            return;

        }


        email =
            email.trim();

    }


    /*
        --------------------------------------
        COMPLETE EMAIL LINK AUTHENTICATION
        --------------------------------------
    */

    try {

        console.log(
            "Attempting Firebase email-link authentication..."
        );


        const result =
            await signInWithEmailLink(
                auth,
                email,
                window.location.href
            );


        console.log(
            "Firebase email-link authentication successful."
        );


        console.log(
            "Authenticated email:",
            result.user.email
        );


        /*
            Remove stored recovery email.
        */

        localStorage.removeItem(
            RECOVERY_EMAIL_KEY
        );


        /*
            Recovery successful.
        */

        completeRecovery();


    } catch (error) {

        console.error(
            "Firebase email-link verification error:",
            error
        );


        switch (error.code) {

            case "auth/invalid-action-code":

                showMessage(
                    "This verification link has already been used or is no longer valid."
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


            default:

                showMessage(
                    "The verification link is invalid or has expired."
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
                Wait for Firebase to restore
                authentication state.
            */

            const user =
                await waitForAuthState();


            if (!user) {

                showMessage(
                    "Please click the verification link in your email first."
                );

                return;

            }


            console.log(
                "Firebase authenticated user:",
                user.email
            );


            /*
                Recovery is confirmed.
            */

            completeRecovery();

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

            /*
                Hide invalid section.
            */

            if (verificationInvalid) {

                verificationInvalid.style.display =
                    "none";

            }


            /*
                Show email form.
            */

            if (verificationForm) {

                verificationForm.style.display =
                    "block";

            }


            /*
                Clear email.
            */

            if (verificationEmail) {

                verificationEmail.value =
                    "";

            }


            /*
                Clear message.
            */

            showMessage("");

        }
    );

}


/* ==========================================
   AUTH STATE LOGGING
========================================== */

onAuthStateChanged(
    auth,
    (user) => {

        if (user) {

            console.log(
                "Recovery authentication active:",
                user.email
            );

        } else {

            console.log(
                "No recovery authentication."
            );

        }

    }
);


/* ==========================================
   START
========================================== */

handleEmailLink();