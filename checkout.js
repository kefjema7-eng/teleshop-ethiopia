"use strict";
const API_URL = window.TELESHOP_API_URL || "http://localhost:3000";
const CART_KEY = "teleshop_cart_v1";
const money = value => (Number(value) || 0).toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const escapeText = value => { const node = document.createElement("span"); node.textContent = String(value ?? ""); return node.innerHTML; };
function getCart() { try { const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); return Array.isArray(cart) ? cart.filter(item => item && item.id && Number(item.quantity) > 0) : []; } catch { return []; } }
const cart = getCart();
const layout = document.getElementById("checkoutLayout");
const empty = document.getElementById("checkoutEmpty");
const form = document.getElementById("checkoutForm");
const message = document.getElementById("checkoutMessage");
const button = document.getElementById("placeOrderButton");
try {
  const savedUser = JSON.parse(localStorage.getItem("teleshopUser") || "null");
  if (savedUser?.name && document.getElementById("customerName")) document.getElementById("customerName").value = savedUser.name;
  if (savedUser?.email && document.getElementById("customerEmail")) document.getElementById("customerEmail").value = savedUser.email;
} catch {}
function renderSummary() {
  if (!cart.length) { layout.hidden = true; empty.hidden = false; return; }
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
  document.getElementById("summarySubtotal").textContent = `${money(subtotal)} ETB`;
  document.getElementById("summaryTotal").textContent = `${money(subtotal)} ETB`;
  document.getElementById("orderItems").innerHTML = cart.map(item => `<div class="order-item">${item.image ? `<img class="item-image" src="${escapeText(item.image)}" alt="" onerror="this.style.display='none'">` : '<div class="item-image">📦</div>'}<div><div class="item-name">${escapeText(item.name || "Product")}</div><div class="item-meta">Qty: ${Number(item.quantity)} × ${money(item.price)} ETB</div></div><div class="item-price">${money((Number(item.price) || 0) * item.quantity)} ETB</div></div>`).join("");
}
function showError(text) { message.textContent = text; message.className = "message error"; }
function showSuccess(data) {
  const refs = (data.orders || []).map(order => order.orderId).join(" · ");
  document.getElementById("checkoutPage").innerHTML = `<section class="success"><div class="success-icon">✓</div><span class="eyebrow">Order submitted</span><h1>Thank you.</h1><p>${escapeText(data.message || "Your order was placed.")} Your order is now pending seller confirmation.</p><div class="order-reference">Reference: ${escapeText(refs || "Submitted")}</div><p>Keep this reference. Each seller receives the items they are responsible for delivering. Delivery charges and timing will be confirmed by the seller.</p><a class="primary-link" href="storefront.html">Continue shopping →</a></section>`;
  localStorage.removeItem(CART_KEY);
}
form?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!cart.length) return showError("Your cart is empty. Add products before placing an order.");
  message.className = "message"; message.textContent = ""; button.disabled = true; button.textContent = "Submitting your order…";
  const data = Object.fromEntries(new FormData(form).entries());
  const payload = { customerName: data.customerName, customerPhone: data.customerPhone, customerEmail: data.customerEmail, city: data.city, address: data.address, notes: data.notes, paymentMethod: data.paymentMethod || "cod", items: cart.map(item => ({ id: item.id, quantity: Number(item.quantity) })) };
  try {
    const token = localStorage.getItem("teleshopToken");
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_URL}/api/checkout`, { method: "POST", headers, body: JSON.stringify(payload) });
    let result; try { result = await response.json(); } catch { throw new Error("The server returned an invalid response. Check that the backend is running."); }
    if (!response.ok || result.success === false) throw new Error(result.message || "Unable to place this order.");
    showSuccess(result);
  } catch (error) {
    showError(error.message || "Could not connect to TeleShop. Make sure the backend is running and try again.");
    button.disabled = false; button.textContent = "Place order · Cash on delivery";
  }
});
renderSummary();
