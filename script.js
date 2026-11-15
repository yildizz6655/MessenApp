
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML ELEMANLARI

const $ = id => document.getElementById(id);

const loginScreen = $("loginScreen");
const appScreen = $("appScreen");

const emailInput = $("email");
const passwordInput = $("password");

const loginBtn = $("loginBtn");
const registerBtn = $("registerBtn");
const loginError = $("loginError");

const searchInput = $("userSearch");
const chatList = $("chatList");
const friendsList = $("friendsList");

const messagesBox = $("messages");
const messageInput = $("messageInput");
const messageForm = $("messageForm");

const logoutBtn = $("logoutBtn");
const backBtn = $("backBtn");

const profileName = $("profileName");
const profileEmail = $("profileEmail");
const newUsername = $("newUsername");
const saveProfileBtn = $("saveProfileBtn");

const conversationName = $("receiverName");
const conversationScreen = $("conversationScreen");

let currentUser = null;
let activeChatId = null;
let activeReceiver = null;

let unsubscribeChats = null;
let unsubscribeMessages = null;
let searchTimeout = null;

// EKRAN KONTROLÜ

function showError(message) {
    loginError.textContent = message;
}

function showApp(loggedIn) {
    loginScreen.hidden = loggedIn;
    appScreen.hidden = !loggedIn;
}

// KAYIT OL

registerBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        return showError("E-posta ve şifreni doldur!");
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

        const username = email.split("@")[0];

        await setDoc(doc(db, "users", result.user.uid), {
            uid: result.user.uid,
            email: email,
            username: username,
            usernameLower: username.toLowerCase(),
            createdAt: serverTimestamp()
        });

        showError("");

    } catch (error) {
        showError("Kayıt hatası: " + error.message);
    }
});

// GİRİŞ YAP

loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        return showError("E-posta ve şifreni gir!");
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showError("");

    } catch (error) {
        showError("Giriş hatası: " + error.message);
    }
});

// OTURUM KONTROLÜ

onAuthStateChanged(auth, async user => {
    currentUser = user;

    if (!user) {
        showApp(false);

        if (unsubscribeChats) unsubscribeChats();
        if (unsubscribeMessages) unsubscribeMessages();

        unsubscribeChats = null;
        unsubscribeMessages = null;

        activeChatId = null;
        activeReceiver = null;

        conversationScreen.hidden = true;
        return;
    }

    showApp(true);

    try {
        const userDoc = await getDoc(
            doc(db, "users", user.uid)
        );

        if (userDoc.exists()) {
            const data = userDoc.data();

            profileName.textContent = data.username || "Kullanıcı";
            profileEmail.textContent = data.email || user.email || "";
            newUsername.value = data.username || "";
        }

        loadChats();

    } catch (error) {
        console.error(error);
        alert("Profil yüklenemedi: " + error.message);
    }
});

// PROFİL KAYDET

saveProfileBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    const username = newUsername.value.trim();

    if (!username) {
        return alert("Kullanıcı adı yaz!");
    }

    try {
        await setDoc(
            doc(db, "users", currentUser.uid),
            {
                username: username,
                usernameLower: username.toLowerCase()
            },
            { merge: true }
        );

        profileName.textContent = username;

        alert("Profil kaydedildi!");

    } catch (error) {
        alert("Profil hatası: " + error.message);
    }
});

// SEKMELER

document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(item => {
            item.classList.remove("active");
        });

        tab.classList.add("active");

        $("chatsPage").hidden = tab.dataset.tab !== "chats";
        $("friendsPage").hidden = tab.dataset.tab !== "friends";
        $("profilePage").hidden = tab.dataset.tab !== "profile";
    });
});

// KULLANICI ARAMA

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(searchUsers, 400);
});

async function searchUsers() {
    if (!currentUser) return;

    const term = searchInput.value.trim().toLowerCase();

    friendsList.innerHTML = "";

    if (!term) {
        friendsList.textContent = "Kullanıcı aramak için isim yaz.";
        return;
    }

    try {
        const usersQuery = query(
            collection(db, "users"),
            where("usernameLower", ">=", term),
            where("usernameLower", "<=", term + "\uf8ff")
        );

        const result = await getDocs(usersQuery);

        let found = 0;

        result.forEach(userDoc => {
            const user = userDoc.data();

            if (user.uid === currentUser.uid) return;

            found++;

            const item = createUserItem(user);

            friendsList.appendChild(item);
        });

        if (found === 0) {
            friendsList.textContent = "Kullanıcı bulunamadı.";
        }

        document.querySelector('[data-tab="friends"]').click();

    } catch (error) {
        console.error(error);
        alert("Arama yapılamadı: " + error.message);
    }
}

// KULLANICI KARTI

function createUserItem(user) {
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

    item.addEventListener("click", () => {
        openChat(user);
    });

    return item;
}

// SOHBET AÇ

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

        conversationName.textContent = receiver.username || "Kullanıcı";
        conversationScreen.hidden = false;

        loadMessages();

    } catch (error) {
        alert("Sohbet açılamadı: " + error.message);
    }
}

// MESAJLARI YÜKLE

function loadMessages() {
    if (!activeChatId) return;

    if (unsubscribeMessages) unsubscribeMessages();

    const messagesRef = collection(
        db,
        "chats",
        activeChatId,
        "messages"
    );

    unsubscribeMessages = onSnapshot(
        messagesRef,
        snapshot => {
            messagesBox.innerHTML = "";

            const messages = snapshot.docs.map(item => ({
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
        },
        error => {
            console.error("Mesaj hatası:", error);
        }
    );
}

// MESAJ GÖNDER

async function sendMessage() {
    if (!currentUser || !activeChatId) return;

    const text = messageInput.value.trim();

    if (!text) return;

    try {
        await addDoc(
            collection(db, "chats", activeChatId, "messages"),
            {
                text: text,
                senderId: currentUser.uid,
                createdAt: serverTimestamp()
            }
        );

        await setDoc(
            doc(db, "chats", activeChatId),
            {
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );

        messageInput.value = "";

    } catch (error) {
        alert("Mesaj gönderilemedi: " + error.message);
    }
}

// MESAJ FORMU

messageForm.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage();
});

// SOHBETLERİ YÜKLE

function loadChats() {
    if (!currentUser) return;

    if (unsubscribeChats) unsubscribeChats();

    const chatsQuery = query(
        collection(db, "chats"),
        where("participants", "array-contains", currentUser.uid)
    );

    unsubscribeChats = onSnapshot(
        chatsQuery,
        async snapshot => {
            chatList.innerHTML = "";

            if (snapshot.empty) {
                const empty = document.createElement("div");
                empty.className = "empty-state";
                empty.innerHTML = `
                    <span>💬</span>
                    <h3>Henüz sohbetin yok</h3>
                    <p>Arkadaşlarını bul ve sohbet etmeye başla.</p>
                `;

                chatList.appendChild(empty);
                return;
            }

            const chats = snapshot.docs.map(item => item);

            chats.sort((a, b) => {
                const timeA = a.data().updatedAt?.toMillis?.() || 0;
                const timeB = b.data().updatedAt?.toMillis?.() || 0;

                return timeB - timeA;
            });

            for (const chatDoc of chats) {
                const participants = chatDoc.data().participants || [];

                const otherUid = participants.find(
                    uid => uid !== currentUser.uid
                );

                if (!otherUid) continue;

                const userSnap = await getDoc(
                    doc(db, "users", otherUid)
                );

                if (!userSnap.exists()) continue;

                const otherUser = userSnap.data();

                const item = createUserItem(otherUser);

                chatList.appendChild(item);

                item.addEventListener("click", () => {
                    activeChatId = chatDoc.id;
                    activeReceiver = otherUser;

                    conversationName.textContent =
                        otherUser.username || "Kullanıcı";

                    conversationScreen.hidden = false;

                    loadMessages();
                });
            }
        },
        error => {
            console.error("Sohbet listesi hatası:", error);
        }
    );
}

// SOHBETTEN GERİ DÖN

backBtn.addEventListener("click", () => {
    conversationScreen.hidden = true;

    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }

    activeChatId = null;
    activeReceiver = null;
});

// ÇIKIŞ YAP

logoutBtn.addEventListener("click", async () => {
    try {
        await signOut(auth);
    } catch (error) {
        alert(error.message);
    }
});

console.log("messenApp hazır!");
    
