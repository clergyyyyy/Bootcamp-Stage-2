let nextPage = 0;
let isLoading = false;
let currentKeyword = null; 

const attractionID = window.location.pathname.split("/").pop();

document.addEventListener("DOMContentLoaded", () => {
    loadMRTs();
    setupListbarScroll();
    setupSearchEvents();

    const isAttractionPage = window.location.pathname.startsWith("/attraction/");
    if (isAttractionPage) {
        fetchAttractionID();
    } else {
        fetchAttractions();
    }
});


const sentinel = document.querySelector(".sentinel");
const sentinelObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            fetchAttractions();
        }
    });
}, { rootMargin: "300px" });
if (sentinel) {
    sentinelObserver.observe(sentinel);
}

async function loadMRTs() {
    try {
        const response = await fetch("/api/mrts");
        const data = await response.json();
        const listbar = document.querySelector(".listbar .container");
        if (!listbar || !data.data) return;

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

async function fetchAttractions() {
    if (isLoading) return;
    isLoading = true;

    try {
        const url = currentKeyword
            ? `/api/attractions?page=${nextPage}&keyword=${encodeURIComponent(currentKeyword)}`
            : `/api/attractions?page=${nextPage}`;

        const response = await fetch(url);
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
        hideLoading();
    }
}

function loadCard(attractions) {
    const bigBox = document.querySelector(".big-box");
    if (!bigBox) return;

    const sentinel = document.querySelector(".sentinel");

    attractions.forEach((item) => {
        
        const cardLink = document.createElement("a");
        cardLink.classList.add("card-frame");
        cardLink.href = `/attraction/${item.id}`;

        
        const card = document.createElement("div");
        card.classList.add("card");

        
        const img = document.createElement("img");
        img.src = item.images?.[0] || "./static/img/placeholder.jpg";
        img.alt = item.name;

        
        const title = document.createElement("h2");
        title.textContent = item.name;

        
        card.appendChild(img);
        card.appendChild(title);

        
        const cardCategory = document.createElement("div");
        cardCategory.classList.add("card_category");

        const mrt = document.createElement("p");
        mrt.textContent = item.mrt || "無捷運站";

        const category = document.createElement("p");
        category.textContent = item.category;

        cardCategory.appendChild(mrt);
        cardCategory.appendChild(category);
        
        cardLink.appendChild(card);         
        cardLink.appendChild(cardCategory); 

        bigBox.insertBefore(cardLink, sentinel);
    });
}

function setupSearchEvents() {
    const searchBtn = document.querySelector("button.搜尋");
    const searchInput = document.querySelector("input.景點名稱");
    const listbarContainer = document.querySelector(".listbar .container");
    if (!searchBtn || !searchInput || !listbarContainer) return;

    searchBtn.addEventListener("click", handleSearch);
    searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") handleSearch();
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
            currentKeyword = keyword;
            nextPage = 0;
            sentinelObserver.observe(sentinel);
            fetchAttractions();
        }
    }

    function clearBigBox() {
        sentinelObserver.unobserve(sentinel);
        document.querySelectorAll(".big-box .card-frame").forEach(el => {
            if (!el.classList.contains("sentinel")) el.remove();
        });
    }
}

function showLoading() {
    hideLoading();
    const bigBox = document.querySelector(".big-box");
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

function hideLoading() {
    document.querySelectorAll(".big-box .loading-card").forEach(el => el.remove());
}

function resetAndFetch() {
    currentKeyword = null;
    nextPage = 0;
    sentinelObserver.observe(sentinel);
    fetchAttractions();
}

async function fetchAttractionID() {
    if (isLoading) return;
    isLoading = true;

    try {
        const url = `/api/attraction/${attractionID}`;
        const response = await fetch(url);
        const data = await response.json();

        loadAttractions(data.data);
    } catch (error) {
        console.error("⚠️ Fetch AttractionID Error:", error);
    } finally {
        isLoading = false;
        hideLoading();
    }
}


function loadAttractions(attraction) {
    const attractionContainer = document.querySelector(".attraction_container_1");
    const container2 = document.querySelector(".container2");
    if (!attractionContainer || !container2) return;

    const carousel = document.createElement("div");
    carousel.className = "attraction_carousel";

    const allBtnContainer = document.createElement("div");
    allBtnContainer.className = "all_btn_container";

    const leftBtn = document.createElement("div");
    leftBtn.className = "btn_container";
    leftBtn.innerHTML = `<img src="/static/img/icon/arrow left.svg">`;

    const rightBtn = document.createElement("div");
    rightBtn.className = "btn_container";
    rightBtn.innerHTML = `<img src="/static/img/icon/arrow right.svg">`;

    allBtnContainer.appendChild(leftBtn);
    allBtnContainer.appendChild(rightBtn);
    carousel.appendChild(allBtnContainer);
    
    const slider = document.createElement("div");
    slider.className = "slider";

    attraction.images.forEach(imgSrc => {
        const img = document.createElement("img");
        img.src = imgSrc;
        img.onerror = () => {
            img.setAttribute("data-ignore", "true");
            img.remove();
        };
        slider.appendChild(img);
    });


    carousel.appendChild(slider);
    attractionContainer.appendChild(carousel);

    const bookingDiv = document.createElement("div");
    bookingDiv.className = "attraction_container_booking";
    bookingDiv.innerHTML = `
        <h2>${attraction.name}</h2>
        <div class="attraction_category">
            <p class="category">${attraction.category}</p><p>&nbsp;at&nbsp;</p><p class="mrt">${attraction.mrt}</p>
        </div>
        <div class="attraction_board">
            <h3>訂購導覽行程</h3>
            <p>以此景點為中心的一日行程，帶您探索城市角落故事</p>
            <div class="input-group">
                <h3>選擇日期：</h3>
                <input type="date">
            </div>
            <div class="input-group">
                <h3>選擇時間：</h3>
                <label class="custom-radio">
                <input type="radio" name="time" value="上半天" checked/>
                <span class="radio-mark"></span>
                <span class="radio-label">
                    <span class="radio-text">上半天</span>
                </span>
                <label class="custom-radio">
                <input type="radio" name="time" value="下半天" />
                <span class="radio-mark"></span>
                <span class="radio-label">
                    <span class="radio-text">下半天</span>
                </span>
                </label>
            </div>
            <div class="input-group">
            <h3>導覽費用：</h3><p>新台幣</p><p id="tour-price">--</p><p>元</p>
            </div>
            <button class="book">開始預約行程</button>
        </div>
    `;
    attractionContainer.appendChild(bookingDiv);

    const timeRadios = bookingDiv.querySelectorAll('input[name="time"]');
    const tourPriceP = bookingDiv.querySelector('#tour-price');
    
    tourPriceP.textContent = '2000';

    timeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.value === '上半天') {
        tourPriceP.textContent = '2000';
        } else {
        tourPriceP.textContent = '2500';
        }
    });
    });

    const intro = document.querySelector(".attraction_intro");
    const address = document.querySelector(".attraction_address");
    const mrt = document.querySelector(".attraction_mrt");

    intro.textContent = attraction.description;
    address.innerHTML += attraction.address;
    mrt.innerHTML += attraction.transport;

    setupCarousel();
}

function setupCarousel() {
    const sliderEl = document.querySelector(".slider");
    const leftBtn = document.querySelector(".all_btn_container .btn_container:first-child img");
    const rightBtn = document.querySelector(".all_btn_container .btn_container:last-child img");
    const imgs = sliderEl.querySelectorAll("img:not([data-ignore])");
    const imgCounts = imgs.length;
  
    if (imgCounts === 0) return;
  
    const slideProps = { index: 0 };
    const slideProxy = new Proxy(slideProps, {
      set(obj, prop, value) {
        if (prop === "index") {
          if (value < 0 || value >= imgCounts) return;
          obj[prop] = value;
          scrollToImage(value);
          updateDots(value);
        }
      }
    });
  
    const dotContainer = document.createElement("div");
    dotContainer.className = "carousel-dots-wrapper";
    
    const dotContainer2 = document.createElement("div");
    dotContainer2.className = "carousel-dots";
    
    dotContainer.appendChild(dotContainer2); 
    
    const dots = [];
    for (let i = 0; i < imgCounts; i++) {
      const dot = document.createElement("img");
      dot.src = i === 0
        ? "/static/img/icon/Union.png"
        : "/static/img/icon/circle default 1.png";
      dot.addEventListener("click", () => {
        slideProxy.index = i;
      });
      dotContainer2.appendChild(dot); 
      dots.push(dot);
    }
  
    sliderEl.parentElement.appendChild(dotContainer); 
  
    leftBtn.addEventListener("click", () => {
      slideProxy.index -= 1;
    });
    rightBtn.addEventListener("click", () => {
      slideProxy.index += 1;
    });
  
    function scrollToImage(index) {
      const target = imgs[index];
      if (target) {
        target.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      }
    }
  
    function updateDots(current) {
      dots.forEach((dot, i) => {
        dot.src = i === current
          ? "/static/img/icon/Union.png"
          : "/static/img/icon/circle default 1.png";
      });
    }

    function debounce(fn, delay = 200) {
        let timer;
        return (...args) => {
          clearTimeout(timer);
          timer = setTimeout(() => fn(...args), delay);
        };
      }
      
      window.addEventListener("resize", debounce(() => {
        scrollToImage(slideProps.index);
      }, 200));
      
  }