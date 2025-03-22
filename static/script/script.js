document.addEventListener("DOMContentLoaded", () => {
    loadMRTs();
    setupListbarScroll();
    setupSearchEvents();  
});

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

document.addEventListener("DOMContentLoaded", () => {
    fetchAttractions(); 
});

let nextPage = 0;     
let isLoading = false; 


const sentinelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        fetchAttractions();
      }
    });
}, { rootMargin: "300px" });


const sentinel = document.querySelector(".sentinel");
if (sentinel) {
    sentinelObserver.observe(sentinel);
}

async function fetchAttractions() {
    if (isLoading) return;
    isLoading = true;

    try {
        const response = await fetch(`/api/attractions?page=${nextPage}`);
        if (!response.ok) {
            throw new Error("❌ API 回應錯誤");
        }

        const data = await response.json();

        
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

        
        const sentinel = document.querySelector(".sentinel");
        bigBox.insertBefore(cardFrame, sentinel);
    });
}

function setupSearchEvents() {
    const searchBtn = document.querySelector("button.搜尋");
    const searchInput = document.querySelector("input.景點名稱");
    const listbarContainer = document.querySelector(".listbar .container");
    const bigBox = document.querySelector(".big-box");

    if (!searchBtn || !searchInput || !listbarContainer || !bigBox) return;

    
    searchBtn.addEventListener("click", handleSearch);
    
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    });

    
    listbarContainer.addEventListener("click", (e) => {
        if (e.target.matches(".mrt-item")) {
            searchInput.value = e.target.textContent; 
            handleSearch(); 
        }
    });

    
    function handleSearch() {
        const keyword = searchInput.value.trim();
        showLoading(); 
    
        clearBigBox(); 
    
        if (!keyword) {
            
            resetAndFetch();
        } else {
            fetchByKeyword(keyword);
        }
    }
    function clearBigBox() {
        sentinelObserver.unobserve(sentinel);      
        document.querySelectorAll(".big-box .card-frame").forEach(el => {
            if (!el.classList.contains("sentinel")) { 
                el.remove(); 
            }
        });
    }

    
    async function fetchByKeyword(keyword) {
        try {
            showLoading(); 
            clearBigBox(); 
    
            const url = `/api/attractions?keyword=${encodeURIComponent(keyword)}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error("關鍵字搜尋 API 錯誤");
            }
    
            const data = await response.json();
            hideLoading(); 
    
            if (!data.data || data.data.length === 0) {
                console.log("查無資料");
                return;
            }
    
            loadCard(data.data);
        } catch (err) {
            console.error(err);
            hideLoading(); 
        }
    }
    
}

function showLoading() {
    const bigBox = document.querySelector(".big-box");

    
    hideLoading();

    for (let i = 0; i < 8; i++) {
        const cardFrame = document.createElement("div");
        cardFrame.classList.add("card-frame", "loading-card"); 

        const card = document.createElement("div");
        card.classList.add("card");

        const img = document.createElement("div");
        img.classList.add("loading-img"); 

        const title = document.createElement("div");
        title.classList.add("loading-title"); 

        const cardCategory = document.createElement("div");
        cardCategory.classList.add("card_category");

        const mrt = document.createElement("div");
        mrt.classList.add("loading-text"); 
        const category = document.createElement("div");
        category.classList.add("loading-text"); 

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

