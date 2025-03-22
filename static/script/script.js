/**
 * 1. 首次 DOMContentLoaded: 載入 MRT (loadMRTs) & 設定 listbarScroll
 */
document.addEventListener("DOMContentLoaded", () => {
    loadMRTs();
    setupListbarScroll();
    setupSearchEvents();  // <-- 新增：初始化搜尋事件監聽
});

/**
 * 載入 MRT 清單
 */
async function loadMRTs() {
    try {
        const response = await fetch("/api/mrts", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
            throw new Error("載入 MRT 清單失敗");
        }

        const data = await response.json();
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error("MRT API 資料格式錯誤");
        }

        const listbar = document.querySelector(".listbar .container");
        if (!listbar) return;

        // 動態插入 MRT 清單
        data.data.forEach(mrt => {
            const p = document.createElement("p");
            p.textContent = mrt;
            p.classList.add("mrt-item");
            listbar.appendChild(p);
        });

    } catch (error) {
        console.error(error);
    }
}

/**
 * 設定左右滾動按鈕
 */
function setupListbarScroll() {
    const listbarContainer = document.querySelector(".listbar .container");
    const leftButton = document.querySelector(".listbar .left img");
    const rightButton = document.querySelector(".listbar .right img");

    if (!listbarContainer || !leftButton || !rightButton) return;

    const scrollAmount = 250;

    leftButton.addEventListener("click", () => {
        listbarContainer.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });

    rightButton.addEventListener("click", () => {
        listbarContainer.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
}

/**
 * 2. 第二個 DOMContentLoaded：初次載入景點資料
 */
document.addEventListener("DOMContentLoaded", () => {
    fetchAttractions(); // 初次載入第 1 頁
});

/** 
 * 分頁參數
 */
let nextPage = 0;     
let isLoading = false; 

// sentinel observer
const sentinelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        fetchAttractions();
      }
    });
}, { rootMargin: "300px" });

// sentinel
const sentinel = document.querySelector(".sentinel");
if (sentinel) {
    sentinelObserver.observe(sentinel);
}

/**
 * 從 /api/attractions 載入資料: 預設用分頁（page = nextPage）做查詢
 */
async function fetchAttractions() {
    if (isLoading) return;
    isLoading = true;

    try {
        const response = await fetch(`/api/attractions?page=${nextPage}`);
        if (!response.ok) {
            throw new Error("❌ API 回應錯誤");
        }

        const data = await response.json();

        // 若無更多資料 => 停止監聽
        if (!data.data || data.data.length === 0) {
            sentinelObserver.unobserve(sentinel);
            return;
        }

        loadCard(data.data);
        nextPage = data.nextPage ?? (nextPage + 1);

    } catch (error) {
        console.error("⚠️ Fetch Attractions Error:", error);
    } finally {
        isLoading = false;
    }
}

/**
 * loadCard: 插入卡片
 */
function loadCard(attractions) {
    const bigBox = document.querySelector(".big-box");
    if (!bigBox) return;

    attractions.forEach((item) => {
        const cardFrame = document.createElement("div");
        cardFrame.classList.add("card-frame");

        const card = document.createElement("div");
        card.classList.add("card");

        const img = document.createElement("img");
        img.src = item.images?.[0] || "./static/img/placeholder.jpg";
        img.alt = item.name;

        const title = document.createElement("h2");
        title.textContent = item.name;

        const cardCategory = document.createElement("div");
        cardCategory.classList.add("card_category");

        const mrt = document.createElement("p");
        mrt.textContent = item.mrt || "無捷運站";

        const category = document.createElement("p");
        category.textContent = item.category;

        card.appendChild(img);
        card.appendChild(title);
        cardCategory.appendChild(mrt);
        cardCategory.appendChild(category);
        cardFrame.appendChild(card);
        cardFrame.appendChild(cardCategory);

        // 插在 sentinel 前面，確保 sentinel 永遠在最底
        const sentinel = document.querySelector(".sentinel");
        bigBox.insertBefore(cardFrame, sentinel);
    });
}

/* ------------------------------------------------------------------
   新增：搜尋功能
------------------------------------------------------------------ */

/**
 * 設定搜尋事件監聽：
 * 1. 點擊「搜尋」按鈕
 * 2. 輸入框按下 Enter
 * 3. 點擊 .mrt-item (listbar) 時將內容寫入輸入框
 */
function setupSearchEvents() {
    const searchBtn = document.querySelector("button.搜尋");
    const searchInput = document.querySelector("input.景點名稱");
    const listbarContainer = document.querySelector(".listbar .container");
    const bigBox = document.querySelector(".big-box");

    if (!searchBtn || !searchInput || !listbarContainer || !bigBox) return;

    // 點擊「搜尋」按鈕
    searchBtn.addEventListener("click", handleSearch);
    // 輸入框按下 Enter
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    });

    // 點擊 MRT list p
    listbarContainer.addEventListener("click", (e) => {
        if (e.target.matches(".mrt-item")) {
            searchInput.value = e.target.textContent; 
            handleSearch(); // ← 點完馬上搜尋
        }
    });

    // 搜尋函式
    function handleSearch() {
        const keyword = searchInput.value.trim();
        showLoading(); // 1️⃣ 先顯示 Loading 效果
    
        clearBigBox(); // 2️⃣ 清空 Big Box
    
        if (!keyword) {
            // 🔥 若搜尋框為空，重設分頁並重新載入所有景點
            resetAndFetch();
        } else {
            fetchByKeyword(keyword);
        }
    }
    function clearBigBox() {
        sentinelObserver.unobserve(sentinel);      // 先停止觀察
        document.querySelectorAll(".big-box .card-frame").forEach(el => {
            if (!el.classList.contains("sentinel")) { 
                el.remove(); // 刪除所有卡片，**但保留 sentinel**
            }
        });
    }

    // 根據 keyword 來搜尋
    async function fetchByKeyword(keyword) {
        try {
            showLoading(); // 1️⃣ 先顯示 Loading Card
            clearBigBox(); // 2️⃣ 清空原有 Big Box
    
            const url = `/api/attractions?keyword=${encodeURIComponent(keyword)}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("關鍵字搜尋 API 錯誤");
            }
    
            const data = await response.json();
            hideLoading(); // 3️⃣ 移除 Loading Card
    
            if (!data.data || data.data.length === 0) {
                console.log("查無資料");
                return;
            }
    
            loadCard(data.data);
        } catch (err) {
            console.error(err);
            hideLoading(); // 如果 API 出錯，也要確保 Loading 消失
        }
    }
    
}

function showLoading() {
    const bigBox = document.querySelector(".big-box");

    // 先清除舊的 Loading（避免重複累積）
    hideLoading();

    for (let i = 0; i < 8; i++) {
        const cardFrame = document.createElement("div");
        cardFrame.classList.add("card-frame", "loading-card"); // 加上 loading 樣式

        const card = document.createElement("div");
        card.classList.add("card");

        const img = document.createElement("div");
        img.classList.add("loading-img"); // 這裡使用 div 模擬圖片位置

        const title = document.createElement("div");
        title.classList.add("loading-title"); // 這裡使用 div 模擬標題

        const cardCategory = document.createElement("div");
        cardCategory.classList.add("card_category");

        const mrt = document.createElement("div");
        mrt.classList.add("loading-text"); // 模擬捷運站名稱
        const category = document.createElement("div");
        category.classList.add("loading-text"); // 模擬類別

        card.appendChild(img);
        card.appendChild(title);
        cardCategory.appendChild(mrt);
        cardCategory.appendChild(category);
        cardFrame.appendChild(card);
        cardFrame.appendChild(cardCategory);

        bigBox.appendChild(cardFrame);
    }
}

function resetAndFetch() {
    nextPage = 0;
    sentinelObserver.observe(sentinel);
    fetchAttractions();
}

function hideLoading() {
    document.querySelectorAll(".big-box .loading-card").forEach(el => el.remove());
}

