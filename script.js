
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// FIREBASE AYARLARI
const firebaseConfig = {
    apiKey: "AIzaSyCwwEY9UuOs71ZjHgMIknRIwLqXFsTh6es",
    authDomain: "messenapp-1daa6.firebaseapp.com",
    projectId: "messenapp-1daa6",
    storageBucket: "messenapp-1daa6.firebasestorage.app",
    messagingSenderId: "396353593504",
    appId: "1:396353593504:web:3f0672539772b94a1469c5",
    measurementId: "G-JCLKWJF88M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

// ELEMANLAR
const loginScreen = $("loginScreen");
const appScreen = $("appScreen");
const conversationScreen = $("conversationScreen");

const emailInput = $("email");
const passwordInput = $("password");
const loginError = $("loginError");

const loginBtn = $("loginBtn");
const registerBtn = $("registerBtn");
const forgotPasswordBtn = $("forgotPasswordBtn");

const userSearch = $("userSearch");
const friendsList = $("friendsList");
const chatList = $("chatList");

const messages = $("messages");
const messageInput = $("messageInput");
const messageForm = $("messageForm");

const profileName = $("profileName");
const profileEmail = $("profileEmail");
const newUsername = $("newUsername");

let currentUser = null;
let currentChatId = null;
let currentReceiver = null;

let unsubscribeMessages = null;
let unsubscribeChats = null;

// HATA MESAJI
function showError(message) {
    loginError.textContent = message;
}

function translateError(error) {
    const errors = {
        "auth/email-already-in-use": "Bu e-posta zaten kayıtlı.",
        "auth/invalid-email": "E-posta adresi geçersiz.",
        "auth/weak-password": "Şifre en az 6 karakter olmalı.",
        "auth/user-not-found": "Hesap bulunamadı.",
        "auth/wrong-password": "Şifre yanlış.",
        "auth/invalid-credential": "E-posta veya şifre hatalı.",
        "auth/too-many-requests": "Çok fazla deneme yaptın. Bekle.",
        "auth/network-request-failed": "İnternet bağlantını kontrol et.",
        "auth/operation-not-allowed": "Firebase e-posta girişini etkinleştir.",
        "auth/unauthorized-domain": "GitHub Pages alan adını Firebase'e ekle.",
        "permission-denied": "Firebase güvenlik kurallarını kontrol et."
    };

    return errors[error.code] || error.message;
}

// EKRANLARI DEĞİŞTİR
function showLoginScreen() {
    loginScreen.hidden = false;
    loginScreen.style.display = "flex";

    appScreen.hidden = true;
    appScreen.style.display = "none";

    conversationScreen.hidden = true;
    conversationScreen.style.display = "none";
}

function showAppScreen() {
    loginScreen.hidden = true;
    loginScreen.style.display = "none";

    appScreen.hidden = false;
    appScreen.style.display = "block";

    conversationScreen.hidden = true;
    conversationScreen.style.display = "none";
}

// ŞİFREMİ UNUTTUM
forgotPasswordBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    showError("");

    if (!email || !emailInput.checkValidity()) {
        showError("Geçerli e-posta adresini yaz.");
        emailInput.focus();
        return;
    }

    forgotPasswordBtn.disabled = true;
    forgotPasswordBtn.textContent = "Gönderiliyor...";

    try {
        await sendPasswordResetEmail(auth, email);
        alert("Şifre yenileme bağlantısı gönderildi. Spam klasörünü de kontrol et.");
    } catch (error) {
        showError(translateError(error));
    } finally {
        forgotPasswordBtn.disabled = false;
        forgotPasswordBtn.textContent = "Şifremi Unuttum?";
    }
});

// HESAP OLUŞTUR
registerBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    showError("");

    if (!email || !password) {
        showError("E-posta ve şifreni gir.");
        return;
    }

    if (!emailInput.checkValidity()) {
        showError("Geçerli bir e-posta adresi gir.");
        return;
    }

    if (password.length < 6) {
        showError("Şifre en az 6 karakter olmalı.");
        return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = "Hesap oluşturuluyor...";

    try {
        const result = await createUserWithEmailAndPassword(
            auth, email, password
        );

        const username = email.split("@")[0];

        await setDoc(doc(db, "users", result.user.uid), {
            uid: result.user.uid,
            email,
            username,
            usernameLower: username.toLowerCase(),
            createdAt: serverTimestamp()
        });

        showError("");

    } catch (error) {
        showError(translateError(error));
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = "Yeni Hesap Oluştur";
    }
});

// GİRİŞ YAP
loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    showError("");

    if (!email || !password) {
        showError("E-posta ve şifreni gir.");
        return;
    }

    if (!emailInput.checkValidity()) {
        showError("Geçerli bir e-posta adresi gir.");
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Giriş yapılıyor...";

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showError("");
    } catch (error) {
        showError(translateError(error));
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Giriş Yap";
    }
});

// ENTER İLE GİRİŞ
passwordInput.addEventListener("keydown", event => {
    if (event.key === "Enter") loginBtn.click();
});

// OTURUM KONTROLÜ
onAuthStateChanged(auth, async user => {
    currentUser = user;

    if (user) {
        showAppScreen();
        showError("");

        try {
            await loadProfile();
            loadChats();
        } catch (error) {
            console.error("Yükleme hatası:", error);
            alert("Uygulama yüklenemedi: " + error.message);
        }

    } else {
        showLoginScreen();

        if (unsubscribeChats) {
            unsubscribeChats();
            unsubscribeChats = null;
        }

        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        currentChatId = null;
        currentReceiver = null;
    }
});

// PROFİL YÜKLE
async function loadProfile() {
    if (!currentUser) return;

    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
        const username = currentUser.email.split("@")[0];

        await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            username,
            usernameLower: username.toLowerCase(),
            createdAt: serverTimestamp()
        });

        profileName.textContent = username;
        newUsername.value = username;

    } else {
        const data = snap.data();
        profileName.textContent = data.username || "Kullanıcı";
        newUsername.value = data.username || "";
    }

    profileEmail.textContent = currentUser.email;
}

// PROFİL KAYDET
$("saveProfileBtn").addEventListener("click", async () => {
    if (!currentUser) return;

    const username = newUsername.value.trim();

    if (username.length < 3) {
        alert("Kullanıcı adı en az 3 karakter olmalı.");
        return;
    }

    try {
        await updateDoc(doc(db, "users", currentUser.uid), {
            username,
            usernameLower: username.toLowerCase()
        });

        profileName.textContent = username;
        alert("Profil kaydedildi!");

    } catch (error) {
        alert(translateError(error));
    }
});

// SEKME DEĞİŞTİR
document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(item => {
            item.classList.remove("active");
        });

        tab.classList.add("active");

        $("chatsPage").hidden = tab.dataset.tab !== "chats";
        $("friendsPage").hidden = tab.dataset.tab !== "friends";
        $("profilePage").hidden = tab.dataset.tab !== "profile";

        conversationScreen.hidden = true;
        conversationScreen.style.display = "none";
    });
});

// PROFİL KISAYOLU
$("profileBtn").addEventListener("click", () => {
    document.querySelector('[data-tab="profile"]').click();
});

// ARAMA KISAYOLU
$("searchBtn").addEventListener("click", () => {
    userSearch.focus();
    userSearch.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});

// KULLANICI ARAMA
let searchTimeout;

userSearch.addEventListener("input", () => {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
        searchUsers(userSearch.value.trim().toLowerCase());
    }, 350);
});

async function searchUsers(search) {
    friendsList.innerHTML = "";

    if (!search || !currentUser) return;

    try {
        const q = query(
            collection(db, "users"),
            where("usernameLower", ">=", search),
            where("usernameLower", "<=", search + "\uf8ff")
        );

        const result = await getDocs(q);

        result.forEach(userDoc => {
            const user = userDoc.data();

            if (user.uid === currentUser.uid) return;

            createUserItem(user, friendsList);
        });

        if (!friendsList.innerHTML) {
            friendsList.innerHTML =
                "<p style='padding:20px'>Kullanıcı bulunamadı.</p>";
        }

        document.querySelector('[data-tab="friends"]').click();

    } catch (error) {
        console.error("Arama hatası:", error);
        friendsList.innerHTML =
            "<p style='padding:20px'>Arama yapılamadı.</p>";
    }
}

// KULLANICI KARTI
function createUserItem(user, container) {
    const item = document.createElement("div");
    item.className = "chat-item";

    const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
    avatar.textContent = "👤";

    const info = document.createElement("div");
    info.className = "chat-info";

    const name = document.createElement("h4");
    name.textContent = user.username || "Kullanıcı";

    const description = document.createElement("p");
    description.textContent = "Sohbet başlat";

    info.append(name, description);
    item.append(avatar, info);

    item.addEventListener("click", () => openChat(user));

    container.appendChild(item);
}

// SOHBET ID
function makeChatId(uid1, uid2) {
    return [uid1, uid2].sort().join("_");
}

// SOHBET AÇ
async function openChat(receiver) {
    if (!currentUser) return;

    try {
        const chatId = makeChatId(currentUser.uid, receiver.uid);
        const chatRef = doc(db, "chats", chatId);
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) {
            await setDoc(chatRef, {
                participants: [currentUser.uid, receiver.uid],
                createdAt: serverTimestamp(),
                lastMessage: "",
                updatedAt: serverTimestamp()
            });
        }

        currentChatId = chatId;
        currentReceiver = receiver;

        $("receiverName").textContent = receiver.username || "Kullanıcı";
        $("receiverStatus").textContent = "Sohbet";

        conversationScreen.hidden = false;
        conversationScreen.style.display = "flex";

        loadMessages(chatId);

    } catch (error) {
        alert("Sohbet açılamadı: " + translateError(error));
    }
}

// MESAJLARI YÜKLE
function loadMessages(chatId) {
    if (unsubscribeMessages) unsubscribeMessages();

    messages.innerHTML = "";

    const q = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("createdAt", "asc")
    );

    unsubscribeMessages = onSnapshot(q, snapshot => {
        messages.innerHTML = "";

        snapshot.forEach(messageDoc => {
            const data = messageDoc.data();
            const message = document.createElement("div");

            message.className =
                "message " +
                (data.senderId === currentUser.uid ? "sent" : "received");

            const text = document.createElement("div");
            text.textContent = data.text;

            message.appendChild(text);
            messages.appendChild(message);
        });

        messages.scrollTop = messages.scrollHeight;

    }, error => {
        console.error("Mesaj hatası:", error);
        alert("Mesajlar yüklenemedi: " + translateError(error));
    });
}

// MESAJ GÖNDER
messageForm.addEventListener("submit", async event => {
    event.preventDefault();

    const text = messageInput.value.trim();

    if (!text || !currentChatId || !currentUser) return;

    messageInput.value = "";

    try {
        await addDoc(
            collection(db, "chats", currentChatId, "messages"),
            {
                text,
                senderId: currentUser.uid,
                createdAt: serverTimestamp()
            }
        );

        await updateDoc(doc(db, "chats", currentChatId), {
            lastMessage: text,
            updatedAt: serverTimestamp()
        });

    } catch (error) {
        alert("Mesaj gönderilemedi: " + translateError(error));
        messageInput.value = text;
    }
});

// SOHBET LİSTESİ
function loadChats() {
    if (unsubscribeChats) unsubscribeChats();

    const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser.uid)
    );

    unsubscribeChats = onSnapshot(q, async snapshot => {
        chatList.innerHTML = "";

        if (snapshot.empty) {
            chatList.innerHTML = `
                <div class="empty-state">
                    <span>💬</span>
                    <h3>Henüz sohbetin yok</h3>
                    <p>Arkadaşlarını bul ve sohbet etmeye başla.</p>
                </div>
            `;
            return;
        }

        for (const chatDoc of snapshot.docs) {
            const chat = chatDoc.data();

            const otherUid = chat.participants.find(
                uid => uid !== currentUser.uid
            );

            if (!otherUid) continue;

            try {
                const userSnap = await getDoc(doc(db, "users", otherUid));

                if (!userSnap.exists()) continue;

                const user = userSnap.data();

                const item = document.createElement("div");
                item.className = "chat-item";

                const avatar = document.createElement("div");
                avatar.className = "chat-avatar";
                avatar.textContent = "👤";

                const info = document.createElement("div");
                info.className = "chat-info";

                const name = document.createElement("h4");
                name.textContent = user.username || "Kullanıcı";

                const last = document.createElement("p");
                last.textContent = chat.lastMessage || "Sohbet başlatıldı";

                info.append(name, last);
                item.append(avatar, info);

                item.addEventListener("click", () => openChat(user));

                chatList.appendChild(item);

            } catch (error) {
                console.error("Sohbet kullanıcısı hatası:", error);
            }
        }

    }, error => {
        console.error("Sohbet listesi hatası:", error);
    });
}

// GERİ DÖN
$("backBtn").addEventListener("click", () => {
    conversationScreen.hidden = true;
    conversationScreen.style.display = "none";

    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

    currentChatId = null;
    currentReceiver = null;
});

// EMOJİ
$("emojiBtn").addEventListener("click", () => {
    messageInput.value += " 😊";
    messageInput.focus();
});

// ÇIKIŞ
$("logoutBtn").addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        alert("Çıkış yapılamadı: " + translateError(error));
    }
});

// BAŞLANGIÇ
showLoginScreen();

console.log("messenApp hazır!");
    
