"use strict";
require("dotenv").config();
const { MongoClient } = require("mongodb");
const email = String(process.argv[2] || "").trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error("Usage: npm run make-admin -- existing-account@example.com"); process.exit(1); }
if (!process.env.MONGODB_URI) { console.error("MONGODB_URI is missing from backend/.env"); process.exit(1); }
(async()=>{const client=new MongoClient(process.env.MONGODB_URI);try{await client.connect();const db=client.db("teleshop");const result=await db.collection("users").updateOne({email},{$set:{role:"admin",updatedAt:new Date()}});if(!result.matchedCount){console.error("No account with that email exists. Register it first, then run this command.");process.exitCode=1;}else console.log(`Administrator role assigned to ${email}. Sign out and sign back in to refresh your account session.`);}catch(e){console.error("Could not promote account:",e.message);process.exitCode=1;}finally{await client.close();}})();
