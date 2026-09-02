/* ==========================================
   PROJOYSTICK AUTHENTICATION
   Firebase Authentication + Email Verification
========================================== */

import {
    auth,
    db
} from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendEmailVerification,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    updatePassword,
    onAuthStateChanged,
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   ELEMENTS
========================================== */

const loginForm =
    document.getElementById("loginForm");

const registerForm =
    document.getElementById("registerForm");

const authMessage =
    document.getElementById("authMessage");

document
    .querySelectorAll(".show-password")
    .forEach(
        (button) => {

            button.addEventListener(
                "click",
                () => {

                    const input =
                        document.getElementById(
                            button.dataset.target
                        );

                    if (!input) {
                        return;
                    }

                    const isHidden =
                        input.type === "password";

                    input.type =
                        isHidden ? "text" : "password";

                    button.textContent =
                        isHidden ? "Hide" : "Show";
                }
            );
        }
    );


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
   FIREBASE ERROR HANDLER
========================================== */

function getAuthErrorMessage(error) {

    switch (error.code) {

        case "auth/email-already-in-use":
            return "An account with this email already exists.";

        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/weak-password":
            return "Password must be at least 8 characters.";

        case "auth/invalid-credential":
            return "Incorrect email or password.";

        case "auth/user-not-found":
            return "No account was found with this email.";

        case "auth/wrong-password":
            return "Incorrect email or password.";

        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";

        case "auth/popup-closed-by-user":
            return "Google sign-in was cancelled.";

        case "auth/network-request-failed":
            return "Network error. Please check your connection.";

        case "auth/requires-recent-login":
            return "Please log in again and try this action.";

        default:

            console.error(
                "Firebase Auth Error:",
                error
            );

            return "Something went wrong. Please try again.";
    }
}


/* ==========================================
   PASSWORD VALIDATION

   Requirements:
   - Minimum 8 characters
   - 1 letter
   - 1 number
   - 1 special character
========================================== */

function isValidPassword(password) {

    const passwordRegex =
        /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    return passwordRegex.test(password);
}


/* ==========================================
   CREATE USER PROFILE
========================================== */

async function createUserProfile(
    user,
    username = ""
) {

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );

    const existingUser =
        await getDoc(userRef);

    /*
       Don't overwrite an existing
       user profile.
    */

    if (existingUser.exists()) {
        return;
    }

    await setDoc(
        userRef,
        {
            uid: user.uid,

            username:
                username ||
                user.displayName ||
                "Gamer",

            email:
                user.email,

            role:
                "user",

            createdAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp()
        }
    );
}


/* ==========================================
   REGISTER
========================================== */

if (registerForm) {

    registerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            /* ----------------------------------
               GET FORM VALUES
            ---------------------------------- */

            const usernameInput =
                document.getElementById(
                    "username"
                );

            const emailInput =
                document.getElementById(
                    "email"
                );

            const passwordInput =
                document.getElementById(
                    "password"
                );

            const confirmPasswordInput =
                document.getElementById(
                    "confirmPassword"
                );

            const button =
                document.getElementById(
                    "registerButton"
                );


            const username =
                usernameInput.value.trim();

            const email =
                emailInput.value.trim();

            const password =
                passwordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;


            /* ----------------------------------
               USERNAME VALIDATION
            ---------------------------------- */

            if (username.length < 3) {

                showMessage(
                    "Username must contain at least 3 characters."
                );

                return;
            }


            /* ----------------------------------
               PASSWORD VALIDATION
            ---------------------------------- */

            if (!isValidPassword(password)) {

                showMessage(
                    "Password must be at least 8 characters and contain at least one letter, one number, and one special character."
                );

                return;
            }


            /* ----------------------------------
               CONFIRM PASSWORD
            ---------------------------------- */

            if (
                password !==
                confirmPassword
            ) {

                showMessage(
                    "Passwords do not match."
                );

                return;
            }


            /* ----------------------------------
               CREATE ACCOUNT
            ---------------------------------- */

            try {

                button.disabled =
                    true;

                button.textContent =
                    "Creating account...";


                const userCredential =
                    await createUserWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    userCredential.user;


                /* ----------------------------------
                   UPDATE DISPLAY NAME
                ---------------------------------- */

                await updateProfile(
                    user,
                    {
                        displayName:
                            username
                    }
                );


                /* ----------------------------------
                   CREATE FIRESTORE PROFILE
                ---------------------------------- */

                await createUserProfile(
                    user,
                    username
                );


                /* ----------------------------------
                   SEND EMAIL VERIFICATION
                ---------------------------------- */

                await sendEmailVerification(
                    user
                );


                /*
                   Registration is complete,
                   but the email is NOT verified yet.
                */

                showMessage(
                    "Account created! Verification email sent.",
                    "success"
                );


                /*
                   Give Firebase a moment,
                   then open verification page.
                */

                setTimeout(() => {

                    window.location.href =
                        "email-verification.html";

                }, 800);


            } catch (error) {

                console.error(
                    "Registration error:",
                    error
                );

                showMessage(
                    getAuthErrorMessage(error)
                );

                button.disabled =
                    false;

                button.textContent =
                    "Create Account";
            }
        }
    );
}


/* ==========================================
   LOGIN
========================================== */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            /* ----------------------------------
               GET FORM VALUES
            ---------------------------------- */

            const emailInput =
                document.getElementById(
                    "email"
                );

            const passwordInput =
                document.getElementById(
                    "password"
                );

            const button =
                document.getElementById(
                    "loginButton"
                );


            const email =
                emailInput.value.trim();

            const password =
                passwordInput.value;


            /* ----------------------------------
               LOGIN
            ---------------------------------- */

            try {

                button.disabled =
                    true;

                button.textContent =
                    "Logging in...";


                const userCredential =
                    await signInWithEmailAndPassword(
                        auth,
                        email,
                        password
                    );


                const user =
                    userCredential.user;


                /* ----------------------------------
                   CHECK EMAIL VERIFICATION
                ---------------------------------- */

                await user.reload();


                if (!user.emailVerified) {

                    showMessage(
                        "Please verify your email before logging in."
                    );


                    /*
                       Keep the user signed in temporarily
                       so the verification page can check
                       the account.
                    */

                    setTimeout(() => {

                        window.location.href =
                            "email-verification.html";

                    }, 1000);

                    return;
                }


                /* ----------------------------------
                   MAKE SURE PROFILE EXISTS
                ---------------------------------- */

                await createUserProfile(
                    user
                );


                /* ----------------------------------
                   SUCCESS
                ---------------------------------- */

                showMessage(
                    "Login successful. Redirecting...",
                    "success"
                );


                setTimeout(() => {

                    window.location.href =
                        "../index.html";

                }, 700);


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );

                showMessage(
                    getAuthErrorMessage(error)
                );

                button.disabled =
                    false;

                button.textContent =
                    "Login";
            }
        }
    );
}


/* ==========================================
   GOOGLE AUTHENTICATION
========================================== */

const googleProvider =
    new GoogleAuthProvider();


async function loginWithGoogle() {

    try {

        const result =
            await signInWithPopup(
                auth,
                googleProvider
            );


        const user =
            result.user;


        /*
           Google accounts are already
           considered email verified.
        */

        await createUserProfile(
            user
        );


        showMessage(
            "Google login successful. Redirecting...",
            "success"
        );


        setTimeout(() => {

            window.location.href =
                "../index.html";

        }, 700);


    } catch (error) {

        console.error(
            "Google authentication error:",
            error
        );

        showMessage(
            getAuthErrorMessage(error)
        );
    }
}


/* ==========================================
   GOOGLE LOGIN BUTTON
========================================== */

const googleLogin =
    document.getElementById(
        "googleLogin"
    );


if (googleLogin) {

    googleLogin.addEventListener(
        "click",
        loginWithGoogle
    );
}


/* ==========================================
   GOOGLE REGISTER BUTTON
========================================== */

const googleRegister =
    document.getElementById(
        "googleRegister"
    );


if (googleRegister) {

    googleRegister.addEventListener(
        "click",
        loginWithGoogle
    );
}


/* ==========================================
   FORGOT PASSWORD
========================================== */

const forgotPassword =
    document.getElementById(
        "forgotPassword"
    );

if (forgotPassword) {

    forgotPassword.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            /*
                Open the password verification page.

                The user will enter their email
                on that page.
            */

            window.location.href =
                "password-verification.html";

        }
    );

}


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(
    auth,
    async (user) => {

        if (user) {

            console.log(
                "PROJOYSTICK user:",
                user.email
            );

            console.log(
                "Email verified:",
                user.emailVerified
            );

        } else {

            console.log(
                "No PROJOYSTICK user logged in."
            );
        }
    }
);


/* ==========================================
   GLOBAL LOGOUT
========================================== */

window.gameVaultLogout =
    async function () {

        try {

            await signOut(
                auth
            );


            window.location.href =
                "../index.html";


        } catch (error) {

            console.error(
                "Logout error:",
                error
            );
        }
    };