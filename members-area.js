document.addEventListener("DOMContentLoaded", async () => {
    let supabase = window.supabaseClient;
    if (!supabase) {
        const provider = window.supabase || window.Supabase;
        if (
            provider &&
            provider.createClient &&
            window.SUPABASE_URL &&
            window.SUPABASE_KEY
        ) {
            try {
                window.supabaseClient = provider.createClient(
                    window.SUPABASE_URL,
                    window.SUPABASE_KEY,
                );
                supabase = window.supabaseClient;
            } catch (e) {
                console.error(e);
            }
        }
    }
    if (!supabase) return;

    // --- PWA Standalone Detection ---
    // --- PWA Standalone Detection (Enhanced) ---
    const isPWA =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true ||
        document.referrer.includes("android-app://");

    const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // PWA初回起動: 強制ログアウトしてログイン画面へ
    if (isPWA && !localStorage.getItem("sodre_pwa_initialized")) {
        localStorage.setItem("sodre_pwa_initialized", "true");
        try {
            await supabase.auth.signOut();
        } catch (e) {
            /* ignore */
        }
        window.location.replace("login.html");
        return;
    }

    // --- DOM Elements ---
    const displayNameEl = document.getElementById("user-display-name");
    const logoutBtn = document.getElementById("logout-btn");
    const tabBtns = document.querySelectorAll(".m-tab-btn");
    const viewAll = document.getElementById("view-all");
    const viewGroups = document.getElementById("view-groups");
    const viewSettings = document.getElementById("view-settings");

    // Feeds
    const allFeed = document.getElementById("all-board-feed");
    const groupFeed = document.getElementById("group-board-feed");
    const groupsList = document.getElementById("my-groups-list");
    const groupBoardView = document.getElementById("group-board-view");
    const currentGroupName = document.getElementById("current-group-name");
    const backToGroupsBtn = document.getElementById("back-to-groups-btn");

    // FAB & Modal Elements
    const fabPost = document.getElementById("fab-post");
    const postModal = document.getElementById("post-modal");
    const modalClose = document.getElementById("modal-close");
    const modalTitle = document.getElementById("modal-title");
    const modalPostContent = document.getElementById("modal-post-content");
    const modalSubmitBtn = document.getElementById("modal-submit-btn");
    const modalPreviewBtn = document.getElementById("modal-preview-btn");

    const previewModal = document.getElementById("preview-modal");
    const previewContainer = document.getElementById("preview-container");
    const previewModalClose = document.getElementById("preview-modal-close");
    const closePreviewBtn = document.getElementById("close-preview-btn");
    // --- Firebase & Notifications ---
    // Initialize Firebase (Compat)
    let messaging = null;
    try {
        if (firebase.messaging.isSupported()) {
            firebase.initializeApp(window.FIREBASE_CONFIG);
            messaging = firebase.messaging();
        }
    } catch (e) {
        console.error("Firebase Init Error:", e);
    }

    // New Schedule Elements
    const scheduleToggle = document.getElementById("schedule-toggle");
    const scheduleOptions = document.getElementById("schedule-options");
    const scheduleDateInput = document.getElementById("schedule-date");
    const scheduleTimeInput = document.getElementById("schedule-time");

    // --- State ---
    let currentPostContext = "all"; // 'all' or 'group'
    let currentGroupId = null;
    let currentGroupCanPost = false;
    // Pagination State
    let allPostsOffset = 0;
    let groupPostsOffset = 0;
    const POST_LIMIT = 50;
    let selectedFiles = []; // Store selected files for upload
    let isAdmin = false; // Admin State
    let isSuperAdmin = false; // Superadmin State
    let currentSession = null; // Store session for token-based features like file access
    let isEditingPostId = null; // Track if we are editing a post

    // --- Quill Rich Text Initialization ---
    let postQuill;
    try {
        postQuill = new Quill("#modal-post-content", {
            theme: "snow",
            modules: {
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    ["bold", "italic", "underline", "strike"],
                    [{ color: [] }, { background: [] }],
                    [{ list: "ordered" }, { list: "bullet" }],
                    [{ align: [] }],
                    ["link"],
                    ["clean"],
                ],
            },
            placeholder: "メッセージを入力...",
        });
    } catch (e) {
        console.error("Quill Post Init Error:", e);
    }

    // --- Auth Check (PWA: セッション自動更新) ---
    if (isPWA) {
        // PWAではセッションを自動更新して維持する (失敗しても即座にログアウトしない)
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
            console.log(
                "Session refresh failed, using local session (Offline mode safe)",
            );
            // リフレッシュ失敗 → ローカルセッションがあるか確認
            const { data: fallback } = await supabase.auth.getSession();
            if (!fallback.session) {
                // 完全にセッションがない場合のみログイン画面へ
                window.location.replace("login.html");
                return;
            }
            currentSession = fallback.session;
        } else {
            currentSession = data.session;
        }
    } else {
        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.replace("login.html");
            return;
        }
        currentSession = session;
    }
    const user = currentSession.user;

    supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === "SIGNED_OUT") {
            window.location.replace("login.html");
        } else if (newSession) {
            currentSession = newSession; // Update session
        }
    });

    loadProfile(user.id);

    // --- PWA Session Persistence (Wake-up Handler) ---
    if (isPWA) {
        const forceSessionRefresh = async () => {
            console.log("App wake-up: Checking session...");
            const { data, error } = await supabase.auth.getSession();

            // If session is missing or about to expire (optional check), try refresh
            // For now, just rely on getSession returning null if invalid, or refreshSession if we want to be aggressive

            if (!data.session) {
                console.log("Session missing on wake-up, attempting refresh...");
                const { data: refreshData, error: refreshError } =
                    await supabase.auth.refreshSession();
                if (refreshError || !refreshData.session) {
                    console.warn("Wake-up refresh failed:", refreshError);
                    // Do not logout immediately to avoid disruption if offline,
                    // but next API call might fail (406).
                    // We can try to redirect if we are sure it's fatal?
                    // For now, let's just log.
                } else {
                    console.log("Session refreshed successfully on wake-up");
                    currentSession = refreshData.session;
                }
            } else {
                console.log("Session valid on wake-up");
                currentSession = data.session;
            }
        };

        // Debounce logic to prevent multiple calls
        let refreshTimeout;
        const debouncedRefresh = () => {
            if (refreshTimeout) clearTimeout(refreshTimeout);
            refreshTimeout = setTimeout(forceSessionRefresh, 1000);
        };

        // --- IndexedDB Helper for Badge Reset ---
        const clearBadgeCount = () => {
            if (navigator.clearAppBadge) {
                navigator.clearAppBadge().catch(console.error);
            }
            const request = indexedDB.open("SodreAppDB", 1);
            request.onsuccess = (event) => {
                const db = event.target.result;
                if (db.objectStoreNames.contains("badge_store")) {
                    const transaction = db.transaction(["badge_store"], "readwrite");
                    const store = transaction.objectStore("badge_store");
                    store.put({ id: "unread_count", value: 0 });
                }
            };
        };

        // Clear badge on initial load
        clearBadgeCount();

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                debouncedRefresh();
                clearBadgeCount();
            }
        });

        window.addEventListener("online", () => {
            console.log("Network online: refreshing session...");
            debouncedRefresh();
        });
        window.addEventListener("online", () => {
            console.log("Network online: refreshing session...");
            debouncedRefresh();
        });
    }

    // --- Periodic Credential Verification (Security Check) ---
    // Removed: Plain text password polling has been replaced by Supabase session management.

    // --- Firebase: Token refresh & Foreground message handling (after session is ready) ---
    async function refreshFCMToken() {
        if (!messaging || Notification.permission !== "granted") return;
        if (localStorage.getItem("sodre_notifications_disabled") === "true") return; // User opted out
        try {
            let registration = await navigator.serviceWorker.getRegistration();
            if (!registration) registration = await navigator.serviceWorker.ready;

            // Get current token from Firebase
            const token = await messaging.getToken({
                vapidKey: window.FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration,
            });

            if (token) {
                // Optimization: Check if token is already synced
                const storageKey = `sodre_fcm_token_${user.id}`;
                const lastSynced = localStorage.getItem(`${storageKey}_time`);
                const lastToken = localStorage.getItem(storageKey);
                const now = Date.now();
                const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

                // Condition to update DB:
                // 1. Token changed
                // 2. Not synced yet
                // 3. Synced more than 24 hours ago (to keep "last_updated" fresh)
                const needsUpdate =
                    !lastToken ||
                    lastToken !== token ||
                    !lastSynced ||
                    now - parseInt(lastSynced) > TWENTY_FOUR_HOURS;

                if (needsUpdate) {
                    const ua = navigator.userAgent;
                    let deviceType = "web";
                    if (/android/i.test(ua)) deviceType = "android";
                    else if (/iPad|iPhone|iPod/.test(ua)) deviceType = "ios";

                    const { error } = await supabase.from("user_fcm_tokens").upsert(
                        {
                            user_id: currentSession.user.id,
                            token: token,
                            device_type: deviceType,
                            last_updated: new Date().toISOString(), // Ensure column exists or defaults to now()
                        },
                        { onConflict: "user_id,token" },
                    );

                    if (!error) {
                        localStorage.setItem(storageKey, token);
                        localStorage.setItem(`${storageKey}_time`, now.toString());
                        console.log("FCM token synced to DB");
                    } else {
                        console.error("FCM sync error:", error);
                    }
                } else {
                    console.log("FCM token already up to date");
                }
            }
        } catch (err) {
            console.error("FCM token refresh error:", err);
        }
    }

    // Token refresh (permission is managed on login.js)
    await refreshFCMToken();

    // Periodic check (every 30 minutes, but will only write to DB if needed)
    setInterval(refreshFCMToken, 30 * 60 * 1000);

    // Handle foreground messages as proper push notifications
    if (messaging) {
        messaging.onMessage((payload) => {
            if (localStorage.getItem("sodre_notifications_disabled") === "true")
                return;
            console.log("Foreground message received:", payload);
            const title = payload.data?.title || "SoDRé";
            const body = payload.data?.body || "";
            if (Notification.permission === "granted") {
                const notif = new Notification(title, {
                    body: body,
                    icon: "https://lh3.googleusercontent.com/a/ACg8ocKrevxxn-jyPFTJ3zy5r6EFRGmv0Tp8-qWyb3bMaXduuMzHS0Y=s400-c",
                    data: payload.data,
                });
                notif.onclick = () => {
                    window.focus();
                    const url = payload.data?.url;
                    if (url) window.location.href = url;
                };
            }
        });
    }

    // --- Profile Logic ---
    async function loadProfile(uid) {
        const { data, error } = await supabase
            .from("profiles")
            .select(
                "display_name, is_admin, is_superadmin, app_lock_enabled, app_lock_credential_id",
            )
            .eq("id", uid)
            .maybeSingle();

        if (data && data.display_name) {
            displayNameEl.textContent = `ようこそ、 ${data.display_name} さん`;
        } else {
            // Prioritize Display Name but fallback to email if empty
            displayNameEl.textContent = `ようこそ、 ${user.email} さん`;
            // If display_name is retrieved but empty, logic holds.
        }

        if (data) {
            if (data.is_admin) {
                isAdmin = true;
                console.log("User is Admin");
            }
            if (data.is_superadmin) {
                isSuperAdmin = true;
                console.log("User is Superadmin");
            }

            // Sync App Lock security from server to prevent localStorage bypass
            if (data.app_lock_enabled) {
                if (localStorage.getItem("sodre_app_lock_enabled") !== "true") {
                    console.log("Restoring App Lock from server profile...");
                    localStorage.setItem("sodre_app_lock_enabled", "true");
                    if (data.app_lock_credential_id) {
                        localStorage.setItem(
                            "sodre_app_lock_cred_id",
                            data.app_lock_credential_id,
                        );
                    }
                    if (isPWA && typeof lockAppVisually === "function") {
                        lockAppVisually();
                        if (typeof triggerAppUnlock === "function") triggerAppUnlock();
                    }
                }

                // Initialize toggle UI state
                const appLockToggle = document.getElementById("app-lock-toggle");
                if (appLockToggle) appLockToggle.checked = true;
            } else {
                // Ensure App Lock is disabled locally if DB says it is disabled
                if (
                    localStorage.getItem("sodre_app_lock_enabled") === "true" ||
                    localStorage.getItem("sodre_app_lock_cred_id")
                ) {
                    console.log("Removing outdated App Lock from local storage sync...");
                    localStorage.removeItem("sodre_app_lock_enabled");
                    localStorage.removeItem("sodre_app_lock_cred_id");

                    const appLockOverlay = document.getElementById("app-lock-overlay");
                    if (appLockOverlay) {
                        appLockOverlay.style.display = "none";
                        document.body.style.overflow = "";
                    }
                }

                // Initialize toggle UI state
                const appLockToggle = document.getElementById("app-lock-toggle");
                if (appLockToggle) appLockToggle.checked = false;
            }
        }

        // セッションタイムアウト設定 (PWA以外のみ)
        if (!isPWA) {
            setupSessionTimeout();
        }
    }

    // --- Session Expiration Logic (60 mins) - PWAでは無効 ---
    function setupSessionTimeout() {
        const TIMEOUT_DURATION = 60 * 60 * 1000; // 60 minutes
        const STORAGE_KEY = "sodre_last_activity";

        // Initialize or update last activity
        const updateActivity = () => {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        };

        // Check timeout
        const checkTimeout = async () => {
            // PWA Safety Check: Absolutely no auto-logout for PWA
            const checkIsPWA =
                window.matchMedia("(display-mode: standalone)").matches ||
                window.navigator.standalone === true ||
                document.referrer.includes("android-app://");
            if (checkIsPWA) return;

            // If already on login page, do nothing (safety)
            if (window.location.pathname.endsWith("login.html")) return;

            const lastActivity = parseInt(localStorage.getItem(STORAGE_KEY) || "0");
            const now = Date.now();

            // If lastActivity is 0 (not set) or difference > duration
            if (lastActivity > 0 && now - lastActivity > TIMEOUT_DURATION) {
                console.log("Session expired due to inactivity");
                // Clear storage to prevent loops
                localStorage.removeItem(STORAGE_KEY);
                localStorage.removeItem("sodre_user_email");
                localStorage.removeItem("sodre_user_password");

                try {
                    await supabase.auth.signOut();
                } catch (e) {
                    console.error("SignOut error", e);
                }

                alert("一定時間操作がなかったため、ログアウトしました。");
                window.location.href = "login.html";
            }
        };

        // Set initial time if not set
        if (!localStorage.getItem(STORAGE_KEY)) {
            updateActivity();
        }

        // Periodic check (every 1 minute)
        // This is still needed for desktop/active users
        setInterval(checkTimeout, 60 * 1000);

        // Immediate check on visibility change (Mobile wake up)
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                checkTimeout();
                // Optionally update activity here if simply looking counts as activity
                // But safer to wait for interaction
            }
        });

        // Also check on pageshow (Back/Forward cache restore)
        window.addEventListener("pageshow", () => {
            checkTimeout();
        });

        // Listen for user activity to update timestamp
        // Throttle to avoid excessive writes
        let throttleTimer;
        const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
        const throttledUpdate = () => {
            if (!throttleTimer) {
                // Update and reset timer
                updateActivity();
                throttleTimer = setTimeout(() => {
                    throttleTimer = null;
                }, 30000); // Update max once per 30 seconds
            }
        };

        events.forEach((event) => {
            document.addEventListener(event, throttledUpdate);
        });

        // Initial update
        updateActivity();
    }

    // --- Logout ---
    logoutBtn.addEventListener("click", async () => {
        // Delete FCM Token from DB before logout
        try {
            if (messaging) {
                let registration = await navigator.serviceWorker.getRegistration();
                if (!registration) registration = await navigator.serviceWorker.ready;
                if (registration) {
                    const token = await messaging.getToken({
                        vapidKey: window.FIREBASE_VAPID_KEY,
                        serviceWorkerRegistration: registration,
                    });
                    if (token) {
                        await supabase.from("user_fcm_tokens").delete().eq("token", token);
                    }
                }
            }
        } catch (e) {
            console.error("Token cleanup error:", e);
        }

        // Clear stored credentials to prevent auto-login
        localStorage.removeItem("sodre_user_email");
        localStorage.removeItem("sodre_user_password");
        localStorage.removeItem("sodre_last_activity");

        await supabase.auth.signOut();
        window.location.href = "login.html";
    });

    // --- Tab Switching ---
    tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
            // Only handle buttons with data-tab (ignore settings/other UI buttons using the class for styling)
            const tab = btn.dataset.tab;
            if (!tab) return;

            tabBtns.forEach((b) => {
                if (b.dataset.tab) b.classList.remove("active");
            });
            btn.classList.add("active");
            if (tab === "all") {
                if (viewAll) viewAll.style.display = "block";
                if (viewGroups) viewGroups.style.display = "none";
                if (viewSettings) viewSettings.style.display = "none";

                // Update Context
                currentPostContext = "all";
                if (fabPost) fabPost.style.display = "flex"; // Show FAB for All Board
                loadAllPosts();
            } else if (tab === "groups") {
                if (viewAll) viewAll.style.display = "none";
                if (viewGroups) viewGroups.style.display = "block";
                if (viewSettings) viewSettings.style.display = "none";

                // Explicitly Reset View to List
                if (groupsList) groupsList.style.display = "grid"; // or block/flex depending on css, grid seems used in loadMyGroups
                if (groupBoardView) groupBoardView.style.display = "none";
                currentGroupId = null;

                // Update Context (Initially Group List)
                currentPostContext = "group_list";
                if (fabPost) fabPost.style.display = "none"; // Hide FAB in Group List
                loadMyGroups();
            } else if (tab === "settings") {
                if (viewAll) viewAll.style.display = "none";
                if (viewGroups) viewGroups.style.display = "none";
                if (viewSettings) viewSettings.style.display = "block";

                // Update Context
                currentPostContext = "settings";
                if (fabPost) fabPost.style.display = "none"; // Hide FAB in Settings

                // Focus on our profile
                loadSettingsProfile(user.id);
            }
        });
    });

    // --- Router Logic ---
    async function handleRouting(urlString) {
        // Parse URL to get params
        // If urlString is provided (from SW), use it. Otherwise use window.location
        const urlObj = urlString
            ? new URL(urlString, window.location.origin)
            : window.location;
        const urlParams = new URLSearchParams(urlObj.search);

        const tabParam = urlParams.get("tab");
        const groupIdParam = urlParams.get("group_id");

        if (tabParam === "group" && groupIdParam) {
            // Check if we are already seeing this group to avoid re-fetching if not needed?
            // For now, just follow logic to ensure consistency.

            // Switch to Group Tab UI
            viewAll.style.display = "none";
            viewGroups.style.display = "block";
            tabBtns.forEach((b) => {
                b.classList.toggle("active", b.dataset.tab === "groups");
            });

            // If we are already viewing this group, maybe we just reload posts?
            // But let's run the full open logic to be safe (permission checks etc)

            // Fetch membership/group info
            const { data: membership } = await supabase
                .from("group_members")
                .select("can_post, groups(id, name)")
                .eq("group_id", groupIdParam)
                .eq("user_id", user.id)
                .single();

            if (membership && membership.groups) {
                window.openGroup(
                    membership.groups.id,
                    membership.groups.name,
                    membership.can_post,
                );
            } else {
                // Not a member, check if admin
                if (isAdmin) {
                    const { data: grp } = await supabase
                        .from("groups")
                        .select("id, name")
                        .eq("id", groupIdParam)
                        .single();
                    if (grp) {
                        window.openGroup(grp.id, grp.name, true);
                    } else {
                        // Group not found or error, fallback to All
                        loadAllPosts();
                    }
                } else {
                    // Access denied, fallback to All
                    loadAllPosts();
                }
            }
        } else {
            // Default: All Posts
            // Ensure UI is correct
            viewAll.style.display = "block";
            viewGroups.style.display = "none";
            tabBtns.forEach((b) => {
                b.classList.toggle("active", b.dataset.tab === "all");
            });
            currentPostContext = "all";
            fabPost.style.display = "flex";

            loadAllPosts();
        }

        // Clean URL if it's the current window location
        if (!urlString) {
            if (tabParam) {
                window.history.replaceState({}, "", window.location.pathname);
            }
        }
    }

    // --- Service Worker Message Listener (for Notification Clicks) ---
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", (event) => {
            if (event.data && event.data.type === "NOTIFICATION_CLICK") {
                console.log("Notification clicked (SW Message):", event.data.url);
                handleRouting(event.data.url);
            }
        });
    }

    // --- Initial Load ---
    handleRouting();

    // --- Modal / FAB Logic ---
    fabPost.addEventListener("click", () => {
        openPostModal();
    });

    function openPostModal(postToEdit = null) {
        // Reset State
        selectedFiles = [];
        document.getElementById("modal-post-image").value = "";
        document.getElementById("modal-image-preview").innerHTML = "";

        if (postToEdit) {
            // Edit Mode
            isEditingPostId = postToEdit.id;
            modalTitle.textContent = "投稿を編集";

            if (postQuill) {
                // Paste HTML content directly to Quill root
                postQuill.root.innerHTML = postToEdit.content;
            } else {
                modalPostContent.value = postToEdit.content; // Fallback
            }

            document.getElementById("modal-allow-comments").checked =
                postToEdit.allow_comments;

            // Handle Schedule - only enable toggle if actually scheduled in future
            if (
                postToEdit.scheduled_at &&
                new Date(postToEdit.scheduled_at) > new Date()
            ) {
                const d = new Date(postToEdit.scheduled_at);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                const hh = String(d.getHours()).padStart(2, "0");
                const min = String(d.getMinutes()).padStart(2, "0");

                scheduleDateInput.value = `${yyyy}-${mm}-${dd}`;
                scheduleTimeInput.value = `${hh}:${min}`;

                scheduleToggle.checked = true;
                scheduleOptions.classList.add("active");
            } else {
                scheduleToggle.checked = false;
                scheduleOptions.classList.remove("active");
                scheduleDateInput.value = "";
                scheduleTimeInput.value = "";
            }

            // Existing images
            if (postToEdit.images && postToEdit.images.length > 0) {
                const previewArea = document.getElementById("modal-image-preview");
                postToEdit.images.forEach((url) => {
                    const container = document.createElement("div");
                    container.style.position = "relative";
                    container.style.display = "inline-block";
                    container.style.marginRight = "5px";

                    if (isImageUrl(url)) {
                        const img = document.createElement("img");
                        img.src = getSecureUrl(url);
                        img.style.width = "80px";
                        img.style.height = "80px";
                        img.style.objectFit = "cover";
                        img.style.borderRadius = "4px";
                        container.appendChild(img);
                    } else {
                        container.innerHTML = createFilePreviewHTML(url);
                    }

                    previewArea.appendChild(container);
                });
            }
            modalSubmitBtn.textContent = "更新する";
        } else {
            // New Post Mode
            isEditingPostId = null;
            if (postQuill) {
                postQuill.setContents([]); // Clear Quill editor
            } else {
                modalPostContent.value = "";
            }

            if (currentPostContext === "all") {
                modalTitle.textContent = "全体掲示板に投稿";
            } else if (currentPostContext === "group") {
                modalTitle.textContent = `${currentGroupName.innerText} に投稿`;
            }

            document.getElementById("modal-allow-comments").checked = true; // Default to true

            // Reset Schedule
            scheduleToggle.checked = false;
            scheduleOptions.classList.remove("active");
            scheduleDateInput.value = "";
            scheduleTimeInput.value = "";

            modalSubmitBtn.textContent = "投稿する";
        }

        postModal.classList.add("show"); // .show for standard modal
        setTimeout(() => {
            if (postQuill) postQuill.focus();
            else modalPostContent.focus();
        }, 100);
    }

    modalClose.addEventListener("click", () => {
        postModal.classList.remove("show");
    });

    // Schedule Toggle Logic
    scheduleToggle.addEventListener("change", (e) => {
        if (e.target.checked) {
            scheduleOptions.classList.add("active");
            // Set default date/time to now + 1 hour approx if empty
            if (!scheduleDateInput.value) {
                const now = new Date();
                scheduleDateInput.valueAsDate = now;
            }
        } else {
            scheduleOptions.classList.remove("active");
            // Clear inputs when toggled off to be explicit
            scheduleDateInput.value = "";
            scheduleTimeInput.value = "";
        }
    });

    // File Selection
    document
        .getElementById("modal-post-image")
        .addEventListener("change", (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                const previewArea = document.getElementById("modal-image-preview");
                files.forEach((file) => {
                    const container = document.createElement("div");
                    container.style.position = "relative";
                    container.style.display = "inline-block";
                    container.style.marginRight = "8px";
                    container.style.marginBottom = "8px";

                    if (file.type.startsWith("image/")) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                            const img = document.createElement("img");
                            img.src = ev.target.result;
                            img.style.width = "80px";
                            img.style.height = "80px";
                            img.style.objectFit = "cover";
                            img.style.borderRadius = "4px";
                            container.appendChild(img);
                        };
                        reader.readAsDataURL(file);
                    } else {
                        const filePreview = document.createElement("div");
                        filePreview.style.display = "inline-flex";
                        filePreview.style.alignItems = "center";
                        filePreview.style.gap = "5px";
                        filePreview.style.padding = "8px 12px";
                        filePreview.style.background = "#f5f5f5";
                        filePreview.style.borderRadius = "6px";
                        filePreview.style.fontSize = "0.85rem";
                        filePreview.innerHTML = `<i class="${getFileIcon(file.name)}" style="color:var(--primary-color);"></i> <span style="max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(file.name)}</span>`;
                        container.appendChild(filePreview);
                    }

                    // Add cancel button
                    const cancelBtn = document.createElement("span");
                    cancelBtn.innerHTML = "&times;";
                    cancelBtn.style.position = "absolute";
                    cancelBtn.style.top = "-8px";
                    cancelBtn.style.right = "-8px";
                    cancelBtn.style.background = "rgba(0,0,0,0.6)";
                    cancelBtn.style.color = "white";
                    cancelBtn.style.borderRadius = "50%";
                    cancelBtn.style.width = "20px";
                    cancelBtn.style.height = "20px";
                    cancelBtn.style.display = "flex";
                    cancelBtn.style.alignItems = "center";
                    cancelBtn.style.justifyContent = "center";
                    cancelBtn.style.cursor = "pointer";
                    cancelBtn.style.fontSize = "14px";
                    cancelBtn.style.lineHeight = "1";
                    cancelBtn.style.zIndex = "10";

                    cancelBtn.addEventListener("click", () => {
                        const index = selectedFiles.indexOf(file);
                        if (index > -1) {
                            selectedFiles.splice(index, 1);
                        }
                        container.remove();
                    });

                    container.appendChild(cancelBtn);
                    previewArea.appendChild(container);
                    selectedFiles.push(file);
                });
                // Clear input so selecting same file again works
                e.target.value = "";
            }
        });

    // Close on click outside
    postModal.addEventListener("click", (e) => {
        if (e.target === postModal) {
            postModal.classList.remove("show");
        }
    });

    // --- Preview Logic ---
    let previewObjectUrls = [];

    const hidePreview = () => {
        previewModal.classList.remove("show");
        // Revoke object URLs to avoid memory leaks
        previewObjectUrls.forEach((url) => URL.revokeObjectURL(url));
        previewObjectUrls = [];
    };

    if (modalPreviewBtn) {
        modalPreviewBtn.addEventListener("click", () => {
            let content = "";
            if (postQuill) {
                content = postQuill.root.innerHTML;
            } else {
                content = modalPostContent.value.trim();
            }

            if (!content && selectedFiles.length === 0) return;

            // 1. Build Images HTML from selectedFiles (File objects)
            let filesHtml = "";
            if (selectedFiles && selectedFiles.length > 0) {
                filesHtml = `<div class="post-images" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:1rem;">`;
                selectedFiles.forEach((file) => {
                    if (file.type.startsWith("image/")) {
                        const imgUrl = URL.createObjectURL(file);
                        previewObjectUrls.push(imgUrl);
                        filesHtml += `<img src="${imgUrl}" style="max-height:200px; max-width:100%; border-radius:8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">`;
                    } else {
                        filesHtml += `
                            <div style="padding:12px; border:1px solid #eee; border-radius:8px; display:flex; align-items:center; gap:8px; background:#f9f9f9; font-size: 0.9rem;">
                                <i class="${getFileIcon(file.name)}" style="color:var(--primary-color); font-size: 1.2rem;"></i>
                                <span style="font-weight: 500;">${escapeHtml(file.name)}</span>
                            </div>`;
                    }
                });
                filesHtml += "</div>";
            }

            // 2. Reconstruct the container content
            // We reuse formatContent if it was exported/visible, but here we just sanitize it
            // because Quill content is already somewhat formatted.
            previewContainer.innerHTML = `
                <div class="board-post" style="border:none; padding:0; background:transparent;">
                    <div class="bp-header" style="margin-bottom: 12px;">
                        <div class="bp-user-info">
                            <div class="bp-avatar" style="background: var(--primary-color); color:white; display:flex; align-items:center; justify-content:center;">
                                <i class="fas fa-user-circle"></i>
                            </div>
                            <div class="bp-user-meta">
                                <span class="bp-name">You (Preview)</span>
                                <span class="bp-date">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString().substring(0, 5)}</span>
                            </div>
                        </div>
                    </div>
                    ${filesHtml}
                    <div class="ql-snow">
                        <div class="ql-editor post-body-text" style="padding:0;">
                            ${DOMPurify.sanitize(formatContent(content))}
                        </div>
                    </div>
                </div>
            `;

            previewModal.classList.add("show");
        });
    }

    if (previewModalClose) previewModalClose.addEventListener("click", hidePreview);
    if (closePreviewBtn) closePreviewBtn.addEventListener("click", hidePreview);
    previewModal.addEventListener("click", (e) => {
        if (e.target === previewModal) hidePreview();
    });

    modalSubmitBtn.addEventListener("click", async () => {
        let content = "";
        if (postQuill) {
            if (
                postQuill.getText().trim().length === 0 &&
                !postQuill.root.innerHTML.includes("<img")
            ) {
                // Empty message, ignore. (Quill returns `<p><br></p>` when visually empty)
                return;
            }
            content = postQuill.root.innerHTML;
        } else {
            content = modalPostContent.value.trim();
            if (!content) return;
        }

        const allowComments = document.getElementById(
            "modal-allow-comments",
        ).checked;
        const isScheduled = scheduleToggle.checked;
        let scheduledAt = new Date().toISOString(); // Default to now

        if (isScheduled) {
            const dateVal = scheduleDateInput.value;
            const timeVal = scheduleTimeInput.value;
            if (!dateVal || !timeVal) {
                await showAlert("予約日時を設定してください。", "warning");
                return;
            }
            scheduledAt = new Date(`${dateVal}T${timeVal}`).toISOString();

            // Validate future date ONLY for NEW posts
            if (!isEditingPostId && new Date(scheduledAt) <= new Date()) {
                await showAlert("予約日時は現在より未来の日時を指定してください。", "warning");
                return;
            }
        }

        modalSubmitBtn.disabled = true;
        modalSubmitBtn.textContent = "送信中...";

        // Upload Files via PHP API
        let imageUrls = [];
        if (selectedFiles.length > 0) {
            const formData = new FormData();
            for (const file of selectedFiles) {
                formData.append("files[]", file);
            }
            try {
                const uploadRes = await fetch(window.UPLOAD_API_URL, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${currentSession?.access_token}` },
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success && uploadData.urls) {
                    // Append original filename to URL for display/download
                    imageUrls = uploadData.urls.map((url, index) => {
                        const file = selectedFiles[index];
                        if (file) {
                            // Use encodeURIComponent for Japanese characters
                            return `${url}?name=${encodeURIComponent(file.name)}`;
                        }
                        return url;
                    });
                } else {
                    console.error("Upload error:", uploadData.error);
                    await showAlert(
                        "ファイルのアップロードに失敗しました: " +
                        (uploadData.error || "不明なエラー"),
                        "error"
                    );
                    modalSubmitBtn.disabled = false;
                    modalSubmitBtn.textContent = isEditingPostId
                        ? "更新する"
                        : "投稿する";
                    return; // Abort post creation
                }
            } catch (uploadErr) {
                console.error("Upload fetch error:", uploadErr);
                await showAlert("ファイルのアップロードに失敗しました。", "error");
                modalSubmitBtn.disabled = false;
                modalSubmitBtn.textContent = isEditingPostId ? "更新する" : "投稿する";
                return; // Abort post creation
            }
        }

        if (isEditingPostId) {
            // UPDATE
            let updateData = {
                content: content,
                allow_comments: allowComments,
                scheduled_at: scheduledAt,
            };

            if (imageUrls.length > 0) {
                const { data: currentPost } = await supabase
                    .from("board_posts")
                    .select("images")
                    .eq("id", isEditingPostId)
                    .single();
                const currentImages = currentPost?.images || [];
                updateData.images = [...currentImages, ...imageUrls];
            }

            const { error } = await supabase
                .from("board_posts")
                .update(updateData)
                .eq("id", isEditingPostId);

            modalSubmitBtn.disabled = false;
            modalSubmitBtn.textContent = "送信";

            if (error) {
                await showAlert("更新に失敗しました: " + error.message, "error");
            } else {
                postModal.classList.remove("show");
                if (currentPostContext === "all") loadAllPosts();
                else loadGroupPosts(currentGroupId);
            }
        } else {
            // INSERT
            let insertData = {
                user_id: user.id,
                content: content,
                allow_comments: allowComments,
                scheduled_at: scheduledAt,
            };

            if (currentPostContext === "all") {
                insertData.group_id = null;
            } else if (currentPostContext === "group") {
                if (!currentGroupId) return;
                insertData.group_id = currentGroupId;
            } else {
                return; // Should not happen
            }

            insertData.images = imageUrls;

            const { error } = await supabase.from("board_posts").insert([insertData]);

            modalSubmitBtn.disabled = false;
            modalSubmitBtn.textContent = "送信";

            if (error) {
                await showAlert("投稿に失敗しました: " + error.message, "error");
            } else {
                postModal.classList.remove("show");
                if (currentPostContext === "all") {
                    loadAllPosts();
                } else {
                    loadGroupPosts(currentGroupId);
                }

                // --- Auto Notification ---
                if (window.GAS_NOTIFICATION_URL) {
                    try {
                        // Extract plain text for notification body to avoid HTML tags appearing in system notifications
                        let notificationBody = "";
                        if (postQuill) {
                            notificationBody = postQuill.getText().trim();
                        } else {
                            // Fallback: strip HTML tags if Quill is not used but content has them
                            notificationBody = content.replace(/<[^>]*>/g, "").trim();
                        }

                        const truncatedContent =
                            notificationBody.length > 50 ? notificationBody.substring(0, 50) + "..." : notificationBody;
                        let notifPayload;

                        if (currentPostContext === "group" && currentGroupId) {
                            // グループ投稿 → グループメンバーのみに通知
                            notifPayload = {
                                group_id: currentGroupId,
                                exclude_user_id: user.id,
                                title: "グループに新しい投稿があります",
                                body: truncatedContent,
                                url: `/members-area.html?tab=group&group_id=${currentGroupId}`,
                            };
                        } else {
                            // 全体掲示板 → 全ユーザーに通知
                            notifPayload = {
                                broadcast: true,
                                exclude_user_id: user.id,
                                title: "新しい投稿があります",
                                body: truncatedContent,
                                url: "/members-area.html?tab=all",
                            };
                        }

                        fetch(window.GAS_NOTIFICATION_URL, {
                            method: "POST",
                            body: JSON.stringify(notifPayload),
                            mode: "no-cors",
                            headers: { "Content-Type": "text/plain" },
                        });
                    } catch (notifErr) {
                        console.error("Auto notification error:", notifErr);
                    }
                }
            }
        }
    });

    // --- All Board Logic ---
    async function loadAllPosts(isSilent = false, offset = 0) {
        if (offset === 0) {
            allPostsOffset = 0;
            if (!isSilent) allFeed.innerHTML = "<p>読み込み中...</p>";
        }

        const { data, error } = await supabase
            .from("board_posts")
            .select(
                `
                *,
                profiles(display_name, avatar_url, bio),
                board_comments(count)
            `,
            )
            .is("group_id", null)
            .or(`scheduled_at.lte.${new Date().toISOString()},user_id.eq.${user.id}`)
            .order("is_pinned", { ascending: false })
            .order("scheduled_at", { ascending: false })
            .order("created_at", { ascending: false })
            .range(offset, offset + POST_LIMIT - 1);

        if (error) {
            console.error(error);
            allFeed.innerHTML = "<p>投稿の読み込みに失敗しました。</p>";
            return;
        }

        if (offset === 0) allFeed.innerHTML = ""; // Clear for fresh load (if silent was used, innerHTML might be old or blank)

        renderPosts(data, allFeed, offset > 0);

        // Load More Button
        const hasMore = data && data.length === POST_LIMIT;
        updateLoadMoreButton(allFeed, hasMore, () => {
            allPostsOffset += POST_LIMIT;
            loadAllPosts(true, allPostsOffset);
        });
    }

    // --- Group Logic ---
    backToGroupsBtn.addEventListener("click", () => {
        groupBoardView.style.display = "none";
        groupsList.style.display = "grid";
        currentGroupId = null;

        // Context Update
        currentPostContext = "group_list";
        fabPost.style.display = "none"; // Hide FAB
    });

    async function loadMyGroups() {
        let data = [];
        let error = null;

        if (isAdmin) {
            // Admin sees ALL groups
            const { data: groupsData, error: groupsError } = await supabase
                .from("groups")
                .select("id, name, description")
                .order("created_at", { ascending: false });

            if (groupsData) {
                // Map to same structure as group_members query for template compatibility
                data = groupsData.map((g) => ({
                    groups: g,
                    can_post: true, // Admins can always post
                }));
            }
            error = groupsError;
        } else {
            // Normal user: fetch joined groups
            const response = await supabase
                .from("group_members")
                .select(
                    `
                    group_id,
                    can_post,
                    groups (
                        id, name, description
                    )
                `,
                )
                .eq("user_id", user.id);
            data = response.data;
            error = response.error;
        }

        if (error) {
            console.error(error);
            groupsList.innerHTML = "<p>グループの読み込みに失敗しました。</p>";
            return;
        }

        if (data.length === 0) {
            groupsList.innerHTML = "<p>参加しているグループはありません。</p>";
            return;
        }

        groupsList.innerHTML = data
            .map(
                (item) => `
            <div class="group-card" onclick="openGroup('${item.groups.id}', '${item.groups.name}', ${item.can_post})">
                <h4 style="color:var(--primary-color); font-size:1.1rem; margin-bottom:0.5rem;">${item.groups.name}</h4>
                <p style="font-size:0.9rem; color:#666;">${item.groups.description || ""}</p>
            </div>
        `,
            )
            .join("");
    }

    // Expose to window for onclick
    function openGroup(gid, gname, canPost) {
        currentGroupId = gid;
        currentGroupCanPost = canPost;

        groupsList.style.display = "none";
        groupBoardView.style.display = "block";
        currentGroupName.innerText = gname;

        // Context Update
        currentPostContext = "group";

        if (canPost) {
            fabPost.style.display = "flex"; // Show FAB
        } else {
            fabPost.style.display = "none"; // Hide FAB if read-only
        }

        loadGroupPosts(gid);
    }
    // Expose to window for onclick
    window.openGroup = openGroup;

    async function loadGroupPosts(gid, isSilent = false, offset = 0) {
        if (offset === 0) {
            groupPostsOffset = 0;
            if (!isSilent) groupFeed.innerHTML = "<p>読み込み中...</p>";
        }

        const { data, error } = await supabase
            .from("board_posts")
            .select(
                `
                *,
                profiles(display_name, avatar_url, bio),
                board_comments(count)
            `,
            )
            .eq("group_id", gid)
            .or(`scheduled_at.lte.${new Date().toISOString()},user_id.eq.${user.id}`)
            .order("is_pinned", { ascending: false })
            .order("scheduled_at", { ascending: false })
            .order("created_at", { ascending: false })
            .range(offset, offset + POST_LIMIT - 1);

        if (error) {
            // renderPosts([], groupFeed); // This would clear errors. Better to show error or empty.
            if (offset === 0) renderPosts([], groupFeed);
            return;
        }

        if (offset === 0) groupFeed.innerHTML = "";

        renderPosts(data, groupFeed, offset > 0);

        // Load More Button View
        const hasMore = data && data.length === POST_LIMIT;
        updateLoadMoreButton(groupFeed, hasMore, () => {
            groupPostsOffset += POST_LIMIT;
            loadGroupPosts(gid, true, groupPostsOffset);
        });
    }

    // --- Header Scroll Logic ---
    const header = document.getElementById("global-header");
    let lastScrollTop = 0;

    if (header) {
        const headerHeight = header.offsetHeight;
        window.addEventListener("scroll", () => {
            let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            if (scrollTop > lastScrollTop && scrollTop > headerHeight) {
                // Scroll Down -> Hide
                header.classList.add("hide");
            } else {
                // Scroll Up -> Show
                header.classList.remove("hide");
            }
            lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
        });
    }

    // --- Custom Download Logic for iOS PWA ---
    window.handleFileDownload = async (event, url, filename) => {
        event.preventDefault();
        try {
            const decodedFilename = decodeURIComponent(filename);

            // ファイルをBlobとして取得
            const response = await fetch(url);
            if (!response.ok) throw new Error("Network response was not ok");

            const blob = await response.blob();

            // --- iOS PWA向け対応 (Web Share API) ---
            // ※titleやtextを含めるとiOSが謎の.txtファイルを同時生成することがあるため、filesのみ指定
            if (navigator.canShare) {
                const file = new File([blob], decodedFilename, { type: blob.type || "application/octet-stream" });
                if (navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file]
                        });
                        return; // 共有（保存）成功したら終了
                    } catch (shareErr) {
                        console.log("Share failed or canceled", shareErr);
                        // キャンセルされた場合は何もしないが、エラーならフォールバックへ
                    }
                }
            }

            // --- PCや非対応ブラウザ向けの通常のダウンロード処理 ---
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = blobUrl;
            a.download = decodedFilename;

            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(blobUrl);
            }, 100);
        } catch (error) {
            console.error("Download failed:", error);
            await showAlert("ファイルの取得に失敗しました。", "error");
        }
    };

    // --- Lightbox Logic ---
    const lightboxModal = document.getElementById("lightbox-modal");
    const lightboxImg = document.getElementById("lightbox-img");
    const lightboxClose = document.getElementById("lightbox-close");

    window.openLightbox = (url) => {
        lightboxImg.src = url;
        lightboxModal.style.display = "flex";
        setTimeout(() => (lightboxModal.style.opacity = "1"), 10);
    };

    const closeLightbox = () => {
        lightboxModal.style.opacity = "0";
        setTimeout(() => {
            lightboxModal.style.display = "none";
            lightboxImg.src = "";
        }, 300);
    };

    lightboxClose.addEventListener("click", closeLightbox);
    lightboxModal.addEventListener("click", (e) => {
        if (e.target === lightboxModal) {
            closeLightbox();
        }
    });

    window.deleteMemberPost = async (postId) => {
        if (!await showConfirm("この投稿を削除しますか？")) return;

        try {
            // 1. Get post data to find images
            const { data: post, error: fetchError } = await supabase
                .from("board_posts")
                .select("images")
                .eq("id", postId)
                .single();

            if (fetchError) {
                console.error("Error fetching post for deletion:", fetchError);
                // Continue to delete from DB even if fetch fails, to avoid zombie posts
            } else if (post && post.images && post.images.length > 0) {
                // 2. Delete files from X-server
                try {
                    await fetch("https://data.sodre.jp/api/delete.php", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${currentSession?.access_token}`,
                        },
                        body: JSON.stringify({ urls: post.images }),
                    });
                } catch (deleteErr) {
                    console.error("Physical file delete error:", deleteErr);
                    // Continue to delete from DB
                }
            }

            // 3. Delete from DB
            const { error } = await supabase
                .from("board_posts")
                .delete()
                .eq("id", postId);

            if (error) {
                await showAlert("削除に失敗しました: " + error.message, "error");
            } else {
                if (currentPostContext === "all") loadAllPosts(true);
                else if (currentPostContext === "group" && currentGroupId)
                    loadGroupPosts(currentGroupId, true);
            }
        } catch (err) {
            console.error("Delete error:", err);
            await showAlert("削除中にエラーが発生しました。", "error");
        }
    };

    window.togglePin = async (postId, currentPinState) => {
        const newState = !currentPinState;
        const { error } = await supabase.rpc("toggle_post_pin", {
            post_id: postId,
            pin_state: newState,
        });

        if (error) {
            await showAlert("ピン留めの変更に失敗しました: " + error.message, "error");
        } else {
            if (currentPostContext === "all") loadAllPosts(true);
            else if (currentPostContext === "group" && currentGroupId)
                loadGroupPosts(currentGroupId, true);
        }
    };

    // Edit function attached to window
    window.editMemberPost = async (postId) => {
        // Fetch full post details to populate modal
        const { data, error } = await supabase
            .from("board_posts")
            .select("*")
            .eq("id", postId)
            .single();

        if (error || !data) {
            await showAlert("投稿情報の取得に失敗しました。", "error");
            return;
        }
        openPostModal(data);
    };

    // --- Components ---
    function updateLoadMoreButton(container, hasMore, onClick) {
        // Remove existing button if any
        let existing = container.querySelector(".load-more-container");
        if (existing) existing.remove();

        if (hasMore) {
            const wrapper = document.createElement("div");
            wrapper.className = "load-more-container";
            const btn = document.createElement("button");
            btn.className = "load-more-btn";
            btn.innerText = "さらに表示";
            btn.onclick = onClick;
            wrapper.appendChild(btn);
            container.appendChild(wrapper);
        }
    }

    function renderPosts(posts, container, append = false) {
        if (!append) {
            container.innerHTML = ""; // Clear if not appending
        } else {
            // If appending, remove "No posts" message if it exists (unlikely if appending but good safety)
            const noPosts = container.querySelector(".no-posts-msg");
            if (noPosts) noPosts.remove();

            // Remove old Load More button before appending new posts
            // (It will be re-added by updateLoadMoreButton)
            const oldBtn = container.querySelector(".load-more-container");
            if (oldBtn) oldBtn.remove();
        }

        if ((!posts || posts.length === 0) && !append) {
            container.innerHTML =
                '<p class="no-posts-msg">まだ投稿はありません。</p>';
            return;
        }

        if (!posts || posts.length === 0) return; // Nothing to append

        const now = new Date();

        const html = posts
            .map((post) => {
                const scheduledDate = new Date(post.scheduled_at);
                const isScheduledFuture = scheduledDate > now;
                const isMyPost = post.user_id === user.id;

                // If it's a future post but NOT mine (shouldn't happen via API but safety), hide it
                if (isScheduledFuture && !isMyPost && !isAdmin) return "";

                // Edit Permission: Own post OR Superadmin
                const canEdit = isMyPost || isSuperAdmin;
                const canDelete = isMyPost || isAdmin; // Admin can delete any post (existing logic)

                return `
            <div class="board-post ${isScheduledFuture ? "scheduled-post-container" : ""}" style="position:relative;">
                ${isScheduledFuture
                        ? `<div class="scheduled-badge"><i class="far fa-clock"></i> 予約投稿: ${scheduledDate.toLocaleString()}</div>`
                        : ""
                    }
                <div class="bp-header" style="justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="viewUserProfile('${post.user_id}')">
                        <div style="width:36px; height:36px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#eee;">
                            ${post.profiles?.avatar_url
                        ? `<img src="${getSecureUrl(post.profiles.avatar_url)}" style="width:100%; height:100%; object-fit:cover;">`
                        : `<i class="fas fa-user-circle" style="font-size:36px; color:#ccc;"></i>`
                    }
                        </div>
                        <span class="bp-author">${post.profiles?.display_name || "Unknown"}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="bp-date">${scheduledDate.toLocaleString()}</span>
                        
                        ${post.is_pinned ? `<i class="fas fa-thumbtack" style="color:var(--primary-color); margin-right:5px;" title="固定された投稿"></i>` : ""}

                        ${isAdmin
                        ? `<button onclick="togglePin('${post.id}', ${post.is_pinned})" style="background:none; border:none; color:${post.is_pinned ? "#666" : "var(--primary-color)"}; cursor:pointer; font-size:0.8rem; text-decoration:underline;">
                                ${post.is_pinned ? "固定解除" : "固定する"}
                            </button>`
                        : ""
                    }

                        ${canEdit
                        ? `<button onclick="editMemberPost('${post.id}')" style="background:none; border:none; color:var(--primary-color); cursor:pointer; font-size:0.8rem; text-decoration:underline;">編集</button>`
                        : ""
                    }
                        
                        ${canDelete
                        ? `<button onclick="deleteMemberPost('${post.id}')" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:0.8rem; text-decoration:underline;">削除</button>`
                        : ""
                    }
                    </div>
                </div>
                ${post.images && post.images.length > 0
                        ? `
                    <div style="display:flex; gap:10px; margin-bottom:10px; flex-wrap:wrap;">
                        ${post.images
                            .map((url) => {
                                const secureUrl = getSecureUrl(url);
                                if (isImageUrl(url)) {
                                    return `<img src="${secureUrl}" 
                                    loading="lazy"
                                    onclick="openLightbox('${secureUrl}')"
                                    style="max-width:100%; height:auto; max-height:200px; border-radius:4px; cursor:pointer; transition:opacity 0.2s; object-fit: contain;" 
                                    onmouseover="this.style.opacity=0.8" 
                                    onmouseout="this.style.opacity=1"
                                >`;
                                } else {
                                    // Extract original name from query param if available
                                    let fname = url.split("/").pop();
                                    try {
                                        const urlObj = new URL(url);
                                        const originalName =
                                            urlObj.searchParams.get("name");
                                        if (originalName) {
                                            fname = originalName;
                                        } else {
                                            // Fallback: strip query string from physical filename
                                            fname = fname.split("?")[0];
                                        }
                                    } catch (e) {
                                        fname = fname.split("?")[0];
                                    }

                                    const isPreviewable = isPreviewableFile(fname);
                                    if (isPreviewable) {
                                        return `<a href="${secureUrl}" target="_blank" rel="noopener noreferrer" 
                                        style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#f5f5f5; border-radius:6px; text-decoration:none; color:#333; font-size:0.85rem; transition:background 0.2s;"
                                        onmouseover="this.style.background='#eee'" onmouseout="this.style.background='#f5f5f5'">
                                        <i class="${getFileIconFromUrl(url)}" style="color:var(--primary-color); font-size:1.1rem;"></i>
                                        <span>${decodeURIComponent(fname)}</span>
                                        <i class="fas fa-external-link-alt" style="color:#999; font-size:0.8rem;"></i>
                                    </a>`;
                                    } else {
                                        return `<a href="javascript:void(0)" 
                                        onclick="handleFileDownload(event, '${secureUrl}', '${encodeURIComponent(fname)}')"
                                        style="display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:#f5f5f5; border-radius:6px; text-decoration:none; color:#333; font-size:0.85rem; transition:background 0.2s;"
                                        onmouseover="this.style.background='#eee'" onmouseout="this.style.background='#f5f5f5'">
                                        <i class="${getFileIconFromUrl(url)}" style="color:var(--primary-color); font-size:1.1rem;"></i>
                                        <span>${decodeURIComponent(fname)}</span>
                                        <i class="fas fa-download" style="color:#999; font-size:0.8rem;"></i>
                                    </a>`;
                                    }
                                }
                            })
                            .join("")}
                    </div>`
                        : ""
                    }
                <div class="bp-content ql-snow"><div class="ql-editor" style="padding:0;">${DOMPurify.sanitize(formatContent(post.content))}</div></div>
                
                <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                    ${post.allow_comments
                        ? (() => {
                            const commentCount =
                                post.board_comments && post.board_comments[0]
                                    ? post.board_comments[0].count
                                    : 0;
                            const btnStyle =
                                commentCount > 0
                                    ? "color:var(--primary-color); font-weight:bold;"
                                    : "color:#666;";
                            const iconClass =
                                commentCount > 0
                                    ? "fas fa-comment"
                                    : "far fa-comment";
                            return `<button onclick="toggleComments('${post.id}')" style="background:none; border:none; cursor:pointer; font-size:0.9rem; ${btnStyle}">
                            <i class="${iconClass}"></i> コメント ${commentCount > 0 ? `(${commentCount})` : ""}
                        </button>`;
                        })()
                        : '<span style="color:#999; font-size:0.8rem;">コメント無効</span>'
                    }
                </div>

                <!-- Comments Section -->
                <div id="comments-${post.id}" class="comments-section">
                    <div id="comments-list-${post.id}">
                        <!-- Comments loaded here -->
                        <p style="font-size:0.8rem; color:#999;">読み込み中...</p>
                    </div>
                    
                    ${post.allow_comments
                        ? `
                        <div class="comment-form" style="flex-direction: column; align-items: stretch;">
                            <div id="comment-input-container-${post.id}" style="margin-bottom: 10px;">
                                <div id="comment-input-${post.id}" class="comment-input" style="height: 100px; background: #fff;"></div>
                            </div>
                            <div class="comment-media-preview" id="comment-media-preview-${post.id}"></div>
                            <div class="comment-toolbar">
                                <label for="comment-file-${post.id}" class="comment-toolbar-btn" title="ファイルを添付">
                                    <i class="fas fa-paperclip"></i>
                                </label>
                                <input type="file" id="comment-file-${post.id}" multiple style="display:none;" onchange="handleCommentFileSelect(event, '${post.id}')">
                                <button onclick="submitComment('${post.id}')" class="btn-comment-submit">送信</button>
                            </div>
                        </div>
                    `
                        : ""
                    }
                </div>
            </div>
            `;
            })
            .join("");

        container.insertAdjacentHTML("beforeend", html);
    }

    // --- Comment Quill State ---
    const commentQuillInstances = {};
    const commentEditQuillInstances = {};

    function initCommentQuill(postId) {
        if (!commentQuillInstances[postId]) {
            try {
                commentQuillInstances[postId] = new Quill(`#comment-input-${postId}`, {
                    theme: "snow",
                    modules: {
                        toolbar: [
                            ["bold", "italic", "underline", "strike"],
                            [{ color: [] }, { background: [] }],
                            ["link", "clean"],
                        ], // Simplified toolbar for comments
                    },
                    placeholder: "コメントを書く...",
                });
            } catch (e) {
                console.error("Comment Quill Init Error", e);
            }
        }
    }

    // --- Comment Logic ---
    window.toggleComments = async (postId) => {
        const section = document.getElementById(`comments-${postId}`);
        if (section.style.display === "block") {
            section.style.display = "none";
        } else {
            section.style.display = "block";
            await loadComments(postId);
            // Initialize Quill when section is opened
            initCommentQuill(postId);
        }
    };

    // --- Secure URL Helper ---
    function getSecureUrl(url) {
        if (!url || !url.startsWith("https://data.sodre.jp/uploads/")) {
            return url;
        }
        if (currentSession && currentSession.access_token) {
            const separator = url.includes("?") ? "&" : "?";
            const newUrl = `${url}${separator}token=${currentSession.access_token}`;
            console.log("getSecureUrl(Debug): Appending token to", url);
            return newUrl;
        } else {
            console.warn(
                "getSecureUrl(Debug): Session/Token missing!",
                currentSession,
            );
        }
        return url;
    }

    window.loadComments = async (postId) => {
        const listEl = document.getElementById(`comments-list-${postId}`);

        const { data, error } = await supabase
            .from("board_comments")
            .select(
                `
                *,
                profiles(display_name, avatar_url, bio)
            `,
            )
            .eq("post_id", postId)
            .order("created_at", { ascending: true });

        if (error) {
            console.error(error);
            listEl.innerHTML =
                '<p style="color:red;">コメントの読み込みに失敗しました。</p>';
            return;
        }

        renderComments(postId, data);
    };

    function renderComments(postId, comments) {
        const listEl = document.getElementById(`comments-list-${postId}`);
        if (!comments || comments.length === 0) {
            listEl.innerHTML =
                '<p style="font-size:0.8rem; color:#999;">まだコメントはありません。</p>';
            return;
        }

        listEl.innerHTML = comments
            .map((comment) => {
                const canEditComment = comment.user_id === user.id || isSuperAdmin;
                const canDeleteComment = comment.user_id === user.id || isAdmin;
                return `
            <div class="comment-item" id="comment-item-${comment.id}">
                <div class="comment-header">
                    <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="viewUserProfile('${comment.user_id}')">
                        <div style="width:28px; height:28px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#eee;">
                            ${comment.profiles?.avatar_url
                        ? `<img src="${getSecureUrl(comment.profiles.avatar_url)}" style="width:100%; height:100%; object-fit:cover;">`
                        : `<i class="fas fa-user-circle" style="font-size:28px; color:#ccc;"></i>`
                    }
                        </div>
                        <span class="comment-author">${comment.profiles?.display_name || "Unknown"}</span>
                    </div>
                    <div class="comment-actions">
                        <span>${new Date(comment.created_at).toLocaleString()}</span>
                        ${canEditComment ? `<button onclick="editComment('${comment.id}', '${postId}')" title="編集" style="background:none;border:none;cursor:pointer;color:var(--primary-color);"><i class="fas fa-edit"></i></button>` : ""}
                        ${canDeleteComment
                        ? `<button onclick="deleteComment('${comment.id}', '${postId}')" title="削除"><i class="fas fa-trash"></i></button>`
                        : ""
                    }
                    </div>
                </div>
                ${comment.images && comment.images.length > 0
                        ? `
                    <div style="display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                        ${comment.images
                            .map((url) => {
                                const secureUrl = getSecureUrl(url);
                                if (isImageUrl(url)) {
                                    return `<img src="${secureUrl}" 
                                    loading="lazy"
                                    onclick="openLightbox('${secureUrl}')"
                                    style="max-width:100px; height:auto; max-height:100px; border-radius:4px; cursor:pointer; transition:opacity 0.2s; object-fit: contain;" 
                                    onmouseover="this.style.opacity=0.8" 
                                    onmouseout="this.style.opacity=1"
                                >`;
                                } else {
                                    let fname = url.split("/").pop();
                                    try {
                                        const urlObj = new URL(url);
                                        const originalName =
                                            urlObj.searchParams.get("name");
                                        if (originalName) {
                                            fname = originalName;
                                        } else {
                                            fname = fname.split("?")[0];
                                        }
                                    } catch (e) {
                                        fname = fname.split("?")[0];
                                    }

                                    const isPreviewable = isPreviewableFile(fname);
                                    if (isPreviewable) {
                                        return `<a href="${secureUrl}" target="_blank" rel="noopener noreferrer" 
                                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 10px; background:#f5f5f5; border-radius:6px; text-decoration:none; color:#333; font-size:0.8rem; transition:background 0.2s;"
                                        onmouseover="this.style.background='#eee'" onmouseout="this.style.background='#f5f5f5'">
                                        <i class="${getFileIconFromUrl(url)}" style="color:var(--primary-color); font-size:1rem;"></i>
                                        <span style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${decodeURIComponent(fname)}</span>
                                    </a>`;
                                    } else {
                                        return `<a href="javascript:void(0)" 
                                        onclick="handleFileDownload(event, '${secureUrl}', '${encodeURIComponent(fname)}')"
                                        style="display:inline-flex; align-items:center; gap:6px; padding:6px 10px; background:#f5f5f5; border-radius:6px; text-decoration:none; color:#333; font-size:0.8rem; transition:background 0.2s;"
                                        onmouseover="this.style.background='#eee'" onmouseout="this.style.background='#f5f5f5'">
                                        <i class="${getFileIconFromUrl(url)}" style="color:var(--primary-color); font-size:1rem;"></i>
                                        <span style="max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${decodeURIComponent(fname)}</span>
                                    </a>`;
                                    }
                                }
                            })
                            .join("")}
                    </div>`
                        : ""
                    }
                <div id="comment-content-${comment.id}" class="ql-snow"><div class="ql-editor" style="padding:0; font-size:0.9rem;">${DOMPurify.sanitize(formatCommentContent(comment.content))}</div></div>
                <div id="comment-edit-form-${comment.id}" style="display:none; margin-top:8px;">
                    <div id="comment-edit-input-container-${comment.id}" style="margin-bottom: 5px;">
                        <div id="comment-edit-input-${comment.id}" class="comment-input" style="height: 100px; background: #fff;"></div>
                    </div>
                    <div style="display:flex; gap:8px; margin-top:5px;">
                        <button onclick="saveCommentEdit('${comment.id}', '${postId}')" class="btn-comment-submit">保存</button>
                        <button onclick="cancelCommentEdit('${comment.id}')" style="background:none; border:1px solid #ccc; border-radius:4px; padding:4px 12px; cursor:pointer; color:#666;">キャンセル</button>
                    </div>
                </div>
            </div>
        `;
            })
            .join("");
    }

    function initCommentEditQuill(commentId, existingContent) {
        if (!commentEditQuillInstances[commentId]) {
            try {
                const quill = new Quill(`#comment-edit-input-${commentId}`, {
                    theme: "snow",
                    modules: {
                        toolbar: [
                            ["bold", "italic", "underline", "strike"],
                            [{ color: [] }, { background: [] }],
                            ["link", "clean"],
                        ],
                    },
                    placeholder: "コメントを編集...",
                });
                commentEditQuillInstances[commentId] = quill;
                quill.root.innerHTML = existingContent || "";
            } catch (e) {
                console.error("Comment Edit Quill Init Error", e);
            }
        }
    }

    // --- Comment Edit Functions ---
    window.editComment = (commentId, postId) => {
        const contentDiv = document.getElementById(`comment-content-${commentId}`);
        const editForm = document.getElementById(`comment-edit-form-${commentId}`);

        contentDiv.style.display = "none";
        editForm.style.display = "block";

        // Read raw DOMPurify sanitized content dynamically or maintain in JS state.
        // For simple case, we extract what's in the DOM since DOMPurify maintains Quill integrity.
        const existingContent = contentDiv.innerHTML;
        initCommentEditQuill(commentId, existingContent);
    };

    window.cancelCommentEdit = (commentId) => {
        document.getElementById(`comment-content-${commentId}`).style.display =
            "block";
        document.getElementById(`comment-edit-form-${commentId}`).style.display =
            "none";
    };

    window.saveCommentEdit = async (commentId, postId) => {
        const quill = commentEditQuillInstances[commentId];
        let content = "";

        if (quill) {
            if (
                quill.getText().trim().length === 0 &&
                !quill.root.innerHTML.includes("<img")
            ) {
                content = ""; // Treat as empty
            } else {
                content = quill.root.innerHTML;
            }
        } else {
            // Unlikely fallback
            const fallbackEl = document.getElementById(
                `comment-edit-input-${commentId}`,
            );
            if (fallbackEl) content = fallbackEl.innerText || "";
        }

        if (!content) return;

        const { error } = await supabase
            .from("board_comments")
            .update({ content: content })
            .eq("id", commentId);

        if (error) {
            await showAlert("コメントの更新に失敗しました: " + error.message, "error");
        } else {
            await loadComments(postId);
        }
    };

    // --- Comment File Handling State ---
    const commentFiles = {}; // Structure: { [postId]: [File, File, ...] }

    window.handleCommentFileSelect = (event, postId) => {
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;

        if (!commentFiles[postId]) {
            commentFiles[postId] = [];
        }

        const previewArea = document.getElementById(
            `comment-media-preview-${postId}`,
        );

        files.forEach((file) => {
            const container = document.createElement("div");
            container.style.position = "relative";
            container.style.display = "inline-block";

            if (file.type.startsWith("image/")) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const img = document.createElement("img");
                    img.src = ev.target.result;
                    img.style.width = "60px";
                    img.style.height = "60px";
                    img.style.objectFit = "cover";
                    img.style.borderRadius = "4px";
                    container.appendChild(img);
                };
                reader.readAsDataURL(file);
            } else {
                const filePreview = document.createElement("div");
                filePreview.style.display = "inline-flex";
                filePreview.style.alignItems = "center";
                filePreview.style.gap = "5px";
                filePreview.style.padding = "4px 8px";
                filePreview.style.background = "#f5f5f5";
                filePreview.style.borderRadius = "4px";
                filePreview.style.fontSize = "0.75rem";
                filePreview.innerHTML = `<i class="${getFileIcon(file.name)}" style="color:var(--primary-color);"></i> <span style="max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(file.name)}</span>`;
                container.appendChild(filePreview);
            }

            const cancelBtn = document.createElement("span");
            cancelBtn.innerHTML = "&times;";
            cancelBtn.style.position = "absolute";
            cancelBtn.style.top = "-6px";
            cancelBtn.style.right = "-6px";
            cancelBtn.style.background = "rgba(0,0,0,0.6)";
            cancelBtn.style.color = "white";
            cancelBtn.style.borderRadius = "50%";
            cancelBtn.style.width = "16px";
            cancelBtn.style.height = "16px";
            cancelBtn.style.display = "flex";
            cancelBtn.style.alignItems = "center";
            cancelBtn.style.justifyContent = "center";
            cancelBtn.style.cursor = "pointer";
            cancelBtn.style.fontSize = "12px";
            cancelBtn.style.lineHeight = "1";
            cancelBtn.style.zIndex = "10";

            cancelBtn.addEventListener("click", () => {
                const index = commentFiles[postId].indexOf(file);
                if (index > -1) {
                    commentFiles[postId].splice(index, 1);
                }
                container.remove();
            });

            container.appendChild(cancelBtn);
            previewArea.appendChild(container);
            commentFiles[postId].push(file);
        });

        // Clear input
        event.target.value = "";
    };

    window.submitComment = async (postId) => {
        const quill = commentQuillInstances[postId];
        let content = "";

        if (quill) {
            if (
                quill.getText().trim().length === 0 &&
                !quill.root.innerHTML.includes("<img")
            ) {
                content = "";
            } else {
                content = quill.root.innerHTML;
            }
        } else {
            // Fallback just in case quill didn't init
            const inputEl = document.getElementById(`comment-input-${postId}`);
            if (inputEl) {
                // If fallback element is a div (which it should be), textContent or innerText could be used.
                // But typically if Quill failed to init we just can't submit properly.
                // Adding basic graceful fail here.
                content = inputEl.innerText || "";
            }
        }

        const filesToUpload = commentFiles[postId] || [];

        if (!content && filesToUpload.length === 0) return;

        // Visual feedback based on DOM structure
        const commentSection = document.getElementById(`comments-${postId}`);
        const submitBtn = commentSection.querySelector(".btn-comment-submit");

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "送信中...";
        }

        let imageUrls = [];

        // Upload files if any exist
        if (filesToUpload.length > 0) {
            const formData = new FormData();
            for (const file of filesToUpload) {
                formData.append("files[]", file);
            }
            try {
                const uploadRes = await fetch(window.UPLOAD_API_URL, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${currentSession?.access_token}` },
                    body: formData,
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success && uploadData.urls) {
                    imageUrls = uploadData.urls.map((url, index) => {
                        const file = filesToUpload[index];
                        if (file) {
                            return `${url}?name=${encodeURIComponent(file.name)}`;
                        }
                        return url;
                    });
                } else {
                    console.error("Comment upload error:", uploadData.error);
                    await showAlert(
                        "ファイルのアップロードに失敗しました: " +
                        (uploadData.error || "不明なエラー"),
                        "error"
                    );
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = "送信";
                    }
                    return;
                }
            } catch (uploadErr) {
                console.error("Comment upload fetch error:", uploadErr);
                await showAlert("ファイルのアップロードに失敗しました。", "error");
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "送信";
                }
                return;
            }
        }

        const { error } = await supabase.from("board_comments").insert([
            {
                post_id: postId,
                user_id: user.id,
                content: content,
                images: imageUrls,
            },
        ]);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "送信";
        }

        if (error) {
            await showAlert("コメントの送信に失敗しました: " + error.message, "error");
        } else {
            // Reset Quill
            if (quill) {
                quill.setContents([]);
            }

            // Clear files
            commentFiles[postId] = [];
            const previewArea = document.getElementById(
                `comment-media-preview-${postId}`,
            );
            if (previewArea) previewArea.innerHTML = "";

            await loadComments(postId); // Reload comments
        }
    };

    window.deleteComment = async (commentId, postId) => {
        if (!await showConfirm("本当に削除しますか？")) return;

        try {
            // 1. Get comment data to find images
            const { data: comment, error: fetchError } = await supabase
                .from("board_comments")
                .select("images")
                .eq("id", commentId)
                .single();

            if (fetchError) {
                console.error("Error fetching comment for deletion:", fetchError);
            } else if (comment && comment.images && comment.images.length > 0) {
                // 2. Delete files from X-server
                try {
                    await fetch("https://data.sodre.jp/api/delete.php", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${currentSession?.access_token}`,
                        },
                        body: JSON.stringify({ urls: comment.images }),
                    });
                } catch (deleteErr) {
                    console.error("Physical file delete error for comment:", deleteErr);
                }
            }

            // 3. Delete from DB
            const { error } = await supabase
                .from("board_comments")
                .delete()
                .eq("id", commentId);

            if (error) {
                alert("削除に失敗しました: " + error.message);
            } else {
                await loadComments(postId); // Reload
            }
        } catch (err) {
            console.error("Delete comment error:", err);
            await showAlert("削除中にエラーが発生しました。", "error");
        }
    };

    // --- File Type Helpers ---
    function isImageUrl(url) {
        const ext = url.split(".").pop().split("?")[0].toLowerCase();
        return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
    }

    function getFileIcon(filename) {
        const ext = filename.split(".").pop().toLowerCase();
        const iconMap = {
            pdf: "fas fa-file-pdf",
            doc: "fas fa-file-word",
            docx: "fas fa-file-word",
            xls: "fas fa-file-excel",
            xlsx: "fas fa-file-excel",
            csv: "fas fa-file-excel",
            ppt: "fas fa-file-powerpoint",
            pptx: "fas fa-file-powerpoint",
            txt: "fas fa-file-alt",
            zip: "fas fa-file-archive",
            rar: "fas fa-file-archive",
            mp3: "fas fa-file-audio",
            wav: "fas fa-file-audio",
            ogg: "fas fa-file-audio",
            m4a: "fas fa-file-audio",
            mp4: "fas fa-file-video",
            mov: "fas fa-file-video",
            avi: "fas fa-file-video",
            webm: "fas fa-file-video",
        };
        return iconMap[ext] || "fas fa-file";
    }

    function getFileIconFromUrl(url) {
        const filename = url.split("/").pop().split("?")[0];
        return getFileIcon(filename);
    }

    // --- File Download Handler (iOS PWA Fallback) ---
    function isPreviewableFile(filenameOrUrl) {
        const ext = filenameOrUrl.split(".").pop().toLowerCase().split("?")[0];
        const previewableExts = [
            "pdf",
            "jpg",
            "jpeg",
            "png",
            "gif",
            "webp",
            "svg",
            "mp3",
            "wav",
            "ogg",
            "m4a",
            "mp4",
            "mov",
            "avi",
            "webm",
        ];
        return previewableExts.includes(ext);
    }

    // Helper for file preview
    function createFilePreviewHTML(url) {
        let filename = "Attachment";
        try {
            const urlObj = new URL(url);
            const params = new URLSearchParams(urlObj.search);
            if (params.has("name")) {
                filename = decodeURIComponent(params.get("name"));
            } else {
                filename = url.split("/").pop().split("?")[0];
            }
        } catch (e) {
            filename = url.split("/").pop().split("?")[0];
        }

        const iconClass = getFileIcon(filename); // Assume getFileIcon is global or defined nearby
        const secureUrl = getSecureUrl(url);

        const isPreviewable = isPreviewableFile(filename);
        if (isPreviewable) {
            return `
            <a href="${secureUrl}" target="_blank" rel="noopener noreferrer" class="file-attachment-link">
                <i class="${iconClass}"></i>
                <span class="filename">${escapeHtml(filename)}</span>
            </a>
        `;
        } else {
            return `
            <a href="javascript:void(0)" class="file-attachment-link" onclick="handleFileDownload(event, '${secureUrl}', '${encodeURIComponent(filename)}'); event.stopPropagation();">
                <i class="${iconClass}"></i>
                <span class="filename">${escapeHtml(filename)}</span>
            </a>
        `;
        }
    }
    function escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatContent(text) {
        if (!text) return "";

        // Removed escapeHtml since we now trust Quill's HTML output via DOMPurify
        let content = text;

        // Linkify external URLs (Not handled perfectly by Quill if pasted as plain text sometimes)
        // We only linkify if it's not already in an href tag, but standard simple regex is okay for now if DOMPurify cleans up broken tags
        const urlRegex = /(?<!href=")(https?:\/\/[^\s<]+)/g;
        let linked = content.replace(urlRegex, function (url) {
            if (url.startsWith("https://data.sodre.jp/uploads/")) {
                const secureUrl = getSecureUrl(url);
                let fname = url.split("/").pop().split("?")[0];
                const isPreviewable = isPreviewableFile(fname);
                if (isPreviewable) {
                    return `<a href="${secureUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
                } else {
                    return `<a href="javascript:void(0)" onclick="handleFileDownload(event, '${secureUrl}', '${encodeURIComponent(fname)}'); event.stopPropagation();" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
                }
            }
            return `<a href="${url}" class="external-link" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
        });

        return linked;
    }

    function formatCommentContent(text) {
        if (!text) return "";

        let content = text;

        const urlRegex = /(?<!href=")(https?:\/\/[^\s<]+)/g;
        let linked = content.replace(urlRegex, function (url) {
            if (url.startsWith("https://data.sodre.jp/uploads/")) {
                const secureUrl = getSecureUrl(url);
                let fname = url.split("/").pop().split("?")[0];
                const isPreviewable = isPreviewableFile(fname);
                if (isPreviewable) {
                    return `<a href="${secureUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
                } else {
                    return `<a href="javascript:void(0)" onclick="handleFileDownload(event, '${secureUrl}', '${encodeURIComponent(fname)}'); event.stopPropagation();" rel="noopener noreferrer" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
                }
            }
            return `<a href="${url}" class="external-link" style="color: var(--primary-color); text-decoration: underline; word-break: break-all;">${url}</a>`;
        });

        // Removed explicit \n to <br> because Quill HTML uses <p> and <br> natively
        return linked;
    }

    // --- External Link Warning Logic ---
    const extModal = document.getElementById("external-link-modal");
    const extUrlDisplay = document.getElementById("external-link-url");
    const extCancelBtn = document.getElementById("external-link-cancel");
    const extProceedBtn = document.getElementById("external-link-proceed");
    let targetExternalUrl = "";

    // Delegate click event for ALL links (including those from Quill)
    document.addEventListener("click", (e) => {
        const link = e.target.closest("a");
        if (!link) return;

        // Check if it's an external link
        const isExternal =
            link.hostname && link.hostname !== window.location.hostname;

        // Exempt .sodre.jp domains
        const isSodreDomain =
            link.hostname &&
            (link.hostname === "sodre.jp" || link.hostname.endsWith(".sodre.jp"));

        if ((isExternal && !isSodreDomain) || link.classList.contains("external-link")) {
            e.preventDefault();
            targetExternalUrl = link.href;
            extUrlDisplay.textContent = targetExternalUrl;
            extModal.classList.add("show");
        }
    });

    extCancelBtn.addEventListener("click", () => {
        extModal.classList.remove("show");
        targetExternalUrl = "";
        // Reset button state to prevent sticky colors/focus
        extCancelBtn.blur();
    });

    extProceedBtn.addEventListener("click", () => {
        if (targetExternalUrl) {
            window.open(targetExternalUrl, "_blank", "noopener,noreferrer");
            extModal.classList.remove("show");
            targetExternalUrl = "";
        }
    });

    // --- Realtime Subscription ---
    // --- Realtime Subscription ---
    const channel = supabase
        .channel("board_changes")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "board_posts" },
            (payload) => {
                const eventType = payload.eventType; // INSERT, UPDATE, DELETE
                const newPost = payload.new;

                // Logic to decide whether to reload posts
                if (eventType === "INSERT") {
                    // Check if the new post is relevant to current view
                    if (currentPostContext === "all") {
                        if (!newPost.group_id) {
                            loadAllPosts(true);
                        }
                    } else if (currentPostContext === "group") {
                        if (newPost.group_id === currentGroupId) {
                            loadGroupPosts(currentGroupId, true);
                        }
                    }
                } else {
                    // UPDATE or DELETE - safer to just reload
                    if (currentPostContext === "all") loadAllPosts(true);
                    else if (currentPostContext === "group" && currentGroupId)
                        loadGroupPosts(currentGroupId, true);
                }
            },
        )
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "board_comments" },
            (payload) => {
                // When comments change, reload comments if the section is open
                // And ideally update the comment count on the post
                const newComment = payload.new;
                const oldComment = payload.old;
                const postId = newComment?.post_id || oldComment?.post_id;

                if (postId) {
                    // 1. Reload comments if open
                    const commentsList = document.getElementById(
                        `comments-list-${postId}`,
                    );
                    if (commentsList && commentsList.offsetParent !== null) {
                        // visible check
                        loadComments(postId);
                    }

                    // 2. Reload posts to update comment count (Silent)
                    // This might be heavy, but ensures consistency
                    if (currentPostContext === "all") loadAllPosts(true);
                    else if (currentPostContext === "group" && currentGroupId)
                        loadGroupPosts(currentGroupId, true);
                }
            },
        )
        .subscribe();

    // --- Personal Action Realtime Subscription ---
    if (typeof currentSession !== "undefined" && currentSession?.user) {
        supabase
            .channel(`user_actions_${currentSession.user.id}`)
            .on("broadcast", { event: "force_unlock" }, async (payload) => {
                console.log("Received force unlock command", payload);
                // Wipe local lock state
                localStorage.removeItem("sodre_app_lock_enabled");
                localStorage.removeItem("sodre_app_lock_cred_id");

                // Immediately disable UI protections
                const overlay = document.getElementById("app-lock-overlay");
                if (overlay) overlay.style.display = "none";
                document.body.style.overflow = "";

                // Uncheck the toggle visually if settings are open
                const toggle = document.getElementById("app-lock-toggle");
                if (toggle) toggle.checked = false;

                await showAlert("管理者によってApp Lock（生体認証ロック）が強制解除されました。", "warning");
            })
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `id=eq.${currentSession.user.id}`,
                },
                (payload) => {
                    const newLockState = payload.new.app_lock_enabled === true;
                    const localLockState =
                        localStorage.getItem("sodre_app_lock_enabled") === "true";

                    // If the database toggled App Lock on/off and it disagrees with our current browser state,
                    // reload the page so loadProfile() can properly sync UI, localStorage, and WebAuthn checks.
                    if (newLockState !== localLockState) {
                        console.log(
                            "Detected remote App Lock settings change. Reloading to sync state.",
                        );
                        window.location.reload();
                    }
                },
            )
            .subscribe();
    }

    // --- Settings Modal & App Lock (WebAuthn) Logic ---
    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const settingsModalClose = document.getElementById("settings-modal-close");
    const appLockToggle = document.getElementById("app-lock-toggle");
    const notificationToggle = document.getElementById("notification-toggle");
    const appLockOverlay = document.getElementById("app-lock-overlay");
    const btnUnlockApp = document.getElementById("btn-unlock-app");

    // Load initial settings
    const isAppLockEnabled =
        localStorage.getItem("sodre_app_lock_enabled") === "true";
    appLockToggle.checked = isAppLockEnabled;

    if (notificationToggle) {
        notificationToggle.checked =
            Notification.permission === "granted" &&
            localStorage.getItem("sodre_notifications_disabled") !== "true";

        notificationToggle.addEventListener("change", async (e) => {
            const enable = e.target.checked;
            if (enable) {
                if (!messaging) {
                    await showAlert("お使いのブラウザはプッシュ通知をサポートしていません。", "warning");
                    notificationToggle.checked = false;
                    return;
                }

                if (Notification.permission !== "granted") {
                    const permission = await Notification.requestPermission();
                    if (permission !== "granted") {
                        await showAlert(
                            "プッシュ通知が許可されませんでした。ブラウザの設定から許可してください。",
                            "warning"
                        );
                        notificationToggle.checked = false;
                        return;
                    }
                }

                localStorage.removeItem("sodre_notifications_disabled");
                await showAlert("プッシュ通知をオンにしました。", "success");
                refreshFCMToken(); // Force refresh and sync to DB
            } else {
                localStorage.setItem("sodre_notifications_disabled", "true");
                try {
                    if (messaging) {
                        let registration = await navigator.serviceWorker.getRegistration();
                        if (!registration)
                            registration = await navigator.serviceWorker.ready;
                        if (registration) {
                            const token = await messaging.getToken({
                                vapidKey: window.FIREBASE_VAPID_KEY,
                                serviceWorkerRegistration: registration,
                            });
                            if (token) {
                                await supabase
                                    .from("user_fcm_tokens")
                                    .delete()
                                    .eq("token", token);
                                localStorage.removeItem(`sodre_fcm_token_${user.id}`);
                            }
                        }
                    }
                    await showAlert("プッシュ通知をオフにしました。", "info");
                } catch (err) {
                    console.error("Failed to remove token", err);
                }
            }
        });
    }

    // --- Settings & Profile Tab Logic ---
    const profileAvatarPreview = document.getElementById("profile-avatar-preview");
    const profileAvatarInput = document.getElementById("profile-avatar-input");
    const profileAvatarImg = document.getElementById("profile-avatar-img");
    const profileAvatarIconOuter = document.getElementById("profile-avatar-icon");
    const profileDisplayName = document.getElementById("profile-display-name");

    let profileBioQuill;
    try {
        profileBioQuill = new Quill("#profile-bio-editor", {
            theme: "snow",
            modules: {
                toolbar: [
                    ["bold", "italic", "underline", "strike"],
                    [{ color: [] }, { background: [] }],
                    [{ list: "ordered" }, { list: "bullet" }],
                    [{ indent: "-1" }, { indent: "+1" }],
                    [{ align: [] }],
                    ["link", "image"],
                    ["clean"],
                ],
            },
            placeholder: "自己紹介を入力...",
        });
    } catch (e) {
        console.error("Quill Bio Init Error:", e);
    }
    const btnSaveProfile = document.getElementById("btn-save-profile");
    const btnPreviewProfile = document.getElementById("btn-preview-profile");

    if (btnPreviewProfile) {
        btnPreviewProfile.addEventListener("click", () => {
            const modal = document.getElementById("profile-modal");
            const avatarImg = document.getElementById("profile-modal-img");
            const avatarIcon = document.getElementById("profile-modal-icon");
            const nameEl = document.getElementById("profile-modal-name");
            const bioEl = document.getElementById("profile-modal-bio");

            if (!modal) return;

            // Use current edits for preview
            nameEl.innerText = profileDisplayName.value.trim() || "ユーザー未設定";

            let bioHTML = "";
            if (profileBioQuill) {
                bioHTML = profileBioQuill.root.innerHTML;
            }
            // Check if Quill content is effectively empty
            if (profileBioQuill && profileBioQuill.getText().trim().length > 0 || bioHTML.includes("<img")) {
                bioEl.innerHTML = DOMPurify.sanitize(bioHTML);
            } else {
                bioEl.innerHTML = "<p style='color:#999;font-style:italic;'>自己紹介はまだありません。</p>";
            }

            if (profileAvatarImg.style.display !== "none" && profileAvatarImg.src) {
                avatarImg.src = profileAvatarImg.src;
                avatarImg.style.display = "block";
                avatarIcon.style.display = "none";
            } else {
                avatarImg.src = "";
                avatarImg.style.display = "none";
                avatarIcon.style.display = "flex";
            }

            modal.style.display = "flex";
            setTimeout(() => {
                modal.style.opacity = "1";
            }, 10);
        });
    }

    // Avatar Selection
    // View-only logic handles the click assignment dynamically

    profileAvatarInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                profileAvatarImg.src = e.target.result;
                profileAvatarImg.style.display = "block";
                profileAvatarIconOuter.style.display = "none";
            }
            reader.readAsDataURL(file);
        }
    });

    // Save Profile
    btnSaveProfile.addEventListener("click", async () => {
        if (!user) return;

        btnSaveProfile.disabled = true;
        const originalText = btnSaveProfile.innerText;
        btnSaveProfile.innerText = "保存中...";

        try {
            let bioContent = "";
            if (profileBioQuill) {
                if (profileBioQuill.getText().trim().length === 0 && !profileBioQuill.root.innerHTML.includes("<img")) {
                    bioContent = "";
                } else {
                    bioContent = profileBioQuill.root.innerHTML;
                }
            }

            const updates = {
                display_name: profileDisplayName.value.trim(),
                bio: bioContent
            };

            // Handle Avatar Upload if a new file is selected
            const file = profileAvatarInput.files[0];
            if (file) {
                if (!window.UPLOAD_API_URL) {
                    throw new Error("アップロードAPIが設定されていません。");
                }
                const formData = new FormData();
                formData.append("files[]", file);

                const response = await fetch(window.UPLOAD_API_URL, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${currentSession?.access_token}`,
                    },
                    body: formData,
                });

                const result = await response.json();
                if (result.success && result.urls && result.urls.length > 0) {
                    updates.avatar_url = `${result.urls[0]}?name=${encodeURIComponent(file.name)}`;
                } else {
                    throw new Error(result.error || "画像アップロードに失敗しました");
                }
            }

            // Update Postgres
            const { error: dbError } = await supabase
                .from("profiles")
                .update(updates)
                .eq("id", user.id);

            if (dbError) throw dbError;

            // Update Auth User Metadata as well (keep in sync)
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    display_name: updates.display_name,
                    ...(updates.avatar_url ? { avatar_url: updates.avatar_url } : {})
                }
            });
            if (authError) console.error("Auth metadata sync warning:", authError);

            await showAlert("プロフィールを保存しました。", "success");

            // Reload our specific display context to reflect new name/avatar across UI if needed
            loadProfile(user.id);

        } catch (error) {
            console.error("Profile update error:", error);
            await showAlert("プロフィールの保存に失敗しました: " + error.message, "error");
        } finally {
            btnSaveProfile.disabled = false;
            btnSaveProfile.innerText = originalText;
        }
    });

    async function loadSettingsProfile(uid) {
        if (!uid) return;
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("display_name, bio, avatar_url")
                .eq("id", uid)
                .single();

            if (error) throw error;
            if (data) {
                profileDisplayName.value = data.display_name || "";

                if (profileBioQuill) {
                    profileBioQuill.root.innerHTML = data.bio || "";
                }

                if (data.avatar_url) {
                    profileAvatarImg.src = getSecureUrl(data.avatar_url);
                    profileAvatarImg.style.display = "block";
                    profileAvatarIconOuter.style.display = "none";
                } else {
                    profileAvatarImg.src = "";
                    profileAvatarImg.style.display = "none";
                    profileAvatarIconOuter.style.display = "flex";
                }
            }

            // Read-only mode logic
            const isOwnProfile = (uid === user.id);
            profileDisplayName.disabled = true; // Always display only

            if (profileBioQuill) {
                profileBioQuill.enable(isOwnProfile);
                const toolbar = profileBioQuill.getModule('toolbar');
                if (toolbar && toolbar.container) {
                    toolbar.container.style.display = isOwnProfile ? 'block' : 'none';
                }
            }
            btnSaveProfile.style.display = isOwnProfile ? "inline-block" : "none";

            // If not our own profile, hide the avatar upload trigger and system settings
            const avatarOverlay = profileAvatarPreview.querySelector("div[style*='position: absolute']");
            if (avatarOverlay) {
                avatarOverlay.style.display = isOwnProfile ? "block" : "none";
            }
            // Disable avatar click if not own profile
            if (isOwnProfile) {
                profileAvatarPreview.onclick = () => profileAvatarInput.click();
                profileAvatarPreview.style.cursor = "pointer";
            } else {
                profileAvatarPreview.onclick = null;
                profileAvatarPreview.style.cursor = "default";
            }

            const systemSettingsSec = document.querySelector(".system-settings-section");
            if (systemSettingsSec) {
                systemSettingsSec.style.display = isOwnProfile ? "block" : "none";
            }

            const headerText = document.querySelector("#view-settings h3");
            const headerSubText = document.querySelector("#view-settings p");
            if (headerText) {
                headerText.innerText = isOwnProfile ? "設定 / プロフィール" : "プロフィール";
            }
            if (headerSubText) {
                headerSubText.innerText = isOwnProfile ? "プロフィールやシステム設定を変更できます。" : "ユーザーのプロフィール情報です。";
            }

        } catch (error) {
            console.error("Error loading settings profile:", error);
        }
    }

    // Connect icon click to profile navigation
    window.viewUserProfile = async function (uid) {
        if (!uid) return;
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("display_name, bio, avatar_url")
                .eq("id", uid)
                .single();

            if (error) throw error;

            const modal = document.getElementById("profile-modal");
            const avatarImg = document.getElementById("profile-modal-img");
            const avatarIcon = document.getElementById("profile-modal-icon");
            const nameEl = document.getElementById("profile-modal-name");
            const bioEl = document.getElementById("profile-modal-bio");

            if (!modal) {
                console.error("Profile modal not found in HTML!");
                return;
            }

            if (data) {
                nameEl.innerText = data.display_name || "ユーザー未設定";

                // Bio is stored as HTML (from Quill), so we render it safely
                if (data.bio) {
                    bioEl.innerHTML = DOMPurify.sanitize(data.bio);
                } else {
                    bioEl.innerHTML = "<p style='color:#999;font-style:italic;'>自己紹介はまだありません。</p>";
                }

                if (data.avatar_url) {
                    avatarImg.src = getSecureUrl(data.avatar_url);
                    avatarImg.style.display = "block";
                    avatarIcon.style.display = "none";
                } else {
                    avatarImg.src = "";
                    avatarImg.style.display = "none";
                    avatarIcon.style.display = "flex";
                }
            }

            modal.style.display = "flex";
            setTimeout(() => {
                modal.style.opacity = "1";
            }, 10);
        } catch (error) {
            console.error("Error loading profile for modal:", error);
            await showAlert("プロフィールの読み込みに失敗しました。", "error");
        }
    };

    // Close Profile Modal
    window.closeProfileModal = function () {
        const modal = document.getElementById("profile-modal");
        if (modal) {
            modal.style.opacity = "0";
            setTimeout(() => {
                modal.style.display = "none";
            }, 300);
        }
    };

    // Close on click outside (this should be wired in DOM, but can be done generally)
    document.addEventListener("click", (e) => {
        const modal = document.getElementById("profile-modal");
        if (modal && e.target === modal) {
            closeProfileModal();
        }
    });

    // Handle App Lock Toggle
    appLockToggle.addEventListener("change", async (e) => {
        const enable = e.target.checked;
        if (enable) {
            // Attempt to register WebAuthn
            try {
                if (!window.PublicKeyCredential) {
                    throw new Error(
                        "お使いのブラウザは生体認証(WebAuthn)をサポートしていません。",
                    );
                }

                appLockToggle.disabled = true;
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);

                const userId = new Uint8Array(16);
                window.crypto.getRandomValues(userId);

                let rpId = window.location.hostname;
                // WebAuthn spec requires rpId to be a valid domain.
                // IPs like 127.0.0.1 or 'localhost' can cause SecurityError in some browsers if explicitly set as rpId.
                // Omitting rp.id makes the browser default to the current effective domain.
                const isLocalIP =
                    /^(127\.0\.0\.1|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.test(
                        rpId,
                    );

                const createOptions = {
                    publicKey: {
                        challenge: challenge,
                        rp: {
                            name: "SoDRé App Lock",
                        },
                        user: {
                            id: userId,
                            name: currentSession.user.email,
                            displayName:
                                currentSession.user.user_metadata?.display_name ||
                                currentSession.user.email,
                        },
                        pubKeyCredParams: [
                            { type: "public-key", alg: -7 }, // ES256
                            { type: "public-key", alg: -257 }, // RS256
                        ],
                        authenticatorSelection: {
                            authenticatorAttachment: "platform", // FaceID/TouchID/Windows Hello
                            userVerification: "required",
                        },
                        timeout: 60000,
                        attestation: "none",
                    },
                };

                // Only set rpId explicitly if it's a real domain
                if (!isLocalIP) {
                    createOptions.publicKey.rp.id = rpId;
                }

                const credential = await navigator.credentials.create(createOptions);

                if (credential) {
                    // Store the credential ID locally
                    const credIdBase64 = btoa(
                        String.fromCharCode.apply(null, new Uint8Array(credential.rawId)),
                    );
                    localStorage.setItem("sodre_app_lock_cred_id", credIdBase64);
                    localStorage.setItem("sodre_app_lock_enabled", "true");

                    // Sync with DB
                    await supabase
                        .from("profiles")
                        .update({
                            app_lock_enabled: true,
                            app_lock_credential_id: credIdBase64,
                        })
                        .eq("id", currentSession.user.id);

                    await showAlert(
                        "App Lock を有効にしました。次回PWA復帰時より生体認証が要求されます。",
                        "success"
                    );
                } else {
                    throw new Error("認証デバイストークンの作成に失敗しました。");
                }
            } catch (err) {
                console.error("WebAuthn Create Error:", err);
                await showAlert("App Lock の設定に失敗しました: " + err.message, "error");
                appLockToggle.checked = false; // Revert
            } finally {
                appLockToggle.disabled = false;
            }
        } else {
            // Require authentication to disable App Lock
            try {
                const credIdBase64 = localStorage.getItem("sodre_app_lock_cred_id");
                if (!credIdBase64) throw new Error("No credential ID");

                const credIdBytes = Uint8Array.from(atob(credIdBase64), (c) =>
                    c.charCodeAt(0),
                );
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);

                let rpId = window.location.hostname;
                const isLocalIP =
                    /^(127\.0\.0\.1|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.test(
                        rpId,
                    );

                const getOptions = {
                    publicKey: {
                        challenge: challenge,
                        allowCredentials: [
                            {
                                type: "public-key",
                                id: credIdBytes,
                            },
                        ],
                        userVerification: "required",
                        timeout: 60000,
                    },
                };

                if (!isLocalIP) {
                    getOptions.publicKey.rpId = rpId;
                }

                appLockToggle.disabled = true;
                const assertion = await navigator.credentials.get(getOptions);

                if (assertion) {
                    localStorage.removeItem("sodre_app_lock_enabled");
                    localStorage.removeItem("sodre_app_lock_cred_id");

                    // Sync with DB
                    await supabase
                        .from("profiles")
                        .update({
                            app_lock_enabled: false,
                            app_lock_credential_id: null,
                        })
                        .eq("id", currentSession.user.id);

                    await showAlert("App Lock を無効にしました。", "info");
                } else {
                    throw new Error("解除キャンセル");
                }
            } catch (err) {
                console.error("WebAuthn Disable Error:", err);
                appLockToggle.checked = true; // Revert visually
            } finally {
                appLockToggle.disabled = false;
            }
        }
    });

    let isUnlockPending = false;

    // App Lock Unlock Function
    async function triggerAppUnlock() {
        const isEnabled = localStorage.getItem("sodre_app_lock_enabled") === "true";
        const credIdBase64 = localStorage.getItem("sodre_app_lock_cred_id");

        // Only trigger if enabled and in PWA mode
        if (isEnabled && isPWA && credIdBase64) {
            appLockOverlay.style.display = "flex";
            document.body.style.overflow = "hidden"; // Ensure no scrolling while locked

            if (isUnlockPending) return; // Prevent concurrent WebAuthn prompts

            try {
                isUnlockPending = true;
                const credIdBytes = Uint8Array.from(atob(credIdBase64), (c) =>
                    c.charCodeAt(0),
                );
                const challenge = new Uint8Array(32);
                window.crypto.getRandomValues(challenge);

                let rpId = window.location.hostname;
                const isLocalIP =
                    /^(127\.0\.0\.1|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.test(
                        rpId,
                    );

                const getOptions = {
                    publicKey: {
                        challenge: challenge,
                        allowCredentials: [
                            {
                                type: "public-key",
                                id: credIdBytes,
                            },
                        ],
                        userVerification: "required",
                        timeout: 60000,
                    },
                };

                if (!isLocalIP) {
                    getOptions.publicKey.rpId = rpId;
                }

                const assertion = await navigator.credentials.get(getOptions);
                if (assertion) {
                    // Success
                    appLockOverlay.style.display = "none";
                    document.body.style.overflow = ""; // Restore scrolling
                }
            } catch (err) {
                console.error("WebAuthn Get Error:", err);
                // Failed or cancelled - leave overlay up
                // The unlock button handles retries
            } finally {
                isUnlockPending = false;
            }
        } else if (
            isPWA &&
            !credIdBase64 &&
            document.getElementById("app-lock-overlay").style.display === "flex"
        ) {
            // Edge case: User clicked unlock but cleared localStorage.
            // Do NOT hide the overlay. Let the session timeout/refresh logic handle logging them out to login.html.
            console.warn(
                "App lock active but credentials missing. Waiting for session validation...",
            );
            // Optional: force session check here to speed up redirect
            if (typeof supabase !== "undefined") {
                supabase.auth.getSession().then(({ data }) => {
                    if (!data.session) window.location.replace("login.html");
                });
            }
        } else if (
            !isPWA ||
            (!isEnabled &&
                document.getElementById("app-lock-overlay").style.display !== "flex")
        ) {
            // Normal unlocked state: ensure it's hidden. Do not carelessly hide if it's already showing.
            appLockOverlay.style.display = "none";
            document.body.style.overflow = "";
        }
    }

    // Manual unlock button retry
    btnUnlockApp.addEventListener("click", triggerAppUnlock);

    // Aggressive Visual Lock
    function lockAppVisually() {
        const isEnabled = localStorage.getItem("sodre_app_lock_enabled") === "true";
        if (isEnabled && isPWA) {
            appLockOverlay.style.display = "flex";
            document.body.style.overflow = "hidden";

            // Force a synchronous layout/reflow.
            // This forces the browser to paint the display:flex immediately,
            // catching the screen BEFORE the OS takes the background snapshot for the App Switcher.
            void appLockOverlay.offsetHeight;
        }
    }

    // Trigger on visibility change
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            lockAppVisually();
        } else if (document.visibilityState === "visible") {
            triggerAppUnlock();
        }
    });

    // Aggressive lock on blur (app switcher) and pagehide (app closing)
    window.addEventListener("blur", lockAppVisually);
    window.addEventListener("pagehide", lockAppVisually);
    document.addEventListener("freeze", lockAppVisually); // Page Lifecycle API fallback

    // Initial Trigger if locked
    if (localStorage.getItem("sodre_app_lock_enabled") === "true" && isPWA) {
        lockAppVisually();
        triggerAppUnlock();
    }
});
