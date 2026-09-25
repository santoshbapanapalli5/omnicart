"use client";

import React, { useState, useEffect } from "react";
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  arrayUnion,
  query,
  where 
} from "firebase/firestore";
import { auth, googleProvider, db } from "@/lib/firebase";

// App Types
interface User {
  id: string;
  name: string;
  email: string;
  role: "customer" | "seller";
}

interface Review {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
}

interface Product {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  deliveryDays: number;
  icon: string;
  imageUrl?: string;
  reviews: Review[];
}

interface CartItem extends Product {
  quantity: number;
}

interface Order {
  id?: string;
  orderCode: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  shippingAddress: string;
  city: string;
  pincode: string;
  items: CartItem[];
  totalAmount: number;
  status: "Pending" | "Shipped" | "Delivered";
  orderDate: string;
  estimatedDeliveryDate: string;
}

const CATEGORIES = [
  { name: "All", icon: "🌐" },
  { name: "Electronics", icon: "💻" },
  { name: "Fashion", icon: "👕" },
  { name: "Home & Kitchen", icon: "🏠" },
  { name: "Medicines", icon: "💊" },
  { name: "Books", icon: "📚" },
  { name: "Grocery", icon: "🛒" },
  { name: "Beauty & Care", icon: "✨" },
  { name: "Sports & Fitness", icon: "⚽" },
  { name: "Automotive", icon: "🚗" },
  { name: "Toys & Games", icon: "🎮" },
];

export default function OmniCartPlatform() {
  const [activeTab, setActiveTab] = useState<"store" | "cart" | "my-orders" | "seller" | "auth">("store");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [sellerSubTab, setSellerSubTab] = useState<"dashboard" | "add-product" | "inventory" | "orders">("dashboard");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<"customer" | "seller">("customer");
  const [loading, setLoading] = useState(true);

  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  // Cloud State from Firestore
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Seller Form Fields
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newCategory, setNewCategory] = useState("Fashion");
  const [newDescription, setNewDescription] = useState("");
  const [newDeliveryDays, setNewDeliveryDays] = useState("3");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Checkout Location Fields
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [checkoutCity, setCheckoutCity] = useState("Jabalpur");
  const [checkoutPincode, setCheckoutPincode] = useState("482005");

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const appUser: User = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Student",
          email: firebaseUser.email || "",
          role: selectedRole,
        };
        setCurrentUser(appUser);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedRole]);

  // Real-time Database Listener: Fetch Catalog Products
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "products"), (snapshot) => {
      const cloudProducts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(cloudProducts);
    });
    return () => unsubscribe();
  }, []);

  // Real-time Database Listener: Fetch ONLY relevant orders for logged-in user
  useEffect(() => {
    if (!currentUser) {
      setOrders([]);
      return;
    }

    // Filter orders so customers only see their purchases and sellers only see their sales
    const fieldToFilter = currentUser.role === "seller" ? "sellerId" : "customerId";
    const q = query(collection(db, "orders"), where(fieldToFilter, "==", currentUser.id));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
      setOrders(cloudOrders);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const sellerProducts = currentUser ? products.filter((p) => p.sellerId === currentUser.id) : [];
  const sellerOrders = orders; // Already filtered by query
  const customerOrders = orders; // Already filtered by query

  const filteredProducts = selectedCategory === "All" 
    ? products 
    : products.filter(p => p.category.toLowerCase() === selectedCategory.toLowerCase());

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const sellerRevenue = sellerOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  // AUTH HANDLERS
  const handleRealGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setActiveTab(selectedRole === "seller" ? "seller" : "store");
    } catch (error: any) {
      alert("Authentication Failed: " + error.message);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      setActiveTab(selectedRole === "seller" ? "seller" : "store");
    } catch (error: any) {
      alert("Sign up failed: " + error.message);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
      setActiveTab("store");
    } catch (error: any) {
      alert("Login failed: Check credentials.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
    setActiveTab("store");
  };

  // WRITE DATA TO FIREBASE CLOUD
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || currentUser.role !== "seller") {
      alert("Only logged-in sellers can post products!");
      return;
    }

    const categoryObj = CATEGORIES.find(c => c.name === newCategory) || { icon: "📦" };

    const newProductData = {
      sellerId: currentUser.id,
      sellerName: currentUser.name,
      title: newTitle,
      sku: "SKU-" + Math.floor(1000 + Math.random() * 9000),
      price: parseFloat(newPrice),
      stock: parseInt(newStock),
      category: newCategory,
      description: newDescription || "No description provided.",
      deliveryDays: parseInt(newDeliveryDays) || 3,
      icon: categoryObj.icon,
      imageUrl: imagePreview || null,
      reviews: [],
    };

    await addDoc(collection(db, "products"), newProductData);

    setNewTitle("");
    setNewPrice("");
    setNewStock("");
    setNewDescription("");
    setImagePreview(null);
    alert("Product saved to Campus Catalog!");
    setSellerSubTab("inventory");
  };

  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
    alert(`Added "${product.title}" to cart!`);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Please login to place an order!");
      setActiveTab("auth");
      return;
    }
    if (cart.length === 0) return;

    const now = new Date();

    for (const cartItem of cart) {
      const newOrderData = {
        orderCode: "OC-" + Math.floor(10000 + Math.random() * 90000),
        customerId: currentUser.id,
        customerName: currentUser.name,
        sellerId: cartItem.sellerId,
        shippingAddress: checkoutAddress,
        city: checkoutCity,
        pincode: checkoutPincode,
        items: [cartItem],
        totalAmount: cartItem.price * cartItem.quantity,
        status: "Pending",
        orderDate: now.toLocaleDateString(),
        estimatedDeliveryDate: `Delivery in ${cartItem.deliveryDays || 3} Days`,
      };

      await addDoc(collection(db, "orders"), newOrderData);
    }

    setCart([]);
    alert("Order placed successfully! Check 'My Orders'.");
    setActiveTab("my-orders");
  };

  const updateOrderStatus = async (orderDocId: string, newStatus: "Pending" | "Shipped" | "Delivered") => {
    const orderRef = doc(db, "orders", orderDocId);
    await updateDoc(orderRef, { status: newStatus });
  };

  const handleAddReview = async (productDocId: string) => {
    if (!reviewComment) {
      alert("Please enter a review comment.");
      return;
    }

    const newRev: Review = {
      id: "REV-" + Date.now(),
      customerName: currentUser?.name || "Verified Student",
      rating: reviewRating,
      comment: reviewComment,
      date: new Date().toLocaleDateString(),
    };

    const productRef = doc(db, "products", productDocId);
    await updateDoc(productRef, {
      reviews: arrayUnion(newRev),
    });

    setReviewComment("");
    alert("Verified purchase review posted!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-sans">
        <p className="text-sm font-bold">Loading IIITJ Campus Marketplace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans">
      <header className="sticky top-0 z-50 bg-slate-900 text-white px-6 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span
              onClick={() => {
                setSelectedProduct(null);
                setActiveTab("store");
              }}
              className="text-2xl font-black text-indigo-400 cursor-pointer tracking-tight"
            >
              🛒 OmniCart Campus
            </span>
            <div className="hidden md:flex items-center gap-2 bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setActiveTab("store");
                }}
                className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                  activeTab === "store" ? "bg-indigo-600 text-white" : "text-slate-300 hover:text-white"
                }`}
              >
                🏪 Storefront
              </button>
              {currentUser?.role === "seller" && (
                <button
                  onClick={() => setActiveTab("seller")}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                    activeTab === "seller" ? "bg-indigo-600 text-white" : "text-slate-300 hover:text-white"
                  }`}
                >
                  💼 Seller Dashboard
                </button>
              )}
              {currentUser?.role === "customer" && (
                <button
                  onClick={() => setActiveTab("my-orders")}
                  className={`px-3 py-1.5 rounded-lg cursor-pointer ${
                    activeTab === "my-orders" ? "bg-indigo-600 text-white" : "text-slate-300 hover:text-white"
                  }`}
                >
                  📦 My Orders
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <button
              onClick={() => setActiveTab("cart")}
              className="flex items-center gap-2 text-indigo-300 bg-indigo-950 border border-indigo-700 px-3 py-1.5 rounded-full cursor-pointer"
            >
              <span>🛒 Cart</span>
              <span className="bg-indigo-600 text-white text-2xs px-2 py-0.5 rounded-full font-bold">
                {totalCartItems}
              </span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-3 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                <span>
                  👤 <strong>{currentUser.name}</strong> ({currentUser.role})
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded-lg text-2xs cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab("auth")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Sign In / Register
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "auth" && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-md space-y-6">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-black text-slate-900">
                {authMode === "login" ? "Welcome Back" : "Campus Registration"}
              </h1>
              <p className="text-xs text-slate-500">Sign in to buy or sell products on campus</p>
            </div>

            <button
              onClick={handleRealGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border border-slate-300 py-3 rounded-xl text-xs font-bold text-slate-700 shadow-sm cursor-pointer"
            >
              Continue with Google Account
            </button>

            <form onSubmit={authMode === "login" ? handleEmailLogin : handleEmailSignUp} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">Account Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as "customer" | "seller")}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-bold text-indigo-700"
                >
                  <option value="customer">🛍️ Student Buyer</option>
                  <option value="seller">💼 Student Seller</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="student@iiitdmj.ac.in"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-300"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl cursor-pointer"
              >
                {authMode === "login" ? "Sign In" : "Register Account"}
              </button>
            </form>

            <div className="text-center text-xs text-slate-500 pt-2">
              {authMode === "login" ? (
                <p>
                  Need an account?{" "}
                  <button onClick={() => setAuthMode("signup")} className="text-indigo-600 font-bold underline cursor-pointer">
                    Sign Up
                  </button>
                </p>
              ) : (
                <p>
                  Already registered?{" "}
                  <button onClick={() => setAuthMode("login")} className="text-indigo-600 font-bold underline cursor-pointer">
                    Log In
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "store" && (
          <div className="space-y-6">
            {selectedProduct ? (
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-md space-y-6">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  ← Back to Catalog
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 h-80 rounded-2xl flex items-center justify-center border overflow-hidden">
                    {selectedProduct.imageUrl ? (
                      <img src={selectedProduct.imageUrl} alt={selectedProduct.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-8xl">{selectedProduct.icon}</span>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-2xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full uppercase">
                        {selectedProduct.category}
                      </span>
                      <h1 className="text-2xl font-black text-slate-900 mt-2">{selectedProduct.title}</h1>
                      <p className="text-xs text-slate-500 mt-0.5">Sold by: <strong className="text-slate-800">{selectedProduct.sellerName}</strong> | SKU: {selectedProduct.sku}</p>
                    </div>

                    <div className="border-t border-b py-3 flex items-center justify-between">
                      <div>
                        <span className="text-3xl font-black text-slate-900">₹{selectedProduct.price}</span>
                      </div>
                      <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                        In Stock ({selectedProduct.stock} units)
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Description & Details</h3>
                      <p className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    </div>

                    <button
                      onClick={() => addToCart(selectedProduct)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-md cursor-pointer transition"
                    >
                      Add to Shopping Cart
                    </button>
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Verified Reviews ({selectedProduct.reviews?.length || 0})</h2>
                  {selectedProduct.reviews && selectedProduct.reviews.length > 0 ? (
                    <div className="space-y-3">
                      {selectedProduct.reviews.map((rev) => (
                        <div key={rev.id} className="bg-slate-50 p-4 rounded-xl border text-xs space-y-1">
                          <div className="flex justify-between items-center font-bold">
                            <span>{rev.customerName} <span className="text-emerald-600 font-normal">✔ Verified Student Purchase</span></span>
                            <span className="text-amber-500">{"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}</span>
                          </div>
                          <p className="text-slate-600">{rev.comment}</p>
                          <span className="text-2xs text-slate-400 block">{rev.date}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No reviews yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
                  <div className="flex gap-2 min-w-max">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          selectedCategory === cat.name
                            ? "bg-indigo-600 text-white shadow-md scale-105"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {filteredProducts.length === 0 ? (
                  <div className="bg-white p-12 text-center rounded-3xl border border-dashed text-slate-500 space-y-3">
                    <span className="text-5xl block">🛍️</span>
                    <h3 className="font-bold text-slate-800">No Products in "{selectedCategory}"</h3>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {filteredProducts.map((p) => (
                      <div 
                        key={p.id} 
                        onClick={() => setSelectedProduct(p)}
                        className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col justify-between space-y-4 hover:border-indigo-400 transition cursor-pointer group"
                      >
                        <div className="bg-slate-50 h-44 rounded-xl flex items-center justify-center overflow-hidden">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                          ) : (
                            <span className="text-6xl">{p.icon}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-2xs mb-1">
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{p.category}</span>
                            <span className="text-slate-400">by {p.sellerName}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-indigo-600">{p.title}</h3>
                          <p className="text-xs text-slate-500 line-clamp-2 mt-1">{p.description}</p>
                          <p className="text-lg font-black text-slate-900 mt-2">₹{p.price}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(p);
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow-sm transition"
                        >
                          Add to Cart
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "cart" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Shopping Cart</h1>
            {cart.length === 0 ? (
              <p className="text-xs text-slate-500">Your cart is empty.</p>
            ) : (
              <div className="bg-white p-6 rounded-2xl border space-y-4 shadow-sm">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center border-b pb-3 text-xs">
                    <div>
                      <h3 className="font-bold text-slate-800">{item.title}</h3>
                      <p className="font-bold text-indigo-600">₹{item.price}</p>
                    </div>
                    <span className="font-bold bg-slate-100 px-3 py-1 rounded-lg">Qty: {item.quantity}</span>
                  </div>
                ))}

                <form onSubmit={handleCheckout} className="space-y-3 pt-4 border-t text-xs">
                  <h3 className="font-bold text-sm text-slate-900">📍 Delivery Details (Hostel / Room)</h3>
                  <div>
                    <label className="block text-slate-600 mb-1">Hostel & Room No.</label>
                    <input
                      type="text"
                      placeholder="e.g. Hall 4, Room 201"
                      value={checkoutAddress}
                      onChange={(e) => setCheckoutAddress(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-xl border"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 mb-1">City</label>
                      <input
                        type="text"
                        value={checkoutCity}
                        onChange={(e) => setCheckoutCity(e.target.value)}
                        required
                        className="w-full p-2.5 rounded-xl border bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Pincode</label>
                      <input
                        type="text"
                        value={checkoutPincode}
                        onChange={(e) => setCheckoutPincode(e.target.value)}
                        required
                        className="w-full p-2.5 rounded-xl border bg-slate-50"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-xs cursor-pointer shadow">
                    Confirm Order (Total: ₹{cartSubtotal})
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === "my-orders" && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold">My Orders</h1>
            {customerOrders.length === 0 ? (
              <p className="text-xs text-slate-500">No orders found for your account.</p>
            ) : (
              <div className="space-y-4">
                {customerOrders.map((o) => (
                  <div key={o.id} className="bg-white p-5 rounded-2xl border text-xs space-y-3 shadow-sm">
                    <div className="flex justify-between items-center font-bold border-b pb-2">
                      <div>
                        <span>Order #{o.orderCode}</span>
                        <span className="text-slate-400 font-normal block text-2xs">Placed on: {o.orderDate}</span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-2xs uppercase ${
                        o.status === "Delivered" 
                          ? "bg-emerald-100 text-emerald-800" 
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {o.status}
                      </span>
                    </div>

                    <div className="text-slate-600 space-y-1">
                      <p><strong>Campus Location:</strong> {o.shippingAddress}, {o.city} - {o.pincode}</p>
                      <p><strong>Estimate:</strong> {o.estimatedDeliveryDate}</p>
                    </div>

                    <div className="border-t pt-2 space-y-2">
                      {o.items.map((it) => (
                        <div key={it.id} className="space-y-2">
                          <div className="flex justify-between items-center font-bold">
                            <span>{it.title} (x{it.quantity})</span>
                            <span className="text-indigo-600">₹{it.price * it.quantity}</span>
                          </div>

                          {o.status === "Delivered" ? (
                            <div className="bg-slate-50 p-3 rounded-xl border space-y-2 mt-2">
                              <span className="font-bold text-emerald-700 block text-2xs">
                                🌟 Review Unlocked for "{it.title}"
                              </span>
                              <div className="flex items-center gap-2">
                                <label className="text-2xs font-bold">Rating:</label>
                                <select
                                  value={reviewRating}
                                  onChange={(e) => setReviewRating(Number(e.target.value))}
                                  className="p-1 border rounded bg-white font-bold"
                                >
                                  <option value={5}>5 Stars ★★★★★</option>
                                  <option value={4}>4 Stars ★★★★☆</option>
                                  <option value={3}>3 Stars ★★★☆☆</option>
                                  <option value={2}>2 Stars ★★☆☆☆</option>
                                  <option value={1}>1 Star ★☆☆☆☆</option>
                                </select>
                              </div>
                              <input
                                type="text"
                                placeholder="Write your verified product review..."
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-white"
                              />
                              <button
                                onClick={() => handleAddReview(it.id)}
                                className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-2xs cursor-pointer"
                              >
                                Submit Verified Review
                              </button>
                            </div>
                          ) : (
                            <p className="text-2xs text-slate-400 italic">
                              🔒 Review capability unlocks once seller updates status to "Delivered".
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="font-bold pt-2 border-t text-right text-slate-900">Total Amount: ₹{o.totalAmount}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "seller" && currentUser?.role === "seller" && (
          <div className="space-y-6">
            <div className="bg-white border p-3 rounded-2xl flex gap-2 text-xs font-semibold shadow-sm">
              <button
                onClick={() => setSellerSubTab("dashboard")}
                className={`px-4 py-2 rounded-xl cursor-pointer ${sellerSubTab === "dashboard" ? "bg-slate-900 text-white" : ""}`}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setSellerSubTab("add-product")}
                className={`px-4 py-2 rounded-xl cursor-pointer ${sellerSubTab === "add-product" ? "bg-slate-900 text-white" : ""}`}
              >
                ➕ Add Product
              </button>
              <button
                onClick={() => setSellerSubTab("inventory")}
                className={`px-4 py-2 rounded-xl cursor-pointer ${sellerSubTab === "inventory" ? "bg-slate-900 text-white" : ""}`}
              >
                📦 Inventory ({sellerProducts.length})
              </button>
              <button
                onClick={() => setSellerSubTab("orders")}
                className={`px-4 py-2 rounded-xl cursor-pointer ${sellerSubTab === "orders" ? "bg-slate-900 text-white" : ""}`}
              >
                🚚 Customer Orders ({sellerOrders.length})
              </button>
            </div>

            {sellerSubTab === "dashboard" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                  <span className="text-xs font-bold text-slate-400">TOTAL REVENUE</span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">₹{sellerRevenue}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                  <span className="text-xs font-bold text-slate-400">ACTIVE LISTINGS</span>
                  <h3 className="text-2xl font-black text-slate-900 mt-1">{sellerProducts.length}</h3>
                </div>
              </div>
            )}

            {sellerSubTab === "add-product" && (
              <div className="bg-white p-6 rounded-2xl border max-w-xl mx-auto space-y-4 text-xs font-medium shadow-sm">
                <h2 className="text-lg font-bold">List Product for Campus</h2>
                <form onSubmit={handleAddProduct} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 mb-1">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-white font-bold"
                    >
                      {CATEGORIES.filter(c => c.name !== "All").map((c) => (
                        <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Product Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Engineering Mathematics Textbook / Table Lamp"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      className="w-full p-2.5 rounded-xl border"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 mb-1">Price (₹)</label>
                      <input
                        type="number"
                        placeholder="250"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        required
                        className="w-full p-2.5 rounded-xl border"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 mb-1">Stock</label>
                      <input
                        type="number"
                        placeholder="1"
                        value={newStock}
                        onChange={(e) => setNewStock(e.target.value)}
                        required
                        className="w-full p-2.5 rounded-xl border"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Product Image</label>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="w-full border p-2 rounded-xl" />
                  </div>

                  <div>
                    <label className="block text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      placeholder="Enter condition, usage details, hostel pickup location..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      className="w-full p-2.5 rounded-xl border"
                    />
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl cursor-pointer">
                    Publish Product to Campus
                  </button>
                </form>
              </div>
            )}

            {sellerSubTab === "inventory" && (
              <div className="bg-white rounded-2xl border p-5 text-xs space-y-3 shadow-sm">
                <h2 className="font-bold text-sm">Your Active Listings</h2>
                {sellerProducts.length === 0 ? (
                  <p className="text-slate-500">No items listed yet.</p>
                ) : (
                  sellerProducts.map((p) => (
                    <div key={p.id} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <span className="font-bold">{p.title}</span>
                        <span className="text-2xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded ml-2">{p.category}</span>
                      </div>
                      <span className="font-bold text-indigo-600">₹{p.price}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {sellerSubTab === "orders" && (
              <div className="bg-white rounded-2xl border p-5 text-xs space-y-4 shadow-sm">
                <h2 className="font-bold text-sm">Fulfill Student Orders</h2>
                {sellerOrders.length === 0 ? (
                  <p className="text-slate-500">No orders received yet.</p>
                ) : (
                  sellerOrders.map((o) => (
                    <div key={o.id} className="border p-4 rounded-xl space-y-2">
                      <div className="flex justify-between font-bold">
                        <span>Order #{o.orderCode} - Buyer: {o.customerName}</span>
                        <span className="text-indigo-600">₹{o.totalAmount}</span>
                      </div>
                      <p className="text-slate-600">📍 <strong>Deliver To:</strong> {o.shippingAddress}, {o.city} ({o.pincode})</p>
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="font-bold">Update Status:</span>
                        <button
                          onClick={() => updateOrderStatus(o.id!, "Pending")}
                          className={`px-3 py-1 rounded text-2xs font-bold cursor-pointer ${o.status === "Pending" ? "bg-amber-600 text-white" : "bg-slate-100"}`}
                        >
                          Pending
                        </button>
                        <button
                          onClick={() => updateOrderStatus(o.id!, "Shipped")}
                          className={`px-3 py-1 rounded text-2xs font-bold cursor-pointer ${o.status === "Shipped" ? "bg-blue-600 text-white" : "bg-slate-100"}`}
                        >
                          Shipped
                        </button>
                        <button
                          onClick={() => updateOrderStatus(o.id!, "Delivered")}
                          className={`px-3 py-1 rounded text-2xs font-bold cursor-pointer ${o.status === "Delivered" ? "bg-emerald-600 text-white" : "bg-slate-100"}`}
                        >
                          Delivered
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}