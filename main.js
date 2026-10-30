// =========================================================
// TELESHOP ETHIOPIA — MAIN JAVASCRIPT
// AUTHENTICATION
// =========================================================

const API_URL = window.TELESHOP_API_URL || "http://localhost:3000";
const TOKEN_KEY = "teleshopToken";
const USER_KEY = "teleshopUser";


// =========================================================
// STORAGE HELPERS
// =========================================================

function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function saveAuthToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function saveUser(user) {
    if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
}

function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
}


// =========================================================
// REGISTER
// =========================================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const nameInput =
            document.getElementById("name");

        const emailInput =
            document.getElementById("email");

        const passwordInput =
            document.getElementById("password");

        const confirmPasswordInput =
            document.getElementById("confirmPassword");


        if (
            !nameInput ||
            !emailInput ||
            !passwordInput ||
            !confirmPasswordInput
        ) {
            console.error("Registration fields are missing.");

            alert(
                "Something is wrong with the registration form."
            );

            return;
        }


        const name =
            nameInput.value.trim();

        const email =
            emailInput.value.trim().toLowerCase();

        const password =
            passwordInput.value;

        const confirmPassword =
            confirmPasswordInput.value;


        // =====================================================
        // VALIDATION
        // =====================================================

        if (!name) {
            alert("Please enter your name.");
            nameInput.focus();
            return;
        }


        if (!email) {
            alert("Please enter your email.");
            emailInput.focus();
            return;
        }


        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            alert("Please enter a valid email address.");
            emailInput.focus();
            return;
        }


        if (password.length < 8) {

            alert(
                "Password must be at least 8 characters long."
            );

            passwordInput.focus();

            return;
        }


        if (password !== confirmPassword) {

            alert(
                "Passwords do not match."
            );

            confirmPasswordInput.focus();

            return;
        }


        // =====================================================
        // BUTTON STATE
        // =====================================================

        const submitButton =
            registerForm.querySelector(
                'button[type="submit"]'
            );

        const originalButtonText =
            submitButton
                ? submitButton.textContent
                : "";


        if (submitButton) {

            submitButton.disabled = true;

            submitButton.textContent =
                "Creating account...";
        }


        // =====================================================
        // REQUEST
        // =====================================================

        try {

            const response =
                await fetch(
                    `${API_URL}/api/auth/register`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                name,
                                email,
                                password,
                                role: document.getElementById("accountRole")?.value || "customer"
                            })
                    }
                );


            let data = {};

            try {
                data = await response.json();
            } catch {
                data = {};
            }


            if (!response.ok) {

                console.error(
                    "Registration failed:",
                    data
                );

                alert(
                    data.message ||
                    data.error ||
                    "Registration failed."
                );

                return;
            }


            alert(
                data.message ||
                "Account created successfully!"
            );


            window.location.href =
                "login.html";


        } catch (error) {

            console.error(
                "Registration error:",
                error
            );


            alert(
                "Could not connect to the TeleShop server.\n\n" +
                "Make sure the backend is running on port 3000."
            );


        } finally {

            if (submitButton) {

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    originalButtonText;
            }
        }
    });
}


// =========================================================
// LOGIN
// =========================================================

const loginForm =
    document.getElementById("loginForm");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const emailInput =
                document.getElementById(
                    "loginEmail"
                );

            const passwordInput =
                document.getElementById(
                    "loginPassword"
                );


            if (
                !emailInput ||
                !passwordInput
            ) {

                console.error(
                    "Login fields are missing."
                );

                alert(
                    "Something is wrong with the login form."
                );

                return;
            }


            const email =
                emailInput.value
                    .trim()
                    .toLowerCase();

            const password =
                passwordInput.value;


            // =================================================
            // VALIDATION
            // =================================================

            if (!email) {

                alert(
                    "Please enter your email."
                );

                emailInput.focus();

                return;
            }


            if (!password) {

                alert(
                    "Please enter your password."
                );

                passwordInput.focus();

                return;
            }


            // =================================================
            // BUTTON STATE
            // =================================================

            const submitButton =
                loginForm.querySelector(
                    'button[type="submit"]'
                );


            const originalButtonText =
                submitButton
                    ? submitButton.textContent
                    : "";


            if (submitButton) {

                submitButton.disabled =
                    true;

                submitButton.textContent =
                    "Signing in...";
            }


            // =================================================
            // LOGIN REQUEST
            // =================================================

            try {

                const response =
                    await fetch(
                        `${API_URL}/api/auth/login`,
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({
                                    email,
                                    password
                                })
                        }
                    );


                let data = {};

                try {

                    data =
                        await response.json();

                } catch {

                    data = {};
                }


                // =============================================
                // LOGIN FAILED
                // =============================================

                if (!response.ok) {

                    console.error(
                        "Login failed:",
                        data
                    );


                    alert(
                        data.message ||
                        data.error ||
                        "Invalid email or password."
                    );


                    return;
                }


                // =============================================
                // TOKEN CHECK
                // =============================================

                if (
                    !data.token ||
                    typeof data.token !== "string"
                ) {

                    console.error(
                        "Server returned no valid JWT:",
                        data
                    );


                    alert(
                        "Login succeeded, but no authentication token was returned."
                    );


                    return;
                }


                // =============================================
                // SAVE AUTHENTICATION
                // =============================================

                saveAuthToken(
                    data.token
                );


                if (data.user) {
                    saveUser(data.user);
                }


                console.log(
                    "TeleShop login successful."
                );


                // =============================================
                // DASHBOARD
                // =============================================

                const accountRole = data.user?.role || "seller";
                if (accountRole === "admin") {
                    window.location.href = "admin.html";
                } else if (accountRole === "customer") {
                    window.location.href = "customer-orders.html";
                } else {
                    window.location.href = "dashboard.html";
                }


            } catch (error) {

                console.error(
                    "Login error:",
                    error
                );


                alert(
                    "Unable to connect to the TeleShop server.\n\n" +
                    "Make sure the backend is running on:\n" +
                    "http://localhost:3000"
                );


            } finally {

                if (submitButton) {

                    submitButton.disabled =
                        false;

                    submitButton.textContent =
                        originalButtonText;
                }
            }
        }
    );
}


// =========================================================
// LOGOUT
// =========================================================

const logoutButtons =
    document.querySelectorAll(
        "#logoutBtn"
    );


logoutButtons.forEach(
    function (button) {

        button.addEventListener(
            "click",
            function () {

                clearAuth();

                window.location.href =
                    "login.html";
            }
        );
    }
);