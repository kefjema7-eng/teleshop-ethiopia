// =========================================================
// TELESHOP - PRODUCTS PAGE
// =========================================================

const API_URL = "http://localhost:3000";

let products = [];
let editingProductId = null;


// =========================================================
// ELEMENTS
// =========================================================

const productsGrid = document.getElementById("productsGrid");
const emptyProducts = document.getElementById("emptyProducts");
const productCount = document.getElementById("productCount");

const productModal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");

const modalTitle = document.getElementById("modalTitle");

const openAddProductBtn =
    document.getElementById("openAddProductBtn");

const emptyAddProductBtn =
    document.getElementById("emptyAddProductBtn");

const closeProductModal =
    document.getElementById("closeProductModal");

const cancelProductBtn =
    document.getElementById("cancelProductBtn");

const saveProductBtn =
    document.getElementById("saveProductBtn");

const logoutBtn =
    document.getElementById("logoutBtn");

const productName =
    document.getElementById("productName");

const productDescription =
    document.getElementById("productDescription");

const productPrice =
    document.getElementById("productPrice");

const productStock =
    document.getElementById("productStock");

const productCategory =
    document.getElementById("productCategory");

const productImage =
    document.getElementById("productImage");


// =========================================================
// TOKEN
// =========================================================

function getToken() {
    return localStorage.getItem("teleshopToken");
}


// =========================================================
// FETCH WITH TIMEOUT
// =========================================================

async function apiFetch(url, options = {}) {

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        10000
    );

    try {

        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        return response;

    } finally {

        clearTimeout(timeout);

    }

}


// =========================================================
// SAFE JSON
// =========================================================

async function getResponseData(response) {

    try {

        return await response.json();

    } catch {

        return {
            success: false,
            message: "Invalid response from server."
        };

    }

}


// =========================================================
// LOGOUT
// =========================================================

function logout() {

    localStorage.removeItem("teleshopToken");
    localStorage.removeItem("teleshopUser");

    window.location.href = "login.html";

}


// =========================================================
// AUTHENTICATE USER
// =========================================================

async function authenticateUser() {

    const token = getToken();

    if (!token) {

        logout();
        return false;

    }

    try {

        const response = await apiFetch(
            `${API_URL}/api/auth/me`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data =
            await getResponseData(response);

        if (
            !response.ok ||
            !data.success
        ) {

            logout();
            return false;

        }

        const usernameElement =
            document.getElementById("productsUserName");

        if (usernameElement) {

            usernameElement.textContent =
                data.user?.name ||
                "My Account";

        }

        return true;

    } catch (error) {

        console.error(
            "Authentication error:",
            error
        );

        if (
            error.name === "AbortError"
        ) {

            alert(
                "The backend took too long to respond. Make sure it is running."
            );

            return false;

        }

        logout();
        return false;

    }

}


// =========================================================
// LOAD PRODUCTS
// =========================================================

async function loadProducts() {

    if (!productsGrid) {
        return;
    }

    productsGrid.innerHTML = `
        <div class="dashboard-loading">
            <div class="loading-spinner"></div>
            <span>Loading your products...</span>
        </div>
    `;

    if (emptyProducts) {
        emptyProducts.style.display = "none";
    }

    try {

        const response = await apiFetch(
            `${API_URL}/api/products`,
            {
                headers: {
                    Authorization:
                        `Bearer ${getToken()}`
                }
            }
        );

        const data =
            await getResponseData(response);

        if (response.status === 401) {

            logout();
            return;

        }

        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Could not load products."
            );

        }

        products =
            Array.isArray(data.products)
                ? data.products
                : [];

        renderProducts();

    } catch (error) {

        console.error(
            "Load products error:",
            error
        );

        productsGrid.innerHTML = `
            <div class="products-error">
                <strong>Could not load products.</strong>

                <p>
                    ${escapeHTML(
                        error.name === "AbortError"
                            ? "The server took too long to respond."
                            : error.message
                    )}
                </p>

                <button
                    type="button"
                    id="retryProductsBtn"
                >
                    Try Again
                </button>
            </div>
        `;

        const retryButton =
            document.getElementById(
                "retryProductsBtn"
            );

        if (retryButton) {

            retryButton.addEventListener(
                "click",
                loadProducts
            );

        }

    }

}


// =========================================================
// RENDER PRODUCTS
// =========================================================


function renderProducts() {
    if (!productsGrid) return;

    productsGrid.innerHTML = "";

    if (productCount) {
        productCount.textContent = products.length;
    }

    if (emptyProducts) {
        emptyProducts.style.display =
            products.length === 0 ? "flex" : "none";
    }

    if (products.length === 0) return;

    products.forEach((product) => {
        const card = document.createElement("article");
        card.className = "product-card";

        const name = product.name || "Unnamed product";
        const image = product.image || "";
        const stock = Number(product.stock) || 0;
        const price = Number(product.price) || 0;

        const stockClass =
            stock === 0
                ? "out-of-stock"
                : stock <= 5
                    ? "low-stock"
                    : "in-stock";

        const imageHTML = image.trim()
            ? `
                <div class="product-card-image-wrap">
                    <img
                        src="${escapeHTML(image)}"
                        alt="${escapeHTML(name)}"
                        class="product-card-image"
                    >
                    <div
                        class="product-card-placeholder"
                        style="display:none;"
                    >📦</div>
                </div>
            `
            : `
                <div class="product-card-image-wrap">
                    <div class="product-card-placeholder">📦</div>
                </div>
            `;

        card.innerHTML = `
            ${imageHTML}

            <div class="product-card-body">
                <div class="product-card-category">
                    ${escapeHTML(product.category || "Uncategorized")}
                </div>

                <h3>${escapeHTML(name)}</h3>

                <p class="product-description">
                    ${escapeHTML(
                        product.description || "No description provided."
                    )}
                </p>

                <div class="product-card-meta">
                    <strong>${formatPrice(price)} ETB</strong>
                    <span class="${stockClass}">
                        ${stock} in stock
                    </span>
                </div>

                <div class="product-card-actions">
                    <button
                        type="button"
                        class="edit-product-btn"
                        data-id="${escapeHTML(product._id || "")}"
                    >Edit</button>

                    <button
                        type="button"
                        class="delete-product-btn"
                        data-id="${escapeHTML(product._id || "")}"
                    >Delete</button>
                </div>
            </div>
        `;

        const imageElement = card.querySelector(".product-card-image");

        if (imageElement) {
            imageElement.addEventListener("error", () => {
                imageElement.style.display = "none";

                const placeholder =
                    imageElement.nextElementSibling;

                if (placeholder) {
                    placeholder.style.display = "flex";
                }
            });
        }

        const editButton = card.querySelector(".edit-product-btn");
        const deleteButton = card.querySelector(".delete-product-btn");

        if (editButton) {
            editButton.addEventListener("click", () => {
                const selectedProduct = products.find(
                    item => String(item._id) === editButton.dataset.id
                );

                if (selectedProduct) {
                    openEditModal(selectedProduct);
                }
            });
        }

        if (deleteButton) {
            deleteButton.addEventListener("click", () => {
                deleteProduct(deleteButton.dataset.id);
            });
        }

        productsGrid.appendChild(card);
    });
}





// =========================================================
// OPEN ADD MODAL
// =========================================================

function openAddModal() {

    if (
        !productModal ||
        !productForm
    ) {

        console.error(
            "Product modal HTML is missing."
        );

        alert(
            "Add Product modal is missing from products.html."
        );

        return;

    }

    editingProductId = null;

    modalTitle.textContent =
        "Add Product";

    productForm.reset();

    saveProductBtn.textContent =
        "Save Product";

    productModal.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";

    productName.focus();

}


// =========================================================
// OPEN EDIT MODAL
// =========================================================

function openEditModal(product) {

    editingProductId =
        product._id;

    modalTitle.textContent =
        "Edit Product";

    productName.value =
        product.name || "";

    productDescription.value =
        product.description || "";

    productPrice.value =
        product.price ?? "";

    productStock.value =
        product.stock ?? 0;

    productCategory.value =
        product.category || "";

    productImage.value =
        product.image || "";

    saveProductBtn.textContent =
        "Update Product";

    productModal.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";

    productName.focus();

}


// =========================================================
// CLOSE MODAL
// =========================================================

function closeModal() {

    if (!productModal) {
        return;
    }

    productModal.classList.add(
        "hidden"
    );

    document.body.style.overflow =
        "";

    if (productForm) {

        productForm.reset();

    }

    editingProductId = null;

    if (saveProductBtn) {

        saveProductBtn.textContent =
            "Save Product";

    }

}


// =========================================================
// SAVE PRODUCT
// =========================================================

async function saveProduct(event) {

    event.preventDefault();

    const name =
        productName.value.trim();

    const description =
        productDescription.value.trim();

    const price =
        productPrice.value;

    const stock =
        productStock.value;

    const category =
        productCategory.value.trim();

    const image =
        productImage.value.trim();


    if (!name) {

        alert(
            "Enter a product name."
        );

        productName.focus();
        return;

    }


    if (
        price === "" ||
        !Number.isFinite(Number(price)) ||
        Number(price) < 0
    ) {

        alert(
            "Enter a valid price."
        );

        productPrice.focus();
        return;

    }


    const numericStock =
        stock === ""
            ? 0
            : Number(stock);


    if (
        !Number.isInteger(numericStock) ||
        numericStock < 0
    ) {

        alert(
            "Stock must be 0 or greater."
        );

        productStock.focus();
        return;

    }


    const productData = {

        name,
        description,

        price:
            Number(price),

        stock:
            numericStock,

        category:
            category ||
            "Uncategorized",

        image

    };


    const isEditing =
        Boolean(editingProductId);


    const endpoint =
        isEditing
            ? `${API_URL}/api/products/${editingProductId}`
            : `${API_URL}/api/products`;


    const method =
        isEditing
            ? "PUT"
            : "POST";


    const originalText =
        saveProductBtn.textContent;

    saveProductBtn.disabled = true;

    saveProductBtn.textContent =
        isEditing
            ? "Updating..."
            : "Saving...";


    try {

        const response = await apiFetch(
            endpoint,
            {
                method,

                headers: {

                    "Content-Type":
                        "application/json",

                    Authorization:
                        `Bearer ${getToken()}`

                },

                body:
                    JSON.stringify(productData)

            }
        );

        const data =
            await getResponseData(response);


        if (response.status === 401) {

            logout();
            return;

        }


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Could not save product."
            );

        }


        closeModal();

        await loadProducts();


    } catch (error) {

        console.error(
            "Save product error:",
            error
        );

        alert(
            error.name === "AbortError"
                ? "Server took too long to respond."
                : error.message
        );

    } finally {

        saveProductBtn.disabled = false;

        saveProductBtn.textContent =
            originalText;

    }

}


// =========================================================
// DELETE PRODUCT
// =========================================================

async function deleteProduct(productId) {

    const product =
        products.find(
            item =>
                item._id === productId
        );

    if (!product) {
        return;
    }


    const confirmed =
        confirm(
            `Delete "${product.name}"?\n\nThis cannot be undone.`
        );

    if (!confirmed) {
        return;
    }


    try {

        const response = await apiFetch(
            `${API_URL}/api/products/${productId}`,
            {
                method: "DELETE",

                headers: {

                    Authorization:
                        `Bearer ${getToken()}`

                }
            }
        );

        const data =
            await getResponseData(response);


        if (response.status === 401) {

            logout();
            return;

        }


        if (
            !response.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Could not delete product."
            );

        }


        await loadProducts();

    } catch (error) {

        console.error(
            "Delete product error:",
            error
        );

        alert(
            error.message ||
            "Could not delete product."
        );

    }

}


// =========================================================
// HELPERS
// =========================================================

function formatPrice(price) {

    const number =
        Number(price);

    return Number.isFinite(number)
        ? number.toLocaleString(
            "en-US",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        )
        : "0.00";

}


function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        String(value ?? "");

    return div.innerHTML;

}


// =========================================================
// EVENTS
// =========================================================

openAddProductBtn?.addEventListener(
    "click",
    openAddModal
);

emptyAddProductBtn?.addEventListener(
    "click",
    openAddModal
);

closeProductModal?.addEventListener(
    "click",
    closeModal
);

cancelProductBtn?.addEventListener(
    "click",
    closeModal
);

productForm?.addEventListener(
    "submit",
    saveProduct
);

logoutBtn?.addEventListener(
    "click",
    logout
);


productModal?.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            productModal
        ) {

            closeModal();

        }

    }
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            closeModal();

        }

    }
);


// =========================================================
// START
// =========================================================

async function initializeProductsPage() {

    const authenticated =
        await authenticateUser();

    if (!authenticated) {
        return;
    }

    await loadProducts();

}

document.addEventListener(
    "DOMContentLoaded",
    initializeProductsPage
);