let nextPage = 0;
let isLoading = false;
let currentKeyword = null; 

const attractionID = window.location.pathname.split("/").pop();

document.addEventListener("DOMContentLoaded", () => {
    loadMRTs();
    setupListbarScroll();
    setupSearchEvents();
    setupLoginDialogue();
    checkAuthStatus();

    const isAttractionPage = window.location.pathname.startsWith("/attraction");
    const isBookingPage = window.location.pathname.startsWith("/booking");

    if (isAttractionPage) {
        fetchAttractionID();
    } else if (isBookingPage) {
        const token = localStorage.getItem("token");
        if (!token) {
            
            document.querySelector("footer")?.classList.add("no-booking");
            setTimeout(() => {
                document.querySelector(".login")?.click();
            }, 0);
        } else {
            handleBookingPage();  
        }
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
                <span class="radio-label"><span class="radio-text">上半天</span></span>
                </label>
                <label class="custom-radio">
                <input type="radio" name="time" value="下半天" />
                <span class="radio-mark"></span>
                <span class="radio-label"><span class="radio-text">下半天</span></span>
                </label>
            </div>
            <div class="input-group">
                <h3>導覽費用：</h3><p>新台幣</p><p class="tour-price">--</p><p>元</p>
            </div>
            <button class="book">開始預約行程</button>
        </div>
    `;
    attractionContainer.appendChild(bookingDiv);

    const tourPriceP = bookingDiv.querySelector(".tour-price");
    tourPriceP.textContent = '2000';

    const timeRadios = bookingDiv.querySelectorAll('input[name="time"]');
    timeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            tourPriceP.textContent = radio.value === '上半天' ? '2000' : '2500';
        });
    });

    const bookBtn = bookingDiv.querySelector(".book");
    console.log("book btn綁定", bookBtn);

    bookBtn.addEventListener("click", async () => {
        const dateInput = bookingDiv.querySelector("input[type='date']");
        const selectDate = dateInput.value;
        const selectTime = bookingDiv.querySelector("input[name='time']:checked")?.value;
        const price = parseInt(tourPriceP.textContent);
        const attractionId = parseInt(attraction.id);  

        const token = localStorage.getItem("token");
        if (!token) {

            localStorage.setItem("pendingBooking", JSON.stringify({
                attractionId,
                selectDate,
                selectTime,
                price}));

            document.querySelector(".login_dialogue").classList.add("active");
            document.querySelector(".mask").classList.add("active");
            return;
        }

        if (!selectDate || !selectTime || !price || !attractionId) {
            alert("您的預定行程資訊未填寫完整");
            return;
        }

        try {
            const res = await fetch("/api/booking", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    price,
                    attractionId,
                    date: selectDate,
                    time: selectTime === "上半天" ? "morning" : "afternoon",
                })
            });

            const data = await res.json();
            if (res.ok && data.ok) {
                window.location.href = "/booking";
            } else {
                alert(data.message || "預約失敗，請重新預約");
            }
        } 
        catch (error) {
            console.error("發生了問題", error);
            alert("伺服器發生錯誤，請稍後再試");
        }
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

  function setupLoginDialogue() {
    const mask = document.querySelector(".mask");
    const login = document.querySelector(".login"); 
    const loginDialogue = document.querySelector(".login_dialogue");
    const closeBtn = document.querySelector(".close img");
    const switchToSignup = document.querySelector(".switch-to-signup");
    const switchToLogin = document.querySelector(".switch-to-login");
    const formLogin = document.querySelector(".form.login_elements");
    const formSignup = document.querySelector(".form.signup_elements");
    const logoutBtn = document.querySelector(".logout");

    
    login.addEventListener("click", (e) => {
        e.preventDefault();
        mask.classList.add("active");
        loginDialogue.classList.add("active");
    });

    closeBtn.addEventListener("click", closeLoginDialog);
    mask.addEventListener("click", closeLoginDialog);

    function closeLoginDialog() {
        mask.classList.remove("active");
        loginDialogue.classList.remove("active");
    }

    switchToSignup.addEventListener("click", () => {
        formLogin.classList.remove("active");
        formSignup.classList.add("active");
    });

    switchToLogin.addEventListener("click", () => {
        formSignup.classList.remove("active");
        formLogin.classList.add("active");
    });

    document.querySelector(".signin-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        signin();
    });

    document.querySelector(".signup-btn")?.addEventListener("click", (e) => {
        e.preventDefault();
        signup();
    });

    logoutBtn?.addEventListener("click", () => {
        logout("manual");
    });
}


async function signin() {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const errorDiv = document.getElementById("login-error");
    errorDiv.textContent = "";

    if (!email || !password) {
        errorDiv.textContent = "請填寫帳號與密碼";
        return;
    }

    try {
        const res = await fetch("/api/user/auth", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            errorDiv.textContent = data.message || "登入失敗";
            return;
        }

        const token = data.token;
        localStorage.setItem("token", token);

        const verifyRes = await fetch("/api/user/auth", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok) {
            
            const pendingBooking = JSON.parse(localStorage.getItem("pendingBooking"));
            if (pendingBooking && window.location.pathname.startsWith("/attraction/")) {
                localStorage.setItem("restoreBooking", JSON.stringify(pendingBooking));
                localStorage.removeItem("pendingBooking");
            }

            document.querySelector(".login_dialogue").classList.remove("active");
            document.querySelector(".mask").classList.remove("active");

            window.location.reload(); 
        } else {
            console.error("登入驗證失敗：", verifyData);
            errorDiv.textContent = "登入驗證失敗，請稍後再試";
        }

    } catch (err) {
        console.error("登入錯誤", err);
        errorDiv.textContent = "登入過程發生錯誤";
    }
}

async function signup() {
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();  
    const password = document.getElementById("signup-password").value.trim();

    const errorDiv = document.getElementById("signup-error");
    errorDiv.textContent = "";

    console.log("email欄位綁定", email);

    if (!name || !email || !password) {
        errorDiv.textContent = "請填寫姓名、帳號與密碼";
        return;
    }

    try {
        const res = await fetch("/api/user", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();
        if (!res.ok) {
            errorDiv.textContent = "註冊失敗";
            return;
        }
        alert("註冊成功！");
        window.location.reload();
        } catch (err) {
        console.error("註冊錯誤", err);
        errorDiv.textContent = "註冊過程發生錯誤";
    }
}

async function checkAuthStatus() {
    const token = localStorage.getItem("token");
    const loginBtn = document.querySelector(".login");
    const logoutBtn = document.querySelector(".logout");

    if (!loginBtn || !logoutBtn) return;

    if (!token) {
        loginBtn.style.display = "flex";
        logoutBtn.style.display = "none";
    }

    try {
        const res = await fetch("/api/user/auth", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (res.ok && data.data) {
            loginBtn.style.display = "none";
            logoutBtn.style.display = "flex";
        } else {
            localStorage.removeItem("token");
            loginBtn.style.display = "flex";
            logoutBtn.style.display = "none";
        }
    } catch (error) {
        console.error("checkAuthStatus有誤", error);
        localStorage.removeItem("token");
        loginBtn.style.display = "flex";
        logoutBtn.style.display = "none";
    }
}

function logout(reason = "manual") {
    localStorage.removeItem("token");
    if (reason === "manual") {
        alert("已成功登出！");
    } else if (reason === "expired") {
        alert("登入已過期，請重新登入。");
    }
    window.location.reload();
}

async function fetchBooking() {
    const token = localStorage.getItem("token");
    if (!token) return;

    const bookingContainer = document.querySelector(".booking_container");

    try {
        const res = await fetch("/api/booking", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();

        if (!res.ok || !result.data) {
            bookingContainer.innerHTML = `<h3>目前沒有任何待預定的行程</h3>`;
            document.querySelector("footer")?.classList.add("no-booking");
            return;
        }

        const { attraction, date, time, price } = result.data;

        const bookingDiv = document.createElement("div");
        bookingDiv.className = "booking_container_attraction";
        bookingDiv.innerHTML = `
            <img src="${attraction.image}" alt="${attraction.name}">
            <div class="info">
                <h2>台北一日遊：${attraction.name}</h2>
                <div class="date"><strong>日期：</strong><span class="normal">${date}</span></div>
                <div class="time"><strong>時間：</strong><span class="normal">${time === "morning" ? "上半天" : "下半天"}</span></div>
                <div class="price"><strong>費用：</strong><span class="normal">新台幣 ${price} 元</span></div>
                <div class="address"><strong>地點：</strong><span class="normal">${attraction.address}</span></div>
                <img class="delete" src="/static/img/icon/delete.png">
                </div>
            </div>
        `;

        bookingContainer.appendChild(bookingDiv);

        bookingContainer.insertAdjacentHTML("beforeend", `
            <div class="contract">
                <div class="contract_form">
                    <h2>您的預定資訊</h2>
                    <div class="input-group">
                        <label for="name">聯絡姓名：</label>
                        <input type="text" id="contract-name" placeholder="">
                    </div>
                    <div class="input-group">
                        <label for="email">聯絡信箱：</label>
                        <input type="email" id="contract-email" placeholder="">
                    </div>
                    <div class="input-group">
                        <label for="phone">手機號碼：</label>
                        <input type="tel" id="contract-phone" placeholder="">
                    </div>
                    <p class="field-notice">請保持手機暢通，準時到達，導覽人員將用手機與您聯繫，務必留下正確的聯絡方式。</p>
                </div>
            </div>
            <div class="payment">
                <div class="payment_form">
                    <h2>信用卡付款資訊</h2>
                    <div class="input-group">
                        <label for="card">卡片號碼：</label>
                        <input type="text" id="card" placeholder="**** **** **** ****">
                    </div>
                    <div class="input-group">
                        <label for="due">過期時間：</label>
                        <input type="text" id="due" placeholder="MM/YY">
                    </div>
                    <div class="input-group">
                        <label for="csc">驗證密碼：</label>
                        <input type="text" id="csc" placeholder="CVV">
                    </div>
                </div>
            </div>
            <div class="total">
                <h2>總價： <span id="total-price">${price}</span> 元</h2>
            </div>
            <div class="checkout_btn">
                <button>確認訂購並付款</button>
            </div>
        `);

    } catch (error) {
        console.error("⚠️ Fetch Booking Error:", error);
        document.querySelector("footer")?.classList.add("no-booking");
    }
}


document.addEventListener("click", (e) => {
    if (e.target.closest(".delete")) {
      if (!confirm("確定要刪除行程嗎？")) return;
  
      const token = localStorage.getItem("token");
      fetch("/api/booking", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          document.querySelector(".booking_container_attraction")?.remove();
          window.location.reload(); 
        } else {
          alert(data.message || "刪除失敗，請稍後再試");
        }
      })
      .catch(err => console.error("刪除行程失敗", err));
    }
  });
  

  async function handleBookingPage() {
    const token = localStorage.getItem("token");
    if (!token) {
        showLoginDialog();
        document.querySelector("footer")?.classList.add("no-booking");
        return;
    }

    try {
        const res = await fetch("/api/user/auth", {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        if (!res.ok || !data.data || !data.data.name) {
            showLoginDialog();
            document.querySelector("footer")?.classList.add("no-booking");
            return;
        }

        const headlineEl = document.querySelector(".headline");
        if (headlineEl) {
            headlineEl.textContent = `您好，${data.data.name}，待預定的行程如下：`;
        }

        fetchBooking();

    } catch (err) {
        console.error("驗證失敗", err);
        showLoginDialog();
        document.querySelector("footer")?.classList.add("no-booking");
    }
}
