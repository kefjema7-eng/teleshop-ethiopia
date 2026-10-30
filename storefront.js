"use strict";

// Set window.TELESHOP_API_URL before this file to override the API origin.
const API_URL = window.TELESHOP_API_URL || "http://localhost:3000";
const CART_KEY = "teleshop_cart_v1";
const urlParams = new URLSearchParams(window.location.search);
const sellerId = urlParams.get("seller");
const requestedCategory = urlParams.get("category");
const productsGrid = document.getElementById("storefrontProducts");
const loadingMessage = document.getElementById("storefrontLoading");
const emptyMessage = document.getElementById("storefrontEmpty");
const sectionTitle = document.querySelector(".storefront-section-header h2");
const storeNameElement = document.getElementById("storefrontStoreName");
const storeDescriptionElement = document.getElementById("storefrontStoreDescription");
const storeLocationElement = document.getElementById("storefrontStoreLocation");
const storeLogoElement = document.getElementById("storefrontStoreLogo");
const searchInput = document.getElementById("productSearch");
const categoryFilter = document.getElementById("categoryFilter");
const sortSelect = document.getElementById("sortProducts");
const cartDrawer = document.getElementById("cartDrawer");
const cartBackdrop = document.getElementById("cartBackdrop");
const cartItemsElement = document.getElementById("cartItems");
const cartCountElement = document.getElementById("cartCount");
const cartSubtotalElement = document.getElementById("cartSubtotal");
const toastElement = document.getElementById("marketplaceToast");
const productDetailsModal = document.getElementById("productDetailsModal");
const productDetailsBackdrop = document.getElementById("productDetailsBackdrop");
const productDetailsContent = document.getElementById("productDetailsContent");
let allProducts = [];
let toastTimer;

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function formatPrice(value) {
  const number = Number(value);
  return (Number.isFinite(number) ? number : 0).toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHTML(value) {
  const element = document.createElement("span");
  element.textContent = String(value ?? "");
  return element.innerHTML;
}
function escapeAttribute(value) {
  return escapeHTML(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
async function apiRequest(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  let data;
  try { data = await response.json(); } catch { throw new Error("The server returned an invalid response."); }
  if (!response.ok || data.success === false) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}
function showLoading(message) {
  if (loadingMessage) { loadingMessage.style.display = "block"; loadingMessage.textContent = message; }
  if (emptyMessage) emptyMessage.style.display = "none";
  if (productsGrid) productsGrid.innerHTML = "";
}
function hideLoading() { if (loadingMessage) loadingMessage.style.display = "none"; }
function showError(message) {
  hideLoading();
  if (productsGrid) productsGrid.innerHTML = "";
  if (emptyMessage) { emptyMessage.style.display = "flex"; emptyMessage.textContent = message; }
}
function showToast(message) {
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove("is-visible"), 2200);
}
function renderSellerInformation(store) {
  if (!store || typeof store !== "object") return;
  const name = store.storeName || store.businessName || store.name || store.username || "Seller Store";
  const description = store.storeDescription || store.description || "";
  const location = store.location || store.address || "";
  const logo = store.storeLogo || store.logo || store.image || "";
  if (storeNameElement) storeNameElement.textContent = name;
  if (storeDescriptionElement) { storeDescriptionElement.textContent = description; storeDescriptionElement.style.display = description ? "" : "none"; }
  if (storeLocationElement) { storeLocationElement.textContent = location; storeLocationElement.style.display = location ? "" : "none"; }
  if (storeLogoElement && logo) {
    if (storeLogoElement.tagName === "IMG") { storeLogoElement.src = logo; storeLogoElement.alt = `${name} logo`; storeLogoElement.style.display = ""; }
    else storeLogoElement.style.backgroundImage = `url("${String(logo).replace(/["\\]/g, "")}")`;
  }
  if (sectionTitle) sectionTitle.textContent = requestedCategory ? `${name} — ${requestedCategory}` : name;
  document.title = `${name} | TeleShop Ethiopia`;
}
function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value.filter(item => item && item.id && Number(item.quantity) > 0) : [];
  } catch { return []; }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  renderCart();
}
function addToCart(product) {
  const id = String(product.id || product._id || "");
  if (!id) return showToast("This product cannot be added right now.");
  const cart = readCart();
  const existing = cart.find(item => item.id === id);
  const stock = Math.max(0, Number(product.stock) || 0);
  if (existing) {
    if (existing.quantity >= stock) return showToast("You have reached the available stock limit.");
    existing.quantity += 1;
    existing.stock = stock;
  } else {
    if (stock < 1) return showToast("This product is out of stock.");
    cart.push({ id, name: String(product.name || "Product"), price: Number(product.price) || 0, image: String(product.image || ""), sellerId: String(product.sellerId || ""), quantity: 1, stock });
  }
  saveCart(cart);
  showToast("Added to your cart");
}
function changeQuantity(id, delta) {
  const cart = readCart();
  const item = cart.find(entry => entry.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) return saveCart(cart.filter(entry => entry.id !== id));
  if (item.quantity > Math.max(1, Number(item.stock) || 1)) { item.quantity = Math.max(1, Number(item.stock) || 1); showToast("Available stock limit reached."); }
  saveCart(cart);
}
function removeFromCart(id) { saveCart(readCart().filter(item => item.id !== id)); }
function openCart() {
  if (!cartDrawer || !cartBackdrop) return;
  cartDrawer.classList.add("is-open"); cartDrawer.setAttribute("aria-hidden", "false");
  cartBackdrop.hidden = false; document.body.style.overflow = "hidden";
}
function closeCart() {
  if (!cartDrawer || !cartBackdrop) return;
  cartDrawer.classList.remove("is-open"); cartDrawer.setAttribute("aria-hidden", "true");
  cartBackdrop.hidden = true; document.body.style.overflow = "";
}
function renderCart() {
  const cart = readCart();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
  if (cartCountElement) cartCountElement.textContent = String(count);
  if (cartSubtotalElement) cartSubtotalElement.textContent = `${formatPrice(subtotal)} ETB`;
  if (!cartItemsElement) return;
  if (!cart.length) {
    cartItemsElement.innerHTML = '<div class="cart-empty">Your cart is empty.<br>Explore the marketplace and add something you need.</div>';
    return;
  }
  cartItemsElement.innerHTML = cart.map(item => `
    <article class="cart-item">
      ${item.image ? `<img src="${escapeAttribute(item.image)}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="cart-item-placeholder">📦</div>'}
      <div><h3>${escapeHTML(item.name)}</h3><p>${formatPrice(item.price)} ETB</p>
        <div class="cart-quantity"><button type="button" data-cart-minus="${escapeAttribute(item.id)}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button type="button" data-cart-plus="${escapeAttribute(item.id)}" aria-label="Increase quantity">+</button></div>
      </div>
      <button type="button" class="cart-remove" data-cart-remove="${escapeAttribute(item.id)}">Remove</button>
    </article>`).join("");
  cartItemsElement.querySelectorAll("[data-cart-minus]").forEach(button => button.addEventListener("click", () => changeQuantity(button.dataset.cartMinus, -1)));
  cartItemsElement.querySelectorAll("[data-cart-plus]").forEach(button => button.addEventListener("click", () => changeQuantity(button.dataset.cartPlus, 1)));
  cartItemsElement.querySelectorAll("[data-cart-remove]").forEach(button => button.addEventListener("click", () => removeFromCart(button.dataset.cartRemove)));
}
function populateCategories(products) {
  if (!categoryFilter) return;
  const current = categoryFilter.value;
  const categories = [...new Set(products.map(p => String(p.category || "").trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
  categoryFilter.innerHTML = '<option value="">All categories</option>' + categories.map(category => `<option value="${escapeAttribute(category)}">${escapeHTML(category)}</option>`).join("");
  if (requestedCategory) {
    const match = categories.find(category => normalizeCategory(category) === normalizeCategory(requestedCategory));
    if (match) categoryFilter.value = match;
  } else if (categories.includes(current)) categoryFilter.value = current;
}
function filteredProducts() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const category = categoryFilter?.value || requestedCategory || "";
  let products = allProducts.filter(product => {
    const searchable = `${product.name || ""} ${product.description || ""} ${product.category || ""}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!category || normalizeCategory(product.category) === normalizeCategory(category));
  });
  const sort = sortSelect?.value || "newest";
  if (sort === "price-low") products.sort((a,b) => Number(a.price) - Number(b.price));
  if (sort === "price-high") products.sort((a,b) => Number(b.price) - Number(a.price));
  if (sort === "name") products.sort((a,b) => String(a.name || "").localeCompare(String(b.name || "")));
  if (sort === "newest") products.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return products;
}
function openProductDetails(product) {
  if (!productDetailsModal || !productDetailsContent) return;
  const id = String(product.id || product._id || "");
  const name = String(product.name || "Product");
  const image = String(product.image || "").trim();
  const seller = String(product.sellerId || "");
  productDetailsContent.innerHTML = `<div class="product-details-layout">
    ${image ? `<img class="product-details-image" src="${escapeAttribute(image)}" alt="${escapeAttribute(name)}" onerror="this.style.display='none'">` : '<div class="product-details-image" style="display:grid;place-items:center;font-size:60px">📦</div>'}
    <div class="product-details-copy"><span class="storefront-product-category">${escapeHTML(product.category || "Uncategorized")}</span><h2 id="productDetailsTitle">${escapeHTML(name)}</h2><p>${escapeHTML(product.description || "No description provided by the seller.")}</p><div class="product-details-price">${formatPrice(product.price)} ETB</div><p>${Math.max(0, Number(product.stock) || 0)} currently available</p>${seller ? `<a class="product-details-seller" href="storefront.html?seller=${encodeURIComponent(seller)}">Visit seller store →</a>` : ""}<button class="product-details-add" id="productDetailsAdd" type="button" ${Number(product.stock) < 1 ? "disabled" : ""}>${Number(product.stock) < 1 ? "Out of stock" : "Add to cart"}</button></div></div>`;
  productDetailsContent.querySelector("#productDetailsAdd")?.addEventListener("click", () => { addToCart(product); closeProductDetails(); });
  productDetailsModal.classList.add("is-open"); productDetailsModal.setAttribute("aria-hidden", "false"); productDetailsBackdrop.hidden = false; document.body.style.overflow = "hidden";
}
function closeProductDetails() {
  if (!productDetailsModal || !productDetailsBackdrop) return;
  productDetailsModal.classList.remove("is-open"); productDetailsModal.setAttribute("aria-hidden", "true"); productDetailsBackdrop.hidden = true;
  if (!cartDrawer?.classList.contains("is-open")) document.body.style.overflow = "";
}

function renderStorefrontProducts(products) {
  if (!productsGrid) return;
  productsGrid.innerHTML = "";
  products.forEach(product => {
    const card = document.createElement("article");
    card.className = "storefront-product-card";
    const name = product.name || "Unnamed Product";
    const id = product.id || product._id || "";
    const image = String(product.image || "").trim();
    const stock = Math.max(0, Number(product.stock) || 0);
    const imageHTML = image
      ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(name)}" class="storefront-product-image" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="storefront-product-placeholder" style="display:none">📦</div>`
      : '<div class="storefront-product-placeholder">📦</div>';
    card.innerHTML = `<div class="storefront-product-image-wrapper">${imageHTML}</div>
      <div class="storefront-product-content"><span class="storefront-product-category">${escapeHTML(product.category || "Uncategorized")}</span>
      <h3>${escapeHTML(name)}</h3><p>${escapeHTML(product.description || "No description available.")}</p>
      <div class="storefront-product-bottom"><strong>${formatPrice(product.price)} ETB</strong><span>${stock === 1 ? "1 available" : `${stock.toLocaleString("en-US")} available`}</span></div>
      <div class="product-card-actions"><button class="details-button" type="button">Details</button><button class="add-to-cart-button" type="button" ${!id || stock < 1 ? "disabled" : ""}>${stock < 1 ? "Out of stock" : "+ Add to cart"}</button></div></div>`;
    const button = card.querySelector(".add-to-cart-button");
    button.addEventListener("click", () => addToCart(product));
    card.querySelector(".details-button")?.addEventListener("click", () => openProductDetails(product));
    productsGrid.appendChild(card);
  });
}
function updateProductResults() {
  const products = filteredProducts();
  renderStorefrontProducts(products);
  if (emptyMessage) {
    emptyMessage.style.display = products.length ? "none" : "flex";
    if (!products.length) emptyMessage.textContent = "No products match your search. Try a different search or category.";
  }
}
async function loadStorefrontProducts() {
  if (!productsGrid) return;
  showLoading(sellerId ? "Loading seller store..." : "Loading products...");
  try {
    let data;
    if (sellerId) {
      data = await apiRequest(`${API_URL}/api/stores/${encodeURIComponent(sellerId)}`);
      renderSellerInformation(data.store || data.seller || null);
      allProducts = Array.isArray(data.products) ? data.products : [];
    } else {
      data = await apiRequest(`${API_URL}/api/products/public`);
      allProducts = Array.isArray(data.products) ? data.products : [];
      if (requestedCategory && sectionTitle) sectionTitle.textContent = requestedCategory;
      if (requestedCategory) document.title = `${requestedCategory} | TeleShop Ethiopia`;
    }
    populateCategories(allProducts);
    hideLoading();
    updateProductResults();
  } catch (error) {
    console.error("TeleShop storefront error:", error);
    showError(`${error.message || "Could not load products."} Make sure the TeleShop backend is running.`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderCart();
  document.getElementById("cartOpenButton")?.addEventListener("click", openCart);
  document.getElementById("cartCloseButton")?.addEventListener("click", closeCart);
  cartBackdrop?.addEventListener("click", closeCart);
  productDetailsBackdrop?.addEventListener("click", closeProductDetails);
  document.getElementById("productDetailsClose")?.addEventListener("click", closeProductDetails);
  document.addEventListener("keydown", event => { if (event.key === "Escape") { closeCart(); closeProductDetails(); } });
  searchInput?.addEventListener("input", updateProductResults);
  categoryFilter?.addEventListener("change", updateProductResults);
  sortSelect?.addEventListener("change", updateProductResults);
  loadStorefrontProducts();
});
