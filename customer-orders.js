"use strict";
const API_URL = window.TELESHOP_API_URL || "http://localhost:3000";
const token = localStorage.getItem("teleshopToken");
const notice = document.getElementById("notice");
const ordersRoot = document.getElementById("orders");
const escapeHTML = value => { const node = document.createElement("span"); node.textContent = String(value ?? ""); return node.innerHTML; };
const money = value => (Number(value)||0).toLocaleString("en-ET",{minimumFractionDigits:2,maximumFractionDigits:2}) + " ETB";
async function loadOrders(){
  if(!token){notice.innerHTML='You are not signed in. <a class="btn" href="login.html">Sign in</a> <a class="btn" href="register.html">Create account</a>';ordersRoot.innerHTML="";return;}
  notice.textContent="Loading your orders…";ordersRoot.innerHTML="";
  try{const res=await fetch(`${API_URL}/api/customer/orders`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"}});const data=await res.json();if(!res.ok)throw new Error(data.message||"Could not load orders.");
    const list=Array.isArray(data.orders)?data.orders:[];notice.style.display=list.length?"none":"block";notice.textContent=list.length?"":"No account-linked orders yet. If you checked out as a guest, the order is not linked to your account.";
    ordersRoot.innerHTML=list.map(order=>`<article class="order"><div class="order-head"><div><div class="ref">Order #${escapeHTML(String(order._id||"").slice(-8).toUpperCase())}</div><div class="meta">${escapeHTML(new Date(order.createdAt||Date.now()).toLocaleString())} · ${escapeHTML(order.city||"Delivery location not provided")}</div></div><span class="status">${escapeHTML(order.status||"pending")}</span></div><div class="items">${(order.items||[]).map(item=>`<div class="item"><span>${escapeHTML(item.name||"Product")} × ${Number(item.quantity)||1}</span><span>${money(item.lineTotal)}</span></div>`).join("")}</div><div class="total"><span>Order subtotal · COD</span><strong>${money(order.total)}</strong></div><div class="meta">Seller arranges delivery; delivery fee is confirmed separately.</div></article>`).join("");
  }catch(error){notice.className="notice danger";notice.textContent=error.message;}}
document.getElementById("refreshOrders").addEventListener("click",loadOrders);document.getElementById("logoutButton").addEventListener("click",()=>{localStorage.removeItem("teleshopToken");localStorage.removeItem("teleshopUser");location.href="storefront.html";});loadOrders();