/* ==========================================
   PROJOYSTICK — PASSWORD RECOVERY

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

const recoveryForm =
    document.getElementById(
        "recoveryForm"
    );

const recoveryEmail =
    document.getElementById(
        "recoveryEmail"
    );

const recoveryButton =
    document.getElementById(
        "recoveryButton"
    );

const recoveryMessage =
    document.getElementById(
        "recoveryMessage"
    );

const recoverySent =
    document.getElementById(
        "recoverySent"
    );

const checkVerificationButton =
    document.getElementById(
        "checkVerificationButton"
    );


/* ==========================================
   STORAGE KEY
========================================== */

const RECOVERY_EMAIL_KEY =
    "projoystick_recovery_email";


/* ==========================================
   SHOW MESSAGE
========================================== */

function showMessage(
    message,
    type = "error"
) {

    if (!recoveryMessage) {
        return;
    }

    recoveryMessage.textContent =
        message;

    recoveryMessage.className =
        `auth-message ${type}`;
}


/* ==========================================
   SEND EMAIL LINK
========================================== */

if (recoveryForm) {

    recoveryForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                recoveryEmail.value.trim();

            if (!email) {

                showMessage(
                    "Enter your email address."
                );

                return;
            }


            try {

                recoveryButton.disabled =
                    true;

                recoveryButton.textContent =
                    "Sending...";


                /*
                    Save email locally.

                    Firebase needs the email again
                    when the user returns from the
                    email link.
                */

                localStorage.setItem(
                    RECOVERY_EMAIL_KEY,
                    email
                );


                /*
                    Firebase email-link settings.

                    The email link will return the
                    user to THIS page.
                */

                const actionCodeSettings = {

                    url:
                        `${window.location.origin}/pages/password-recovery.html`,

                    handleCodeInApp: true

                };


                /*
                    Send Firebase email-link email.
                */

                await sendSignInLinkToEmail(
                    auth,
                    email,
                    actionCodeSettings
                );


                /*
                    Hide form.
                */

                recoveryForm.style.display =
                    "none";


                /*
                    Show waiting screen.
                */

                recoverySent.style.display =
                    "block";


                showMessage(
                    "Verification email sent. Check your inbox.",
                    "success"
                );


                console.log(
                    "Recovery email sent to:",
                    email
                );


            } catch (error) {

                console.error(
                    "Recovery email error:",
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
                            "Too many attempts. Please try again later."
                        );

                        break;


                    case "auth/unauthorized-continue-uri":

                        showMessage(
                            "This website is not authorized in Firebase. Check your Authorized Domains."
                        );

                        break;


                    default:

                        showMessage(
                            "Unable to send verification email. Please try again."
                        );

                }


                recoveryButton.disabled =
                    false;

                recoveryButton.textContent =
                    "Send Verification Email";
            }
        }
    );
}


/* ==========================================
   HANDLE EMAIL LINK
========================================== */

async function handleRecoveryEmailLink() {

    /*
        Check whether the current URL is
        a Firebase email sign-in link.
    */

    if (
        !isSignInWithEmailLink(
            auth,
            window.location.href
        )
    ) {

        return;
    }


    console.log(
        "Firebase email link detected."
    );


    /*
        Get the email that was stored
        before sending the link.
    */

    let email =
        localStorage.getItem(
            RECOVERY_EMAIL_KEY
        );


    /*
        If localStorage is unavailable,
        ask the user for their email.
    */

    if (!email) {

        email =
            window.prompt(
                "Please enter your email address to continue:"
            );

        if (!email) {

            showMessage(
                "Email address is required to complete verification."
            );

            return;
        }

        email =
            email.trim();
    }


    try {

        /*
            Sign the user in using the
            Firebase email link.
        */

        await signInWithEmailLink(
            auth,
            email,
            window.location.href
        );


        /*
            Remove stored email after
            successful authentication.
        */

        localStorage.removeItem(
            RECOVERY_EMAIL_KEY
        );


        /*
            Remove Firebase parameters
            from the browser URL.

            This makes the page look clean.
        */

        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );


        /*
            Hide the email form.
        */

        if (recoveryForm) {

            recoveryForm.style.display =
                "none";
        }


        /*
            Show verified state.
        */

        if (recoverySent) {

            recoverySent.style.display =
                "block";
        }


        showMessage(
            "Email verified successfully. You can now reset your password.",
            "success"
        );


        /*
            Change button text.
        */

        if (checkVerificationButton) {

            checkVerificationButton.textContent =
                "Continue to Password Reset";
        }


        console.log(
            "Email verification successful."
        );

        console.log(
            "Authenticated user:",
            auth.currentUser?.email
        );


    } catch (error) {

        console.error(
            "Email link sign-in error:",
            error
        );


        showMessage(
            "This verification link is invalid or has expired."
        );
    }
}


/* ==========================================
   I VERIFIED / CONTINUE
========================================== */

if (checkVerificationButton) {

    checkVerificationButton.addEventListener(
        "click",
        () => {

            const user =
                auth.currentUser;


            if (!user) {

                showMessage(
                    "Please click the verification link in your email first."
                );

                return;
            }


            console.log(
                "Verified user:",
                user.email
            );


            /*
                Continue to our custom
                password reset page.
            */

            window.location.href =
                "reset-password.html";
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
                "Recovery user authenticated:",
                user.email
            );

        } else {

            console.log(
                "No recovery user authenticated."
            );
        }
    }
);


/* ==========================================
   START
========================================== */

handleRecoveryEmailLink();