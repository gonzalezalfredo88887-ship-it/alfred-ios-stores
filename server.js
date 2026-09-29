const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 10000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "store.db");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "Blackblack1000130@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CAMBIAR_ESTA_CLAVE";

fs.mkdirSync(path.dirname(DB_PATH), {recursive:true});

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 balance INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 category TEXT NOT NULL,
 price INTEGER NOT NULL,
 description TEXT DEFAULT '',
 image TEXT DEFAULT '',
 video TEXT DEFAULT '',
 mediafire_url TEXT DEFAULT '',
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS topups(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 amount INTEGER NOT NULL,
 receipt TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS purchases(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 product_id INTEGER NOT NULL,
 price INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'paid',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id),
 FOREIGN KEY(product_id) REFERENCES products(id)
);
`);

const seed = [
 ["Sensibilidad Alto","Sensibilidades",45],
 ["Sensibilidad cuello","Sensibilidades",40],
 ["Sensibilidad pecho","Sensibilidades",50],
 ["Sensibilidad barriga","Sensibilidades",50],
 ["Sensibilidad mágica","Sensibilidades",50],
 ["Ver arma y personaje","Sensibilidades",15]
];
if (db.prepare("SELECT COUNT(*) c FROM products").get().c === 0) {
 const ins=db.prepare("INSERT INTO products(name,category,price) VALUES(?,?,?)");
 const tx=db.transaction(()=>seed.forEach(p=>ins.run(...p))); tx();
}

app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(session({
 secret: process.env.SESSION_SECRET || "CAMBIAR_SESSION_SECRET",
 resave:false, saveUninitialized:false,
 cookie:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:1000*60*60*24*7}
}));
app.use(express.static(path.join(__dirname,"public")));

const upload = multer({
 dest:path.join(__dirname,"public","uploads"),
 limits:{fileSize:10*1024*1024}
});

function requireUser(req,res,next){
 if(!req.session.userId) return res.status(401).json({error:"Debes iniciar sesión."});
 next();
}
function requireAdmin(req,res,next){
 if(!req.session.admin) return res.status(401).json({error:"Acceso de administrador requerido."});
 next();
}

app.post("/api/register", async (req,res)=>{
 const {name,email,password}=req.body;
 if(!name || !email || !password || password.length<8) return res.status(400).json({error:"Nombre, correo y contraseña de al menos 8 caracteres son obligatorios."});
 try{
  const hash=await bcrypt.hash(password,12);
  const info=db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run(name.trim(),email.trim().toLowerCase(),hash);
  req.session.userId=info.lastInsertRowid;
  res.json({ok:true});
 }catch(e){res.status(400).json({error:"Ese correo ya está registrado."});}
});

app.post("/api/login", async (req,res)=>{
 const {email,password}=req.body;
 const u=db.prepare("SELECT * FROM users WHERE email=?").get((email||"").toLowerCase());
 if(!u || !(await bcrypt.compare(password||"",u.password_hash))) return res.status(401).json({error:"Correo o contraseña incorrectos."});
 req.session.userId=u.id; res.json({ok:true});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get("/api/me",requireUser,(req,res)=>{
 const u=db.prepare("SELECT id,name,email,balance,created_at FROM users WHERE id=?").get(req.session.userId);
 res.json(u);
});
app.get("/api/settings",(req,res)=>{
 res.json({
   payment_method:"Banreservas",
   payment_account:"9605206264",
   delivery_notice:"La entrega puede tardar de 1 a 2 horas.",
   compatibility_notice:"Estas sensibilidades son compatibles para todos dispositivos iPhone desde iOS 14 a iOS 27, excepto iOS 18.7.1–18.7.10 por el momento."
 });
});
app.get("/api/products",(req,res)=>{
 const category=req.query.category;
 const rows=category && category!=="Todas"
  ? db.prepare("SELECT * FROM products WHERE active=1 AND category=? ORDER BY id DESC").all(category)
  : db.prepare("SELECT * FROM products WHERE active=1 ORDER BY id DESC").all();
 res.json(rows);
});
app.get("/api/my-products",requireUser,(req,res)=>{
 res.json(db.prepare(`SELECT p.*, pu.created_at purchased_at
 FROM purchases pu JOIN products p ON p.id=pu.product_id
 WHERE pu.user_id=? ORDER BY pu.id DESC`).all(req.session.userId));
});
app.post("/api/topup",requireUser,upload.single("receipt"),(req,res)=>{
 const amount=Number(req.body.amount);
 if(!Number.isInteger(amount)||amount<=0||amount>1000000||!req.file) return res.status(400).json({error:"Monto y comprobante son obligatorios."});
 const receipt="/uploads/"+path.basename(req.file.path);
 db.prepare("INSERT INTO topups(user_id,amount,receipt) VALUES(?,?,?)").run(req.session.userId,amount,receipt);
 res.json({ok:true,message:"Comprobante recibido. Queda pendiente de verificación."});
});
app.post("/api/buy",requireUser,(req,res)=>{
 const product=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(Number(req.body.productId));
 if(!product) return res.status(404).json({error:"Producto no encontrado."});
 const u=db.prepare("SELECT balance FROM users WHERE id=?").get(req.session.userId);
 if(u.balance<product.price) return res.status(400).json({error:"Saldo insuficiente."});
 const tx=db.transaction(()=>{
   db.prepare("UPDATE users SET balance=balance-? WHERE id=?").run(product.price,req.session.userId);
   db.prepare("INSERT INTO purchases(user_id,product_id,price) VALUES(?,?,?)").run(req.session.userId,product.id,product.price);
 });
 tx();
 res.json({ok:true,message:"Compra registrada. El producto aparecerá en Mis productos."});
});

app.post("/api/admin/login",(req,res)=>{
 const {email,password}=req.body;
 if(email===ADMIN_EMAIL && password===ADMIN_PASSWORD){req.session.admin=true;return res.json({ok:true});}
 res.status(401).json({error:"Credenciales de administrador incorrectas."});
});
app.post("/api/admin/logout",(req,res)=>{req.session.admin=false;res.json({ok:true});});
app.get("/api/admin/data",requireAdmin,(req,res)=>{
 const users=db.prepare("SELECT id,name,email,balance,created_at FROM users ORDER BY id DESC").all();
 const products=db.prepare("SELECT * FROM products ORDER BY id DESC").all();
 const topups=db.prepare(`SELECT t.*,u.name,u.email FROM topups t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC`).all();
 const purchases=db.prepare(`SELECT pu.*,u.name,u.email,p.name product_name FROM purchases pu JOIN users u ON u.id=pu.user_id JOIN products p ON p.id=pu.product_id ORDER BY pu.id DESC`).all();
 res.json({users,products,topups,purchases});
});
app.post("/api/admin/topup/:id/approve",requireAdmin,(req,res)=>{
 const t=db.prepare("SELECT * FROM topups WHERE id=?").get(req.params.id);
 if(!t || t.status!=="pending") return res.status(400).json({error:"Recarga no disponible."});
 const tx=db.transaction(()=>{
  db.prepare("UPDATE users SET balance=balance+? WHERE id=?").run(t.amount,t.user_id);
  db.prepare("UPDATE topups SET status='approved' WHERE id=?").run(t.id);
 }); tx(); res.json({ok:true});
});
app.post("/api/admin/topup/:id/reject",requireAdmin,(req,res)=>{
 db.prepare("UPDATE topups SET status='rejected' WHERE id=? AND status='pending'").run(req.params.id);
 res.json({ok:true});
});
app.post("/api/admin/products",requireAdmin,(req,res)=>{
 const {name,category,price,description,image,video,mediafire_url}=req.body;
 if(!name||!category||!Number.isInteger(Number(price))) return res.status(400).json({error:"Datos inválidos."});
 const info=db.prepare(`INSERT INTO products(name,category,price,description,image,video,mediafire_url) VALUES(?,?,?,?,?,?,?)`)
 .run(name,category,Number(price),description||"",image||"",video||"",mediafire_url||"");
 res.json({id:info.lastInsertRowid});
});
app.post("/api/admin/products/:id",requireAdmin,(req,res)=>{
 const {name,category,price,description,image,video,mediafire_url,active}=req.body;
 db.prepare(`UPDATE products SET name=?,category=?,price=?,description=?,image=?,video=?,mediafire_url=?,active=? WHERE id=?`)
 .run(name,category,Number(price),description||"",image||"",video||"",mediafire_url||"",active?1:0,req.params.id);
 res.json({ok:true});
});

app.listen(PORT,()=>console.log(`ALFRED IOS STORES running on ${PORT}`));
