/* ==========================================
   GAMEVAULT PROFILE
========================================== */

import {
    auth,
    db
} from "./firebase.js";


import {
    onAuthStateChanged,
    updateProfile,
    signOut
} from
"https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from
"https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* ==========================================
   ELEMENTS
========================================== */

const profileAvatar =
    document.getElementById("profileAvatar");

const profileUsername =
    document.getElementById("profileUsername");

const profileEmail =
    document.getElementById("profileEmail");

const profileRole =
    document.getElementById("profileRole");

const infoUsername =
    document.getElementById("infoUsername");

const infoEmail =
    document.getElementById("infoEmail");

const infoJoined =
    document.getElementById("infoJoined");

const infoRole =
    document.getElementById("infoRole");

const editProfileBtn =
    document.getElementById("editProfileBtn");

const profileModal =
    document.getElementById("profileModal");

const closeProfileModal =
    document.getElementById("closeProfileModal");

const profileForm =
    document.getElementById("profileForm");

const editUsername =
    document.getElementById("editUsername");

const saveProfileBtn =
    document.getElementById("saveProfileBtn");

const profileMessage =
    document.getElementById("profileMessage");

const profileLogout =
    document.getElementById("profileLogout");


/* ==========================================
   CURRENT USER
========================================== */

let currentUser = null;


/* ==========================================
   MESSAGE
========================================== */

function showProfileMessage(
    message,
    type = "error"
) {

    profileMessage.textContent =
        message;

    profileMessage.className =
        `profile-message ${type}`;

}


/* ==========================================
   LOAD PROFILE
========================================== */

async function loadProfile(user) {

    currentUser = user;


    try {

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const snapshot =
            await getDoc(userRef);


        let username =
            user.displayName ||
            user.email.split("@")[0];


        let role = "user";

        let createdAt = null;


        if (snapshot.exists()) {

            const data =
                snapshot.data();


            username =
                data.username ||
                username;


            role =
                data.role ||
                "user";


            createdAt =
                data.createdAt || null;

        }


        /* ==================================
           DISPLAY
        ================================== */

        const firstLetter =
            username
                .charAt(0)
                .toUpperCase();


        profileAvatar.textContent =
            firstLetter;


        profileUsername.textContent =
            username;


        profileEmail.textContent =
            user.email;


        profileRole.textContent =
            role.toUpperCase();


        infoUsername.textContent =
            username;


        infoEmail.textContent =
            user.email;


        infoRole.textContent =
            role === "admin"
                ? "Administrator"
                : "User";


        /* ==================================
           DATE
        ================================== */

        if (createdAt) {

            const date =
                createdAt.toDate();


            infoJoined.textContent =
                date.toLocaleDateString(
                    "en-US",
                    {
                        month: "short",
                        year: "numeric"
                    }
                );

        } else {

            infoJoined.textContent =
                "Recently";

        }


        /* ==================================
           EDIT FORM
        ================================== */

        editUsername.value =
            username;


    } catch (error) {

        console.error(
            "Profile loading error:",
            error
        );

        showProfileMessage(
            "Unable to load your profile."
        );

    }

}


/* ==========================================
   AUTH STATE
========================================== */

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            /*
             * User isn't logged in.
             * Send them to login.
             */

            window.location.href =
                "login.html";

            return;

        }


        await loadProfile(user);

    }
);


/* ==========================================
   OPEN MODAL
========================================== */

editProfileBtn.addEventListener(
    "click",
    () => {

        profileModal.classList.add(
            "active"
        );

        editUsername.focus();

    }
);


/* ==========================================
   CLOSE MODAL
========================================== */

closeProfileModal.addEventListener(
    "click",
    () => {

        profileModal.classList.remove(
            "active"
        );

    }
);


/* Close when clicking background */

profileModal.addEventListener(
    "click",
    (event) => {

        if (
            event.target ===
            profileModal
        ) {

            profileModal.classList.remove(
                "active"
            );

        }

    }
);


/* ==========================================
   SAVE PROFILE
========================================== */

profileForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        if (!currentUser) {
            return;
        }


        const username =
            editUsername.value.trim();


        if (username.length < 3) {

            showProfileMessage(
                "Username must contain at least 3 characters."
            );

            return;

        }


        try {

            saveProfileBtn.disabled =
                true;

            saveProfileBtn.textContent =
                "Saving...";


            /* ==================================
               UPDATE AUTH PROFILE
            ================================== */

            await updateProfile(
                currentUser,
                {
                    displayName: username
                }
            );


            /* ==================================
               UPDATE FIRESTORE
            ================================== */

            const userRef =
                doc(
                    db,
                    "users",
                    currentUser.uid
                );


            await updateDoc(
                userRef,
                {

                    username: username,

                    updatedAt:
                        serverTimestamp()

                }
            );


            /* ==================================
               UPDATE PAGE
            ================================== */

            profileUsername.textContent =
                username;


            infoUsername.textContent =
                username;


            profileAvatar.textContent =
                username
                    .charAt(0)
                    .toUpperCase();


            showProfileMessage(
                "Profile updated successfully.",
                "success"
            );


            setTimeout(() => {

                profileModal.classList.remove(
                    "active"
                );

                profileMessage.className =
                    "profile-message";

            }, 900);


        } catch (error) {

            console.error(
                "Profile update error:",
                error
            );


            showProfileMessage(
                "Unable to update your profile."
            );

        } finally {

            saveProfileBtn.disabled =
                false;

            saveProfileBtn.textContent =
                "Save Changes";

        }

    }
);


/* ==========================================
   LOGOUT
========================================== */

profileLogout.addEventListener(
    "click",
    async () => {

        try {

            profileLogout.disabled =
                true;

            profileLogout.innerHTML =
                "<span>↪</span> Logging out...";


            await signOut(auth);


            window.location.href =
                "../index.html";


        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

            profileLogout.disabled =
                false;

            profileLogout.innerHTML =
                "<span>↪</span> Logout";

        }

    }
);