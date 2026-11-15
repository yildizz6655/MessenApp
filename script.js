
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    addDoc,
    query,
    where,
    onSnapshot,
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

// BAĞLANTI

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML ELEMANLARI

const $ = id => document.getElementById(id);

const loginScreen = $("loginScreen");
const appScreen = $("appScreen");

const emailInput = $("emailInput");
const passwordInput = $("passwordInput");
const usernameInput = $("usernameInput");

const loginBtn = $("loginBtn");
const registerBtn = $("registerBtn");
const loginError = $("loginError");

const searchInput = $("searchInput");
const chatList = $("chatList");

const messagesBox = $("messages");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");

const logoutBtn = $("logoutBtn");
const backBtn = $("backBtn");

const profileName = $("profileName");
const saveProfileBtn = $("saveProfileBtn");

let currentUser = null;
let activeChatId = null;
let activeReceiver = null;

let unsubscribeChats = null;
let unsubscribeMessages = null;

function showError(message) {
    if (loginError) loginError.textContent = message;
    else alert(message);
}

function showApp(loggedIn) {
    if (loginScreen) loginScreen.hidden = loggedIn;
    if (appScreen) appScreen.hidden = !loggedIn;
}

// KAYIT OL

if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        const username = usernameInput?.value.trim();

        if (!email || !password || !username) {
            return showError("Bütün alanları doldur!");
        }

        if (password.length < 6) {
            return showError("Şifre en az 6 karakter olmalı!");
        }

        try {
            const result = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await setDoc(doc(db, "users", result.user.uid), {
                uid: result.user.uid,
                email,
                username,
                usernameLower: username.toLowerCase(),
                createdAt: serverTimestamp(),
                online: true
            });

            showError("");
        } catch (error) {
            showError(error.message);
        }
    });
}

// GİRİŞ YAP

if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const email = emailInput?.value.trim();
        const password = passwordInput?.value;

        if (!email || !password) {
            return showError("E-posta ve şifreni gir!");
        }

        try {
            await signInWithEmailAndPassword(auth, email, password);
            showError("");
        } catch (error) {
            showError("Giriş başarısız: " + error.message);
        }
    });
}

// OTURUM KONTROLÜ

onAuthStateChanged(auth, async user => {
    currentUser = user;

    if (user) {
        showApp(true);

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            if (profileName) {
                profileName.value = userSnap.data().username || "";
            }
        }

        loadChats();
    } else {
        showApp(false);

        if (unsubscribeChats) unsubscribeChats();
        if (unsubscribeMessages) unsubscribeMessages();

        activeChatId = null;
        activeReceiver = null;
    }
});

// PROFİL KAYDET

if (saveProfileBtn) {
    saveProfileBtn.addEventListener("click", async () => {
        if (!currentUser) return;

        const username = profileName?.value.trim();

        if (!username) {
            return alert("Kullanıcı adı gir!");
        }

        try {
            await setDoc(
                doc(db, "users", currentUser.uid),
                {
                    username,
                    usernameLower: username.toLowerCase()
                },
                { merge: true }
            );

            alert("Profil kaydedildi!");
        } catch (error) {
            alert(error.message);
        }
    });
}

// KULLANICI ARA

let searchTimeout;

if (searchInput) {
    searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout);

        searchTimeout = setTimeout(searchUsers, 400);
    });
}

async function searchUsers() {
    if (!currentUser || !searchInput) return;

    const term = searchInput.value.trim().toLowerCase();

    if (!term) {
        return;
    }

    try {
        const usersQuery = query(
            collection(db, "users"),
            where("usernameLower", ">=", term),
            where("usernameLower", "<=", term + "\uf8ff")
        );

        const result = await getDocs(usersQuery);

        if (!chatList) return;

        chatList.innerHTML = "";

        result.forEach(userDoc => {
            const user = userDoc.data();

            if (user.uid === currentUser.uid) return;

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
            description.textContent = "Mesaj göndermek için dokun";

            info.append(name, description);
            item.append(avatar, info);

            item.addEventListener("click", () => {
                openChat(user);
            });

            chatList.appendChild(item);
        });

    } catch (error) {
        console.error("Arama hatası:", error);
    }
}

// SOHBET OLUŞTUR

async function openChat(receiver) {
    if (!currentUser) return;

    try {
        const chatsQuery = query(
            collection(db, "chats"),
            where("participants", "array-contains", currentUser.uid)
        );

        const result = await getDocs(chatsQuery);

        let foundChat = null;

        result.forEach(chatDoc => {
            const participants = chatDoc.data().participants || [];

            if (participants.includes(receiver.uid)) {
                foundChat = chatDoc.id;
            }
        });

        if (foundChat) {
            activeChatId = foundChat;
        } else {
            const newChat = await addDoc(collection(db, "chats"), {
                participants: [currentUser.uid, receiver.uid],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            activeChatId = newChat.id;
        }

        activeReceiver = receiver;

        const conversation = $("conversationScreen");

        if (conversation) conversation.hidden = false;

        const conversationName = $("conversationName");

        if (conversationName) {
            conversationName.textContent = receiver.username;
        }

        loadMessages();

    } catch (error) {
        alert("Sohbet açılamadı: " + error.message);
    }
}

// MESAJLARI YÜKLE

function loadMessages() {
    if (!activeChatId) return;

    if (unsubscribeMessages) unsubscribeMessages();

    if (!messagesBox) return;

    const messagesRef = collection(
        db,
        "chats",
        activeChatId,
        "messages"
    );

    unsubscribeMessages = onSnapshot(messagesRef, snapshot => {
        messagesBox.innerHTML = "";

        const messages = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        messages.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeA - timeB;
        });

        messages.forEach(message => {
            const bubble = document.createElement("div");

            bubble.className =
                "message " +
                (message.senderId === currentUser.uid
                    ? "sent"
                    : "received");

            const text = document.createElement("div");
            text.textContent = message.text || "";

            bubble.appendChild(text);
            messagesBox.appendChild(bubble);
        });

        messagesBox.scrollTop = messagesBox.scrollHeight;

    }, error => {
        console.error("Mesaj yükleme hatası:", error);
    });
}

// MESAJ GÖNDER

async function sendMessage() {
    if (!currentUser || !activeChatId || !messageInput) return;

    const text = messageInput.value.trim();

    if (!text) return;

    try {
        await addDoc(
            collection(db, "chats", activeChatId, "messages"),
            {
                text,
                senderId: currentUser.uid,
                createdAt: serverTimestamp()
            }
        );

        await setDoc(
            doc(db, "chats", activeChatId),
            { updatedAt: serverTimestamp() },
            { merge: true }
        );

        messageInput.value = "";

    } catch (error) {
        alert("Mesaj gönderilemedi: " + error.message);
    }
}

if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
}

if (messageInput) {
    messageInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            sendMessage();
        }
    });
}

// SOHBETLERİ YÜKLE

function loadChats() {
    if (!currentUser || !chatList) return;

    if (unsubscribeChats) unsubscribeChats();

    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser.uid)
    );

    unsubscribeChats = onSnapshot(chatsQuery, async snapshot => {
        const chatDocs = snapshot.docs;

        chatDocs.sort((a, b) => {
            const timeA = a.data().updatedAt?.toMillis?.() || 0;
            const timeB = b.data().updatedAt?.toMillis?.() || 0;
            return timeB - timeA;
        });

        chatList.innerHTML = "";

        for (const chatDoc of chatDocs) {
            const participants = chatDoc.data().participants || [];
            const otherUid = participants.find(
                uid => uid !== currentUser.uid
            );

            if (!otherUid) continue;

            const userSnap = await getDoc(doc(db, "users", otherUid));

            if (!userSnap.exists()) continue;

            const otherUser = userSnap.data();

            const item = document.createElement("div");
            item.className = "chat-item";

            const avatar = document.createElement("div");
            avatar.className = "chat-avatar";
            avatar.textContent = "👤";

            const info = document.createElement("div");
            info.className = "chat-info";

            const name = document.createElement("h4");
            name.textContent = otherUser.username || "Kullanıcı";

            const description = document.createElement("p");
            description.textContent = "Sohbete başla";

            info.append(name, description);
            item.append(avatar, info);

            item.addEventListener("click", () => {
                activeChatId = chatDoc.id;
                activeReceiver = otherUser;

                const conversation = $("conversationScreen");
                if (conversation) conversation.hidden = false;

                const conversationName = $("conversationName");
                if (conversationName) {
                    conversationName.textContent = otherUser.username;
                }

                loadMessages();
            });

            chatList.appendChild(item);
        }
    });
}

// SOHBETTEN GERİ DÖN

if (backBtn) {
    backBtn.addEventListener("click", () => {
        const conversation = $("conversationScreen");

        if (conversation) conversation.hidden = true;

        if (unsubscribeMessages) {
            unsubscribeMessages();
            unsubscribeMessages = null;
        }

        activeChatId = null;
        activeReceiver = null;
    });
}

// ÇIKIŞ YAP

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        try {
            await signOut(auth);
        } catch (error) {
            alert(error.message);
        }
    });
}

console.log("messenApp Firebase bağlantısı hazır!");
