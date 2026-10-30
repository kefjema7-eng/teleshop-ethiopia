// =====================================================
// TELESHOP - DASHBOARD
// =====================================================

// =====================================================
// CONFIGURATION
// =====================================================

const API_URL = "http://localhost:3000";
let dashboardCurrentUser = null;


// =====================================================
// GET AUTH TOKEN
// =====================================================

function getDashboardToken() {
    return localStorage.getItem("teleshopToken");
}


// =====================================================
// AUTHENTICATED FETCH
// =====================================================

async function dashboardFetch(endpoint, options = {}) {
    const token = getDashboardToken();

    if (!token) {
        window.location.href = "login.html";
        return null;
    }

    const response = await fetch(API_URL + endpoint, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
            ...(options.headers || {})
        }
    });

    return response;
}


// =====================================================
// INITIALIZE DASHBOARD
// =====================================================

async function initializeDashboard() {
    const token = getDashboardToken();

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    try {
        const userResponse = await dashboardFetch("/api/auth/me");

        if (!userResponse) return;

        const userData = await userResponse.json();

        // Invalid or expired authentication token
        if (
            userResponse.status === 401 ||
            userResponse.status === 403
        ) {
            localStorage.removeItem("teleshopToken");
            localStorage.removeItem("teleshopUser");

            window.location.href = "login.html";
            return;
        }

        if (
            !userResponse.ok ||
            !userData.success ||
            !userData.user
        ) {
            throw new Error(
                userData.message ||
                "Could not load your account. Check that the backend is running."
            );
        }

        const user = userData.user;
        if (user.role === "customer") {
            window.location.replace("customer-orders.html");
            return;
        }
        if (user.role === "admin") {
            window.location.replace("admin.html");
            return;
        }
        dashboardCurrentUser = user;

        // Display seller information
        const dashboardUserName =
            document.getElementById("dashboardUserName");

        const welcomeUserName =
            document.getElementById("welcomeUserName");

        const accountName =
            document.getElementById("accountName");

        const accountEmail =
            document.getElementById("accountEmail");

        if (dashboardUserName) {
            dashboardUserName.textContent = user.name || "Seller";
        }

        if (welcomeUserName) {
            welcomeUserName.textContent = user.name || "Seller";
        }

        if (accountName) {
            accountName.textContent = user.name || "Seller";
        }

        if (accountEmail) {
            accountEmail.textContent =
                user.email || "Email unavailable";
        }

        // Load dashboard information
        await loadDashboardProducts();
        await loadDashboardStats();

    } catch (error) {
        console.error("Dashboard initialization error:", error);

        // Do not redirect to login for ordinary server/network errors.
        const welcomeName =
            document.getElementById("welcomeUserName");

        const accountName =
            document.getElementById("accountName");

        const accountEmail =
            document.getElementById("accountEmail");

        if (
            welcomeName &&
            welcomeName.textContent.trim() === "Seller"
        ) {
            welcomeName.textContent = "Unable to load";
        }

        if (
            accountName &&
            accountName.textContent.trim() === "Loading..."
        ) {
            accountName.textContent = "Unable to load";
        }

        if (
            accountEmail &&
            accountEmail.textContent.trim() === "Loading..."
        ) {
            accountEmail.textContent = "Check backend connection";
        }
    }
}


// =====================================================
// LOAD PRODUCTS
// =====================================================

async function loadDashboardProducts() {
    const recentProducts =
        document.getElementById("recentProducts");

    try {
        const response = await dashboardFetch("/api/products");

        if (!response) return;

        const data = await response.json();

        if (
            response.status === 401 ||
            response.status === 403
        ) {
            localStorage.removeItem("teleshopToken");
            localStorage.removeItem("teleshopUser");

            window.location.href = "login.html";
            return;
        }

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Could not load products."
            );
        }

        const products = Array.isArray(data.products)
            ? data.products
            : [];

        const totalProducts =
            document.getElementById("totalProducts");

        if (totalProducts) {
            totalProducts.textContent = products.length;
        }

        displayRecentProducts(products);

    } catch (error) {
        console.error("Load products error:", error);

        if (recentProducts) {
            recentProducts.innerHTML = `
                <div class="dashboard-empty">
                    <div class="empty-icon">⚠️</div>
                    <h3>Could not load products</h3>
                    <p>
                        Make sure the TeleShop backend is running.
                    </p>
                </div>
            `;
        }
    }
}


// =====================================================
// DISPLAY RECENT PRODUCTS
// =====================================================

function displayRecentProducts(products) {
    const container =
        document.getElementById("recentProducts");

    if (!container) return;

    if (!products.length) {
        container.innerHTML = `
            <div class="dashboard-empty">
                <div class="empty-icon">📦</div>
                <h3>No products yet</h3>
                <p>
                    Add your first product to start building your store.
                </p>
                <a
                    href="products.html"
                    class="dashboard-primary-btn"
                >
                    Add Product
                </a>
            </div>
        `;

        return;
    }

    const recent = products.slice(0, 5);

    container.innerHTML = recent.map(product => {
        const price = Number(product.price || 0).toLocaleString();
        const stock = Number(product.stock || 0);

        const imageHTML = product.image
            ? `
                <img
                    src="${escapeHTML(product.image)}"
                    alt="${escapeHTML(product.name || "Product")}"
                >
            `
            : `
                <div class="product-placeholder">📦</div>
            `;

        return `
            <div class="recent-product">
                <div class="recent-product-image">
                    ${imageHTML}
                </div>

                <div class="recent-product-info">
                    <h3>${escapeHTML(product.name || "Unnamed product")}</h3>
                    <p>
                        ${escapeHTML(
                            product.category || "Uncategorized"
                        )}
                    </p>
                </div>

                <div class="recent-product-price">
                    <strong>${price} ETB</strong>
                    <span>${stock} in stock</span>
                </div>
            </div>
        `;
    }).join("");
}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================================
// LOGOUT
// =====================================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
        localStorage.removeItem("teleshopToken");
        localStorage.removeItem("teleshopUser");

        window.location.href = "login.html";
    });
}


// =====================================================
// DASHBOARD SECTIONS
// ORDERS, STORE, CUSTOMERS, ANALYTICS, TELEGRAM
// =====================================================

const dashboardContainer =
    document.querySelector(".dashboard-main .container");

const originalOverviewHTML = dashboardContainer
    ? dashboardContainer.innerHTML
    : "";


// =====================================================
// CURRENCY FORMAT
// =====================================================

function dashboardMoney(value) {
    return `ETB ${Number(value || 0).toLocaleString("en-ET", {
        maximumFractionDigits: 2
    })}`;
}


// =====================================================
// API JSON HELPER
// =====================================================

async function dashboardJSON(path, options = {}) {
    const response = await dashboardFetch(path, options);

    if (!response) {
        throw new Error(
            "Your session is missing. Please sign in again."
        );
    }

    const data = await response.json().catch(() => ({}));

    if (
        response.status === 401 ||
        response.status === 403
    ) {
        localStorage.removeItem("teleshopToken");
        localStorage.removeItem("teleshopUser");

        window.location.href = "login.html";

        throw new Error(
            "Your session has expired. Please sign in again."
        );
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message || `Request failed (${response.status}).`
        );
    }

    return data;
}


// =====================================================
// DASHBOARD NOTIFICATIONS
// =====================================================

function dashboardNotice(message, type = "info") {
    const el = document.getElementById("dashboardNotice");

    if (!el) return;

    el.textContent = message;
    el.className = `dashboard-notice ${type}`;
    el.style.display = "block";
}


// =====================================================
// EXTRA DASHBOARD STYLES
// =====================================================

function ensureDashboardStyles() {
    if (document.getElementById("dashboardExtraStyles")) return;

    const style = document.createElement("style");
    style.id = "dashboardExtraStyles";

    style.textContent = `
        .dashboard-extra {
            color: #f4f6f4;
        }

        .dashboard-extra .extra-head {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 18px;
            flex-wrap: wrap;
            margin-bottom: 24px;
        }

        .dashboard-extra h1 {
            font-size: clamp(26px, 4vw, 36px);
            margin: 0 0 8px;
        }

        .dashboard-extra .muted {
            color: #84938c;
            line-height: 1.6;
        }

        .dashboard-extra .extra-panel {
            background: #101b17;
            border: 1px solid rgba(255,255,255,.09);
            border-radius: 16px;
            padding: 22px;
            margin: 18px 0;
        }

        .dashboard-extra .extra-form {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
        }

        .dashboard-extra label {
            display: flex;
            flex-direction: column;
            gap: 7px;
            color: #b7c2bc;
            font-size: 13px;
        }

        .dashboard-extra input,
        .dashboard-extra textarea,
        .dashboard-extra select {
            width: 100%;
            padding: 12px 13px;
            border: 1px solid rgba(255,255,255,.13);
            border-radius: 9px;
            background: #0a1410;
            color: #fff;
            outline: none;
        }

        .dashboard-extra textarea {
            min-height: 90px;
            resize: vertical;
        }

        .dashboard-extra .span-2 {
            grid-column: 1 / -1;
        }

        .dashboard-extra .extra-btn {
            cursor: pointer;
            border: 0;
            border-radius: 9px;
            padding: 11px 16px;
            background: #d4a84f;
            color: #07120f;
            font-weight: 800;
        }

        .dashboard-extra .extra-btn.secondary {
            background: #20342b;
            color: #fff;
            border: 1px solid rgba(255,255,255,.1);
        }

        .dashboard-extra .extra-table-wrap {
            overflow-x: auto;
        }

        .dashboard-extra table {
            width: 100%;
            border-collapse: collapse;
            min-width: 650px;
        }

        .dashboard-extra th,
        .dashboard-extra td {
            padding: 13px 11px;
            text-align: left;
            border-bottom: 1px solid rgba(255,255,255,.08);
            font-size: 13px;
            vertical-align: middle;
        }

        .dashboard-extra th {
            color: #8fa097;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: .07em;
        }

        .dashboard-extra .pill {
            display: inline-block;
            padding: 5px 8px;
            border-radius: 20px;
            background: #20342b;
            color: #d4e3d9;
            text-transform: capitalize;
            font-size: 11px;
        }

        .dashboard-extra .metric-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
        }

        .dashboard-extra .metric {
            background: #101b17;
            border: 1px solid rgba(255,255,255,.09);
            padding: 19px;
            border-radius: 14px;
        }

        .dashboard-extra .metric span {
            color: #84938c;
            font-size: 12px;
            display: block;
            margin-bottom: 10px;
        }

        .dashboard-extra .metric strong {
            font-size: 24px;
        }

        .dashboard-notice {
            display: none;
            margin: 14px 0;
            padding: 12px 14px;
            border-radius: 9px;
            background: #1d3328;
            color: #e5f3e9;
        }

        .dashboard-notice.error {
            background: #3a201d;
            color: #ffd8d3;
        }

        .dashboard-notice.success {
            background: #1d3328;
            color: #e5f3e9;
        }

        .dashboard-extra .empty-state {
            padding: 28px;
            text-align: center;
            color: #84938c;
        }

        @media (max-width: 700px) {
            .dashboard-extra .extra-form,
            .dashboard-extra .metric-grid {
                grid-template-columns: 1fr;
            }

            .dashboard-extra .span-2 {
                grid-column: auto;
            }

            .dashboard-extra .extra-panel {
                padding: 15px;
            }
        }
    `;

    document.head.appendChild(style);
}


// =====================================================
// EXTRA PAGE LAYOUT
// =====================================================

function extraPageShell(title, description, body) {
    ensureDashboardStyles();

    return `
        <div class="dashboard-extra">
            <div class="extra-head">
                <div>
                    <h1>${escapeHTML(title)}</h1>
                    <p class="muted">${escapeHTML(description)}</p>
                </div>
            </div>

            <div
                id="dashboardNotice"
                class="dashboard-notice"
                role="status"
                aria-live="polite"
            ></div>

            ${body}
        </div>
    `;
}


// =====================================================
// SIDEBAR LABEL HELPERS
// =====================================================

function getSidebarLabel(link) {
    const clone = link.cloneNode(true);

    clone.querySelectorAll(".side-icon").forEach(icon => {
        icon.remove();
    });

    return clone.textContent.trim().replace(/\s+/g, " ");
}


function activateSidebar(label) {
    document.querySelectorAll(".sidebar .side-link").forEach(link => {
        link.classList.toggle(
            "active",
            getSidebarLabel(link) === label
        );
    });
}


// =====================================================
// CHANGE DASHBOARD VIEW
// =====================================================

async function showDashboardView(view) {
    if (!dashboardContainer) return;

    const views = {
        orders: renderOrdersView,
        store: renderStoreView,
        customers: renderCustomersView,
        analytics: renderAnalyticsView,
        telegram: renderTelegramView
    };

    const titles = {
        orders: "Orders",
        store: "My Store",
        customers: "Customers",
        analytics: "Analytics",
        telegram: "Telegram"
    };

    if (view === "overview") {
        dashboardContainer.innerHTML = originalOverviewHTML;

        activateSidebar("Overview");

        if (dashboardCurrentUser) {
            [
                "dashboardUserName",
                "welcomeUserName",
                "accountName"
            ].forEach(id => {
                const el = document.getElementById(id);

                if (el) {
                    el.textContent =
                        dashboardCurrentUser.name || "Seller";
                }
            });

            const emailEl =
                document.getElementById("accountEmail");

            if (emailEl) {
                emailEl.textContent =
                    dashboardCurrentUser.email || "Email unavailable";
            }
        }

        await loadDashboardProducts();
        await loadDashboardStats();

        return;
    }

    if (!views[view]) return;

    activateSidebar(titles[view]);

    dashboardContainer.innerHTML = extraPageShell(
        titles[view],
        "Manage this part of your TeleShop business.",
        `
            <div class="extra-panel">
                <p class="muted">Loading...</p>
            </div>
        `
    );

    try {
        await views[view]();

    } catch (error) {
        console.error(`Dashboard ${view} error:`, error);

        dashboardContainer.innerHTML = extraPageShell(
            titles[view],
            "We couldn't load this section.",
            `
                <div class="extra-panel">
                    <p class="muted">${escapeHTML(error.message)}</p>

                    <button
                        class="extra-btn secondary"
                        data-retry-view="${view}"
                        type="button"
                    >
                        Try again
                    </button>
                </div>
            `
        );
    }
}


// =====================================================
// ORDERS
// =====================================================

async function renderOrdersView() {
    const data = await dashboardJSON("/api/orders");

    const orders = Array.isArray(data.orders)
        ? data.orders
        : [];

    const rows = orders.map(order => `
        <tr>
            <td>
                <strong>
                    ${escapeHTML(order.customerName || "Customer")}
                </strong>
                <br>
                <span class="muted">
                    ${escapeHTML(
                        order.customerEmail || "No email provided"
                    )}
                </span>
            </td>

            <td>${dashboardMoney(order.total)}</td>

            <td>
                <span class="pill">
                    ${escapeHTML(order.status || "pending")}
                </span>
            </td>

            <td>
                ${
                    order.createdAt
                        ? new Date(order.createdAt).toLocaleDateString()
                        : "—"
                }
            </td>

            <td>
                <select
                    aria-label="Update order status"
                    data-order-status="${escapeHTML(order._id || "")}"
                >
                    ${
                        [
                            "pending",
                            "processing",
                            "shipped",
                            "completed",
                            "cancelled"
                        ].map(status => `
                            <option
                                value="${status}"
                                ${order.status === status ? "selected" : ""}
                            >
                                ${status}
                            </option>
                        `).join("")
                    }
                </select>
            </td>
        </tr>
    `).join("");

    dashboardContainer.innerHTML = extraPageShell(
        "Orders",
        "Create and track orders recorded for your store.",
        `
            <div class="extra-panel">
                <h2 style="margin-bottom:16px">Record an order</h2>

                <form id="newOrderForm" class="extra-form">
                    <label>
                        Customer name *
                        <input
                            name="customerName"
                            required
                            maxlength="120"
                        >
                    </label>

                    <label>
                        Customer email
                        <input
                            name="customerEmail"
                            type="email"
                            maxlength="180"
                        >
                    </label>

                    <label>
                        Customer phone
                        <input
                            name="customerPhone"
                            maxlength="40"
                        >
                    </label>

                    <label>
                        Total (ETB) *
                        <input
                            name="total"
                            type="number"
                            min="0"
                            step="0.01"
                            required
                        >
                    </label>

                    <label>
                        Initial status
                        <select name="status">
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </label>

                    <label>
                        Notes
                        <input
                            name="notes"
                            maxlength="500"
                            placeholder="Optional details"
                        >
                    </label>

                    <div class="span-2">
                        <button class="extra-btn" type="submit">
                            ＋ Save order
                        </button>
                    </div>
                </form>
            </div>

            <div class="extra-panel">
                <h2 style="margin-bottom:14px">
                    All orders (${orders.length})
                </h2>

                ${
                    orders.length
                        ? `
                            <div class="extra-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Customer</th>
                                            <th>Total</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                            <th>Update status</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>
                        `
                        : `
                            <div class="empty-state">
                                No orders yet. Record your first order above.
                            </div>
                        `
                }
            </div>
        `
    );

    const newOrderForm =
        document.getElementById("newOrderForm");

    if (newOrderForm) {
        newOrderForm.addEventListener("submit", async event => {
            event.preventDefault();

            const form = event.currentTarget;

            const body = Object.fromEntries(
                new FormData(form).entries()
            );

            body.total = Number(body.total);

            try {
                await dashboardJSON("/api/orders", {
                    method: "POST",
                    body: JSON.stringify(body)
                });

                await renderOrdersView();

                dashboardNotice(
                    "Order saved successfully.",
                    "success"
                );

            } catch (error) {
                dashboardNotice(error.message, "error");
            }
        });
    }

    dashboardContainer
        .querySelectorAll("[data-order-status]")
        .forEach(select => {
            select.addEventListener("change", async () => {
                try {
                    await dashboardJSON(
                        `/api/orders/${encodeURIComponent(
                            select.dataset.orderStatus
                        )}/status`,
                        {
                            method: "PATCH",
                            body: JSON.stringify({
                                status: select.value
                            })
                        }
                    );

                    await renderOrdersView();

                    dashboardNotice(
                        "Order status updated.",
                        "success"
                    );

                } catch (error) {
                    dashboardNotice(error.message, "error");
                }
            });
        });
}


// =====================================================
// MY STORE
// =====================================================

async function renderStoreView() {
    const data = await dashboardJSON("/api/store");
    const store = data.store || {};

    dashboardContainer.innerHTML = extraPageShell(
        "My Store",
        "Edit the store information associated with your seller account.",
        `
            <div class="extra-panel">
                <form id="storeProfileForm" class="extra-form">
                    <label>
                        Store name *
                        <input
                            name="storeName"
                            required
                            maxlength="100"
                            value="${escapeHTML(store.storeName || "")}"
                        >
                    </label>

                    <label>
                        Contact phone
                        <input
                            name="storePhone"
                            maxlength="40"
                            value="${escapeHTML(store.storePhone || "")}"
                        >
                    </label>

                    <label>
                        Store address
                        <input
                            name="storeAddress"
                            maxlength="200"
                            value="${escapeHTML(store.storeAddress || "")}"
                        >
                    </label>

                    <label>
                        Telegram username
                        <input
                            name="telegramUsername"
                            maxlength="64"
                            placeholder="@yourusername"
                            value="${escapeHTML(
                                store.telegramUsername || ""
                            )}"
                        >
                    </label>

                    <label class="span-2">
                        Store description
                        <textarea
                            name="storeDescription"
                            maxlength="1000"
                            placeholder="Tell customers about your business"
                        >${escapeHTML(store.storeDescription || "")}</textarea>
                    </label>

                    <div class="span-2">
                        <button class="extra-btn" type="submit">
                            Save store details
                        </button>
                    </div>
                </form>
            </div>

            <div class="extra-panel">
                <h3>Store status</h3>

                <p class="muted" style="margin-top:8px">
                    Your store profile is saved to your seller account.
                    Public storefront publishing and custom store URLs
                    are not yet configured.
                </p>
            </div>
        `
    );

    // IMPORTANT: The listener is attached only after the form exists.
    const storeProfileForm =
        document.getElementById("storeProfileForm");

    if (storeProfileForm) {
        storeProfileForm.addEventListener("submit", async event => {
            event.preventDefault();

            const body = Object.fromEntries(
                new FormData(event.currentTarget).entries()
            );

            try {
                await dashboardJSON("/api/store", {
                    method: "PUT",
                    body: JSON.stringify(body)
                });

                dashboardNotice(
                    "Store details saved.",
                    "success"
                );

            } catch (error) {
                dashboardNotice(error.message, "error");
            }
        });
    }
}


// =====================================================
// CUSTOMERS
// =====================================================

async function renderCustomersView() {
    const data = await dashboardJSON("/api/customers");

    const customers = Array.isArray(data.customers)
        ? data.customers
        : [];

    const rows = customers.map(customer => `
        <tr>
            <td>
                <strong>
                    ${escapeHTML(customer.customerName || "Customer")}
                </strong>
            </td>

            <td>${escapeHTML(customer.customerEmail || "—")}</td>

            <td>${escapeHTML(customer.customerPhone || "—")}</td>

            <td>${Number(customer.orderCount || 0)}</td>

            <td>${dashboardMoney(customer.totalSpent)}</td>

            <td>
                ${
                    customer.lastOrderAt
                        ? new Date(
                            customer.lastOrderAt
                        ).toLocaleDateString()
                        : "—"
                }
            </td>
        </tr>
    `).join("");

    dashboardContainer.innerHTML = extraPageShell(
        "Customers",
        "Customers are collected from the orders you record.",
        `
            <div class="extra-panel">
                <h2 style="margin-bottom:14px">
                    Customer list (${customers.length})
                </h2>

                ${
                    customers.length
                        ? `
                            <div class="extra-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Phone</th>
                                            <th>Orders</th>
                                            <th>Total spent</th>
                                            <th>Last order</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>
                        `
                        : `
                            <div class="empty-state">
                                No customers yet. Add orders with customer
                                details to build this list.
                            </div>
                        `
                }
            </div>
        `
    );
}


// =====================================================
// ANALYTICS
// =====================================================

async function renderAnalyticsView() {
    const data = await dashboardJSON("/api/analytics");

    const analytics = data.analytics || {};

    const monthly = Array.isArray(analytics.monthly)
        ? analytics.monthly
        : [];

    const rows = monthly.map(month => `
        <tr>
            <td>${escapeHTML(month.month || "—")}</td>
            <td>${Number(month.orders || 0)}</td>
            <td>${dashboardMoney(month.revenue)}</td>
        </tr>
    `).join("");

    dashboardContainer.innerHTML = extraPageShell(
        "Analytics",
        "A summary calculated from your real product and order records.",
        `
            <div class="metric-grid">
                <div class="metric">
                    <span>Products listed</span>
                    <strong>${Number(analytics.totalProducts || 0)}</strong>
                </div>

                <div class="metric">
                    <span>Units in stock</span>
                    <strong>${Number(analytics.totalStock || 0)}</strong>
                </div>

                <div class="metric">
                    <span>Catalogue stock value</span>
                    <strong>${dashboardMoney(analytics.catalogueValue)}</strong>
                </div>

                <div class="metric">
                    <span>Total orders</span>
                    <strong>${Number(analytics.totalOrders || 0)}</strong>
                </div>

                <div class="metric">
                    <span>Completed orders</span>
                    <strong>${Number(analytics.completedOrders || 0)}</strong>
                </div>

                <div class="metric">
                    <span>Completed-order revenue</span>
                    <strong>${dashboardMoney(analytics.revenue)}</strong>
                </div>
            </div>

            <div class="extra-panel">
                <h2 style="margin-bottom:14px">
                    Monthly order activity
                </h2>

                ${
                    monthly.length
                        ? `
                            <div class="extra-table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Non-cancelled orders</th>
                                            <th>Completed revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>
                        `
                        : `
                            <div class="empty-state">
                                No order history yet. Analytics will fill
                                in when you record orders.
                            </div>
                        `
                }

                <p class="muted" style="margin-top:14px">
                    Revenue counts completed orders only.
                    Catalogue stock value is price × current stock;
                    it is not sales revenue.
                </p>
            </div>
        `
    );
}


// =====================================================
// TELEGRAM
// =====================================================

async function renderTelegramView() {
    const data = await dashboardJSON("/api/telegram/status");

    const telegram = data.telegram || {};

    dashboardContainer.innerHTML = extraPageShell(
        "Telegram Commerce",
        "Prepare a Telegram presence for your TeleShop store.",
        `
            <div class="extra-panel">
                <h2 style="margin-bottom:12px">Connection status</h2>

                <p style="margin-bottom:10px">
                    <span class="pill">
                        ${
                            telegram.botConfigured
                                ? "Bot token configured"
                                : "Bot not configured"
                        }
                    </span>
                </p>

                <p class="muted">
                    ${escapeHTML(
                        telegram.note ||
                        "Telegram status information is unavailable."
                    )}
                </p>

                <form
                    id="telegramProfileForm"
                    style="margin-top:20px;max-width:520px"
                >
                    <label>
                        Telegram username
                        <input
                            name="telegramUsername"
                            maxlength="64"
                            placeholder="@yourstore"
                            value="${escapeHTML(
                                telegram.username || ""
                            )}"
                        >
                    </label>

                    <button
                        class="extra-btn"
                        style="margin-top:14px"
                        type="submit"
                    >
                        Save Telegram username
                    </button>
                </form>
            </div>

            <div class="extra-panel">
                <h3>How to enable the bot</h3>

                <ol
                    class="muted"
                    style="padding-left:20px;line-height:2;margin-top:10px"
                >
                    <li>
                        Open Telegram and message
                        <strong>@BotFather</strong>.
                    </li>

                    <li>Create a bot and copy its token.</li>

                    <li>
                        Add
                        <code>TELEGRAM_BOT_TOKEN=your_token_here</code>
                        to <code>backend/.env</code>.
                        Never put the token in frontend JavaScript
                        or share it publicly.
                    </li>

                    <li>
                        Restart the backend. A bot token alone does
                        not complete bot commands, webhooks, payments,
                        or order notifications. Those require further
                        bot integration.
                    </li>
                </ol>
            </div>
        `
    );

    const telegramProfileForm =
        document.getElementById("telegramProfileForm");

    if (telegramProfileForm) {
        telegramProfileForm.addEventListener("submit", async event => {
            event.preventDefault();

            try {
                const existing = await dashboardJSON("/api/store");

                const store = existing.store || {};

                store.telegramUsername = new FormData(
                    event.currentTarget
                ).get("telegramUsername");

                await dashboardJSON("/api/store", {
                    method: "PUT",
                    body: JSON.stringify(store)
                });

                dashboardNotice(
                    "Telegram username saved.",
                    "success"
                );

            } catch (error) {
                dashboardNotice(error.message, "error");
            }
        });
    }
}


// =====================================================
// DASHBOARD STATISTICS
// =====================================================

async function loadDashboardStats() {
    try {
        const statsData =
            await dashboardJSON("/api/dashboard/stats");

        const stats = statsData.stats || {};

        const productsEl =
            document.getElementById("totalProducts");

        if (productsEl) {
            productsEl.textContent = stats.totalProducts ?? 0;
        }

        const analyticsData =
            await dashboardJSON("/api/analytics");

        const analytics = analyticsData.analytics || {};

        const ordersEl =
            document.getElementById("totalOrders");

        const revenueEl =
            document.getElementById("totalRevenue");

        if (ordersEl) {
            ordersEl.textContent = analytics.totalOrders ?? 0;
        }

        if (revenueEl) {
            revenueEl.textContent =
                dashboardMoney(analytics.revenue);
        }

    } catch (error) {
        console.warn(
            "Dashboard statistics unavailable:",
            error.message
        );
    }
}


// =====================================================
// SIDEBAR NAVIGATION
// =====================================================

function installDashboardNavigation() {
    const viewMap = {
        "Orders": "orders",
        "My Store": "store",
        "Customers": "customers",
        "Analytics": "analytics",
        "Telegram": "telegram"
    };

    document.querySelectorAll(".sidebar .side-link").forEach(link => {
        const label = getSidebarLabel(link);

        if (viewMap[label]) {
            link.href = `#${viewMap[label]}`;

            link.addEventListener("click", event => {
                event.preventDefault();
                showDashboardView(viewMap[label]);
            });
        }

        if (label === "Overview") {
            link.addEventListener("click", event => {
                event.preventDefault();
                showDashboardView("overview");
            });
        }
    });

    // Retry buttons for sections that fail to load.
    document.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element)) return;

        const retry = target.closest("[data-retry-view]");

        if (retry) {
            showDashboardView(retry.dataset.retryView);
        }
    });
}


// =====================================================
// START DASHBOARD
// =====================================================

installDashboardNavigation();
initializeDashboard();