/* ==========================================
   PROJOYSTICK EMAIL VERIFICATION
========================================== */

import {
    auth
} from "./firebase.js";

import {
    onAuthStateChanged,
    sendEmailVerification,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


/* ==========================================
   ELEMENTS
========================================== */

const statusMessage =
    document.getElementById(
        "verificationStatus"
    );

const verificationEmail =
    document.getElementById(
        "verificationEmail"
    );

const checkButton =
    document.getElementById(
        "checkVerification"
    );

const resendButton =
    document.getElementById(
        "resendVerification"
    );

const loginButton =
    document.getElementById(
        "loginAfterVerification"
    );

const title =
    document.getElementById(
        "verificationTitle"
    );

const text =
    document.getElementById(
        "verificationText"
    );


/* ==========================================
   SHOW STATUS
========================================== */

function showStatus(
    message,
    type = "success"
) {

    statusMessage.textContent =
        message;

    statusMessage.className =
        `auth-message ${type}`;
}


/* ==========================================
   VERIFICATION COMPLETE
========================================== */

function verificationComplete() {

    title.textContent =
        "Email verified!";

    text.textContent =
        "Your email address has been successfully verified. You can now log in to your PROJOYSTICK account.";

    showStatus(
        "✓ Email verified successfully!",
        "success"
    );

    checkButton.style.display =
        "none";

    resendButton.style.display =
        "none";

    loginButton.style.display =
        "block";
}


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(
    auth,
    async (user) => {

        /*
           User must exist on this page.
        */

        if (!user) {

            showStatus(
                "No account session found. Please register or log in again.",
                "error"
            );

            checkButton.style.display =
                "none";

            resendButton.style.display =
                "none";

            return;
        }


        verificationEmail.textContent =
            user.email;


        /*
           Reload Firebase user so
           emailVerified is current.
        */

        await user.reload();


        if (user.emailVerified) {

            verificationComplete();

        } else {

            showStatus(
                "Waiting for email verification...",
                "success"
            );
        }
    }
);


/* ==========================================
   CHECK VERIFICATION
========================================== */

if (checkButton) {

    checkButton.addEventListener(
        "click",
        async () => {

            try {

                checkButton.disabled =
                    true;

                checkButton.textContent =
                    "Checking...";


                const user =
                    auth.currentUser;


                if (!user) {

                    showStatus(
                        "Your session has expired. Please log in again.",
                        "error"
                    );

                    return;
                }


                /*
                   Reload user from Firebase to get the latest emailverification Status. 
                */

                await user.reload();


                if (user.emailVerified) {

                    verificationComplete();

                } else {

                    showStatus(
                        "Your email is not verified yet. Please check your inbox and click the verification link. Check your spam folder if you don't see it.",
                        "error"
                    );
                }


            } catch (error) {

                console.error(
                    "Verification check error:",
                    error
                );

                showStatus(
                    "Unable to check verification status. Please try again.",
                    "error"
                );

            } finally {

                checkButton.disabled =
                    false;

                checkButton.textContent =
                    "I've Verified My Email";
            }
        }
    );
}


/* ==========================================
   RESEND VERIFICATION EMAIL
========================================== */

if (resendButton) {

    resendButton.addEventListener(
        "click",
        async () => {

            try {

                const user =
                    auth.currentUser;


                if (!user) {

                    showStatus(
                        "No account session found.",
                        "error"
                    );

                    return;
                }


                await user.reload();


                if (user.emailVerified) {

                    verificationComplete();

                    return;
                }


                resendButton.disabled =
                    true;

                resendButton.textContent =
                    "Sending...";


                await sendEmailVerification(
                    user
                );


                showStatus(
                    "Verification email sent again. Check your inbox. Check your spam folder if you don't see it.",
                    "success"
                );


            } catch (error) {

                console.error(
                    "Resend verification error:",
                    error
                );

                showStatus(
                    "Unable to send verification email. Please try again later.",
                    "error"
                );

            } finally {

                resendButton.disabled =
                    false;

                resendButton.textContent =
                    "Resend Verification Email";
            }
        }
    );
}